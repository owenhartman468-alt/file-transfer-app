// File Transfer App - Server Code
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

// Important settings
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// File storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: null }
});

// Store files temporarily
const fileStore = new Map();

// Upload API
app.post('/api/upload', upload.array('files'), (req, res) => {
    console.log('📨 Upload request received');

    try {
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please select files to upload'
            });
        }

        console.log(`📁 Files received: ${files.length}`);

        // Generate unique download ID
        const downloadId = generateDownloadId();

        // Store file information
        fileStore.set(downloadId, {
            files: files.map(file => ({
                originalName: file.originalname,
                storedName: file.filename,
                path: file.path,
                size: file.size
            })),
            email: req.body.email,
            message: req.body.message,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

        console.log(`✅ Upload successful: ${downloadId}`);

        res.json({
            success: true,
            downloadId: downloadId,
            message: 'Files uploaded successfully!',
            fileCount: files.length
        });

    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error: ' + error.message
        });
    }
});

// Download files
app.get('/download/:id', (req, res) => {
    try {
        const downloadId = req.params.id;
        const fileData = fileStore.get(downloadId);

        if (!fileData) {
            return res.status(404).send(`
                <html>
                <head><title>File Not Found</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h2>File Not Found</h2>
                    <p>The download link is invalid or has expired.</p>
                    <a href="/">Go Back to Home</a>
                </body>
                </html>
            `);
        }

        // Check if link expired
        if (new Date() > fileData.expiresAt) {
            fileStore.delete(downloadId);
            return res.status(410).send(`
                <html>
                <head><title>Link Expired</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h2>Download Link Expired</h2>
                    <p>This download link has expired (7 days limit).</p>
                    <a href="/">Go Back to Home</a>
                </body>
                </html>
            `);
        }

        // Single file - download directly
        if (fileData.files.length === 1) {
            const file = fileData.files[0];
            res.download(file.path, file.originalName);
        } else {
            // Multiple files - show download page
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Download Files</title>
                    <style>
                        body { font-family: Arial; padding: 40px; background: #f5f5f5; }
                        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .file-item { padding: 15px; border: 1px solid #ddd; margin: 10px 0; border-radius: 5px; }
                        .file-item a { text-decoration: none; color: #007bff; font-weight: bold; }
                        .file-item:hover { background: #f8f9fa; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Download Your Files</h2>
                        <p>Click on the files below to download:</p>
                        ${fileData.files.map(file => `
                            <div class="file-item">
                                <a href="/download-file/${downloadId}/${file.storedName}">${file.originalName}</a>
                                <span style="color: #666; float: right;">${formatFileSize(file.size)}</span>
                            </div>
                        `).join('')}
                        <br>
                        <a href="/">← Share More Files</a>
                    </div>
                </body>
                </html>
            `);
        }

    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Individual file download
app.get('/download-file/:id/:filename', (req, res) => {
    const downloadId = req.params.id;
    const filename = req.params.filename;
    const fileData = fileStore.get(downloadId);

    if (!fileData) return res.status(404).send('File not found');

    const file = fileData.files.find(f => f.storedName === filename);
    if (!file) return res.status(404).send('File not found');

    res.download(file.path, file.originalName);
});

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Test API
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Server is working perfectly!',
        timestamp: new Date().toISOString()
    });
});

// Helper functions
function generateDownloadId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 File Transfer App started successfully!`);
    console.log(`📍 Open your browser and go to: http://localhost:${PORT}`);
    console.log(`📁 Files will be stored in: ${path.join(__dirname, 'uploads')}`);
    console.log(`⏰ Files auto-delete after 7 days`);
});
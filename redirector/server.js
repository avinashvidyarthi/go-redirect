const express = require('express');
const mongoose = require('mongoose');
const Redirect = require('./models/Redirect');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => {
        logger.info('Connected to MongoDB', { service: 'server', database: 'go_redirect' });
    })
    .catch(err => {
        logger.error('MongoDB connection error', { service: 'server', error: err.message });
    });

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        };

        if (res.statusCode >= 400) {
            logger.warn('HTTP request failed', logData);
        } else {
            logger.info('HTTP request', logData);
        }
    });

    next();
});

// Error page HTML
const errorPageHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>404 - Not Found</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 100px; }
        .error { color: #e74c3c; }
    </style>
</head>
<body>
    <h1 class="error">404 - Redirect Not Found</h1>
    <p>The requested slug does not exist.</p>
</body>
</html>
`;

// Main redirect route
app.get('/:slug', async (req, res) => {
    const { slug } = req.params;
    const clientIP = req.ip || req.connection.remoteAddress;

    try {
        const redirect = await Redirect.findOne({ slug: slug.toLowerCase() });

        if (!redirect) {
            logger.warn('Redirect not found', {
                slug: slug.toLowerCase(),
                ip: clientIP,
                userAgent: req.get('User-Agent')
            });
            return res.status(404).send(errorPageHTML);
        }

        // Add protocol if not present
        let url = redirect.url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        logger.info('Successful redirect', {
            slug: slug.toLowerCase(),
            targetUrl: url,
            ip: clientIP,
            userAgent: req.get('User-Agent')
        });

        // Set cache control headers for 5 minutes (300 seconds)
        res.set({
            'Cache-Control': 'public, max-age=300',
            'Expires': new Date(Date.now() + 300000).toUTCString()
        });

        res.redirect(301, url);
    } catch (error) {
        logger.error('Redirect error', {
            slug: slug.toLowerCase(),
            error: error.message,
            stack: error.stack,
            ip: clientIP
        });
        res.status(500).send(errorPageHTML);
    }
});

// Root route - list all redirects
app.get('/', async (req, res) => {
    try {
        const redirects = await Redirect.find().sort({ slug: 1 });

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Go Redirect Service</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 800px; 
            margin: 50px auto; 
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #333; text-align: center; }
        .redirect-item { 
            padding: 10px; 
            margin: 5px 0; 
            background: #f8f9fa; 
            border-left: 4px solid #007bff;
            border-radius: 4px;
        }
        .slug { font-weight: bold; color: #007bff; }
        .arrow { color: #6c757d; margin: 0 10px; }
        .url { color: #28a745; }
        .empty { text-align: center; color: #6c757d; font-style: italic; }
        .footer { text-align: center; margin-top: 30px; color: #6c757d; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Go Redirect Service</h1>
        ${redirects.length === 0 ?
                '<p class="empty">No redirects configured yet. Use the CLI to add some!</p>' :
                `<p>Available redirects (${redirects.length}):</p>
            ${redirects.map(redirect =>
                    `<div class="redirect-item">
                    <span class="slug">go/${redirect.slug}</span>
                    <span class="arrow">→</span>
                    <span class="url">${redirect.url}</span>
                </div>`
                ).join('')}`
            }
        <div class="footer">
            <p>Add new redirects using: <code>go-redirect</code> CLI</p>
        </div>
    </div>
</body>
</html>
        `;

        logger.info('Root page accessed', {
            redirectCount: redirects.length,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });

        res.send(html);
    } catch (error) {
        logger.error('Error loading redirects list', {
            error: error.message,
            ip: req.ip || req.connection.remoteAddress
        });
        res.status(500).send('<h1>Error loading redirects</h1>');
    }
});

app.listen(PORT, () => {
    logger.info('Server started', { port: PORT, service: 'go-redirect-server' });
});
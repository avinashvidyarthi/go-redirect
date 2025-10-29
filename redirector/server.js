const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const Redirect = require('./models/Redirect');
const { getCurrentUser } = require('./middleware/auth');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const redirectRoutes = require('./routes/redirects');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key-change-this';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => {
        logger.info('Connected to MongoDB', { service: 'server', database: 'go_redirect' });
    })
    .catch(err => {
        logger.error('MongoDB connection error', { service: 'server', error: err.message });
    });

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        touchAfter: 24 * 3600 // lazy session update
    }),
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
}));

// Add current user to all requests
app.use(getCurrentUser);

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
            ip: req.ip,
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



// Routes
app.use('/', authRoutes);
app.use('/', redirectRoutes);

// Main redirect route - handle /:slug
app.get('/:slug', async (req, res) => {
    const { slug } = req.params;
    const clientIP = req.ip;

    // Skip authentication for login route
    if (slug === 'login') {
        return res.redirect('/login');
    }

    // Require authentication for all redirects
    if (!req.session || !req.session.userId || !req.user || !req.user.isActive) {
        return res.redirect('/login');
    }

    try {
        const redirect = await Redirect.findOne({
            slug: slug.toLowerCase(),
            userId: req.session.userId
        });

        if (!redirect) {
            logger.warn('Redirect not found', {
                slug: slug.toLowerCase(),
                userId: req.session.userId,
                ip: clientIP,
                userAgent: req.get('User-Agent')
            });
            
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>404 - Not Found</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; margin-top: 100px; }
                        .error { color: #e74c3c; }
                        .btn { padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
                    </style>
                </head>
                <body>
                    <h1 class="error">404 - Redirect Not Found</h1>
                    <p>The requested slug "<strong>${slug}</strong>" does not exist in your redirects.</p>
                    <a href="/" class="btn">Back to Dashboard</a>
                </body>
                </html>
            `);
        }

        // Add protocol if not present
        let url = redirect.url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        logger.info('Successful redirect', {
            slug: slug.toLowerCase(),
            targetUrl: url,
            userId: req.session.userId,
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
            userId: req.session.userId,
            error: error.message,
            stack: error.stack,
            ip: clientIP
        });
        
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Server Error</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin-top: 100px; }
                    .error { color: #e74c3c; }
                    .btn { padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
                </style>
            </head>
            <body>
                <h1 class="error">Server Error</h1>
                <p>An error occurred while processing your redirect.</p>
                <a href="/" class="btn">Back to Dashboard</a>
            </body>
            </html>
        `);
    }
});

app.listen(PORT, () => {
    logger.info('Server started', { port: PORT, service: 'go-redirect-server' });
});
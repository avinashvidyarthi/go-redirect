const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const Redirect = require('./models/Redirect');
const User = require('./models/User');
const { requireAuth, getCurrentUser, redirectIfAuthenticated } = require('./middleware/auth');
const logger = require('./utils/logger');

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
        maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
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

// Login page HTML
const loginPageHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Go Redirect - Login</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            background-color: #f5f5f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 400px;
        }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; color: #555; }
        input[type="email"], input[type="password"] {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
            box-sizing: border-box;
        }
        button {
            width: 100%;
            padding: 12px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
        }
        button:hover { background-color: #0056b3; }
        .error { color: #e74c3c; text-align: center; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="login-container">
        <h1>🚀 Go Redirect</h1>
        {{ERROR_MESSAGE}}
        <form method="POST" action="/login">
            <div class="form-group">
                <label for="email">Email:</label>
                <input type="email" id="email" name="email" required>
            </div>
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">Sign In</button>
        </form>
    </div>
</body>
</html>
`;

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

// Login routes
app.get('/login', redirectIfAuthenticated, (req, res) => {
    const errorMessage = req.query.error ? '<div class="error">Invalid email or password</div>' : '';
    const html = loginPageHTML.replace('{{ERROR_MESSAGE}}', errorMessage);
    res.send(html);
});

app.post('/login', redirectIfAuthenticated, async (req, res) => {
    const { email, password } = req.body;
    const clientIP = req.ip;

    try {
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user || !(await user.comparePassword(password))) {
            logger.warn('Failed login attempt', {
                email: email.toLowerCase(),
                ip: clientIP,
                userAgent: req.get('User-Agent'),
                service: 'auth'
            });
            return res.redirect('/login?error=1');
        }

        if (!user.isActive) {
            logger.warn('Inactive user login attempt', {
                userId: user._id,
                email: user.email,
                ip: clientIP,
                userAgent: req.get('User-Agent'),
                service: 'auth'
            });
            return res.redirect('/login?error=1');
        }

        req.session.userId = user._id;

        logger.info('Successful login', {
            userId: user._id,
            email: user.email,
            ip: clientIP,
            userAgent: req.get('User-Agent'),
            service: 'auth'
        });

        res.redirect('/');
    } catch (error) {
        logger.error('Login error', {
            email: email.toLowerCase(),
            error: error.message,
            ip: clientIP,
            service: 'auth'
        });
        res.redirect('/login?error=1');
    }
});

// Logout route
app.post('/logout', (req, res) => {
    if (req.session) {
        logger.info('User logged out', {
            userId: req.session.userId,
            ip: req.ip,
            service: 'auth'
        });
        req.session.destroy();
    }
    res.redirect('/login');
});

// Main redirect route
app.get('/:slug', async (req, res) => {
    const { slug } = req.params;
    const clientIP = req.ip;

    // Skip authentication for login route
    if (slug === 'login') {
        return res.redirect('/login');
    }

    // Require authentication for all redirects
    if (!req.session || !req.session.userId) {
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
        res.status(500).send(errorPageHTML);
    }
});

// Root route - list user's redirects (protected)
app.get('/', requireAuth, async (req, res) => {
    try {
        const redirects = await Redirect.find({ userId: req.user._id }).sort({ slug: 1 });

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
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
        }
        h1 { color: #333; margin: 0; }
        .user-info { color: #6c757d; font-size: 14px; }
        .logout-btn {
            background: #dc3545;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            font-size: 14px;
        }
        .logout-btn:hover { background: #c82333; }
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
        <div class="header">
            <div>
                <h1>🚀 Go Redirect Service</h1>
                <div class="user-info">Welcome, ${req.user.name}</div>
            </div>
            <form method="POST" action="/logout" style="margin: 0;">
                <button type="submit" class="logout-btn">Logout</button>
            </form>
        </div>
        ${redirects.length === 0 ?
                '<p class="empty">No redirects configured yet. Use the CLI to add some!</p>' :
                `<p>Your redirects (${redirects.length}):</p>
            ${redirects.map(redirect =>
                    `<div class="redirect-item">
                    <span class="slug">go/${redirect.slug}</span>
                    <span class="arrow">→</span>
                    <span class="url">${redirect.url}</span>
                </div>`
                ).join('')}`
            }
    </div>
</body>
</html>
        `;

        logger.info('Root page accessed', {
            redirectCount: redirects.length,
            userId: req.user._id,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.send(html);
    } catch (error) {
        logger.error('Error loading redirects list', {
            error: error.message,
            userId: req.user._id,
            ip: req.ip
        });
        res.status(500).send('<h1>Error loading redirects</h1>');
    }
});

app.listen(PORT, () => {
    logger.info('Server started', { port: PORT, service: 'go-redirect-server' });
});
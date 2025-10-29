const express = require('express');
const User = require('../models/User');
const { redirectIfAuthenticated } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Login page
router.get('/login', redirectIfAuthenticated, (req, res) => {
    res.render('login', { 
        title: 'Login',
        error: req.query.error === '1',
        user: null
    });
});

// Process login
router.post('/login', redirectIfAuthenticated, async (req, res) => {
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

// Logout
router.post('/logout', (req, res) => {
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

module.exports = router;
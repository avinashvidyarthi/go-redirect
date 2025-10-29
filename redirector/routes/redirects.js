const express = require('express');
const Redirect = require('../models/Redirect');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Dashboard - list user's redirects
router.get('/', async (req, res) => {
    try {
        const redirects = await Redirect.find({ userId: req.user._id }).sort({ slug: 1 });

        logger.info('Dashboard accessed', {
            redirectCount: redirects.length,
            userId: req.user._id,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.render('dashboard', {
            title: 'Dashboard',
            user: req.user,
            redirects: redirects,
            message: req.session.message || null
        });

        // Clear message after displaying
        delete req.session.message;
    } catch (error) {
        logger.error('Error loading dashboard', {
            error: error.message,
            userId: req.user._id,
            ip: req.ip
        });
        res.status(500).send('Error loading dashboard');
    }
});

// Show new redirect form
router.get('/redirects/new', (req, res) => {
    res.render('redirect-form', {
        title: 'Add New Redirect',
        user: req.user,
        isEdit: false,
        redirect: null,
        error: null
    });
});

// Create new redirect
router.post('/redirects', async (req, res) => {
    const { slug, url } = req.body;

    try {
        const redirect = new Redirect({
            slug: slug.trim().toLowerCase(),
            url: url.trim(),
            userId: req.user._id
        });

        await redirect.save();

        logger.info('Redirect created via web', {
            action: 'create',
            slug: redirect.slug,
            url: redirect.url,
            userId: req.user._id,
            ip: req.ip,
            service: 'web'
        });

        req.session.message = {
            type: 'success',
            text: `Redirect created: go/${redirect.slug} → ${redirect.url}`
        };

        res.redirect('/');
    } catch (error) {
        logger.error('Error creating redirect', {
            action: 'create',
            slug: slug.trim().toLowerCase(),
            userId: req.user._id,
            error: error.message,
            service: 'web'
        });

        let errorMessage = 'Error creating redirect';
        if (error.code === 11000) {
            errorMessage = 'Slug already exists for your account';
        }

        res.render('redirect-form', {
            title: 'Add New Redirect',
            user: req.user,
            isEdit: false,
            redirect: { slug, url },
            error: errorMessage
        });
    }
});

// Show edit redirect form
router.get('/redirects/:id/edit', async (req, res) => {
    try {
        const redirect = await Redirect.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!redirect) {
            req.session.message = {
                type: 'danger',
                text: 'Redirect not found'
            };
            return res.redirect('/');
        }

        res.render('redirect-form', {
            title: 'Edit Redirect',
            user: req.user,
            isEdit: true,
            redirect: redirect,
            error: null
        });
    } catch (error) {
        logger.error('Error loading redirect for edit', {
            redirectId: req.params.id,
            userId: req.user._id,
            error: error.message,
            service: 'web'
        });

        req.session.message = {
            type: 'danger',
            text: 'Error loading redirect'
        };
        res.redirect('/');
    }
});

// Update redirect
router.post('/redirects/:id', async (req, res) => {
    const { slug, url } = req.body;

    try {
        const redirect = await Redirect.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!redirect) {
            req.session.message = {
                type: 'danger',
                text: 'Redirect not found'
            };
            return res.redirect('/');
        }

        const oldSlug = redirect.slug;
        const oldUrl = redirect.url;

        redirect.slug = slug.trim().toLowerCase();
        redirect.url = url.trim();
        await redirect.save();

        logger.info('Redirect updated via web', {
            action: 'update',
            redirectId: redirect._id,
            oldSlug: oldSlug,
            newSlug: redirect.slug,
            oldUrl: oldUrl,
            newUrl: redirect.url,
            userId: req.user._id,
            ip: req.ip,
            service: 'web'
        });

        req.session.message = {
            type: 'success',
            text: `Redirect updated: go/${redirect.slug} → ${redirect.url}`
        };

        res.redirect('/');
    } catch (error) {
        logger.error('Error updating redirect', {
            action: 'update',
            redirectId: req.params.id,
            userId: req.user._id,
            error: error.message,
            service: 'web'
        });

        let errorMessage = 'Error updating redirect';
        if (error.code === 11000) {
            errorMessage = 'Slug already exists for your account';
        }

        // Reload the form with error
        try {
            const redirect = await Redirect.findOne({
                _id: req.params.id,
                userId: req.user._id
            });

            res.render('redirect-form', {
                title: 'Edit Redirect',
                user: req.user,
                isEdit: true,
                redirect: { ...redirect.toObject(), slug, url },
                error: errorMessage
            });
        } catch (loadError) {
            req.session.message = {
                type: 'danger',
                text: errorMessage
            };
            res.redirect('/');
        }
    }
});

// Delete redirect
router.post('/redirects/:id/delete', async (req, res) => {
    try {
        const redirect = await Redirect.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!redirect) {
            req.session.message = {
                type: 'danger',
                text: 'Redirect not found'
            };
            return res.redirect('/');
        }

        await Redirect.deleteOne({ _id: req.params.id, userId: req.user._id });

        logger.info('Redirect deleted via web', {
            action: 'delete',
            redirectId: req.params.id,
            slug: redirect.slug,
            url: redirect.url,
            userId: req.user._id,
            ip: req.ip,
            service: 'web'
        });

        req.session.message = {
            type: 'success',
            text: `Redirect deleted: go/${redirect.slug}`
        };

        res.redirect('/');
    } catch (error) {
        logger.error('Error deleting redirect', {
            action: 'delete',
            redirectId: req.params.id,
            userId: req.user._id,
            error: error.message,
            service: 'web'
        });

        req.session.message = {
            type: 'danger',
            text: 'Error deleting redirect'
        };
        res.redirect('/');
    }
});

module.exports = router;
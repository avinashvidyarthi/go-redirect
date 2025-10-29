const User = require('../models/User');
const logger = require('../utils/logger');

// Check if user is authenticated and active
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId && req.user && req.user.isActive) {
    return next();
  } else {
    logger.info('Unauthorized access attempt', {
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      hasSession: !!(req.session && req.session.userId),
      hasUser: !!req.user,
      isActive: req.user ? req.user.isActive : false,
      service: 'auth'
    });
    return res.redirect('/login');
  }
};

// Get current user
const getCurrentUser = async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).select('-password');
      if (user && user.isActive) {
        req.user = user;
      } else {
        // User is inactive or doesn't exist, destroy session
        req.session.destroy();
        req.user = null;
      }
    } catch (error) {
      logger.error('Error fetching current user', {
        userId: req.session.userId,
        error: error.message,
        service: 'auth'
      });
      req.session.destroy();
      req.user = null;
    }
  }
  next();
};

// Redirect authenticated users away from login page
const redirectIfAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  next();
};

module.exports = {
  requireAuth,
  getCurrentUser,
  redirectIfAuthenticated
};
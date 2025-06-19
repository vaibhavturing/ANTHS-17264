// src/middleware/csrf.middleware.js
const crypto = require('crypto');

const csrfProtection = (req, res, next) => {
  // Skip for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Validate CSRF token for state-changing operations
  const csrfToken = req.headers['x-csrf-token'];
  const sessionToken = req.session.csrfToken;
  
  if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
};

const generateToken = (req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  
  // Expose CSRF token to frontend
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

module.exports = { csrfProtection, generateToken };
/**
 * Static Assets Middleware
 * Configures Express to serve static assets with proper caching
 * Integrates with CDN for production environments
 */

const express = require('express');
const path = require('path');
const compression = require('compression');
const cdnService = require('../config/cdn.config');
const logger = require('../utils/logger');

/**
 * Configure static assets middleware
 * @param {Object} app - Express app instance
 * @param {Object} options - Configuration options
 */
const configureStaticAssets = (app, options = {}) => {
  // Default options
  const config = {
    assetsPath: options.assetsPath || 'public',
    maxAge: options.maxAge || '1d',
    setHeaders: options.setHeaders || null
  };
  
  // Compress all responses
  app.use(compression());
  
  // Custom headers for static files
  const setCustomCacheHeaders = (res, filePath) => {
    // Set cache control header based on file type
    res.setHeader('Cache-Control', cdnService.getCacheControlHeader(filePath));
    
    // Set ETag for caching
    if (!res.getHeader('ETag')) {
      const fileName = path.basename(filePath);
      res.setHeader('ETag', `"${fileName}"`);
    }
    
    // Set additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Call custom header setter if provided
    if (typeof config.setHeaders === 'function') {
      config.setHeaders(res, filePath);
    }
  };
  
  // Configure static serving middleware
  const staticMiddleware = express.static(path.resolve(process.cwd(), config.assetsPath), {
    maxAge: config.maxAge,
    etag: true,
    lastModified: true,
    setHeaders: setCustomCacheHeaders
  });
  
  // Apply middleware
  app.use('/assets', staticMiddleware);
  
  // Set CSP header for enhanced security while allowing CDN
  app.use((req, res, next) => {
    // Only set CSP for HTML responses
    res.on('header', () => {
      const contentType = res.getHeader('Content-Type');
      
      if (contentType && contentType.includes('text/html')) {
        // Allow resources from CDN
        const cdnHost = cdnService.isEnabled() ? cdnService.getBaseUrl() : '';
        
        let cspDirectives = [
          "default-src 'self'",
          `script-src 'self' ${cdnHost} 'unsafe-inline' 'unsafe-eval'`,
          `style-src 'self' ${cdnHost} 'unsafe-inline'`,
          `img-src 'self' ${cdnHost} data: blob:`,
          `font-src 'self' ${cdnHost}`,
          "object-src 'none'",
          "base-uri 'self'",
          `connect-src 'self' ${cdnHost}`
        ];
        
        // Set CSP header
        res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
      }
    });
    
    next();
  });
  
  // Set resource hints for critical assets in HTML responses
  app.use((req, res, next) => {
    // Add helper for templates to generate resource hints
    res.locals.getResourceHints = (resources, type) => 
      cdnService.getResourceHints(resources, type);
    
    // Add helper for templates to generate asset URLs
    res.locals.getAssetUrl = (path, options) => 
      cdnService.getAssetUrl(path, options);
    
    // Add helper for templates to generate image URLs
    res.locals.getImageUrl = (path, options) => 
      cdnService.getImageUrl(path, options);
    
    next();
  });
  
  logger.info(`Static assets configured: /${config.assetsPath} → /assets`);
  if (cdnService.isEnabled()) {
    logger.info(`CDN enabled: ${cdnService.getBaseUrl()}`);
  }
};

module.exports = configureStaticAssets;
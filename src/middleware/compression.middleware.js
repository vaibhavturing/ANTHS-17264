/**
 * Healthcare Management Application
 * Compression Middleware
 * 
 * Sets up response compression for improved performance
 */

const compression = require('compression');

/**
 * Configure response compression
 * @returns {Function} Configured compression middleware
 */
const compressionMiddleware = () => {
  // Only compress responses larger than 1KB
  return compression({
    level: 6, // Default compression level
    threshold: 1024, // Min size to compress (1KB)
    filter: (req, res) => {
      // Don't compress responses for requests that include
      // the 'x-no-compression' header
      if (req.headers['x-no-compression']) {
        return false;
      }
      
      // Use compression filter function from the module
      return compression.filter(req, res);
    }
  });
};

module.exports = compressionMiddleware;
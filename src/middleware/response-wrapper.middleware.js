// src/middleware/response-wrapper.middleware.js

/**
 * Middleware to wrap all responses in a consistent format
 * Used to ensure all API responses follow the standard structure
 */

const { StatusCodes } = require('http-status-codes');
const ApiResponse = require('../utils/response.util');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Create a middleware that wraps all responses in a standard format
 * @param {Object} options - Configuration options
 * @returns {function} Express middleware
 */
function responseWrapper(options = {}) {
  return function(req, res, next) {
    // Store the original res.json and res.send methods
    const originalJson = res.json;
    const originalSend = res.send;
    const originalStatus = res.status;
    
    // Helper to check if wrapping should be skipped
    const skipWrapping = () => {
      // Skip paths specified in options
      if (options.excludePaths && options.excludePaths.some(path => req.path.startsWith(path))) {
        return true;
      }
      
      // Skip based on headers
      if (req.headers['x-raw-response'] === 'true') {
        return true;
      }
      
      return false;
    };
    
    // Skip wrapping for explicitly excluded paths or specialized endpoints
    if (skipWrapping()) {
      return next();
    }
    
    // Track if response was sent through our ApiResponse utility
    let usedApiResponse = false;
    
    // Override res.json method
    res.json = function(data) {
      // If response already handled or status >= 400, don't wrap
      if (usedApiResponse || res.statusCode >= 400) {
        return originalJson.call(this, data);
      }
      
      // Don't wrap null responses (like 204 No Content)
      if (data === null || data === undefined) {
        return originalJson.call(this, data);
      }
      
      // Don't double-wrap responses
      if (data && (data.success !== undefined || data.error !== undefined)) {
        // Already in our format, just send it
        return originalJson.call(this, data);
      }
      
      // Handle paginated responses
      if (data && data.pagination && Array.isArray(data.data)) {
        usedApiResponse = true;
        return ApiResponse.paginated(
          res, 
          data.data, 
          data.pagination, 
          options.defaultMessages?.list || 'Data retrieved successfully'
        );
      }
      
      // Regular success response
      usedApiResponse = true;
      return ApiResponse.success(
        res,
        data,
        getSuccessMessage(req, res.statusCode, options),
        res.statusCode
      );
    };
    
    // Override send to handle non-JSON responses
    res.send = function(body) {
      // If already handled or not JSON, pass through
      if (usedApiResponse || typeof body !== 'object') {
        return originalSend.call(this, body);
      }
      
      // For objects, use our modified json method
      return res.json(body);
    };
    
    // Override status to track HTTP status codes
    res.status = function(code) {
      // Call original method
      originalStatus.call(this, code);
      return this;
    };
    
    // Add convenience methods for standard responses
    
    res.success = function(data = null, message = undefined, statusCode = StatusCodes.OK, options = {}) {
      usedApiResponse = true;
      return ApiResponse.success(res, data, message || getSuccessMessage(req, statusCode, options), statusCode, options);
    };
    
    res.created = function(data = null, message = undefined, options = {}) {
      usedApiResponse = true;
      return ApiResponse.created(
        res, 
        data, 
        message || options.defaultMessages?.created || 'Resource created successfully',
        options
      );
    };
    
    res.noContent = function() {
      usedApiResponse = true;
      return ApiResponse.noContent(res);
    };
    
    res.paginated = function(data, pagination, message = undefined, options = {}) {
      usedApiResponse = true;
      return ApiResponse.paginated(
        res, 
        data, 
        pagination, 
        message || options.defaultMessages?.list || 'Data retrieved successfully',
        options
      );
    };
    
    next();
  };
}

/**
 * Get appropriate success message based on request method and status
 * @param {Object} req - Express request object
 * @param {number} statusCode - HTTP status code
 * @param {Object} options - Configuration options with default messages
 * @returns {string} Success message
 */
function getSuccessMessage(req, statusCode, options = {}) {
  const messages = {
    ...options.defaultMessages
  };
  
  const method = req.method.toUpperCase();
  const resourceName = getResourceName(req.path);
  
  if (statusCode === StatusCodes.CREATED) {
    return messages.created || `${resourceName} created successfully`;
  }
  
  if (statusCode === StatusCodes.NO_CONTENT) {
    return null;
  }
  
  switch (method) {
    case 'GET':
      if (req.params && Object.keys(req.params).length > 0) {
        return messages.retrieve || `${resourceName} retrieved successfully`;
      }
      return messages.list || `${resourceName} list retrieved successfully`;
      
    case 'POST':
      return messages.created || `${resourceName} created successfully`;
      
    case 'PUT':
      return messages.update || `${resourceName} updated successfully`;
      
    case 'PATCH':
      return messages.update || `${resourceName} updated successfully`;
      
    case 'DELETE':
      return messages.delete || `${resourceName} deleted successfully`;
      
    default:
      return messages.default || 'Operation successful';
  }
}

/**
 * Extract resource name from path for use in messages
 * @param {string} path - Request path
 * @returns {string} Resource name
 */
function getResourceName(path) {
  // Remove API version prefix if present
  let cleanPath = path;
  if (cleanPath.includes(`/api/${config.apiVersion}/`)) {
    cleanPath = cleanPath.split(`/api/${config.apiVersion}/`)[1];
  }
  
  // Get the first part of the path
  const parts = cleanPath.split('/').filter(p => p);
  if (parts.length === 0) return 'Resource';
  
  // Convert to title case and singular form
  const resource = parts[0];
  const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;
  
  // Title case: convert first character to uppercase
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}

module.exports = responseWrapper;
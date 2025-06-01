// src/utils/response.util.js

/**
 * Enhanced version with comprehensive API response utilities
 * 
 * Changes from previous version:
 * - Added detailed documentation
 * - Added options parameter for more flexible responses
 * - Added cache control and ETag support
 * - Added error method to standardize error responses
 * - Added multiple response types (accepted, partialContent, etc.)
 * - Enhanced pagination response with more options
 * - Added metadata support for all response types
 */

const { StatusCodes, ReasonPhrases } = require('http-status-codes');
const config = require('../config/config');
const logger = require('./logger');

/**
 * Utility class for standardized API responses
 * Ensures consistent response format across the application
 */
class ApiResponse {
  /**
   * Create a success response
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code
   * @param {Object} options - Additional response options
   * @returns {Object} Express response
   */
  static success(
    res,
    data = null,
    message = 'Operation successful',
    statusCode = StatusCodes.OK,
    options = {}
  ) {
    // Build the response body
    const response = {
      success: true,
      message
    };
    
    // Add data if provided
    if (data !== null) {
      response.data = data;
    }
    
    // Add metadata if provided
    if (options.metadata) {
      response.metadata = options.metadata;
    }
    
    // Set response headers if provided
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        res.set(key, value);
      });
    }
    
    // Set cache control headers
    if (options.cache === 'no-cache') {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    } else if (options.cache === 'public') {
      res.set('Cache-Control', `public, max-age=${options.maxAge || 300}`);  // Default 5 minutes
    } else if (options.cache === 'private') {
      res.set('Cache-Control', `private, max-age=${options.maxAge || 60}`);  // Default 1 minute
    }
    
    // Set ETag if provided
    if (options.etag) {
      res.set('ETag', options.etag);
    }

    // Log response info if enabled
    if (config.logging?.logResponses) {
      logger.debug(`Response: ${statusCode} ${message}`);
    }
    
    return res.status(statusCode).json(response);
  }
  
  /**
   * Create a response for created resource
   * @param {Object} res - Express response object
   * @param {*} data - Created resource data
   * @param {string} message - Success message
   * @param {Object} options - Additional response options
   * @returns {Object} Express response
   */
  static created(
    res,
    data = null,
    message = 'Resource created successfully',
    options = {}
  ) {
    // Set Location header if resourceUrl is provided
    if (data && data._id && !options.headers?.Location) {
      const baseUrl = `${res.req?.protocol}://${res.req?.get('host')}`;
      const resourceUrl = `${baseUrl}/api/${config.apiVersion}/${options.resourcePath || res.req?.path}/${data._id}`;
      
      if (!options.headers) options.headers = {};
      options.headers.Location = resourceUrl;
    }
    
    return ApiResponse.success(res, data, message, StatusCodes.CREATED, options);
  }
  
  /**
   * Create a response for accepted but not yet processed request
   * @param {Object} res - Express response object
   * @param {*} data - Optional task details or tracking information
   * @param {string} message - Success message
   * @param {Object} options - Additional response options
   * @returns {Object} Express response
   */
  static accepted(
    res,
    data = null,
    message = 'Request accepted for processing',
    options = {}
  ) {
    return ApiResponse.success(res, data, message, StatusCodes.ACCEPTED, options);
  }
  
  /**
   * Create a response for no content
   * @param {Object} res - Express response object
   * @param {Object} options - Additional response options
   * @returns {Object} Express response
   */
  static noContent(res, options = {}) {
    // Set headers if provided
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        res.set(key, value);
      });
    }
    
    // Log response if enabled
    if (config.logging?.logResponses) {
      logger.debug(`Response: ${StatusCodes.NO_CONTENT} ${ReasonPhrases.NO_CONTENT}`);
    }
    
    return res.status(StatusCodes.NO_CONTENT).end();
  }
  
  /**
   * Create a response for partial content (e.g., range requests)
   * @param {Object} res - Express response object
   * @param {*} data - Partial data
   * @param {string} message - Success message
   * @param {Object} options - Additional response options including ContentRange
   * @returns {Object} Express response
   */
  static partialContent(
    res,
    data,
    message = 'Partial content retrieved',
    options = {}
  ) {
    // Set Content-Range header if range info is provided
    if (options.range) {
      const { start, end, total } = options.range;
      res.set('Content-Range', `items ${start}-${end}/${total}`);
    }
    
    return ApiResponse.success(res, data, message, StatusCodes.PARTIAL_CONTENT, options);
  }
  
  /**
   * Create a paginated response
   * @param {Object} res - Express response object
   * @param {Array} data - Paginated items
   * @param {Object} pagination - Pagination metadata
   * @param {string} message - Success message
   * @param {Object} options - Additional response options
   * @returns {Object} Express response
   */
  static paginated(
    res,
    data,
    pagination,
    message = 'Data retrieved successfully',
    options = {}
  ) {
    // Calculate pagination details
    const total = pagination.total;
    const page = parseInt(pagination.page) || 1;
    const limit = parseInt(pagination.limit) || 10;
    const pages = Math.ceil(total / limit);
    
    // Build pagination object
    const paginationInfo = {
      total,
      page,
      limit,
      pages
    };
    
    // Add links if needed and request info is available
    if ((page > 1 || page < pages) && res.req) {
      paginationInfo.links = {};
      
      // Build base URL
      const protocol = res.req.headers['x-forwarded-proto'] || res.req.protocol;
      const host = res.req.get('host');
      const baseUrl = `${protocol}://${host}${res.req.path}`;
      
      // Create URL search params from existing query
      const query = new URLSearchParams(res.req.query);
      
      // Previous page link
      if (page > 1) {
        query.set('page', page - 1);
        paginationInfo.links.prev = `${baseUrl}?${query.toString()}`;
      }
      
      // Next page link
      if (page < pages) {
        query.set('page', page + 1);
        paginationInfo.links.next = `${baseUrl}?${query.toString()}`;
      }
      
      // First page link
      if (page > 1) {
        query.set('page', 1);
        paginationInfo.links.first = `${baseUrl}?${query.toString()}`;
      }
      
      // Last page link
      if (page < pages) {
        query.set('page', pages);
        paginationInfo.links.last = `${baseUrl}?${query.toString()}`;
      }
    }
    
    // Add optional filter information
    if (pagination.filters) {
      paginationInfo.filters = pagination.filters;
    }
    
    // Add optional sort information
    if (pagination.sort) {
      paginationInfo.sort = pagination.sort;
    }
    
    // Combine with any other metadata
    const metadata = {
      ...options.metadata,
      pagination: paginationInfo
    };
    
    // Include default cache-control for paginated responses
    const responseOptions = { 
      ...options,
      metadata,
      cache: options.cache || 'private',
      maxAge: options.maxAge || 60
    };
    
    return ApiResponse.success(res, data, message, StatusCodes.OK, responseOptions);
  }
  
  /**
   * Create a standardized error response
   * This is a fallback for directly sending error responses outside the error handler
   * 
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Error code
   * @param {Object} details - Error details
   * @param {Object} options - Additional response options
   * @returns {Object} Express response
   */
  static error(
    res,
    message = 'An error occurred',
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR,
    code = 'ERROR',
    details = undefined,
    options = {}
  ) {
    // Build error response
    const response = {
      success: false,
      error: {
        message,
        code
      }
    };
    
    // Add details if provided and safe to include
    if (details && (process.env.NODE_ENV !== 'production' || statusCode < 500)) {
      response.error.details = details;
    }
    
    // Set headers
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        res.set(key, value);
      });
    }
    
    // Always set no-cache for errors
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    // Log error if enabled and level is appropriate
    if (config.logging?.logResponses) {
      if (statusCode >= 500) {
        logger.error(`Response Error: ${statusCode} ${message}`, { code, details });
      } else {
        logger.warn(`Response Error: ${statusCode} ${message}`, { code });
      }
    }
    
    return res.status(statusCode).json(response);
  }
  
  /**
   * Send a file download response
   * @param {Object} res - Express response object
   * @param {Buffer|Stream} data - File data or stream
   * @param {string} filename - Name of file to download
   * @param {string} mimeType - MIME type of file
   * @param {Object} options - Additional response options
   * @returns {Object} Express response
   */
  static download(
    res,
    data,
    filename,
    mimeType = 'application/octet-stream',
    options = {}
  ) {
    // Set content disposition
    const contentDisposition = options.inline 
      ? `inline; filename="${filename}"` 
      : `attachment; filename="${filename}"`;
    
    // Set headers
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': contentDisposition,
      'Cache-Control': 'no-cache'
    });
    
    // Set additional headers
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        res.set(key, value);
      });
    }
    
    if (Buffer.isBuffer(data)) {
      // Set content length for buffers
      res.set('Content-Length', data.length);
      return res.status(StatusCodes.OK).send(data);
    } else {
      // Stream the data
      return data.pipe(res);
    }
  }
  
  /**
   * Create a response for a change that will be applied but not immediately visible
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @param {Object} options - Additional response options
   * @returns {Object} Express response
   */
  static accepted(
    res,
    data = null,
    message = 'Request has been accepted for processing',
    options = {}
  ) {
    return ApiResponse.success(res, data, message, StatusCodes.ACCEPTED, options);
  }
  
  /**
   * Create a redirect response
   * @param {Object} res - Express response object
   * @param {string} url - Redirect URL
   * @param {number} statusCode - HTTP status code (301 or 302)
   * @returns {Object} Express redirect
   */
  static redirect(
    res,
    url,
    statusCode = StatusCodes.MOVED_TEMPORARILY
  ) {
    // Log redirect if enabled
    if (config.logging?.logResponses) {
      logger.debug(`Response: ${statusCode} Redirecting to ${url}`);
    }
    
    return res.redirect(statusCode, url);
  }
}

module.exports = ApiResponse;
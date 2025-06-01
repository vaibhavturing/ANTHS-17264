// src/utils/response.util.js

const { StatusCodes } = require('http-status-codes');

/**
 * Utility class for standardized API responses
 */
class ApiResponse {
  /**
   * Create a success response
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code
   * @returns {Object} Express response
   */
  static success(res, data = null, message = 'Operation successful', statusCode = StatusCodes.OK) {
    const response = {
      success: true,
      message
    };
    
    if (data !== null) {
      response.data = data;
    }
    
    return res.status(statusCode).json(response);
  }
  
  /**
   * Create a response for created resource
   * @param {Object} res - Express response object
   * @param {*} data - Created resource data
   * @param {string} message - Success message
   * @returns {Object} Express response
   */
  static created(res, data = null, message = 'Resource created successfully') {
    return ApiResponse.success(res, data, message, StatusCodes.CREATED);
  }
  
  /**
   * Create a response for no content
   * @param {Object} res - Express response object
   * @returns {Object} Express response
   */
  static noContent(res) {
    return res.status(StatusCodes.NO_CONTENT).end();
  }
  
  /**
   * Create a paginated response
   * @param {Object} res - Express response object
   * @param {Array} data - Paginated items
   * @param {Object} pagination - Pagination metadata
   * @param {string} message - Success message
   * @returns {Object} Express response
   */
  static paginated(res, data, pagination, message = 'Data retrieved successfully') {
    const response = {
      success: true,
      message,
      data,
      pagination: {
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        pages: Math.ceil(pagination.total / pagination.limit)
      }
    };
    
    // Add links if needed
    if (pagination.page > 1 || pagination.page < response.pagination.pages) {
      response.pagination.links = {};
      
      // Generate the base URL (without query params)
      const baseUrl = `${res.req.protocol}://${res.req.get('host')}${res.req.path}`;
      
      // Create a URLSearchParams object from the request query
      const query = new URLSearchParams(res.req.query);
      
      // Add previous page link if not on first page
      if (pagination.page > 1) {
        query.set('page', pagination.page - 1);
        response.pagination.links.prev = `${baseUrl}?${query.toString()}`;
      }
      
      // Add next page link if not on last page
      if (pagination.page < response.pagination.pages) {
        query.set('page', pagination.page + 1);
        response.pagination.links.next = `${baseUrl}?${query.toString()}`;
      }
    }
    
    return res.status(StatusCodes.OK).json(response);
  }
}

module.exports = ApiResponse;
/**
 * Healthcare Management Application
 * Response Utility
 * 
 * Standardized response format for API endpoints
 */

const { StatusCodes } = require('http-status-codes');

/**
 * Send a success response
 * 
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {String} options.message - Success message
 * @param {Object|Array} options.data - Response data
 * @param {Number} options.statusCode - HTTP status code
 * @param {Object} options.meta - Additional metadata (pagination, etc.)
 * @returns {Object} Express response
 */
const successResponse = (res, options = {}) => {
  const {
    message = 'Operation successful',
    data = {},
    statusCode = StatusCodes.OK,
    meta = {}
  } = options;

  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta
  });
};

/**
 * Send an error response
 * 
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {String} options.message - Error message
 * @param {Number} options.statusCode - HTTP status code
 * @param {Object} options.errors - Validation errors
 * @returns {Object} Express response
 */
const errorResponse = (res, options = {}) => {
  const {
    message = 'An error occurred',
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR,
    errors = null
  } = options;

  const responseBody = {
    success: false,
    message
  };

  if (errors) {
    responseBody.errors = errors;
  }

  return res.status(statusCode).json(responseBody);
};

/**
 * Send a created response (201)
 * 
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {String} options.message - Success message
 * @param {Object} options.data - Created resource data
 * @returns {Object} Express response
 */
const createdResponse = (res, options = {}) => {
  const {
    message = 'Resource created successfully',
    data = {}
  } = options;

  return successResponse(res, {
    message,
    data,
    statusCode: StatusCodes.CREATED
  });
};

/**
 * Send a no content response (204)
 * 
 * @param {Object} res - Express response object
 * @returns {Object} Express response
 */
const noContentResponse = (res) => {
  return res.status(StatusCodes.NO_CONTENT).end();
};

/**
 * Send a pagination response
 * 
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {String} options.message - Success message
 * @param {Array} options.data - Paginated data
 * @param {Number} options.totalCount - Total count of records
 * @param {Number} options.page - Current page
 * @param {Number} options.limit - Page size
 * @returns {Object} Express response
 */
const paginatedResponse = (res, options = {}) => {
  const {
    message = 'Data retrieved successfully',
    data = [],
    totalCount = 0,
    page = 1,
    limit = 10
  } = options;

  const totalPages = Math.ceil(totalCount / limit);
  
  return successResponse(res, {
    message,
    data,
    meta: {
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  });
};

module.exports = {
  successResponse,
  errorResponse,
  createdResponse,
  noContentResponse,
  paginatedResponse
};
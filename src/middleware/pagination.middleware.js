// src/middleware/pagination.middleware.js
/**
 * Middleware for standardized pagination across the application
 * @param {Object} options - Pagination options
 * @returns {Function} Express middleware
 */
const paginationMiddleware = (options = {}) => {
  return (req, res, next) => {
    // Set default pagination parameters
    const defaultLimit = options.defaultLimit || 20;
    const maxLimit = options.maxLimit || 100;
    
    // Parse page and limit from query string
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || defaultLimit;
    
    // Ensure page and limit are positive integers
    page = page > 0 ? page : 1;
    limit = limit > 0 ? limit : defaultLimit;
    
    // Enforce maximum limit to prevent excessive resource usage
    limit = limit <= maxLimit ? limit : maxLimit;
    
    // Calculate skip value for database queries
    const skip = (page - 1) * limit;
    
    // Store pagination info in request object for controllers to use
    req.pagination = {
      page,
      limit,
      skip
    };
    
    // Add a utility function to create pagination metadata
    req.getPaginationMetadata = (totalItems) => {
      const totalPages = Math.ceil(totalItems / limit);
      return {
        total: totalItems,
        page,
        limit,
        pages: totalPages,
        hasMore: page < totalPages
      };
    };
    
    // Continue to the next middleware or controller
    next();
  };
};

module.exports = paginationMiddleware;
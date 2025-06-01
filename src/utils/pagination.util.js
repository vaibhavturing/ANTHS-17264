// src/utils/pagination.util.js

/**
 * Utility for pagination handling in API requests
 * Provides functions for parsing pagination parameters and applying them to queries
 */

const config = require('../config/config');
const { ApiError } = require('./errors');

// Default pagination settings
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;  // Maximum allowed items per page

/**
 * Parse pagination parameters from request query
 * @param {Object} query - Express request query object
 * @param {Object} options - Pagination options
 * @returns {Object} Pagination parameters
 */
function parsePaginationParams(query, options = {}) {
  // Get pagination settings from config or use defaults
  const defaultLimit = options.defaultLimit || config.api?.defaultLimit || DEFAULT_LIMIT;
  const maxLimit = options.maxLimit || config.api?.maxLimit || MAX_LIMIT;
  
  // Parse page and limit
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  
  // Apply defaults and validate
  if (isNaN(page) || page < 1) {
    page = DEFAULT_PAGE;
  }
  
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  } else if (limit > maxLimit) {
    limit = maxLimit;
  }
  
  // Calculate skip for database query
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

/**
 * Parse and validate sorting parameters
 * @param {Object} query - Express request query object
 * @param {Array} allowedFields - Fields that can be sorted
 * @param {string} defaultSort - Default sort field and direction
 * @returns {Object} Sorting parameters
 */
function parseSortParams(query, allowedFields = [], defaultSort = '') {
  if (!query.sort) {
    return defaultSort ? { sort: defaultSort } : {};
  }
  
  // Parse sort field and direction
  const sortParams = query.sort.split(',');
  const validSortItems = [];
  
  for (const sortItem of sortParams) {
    let field = sortItem;
    let direction = 1;  // Default ascending
    
    // Check for descending sort (field prefixed with -)
    if (field.startsWith('-')) {
      field = field.substring(1);
      direction = -1;
    }
    
    // Validate field is allowed to be sorted
    if (allowedFields.length === 0 || allowedFields.includes(field)) {
      validSortItems.push({ [field]: direction });
    }
  }
  
  // Build MongoDB sort object
  if (validSortItems.length === 0) {
    return defaultSort ? { sort: defaultSort } : {};
  }
  
  // Convert to Mongoose-compatible sort object
  const sortObj = {};
  validSortItems.forEach(item => {
    const key = Object.keys(item)[0];
    sortObj[key] = item[key];
  });
  
  return { sort: sortObj, sortFields: Object.keys(sortObj) };
}

/**
 * Parse filter parameters from request query
 * @param {Object} query - Express request query object
 * @param {Object} filterConfig - Configuration for field filtering
 * @returns {Object} Filter parameters for MongoDB query
 */
function parseFilterParams(query, filterConfig = {}) {
  const filter = {};
  const appliedFilters = [];
  
  // Iterate through all query parameters
  for (const [key, value] of Object.entries(query)) {
    // Skip pagination, sorting, and special parameters
    if (['page', 'limit', 'sort', 'fields', 'expand'].includes(key)) {
      continue;
    }
    
    // Skip empty values
    if (value === undefined || value === null || value === '') {
      continue;
    }
    
    // Get field configuration
    const fieldConfig = filterConfig[key] || {};
    
    // Check if field is filterable
    if (filterConfig.allowedFields && !filterConfig.allowedFields.includes(key)) {
      if (filterConfig.strictFiltering) {
        throw ApiError.badRequest(`Filtering by field '${key}' is not allowed`);
      }
      continue;
    }
    
    // Handle special operators (gt, lt, gte, lte, etc.)
    if (key.includes('_')) {
      const [field, operator] = key.split('_');
      
      if (!filter[field]) filter[field] = {};
      
      switch (operator) {
        case 'gt':
          filter[field].$gt = parseValue(value, fieldConfig.type);
          break;
        case 'gte':
          filter[field].$gte = parseValue(value, fieldConfig.type);
          break;
        case 'lt':
          filter[field].$lt = parseValue(value, fieldConfig.type);
          break;
        case 'lte':
          filter[field].$lte = parseValue(value, fieldConfig.type);
          break;
        case 'ne':
          filter[field].$ne = parseValue(value, fieldConfig.type);
          break;
        case 'in':
          filter[field].$in = value.split(',').map(v => parseValue(v, fieldConfig.type));
          break;
        case 'nin':
          filter[field].$nin = value.split(',').map(v => parseValue(v, fieldConfig.type));
          break;
        case 'regex':
          filter[field].$regex = new RegExp(value, 'i');
          break;
        default:
          // If not a special operator, treat as a normal field
          if (filterConfig.allowedFields && filterConfig.allowedFields.includes(field)) {
            filter[field] = parseValue(value, fieldConfig.type);
          }
      }
      
      appliedFilters.push({ field, operator, value });
    } else {
      // Handle comma-separated values as $in operator
      if (value.includes(',') && (!fieldConfig.type || fieldConfig.type !== 'string')) {
        filter[key] = { $in: value.split(',').map(v => parseValue(v.trim(), fieldConfig.type)) };
        appliedFilters.push({ field: key, operator: 'in', value: value.split(',') });
      } else if (fieldConfig.exactMatch) {
        // Exact match
        filter[key] = parseValue(value, fieldConfig.type);
        appliedFilters.push({ field: key, operator: 'eq', value });
      } else if (fieldConfig.type === 'string' || (!fieldConfig.type && typeof value === 'string')) {
        // Default string comparison is case-insensitive partial match
        filter[key] = new RegExp(value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
        appliedFilters.push({ field: key, operator: 'contains', value });
      } else {
        // Other types exact match
        filter[key] = parseValue(value, fieldConfig.type);
        appliedFilters.push({ field: key, operator: 'eq', value });
      }
    }
  }
  
  return { filter, appliedFilters };
}

/**
 * Parse field selection parameters
 * @param {Object} query - Express request query object
 * @param {Array} allowedFields - Fields that can be selected
 * @param {string} defaultFields - Default fields to select
 * @returns {Object} Field selection for MongoDB query
 */
function parseFieldsSelection(query, allowedFields = [], defaultFields = '') {
  if (!query.fields) {
    return defaultFields ? { fields: defaultFields } : {};
  }
  
  // Parse field list
  const requestedFields = query.fields.split(',');
  let selectedFields = [];
  
  if (allowedFields.length > 0) {
    // Filter to only allowed fields
    selectedFields = requestedFields.filter(field => {
      // Remove exclusion operator if present
      const fieldName = field.startsWith('-') ? field.substring(1) : field;
      return allowedFields.includes(fieldName);
    });
    
    if (selectedFields.length === 0) {
      return defaultFields ? { fields: defaultFields } : {};
    }
  } else {
    selectedFields = requestedFields;
  }
  
  return { fields: selectedFields.join(' ') };
}

/**
 * Apply pagination, sorting, and filtering to a Mongoose query
 * @param {Object} query - Mongoose query object
 * @param {Object} req - Express request object
 * @param {Object} options - Configuration options
 * @returns {Object} Modified query and pagination metadata
 */
function applyPagination(query, req, options = {}) {
  // Get pagination parameters
  const { page, limit, skip } = parsePaginationParams(req.query, options);
  
  // Apply pagination to query
  query = query.skip(skip).limit(limit);
  
  // Apply sorting
  const sortParams = parseSortParams(req.query, options.allowedSortFields, options.defaultSort);
  if (sortParams.sort) {
    query = query.sort(sortParams.sort);
  }
  
  // Apply field selection
  const fieldParams = parseFieldsSelection(req.query, options.allowedFields, options.defaultFields);
  if (fieldParams.fields) {
    query = query.select(fieldParams.fields);
  }
  
  return {
    query,
    pagination: {
      page,
      limit,
      skip
    },
    sort: sortParams.sort,
    fields: fieldParams.fields
  };
}

/**
 * Parse and build a paginated response from query execution
 * @param {Object} options - Pagination options
 * @param {Promise} countPromise - Promise returning total count
 * @param {Promise} dataPromise - Promise returning paginated data
 * @returns {Promise<Object>} Pagination result
 */
async function buildPaginationResult(options, countPromise, dataPromise) {
  try {
    // Execute promises in parallel
    const [total, data] = await Promise.all([countPromise, dataPromise]);
    
    // Build pagination result
    return {
      data,
      pagination: {
        total,
        page: options.pagination.page,
        limit: options.pagination.limit,
        pages: Math.ceil(total / options.pagination.limit)
      },
      filters: options.appliedFilters,
      sort: options.sort
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Helper to parse values to the correct type
 * @param {string} value - Value to parse
 * @param {string} type - Type to convert to
 * @returns {any} Parsed value
 */
function parseValue(value, type) {
  if (value === null || value === undefined) {
    return value;
  }
  
  switch (type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'date':
      return new Date(value);
    case 'objectId':
      return value;  // Mongoose will handle ObjectId validation
    default:
      return value;  // Default to string or whatever was passed
  }
}

module.exports = {
  parsePaginationParams,
  parseSortParams,
  parseFilterParams,
  parseFieldsSelection,
  applyPagination,
  buildPaginationResult
};
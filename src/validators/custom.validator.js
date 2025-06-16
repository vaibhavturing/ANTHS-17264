const mongoose = require('mongoose');

/**
 * Custom validator for MongoDB ObjectId
 * @param {string} value - The value to validate as ObjectId
 * @param {Object} helpers - Joi validation helpers
 * @returns {string|Object} - Validated ObjectId or error
 */
const objectId = (value, helpers) => {
  if (!value) {
    return helpers.error('any.required');
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }

  return value;
};

module.exports = {
  objectId
};
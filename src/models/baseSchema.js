/**
 * Healthcare Management Application
 * Base Schema
 * 
 * Common functionality shared across schemas including:
 * - Timestamps
 * - Soft delete functionality
 * - Created by and updated by tracking
 */

const mongoose = require('mongoose');

/**
 * Base Schema options to extend all schemas with common functionality
 * @param {Object} options - Additional schema options
 * @returns {Object} - Mongoose schema options
 */
const baseSchemaOptions = (options = {}) => ({
  timestamps: true, // Automatically adds createdAt and updatedAt
  toJSON: { 
    virtuals: true, 
    // Transform the returned object to remove sensitive data
    transform: function(doc, ret) {
      delete ret.__v;
      if (!options.keepId) delete ret._id;
      if (ret.password) delete ret.password;
      return ret;
    },
  },
  toObject: { 
    virtuals: true,
    // Transform the returned object to remove sensitive data
    transform: function(doc, ret) {
      delete ret.__v;
      if (!options.keepId) delete ret._id;
      if (ret.password) delete ret.password;
      return ret;
    },
  },
  ...options,
});

/**
 * Base schema fields to extend all schemas
 * @param {Object} definitions - Additional schema fields
 * @returns {mongoose.Schema} - Mongoose schema
 */
const baseSchema = (definitions = {}) => {
  return new mongoose.Schema({
    // Common fields for all schemas
    isActive: {
      type: Boolean,
      default: true,
      select: false,  // Don't select this field by default
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,  // Don't select this field by default
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      select: false,  // Don't select this field by default
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      select: false,  // Don't select this field by default
    },
    // Merge with custom schema definitions
    ...definitions,
  });
};

/**
 * Add query middleware to exclude soft-deleted records
 * @param {mongoose.Schema} schema - Schema to add middleware to
 */
const addSoftDeleteQueryMiddleware = (schema) => {
  // Middleware for all queries to exclude soft-deleted records
  schema.pre(/^find/, function(next) {
    // Only exclude deleted records if not explicitly asked to include them
    if (!this.getQuery().includeDeleted) {
      this.find({ isDeleted: { $ne: true } });
    }
    next();
  });
};

/**
 * Add method to soft delete a record
 * @param {mongoose.Schema} schema - Schema to add method to
 */
const addSoftDeleteMethod = (schema) => {
  schema.methods.softDelete = async function(userId) {
    this.isDeleted = true;
    this.isActive = false;
    this.updatedBy = userId;
    await this.save();
  };
};

/**
 * Add method to restore a soft-deleted record
 * @param {mongoose.Schema} schema - Schema to add method to
 */
const addRestoreMethod = (schema) => {
  schema.methods.restore = async function(userId) {
    this.isDeleted = false;
    this.isActive = true;
    this.updatedBy = userId;
    await this.save();
  };
};

/**
 * Add query method to include soft-deleted records
 * @param {mongoose.Schema} schema - Schema to add method to
 */
const addWithDeletedQuery = (schema) => {
  schema.statics.findWithDeleted = function() {
    return this.find().where('isDeleted').ne(undefined);
  };
};

/**
 * Creates a new schema with base schema functionality
 * @param {Object} definitions - Schema field definitions 
 * @param {Object} options - Schema options
 * @returns {mongoose.Schema} Mongoose schema with base functionality
 */
const createSchema = (definitions = {}, options = {}) => {
  const schema = baseSchema(definitions);
  
  // Apply options
  Object.assign(schema.options, baseSchemaOptions(options));
  
  // Add middleware and methods
  addSoftDeleteQueryMiddleware(schema);
  addSoftDeleteMethod(schema);
  addRestoreMethod(schema);
  addWithDeletedQuery(schema);
  
  return schema;
};

module.exports = { createSchema };
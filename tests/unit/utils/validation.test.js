/**
 * Unit Tests for Validation Utilities
 */

const Joi = require('joi');
const validationUtils = require('../../../src/utils/validation.util');
const { ValidationError } = require('../../../src/utils/errors/ValidationError');

describe('Validation Utilities', () => {
  describe('validateSchema', () => {
    it('should validate object successfully against schema', () => {
      // Arrange
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().integer().min(0).required(),
        email: Joi.string().email().required()
      });
      
      const validData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };
      
      // Act
      const result = validationUtils.validateSchema(schema, validData);
      
      // Assert
      expect(result).toEqual(validData);
    });

    it('should sanitize data by removing unknown fields', () => {
      // Arrange
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().integer().min(0).required()
      }).unknown(false); // Don't allow unknown keys
      
      const dataWithExtraFields = {
        name: 'John Doe',
        age: 30,
        extraField: 'This should be removed'
      };
      
      // Act
      const result = validationUtils.validateSchema(schema, dataWithExtraFields);
      
      // Assert
      expect(result).toEqual({
        name: 'John Doe',
        age: 30
      });
      expect(result.extraField).toBeUndefined();
    });

    it('should throw ValidationError when validation fails', () => {
      // Arrange
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().integer().min(0).required(),
        email: Joi.string().email().required()
      });
      
      const invalidData = {
        name: 'John Doe',
        age: -5, // Invalid age (below minimum)
        email: 'not-a-valid-email' // Invalid email
      };
      
      // Act & Assert
      expect(() => {
        validationUtils.validateSchema(schema, invalidData);
      }).toThrow(ValidationError);
    });

    it('should include all validation errors in the error message', () => {
      // Arrange
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().integer().min(0).required(),
        email: Joi.string().email().required()
      });
      
      const invalidData = {
        name: 'John Doe',
        age: -5, // Invalid age (below minimum)
        email: 'not-a-valid-email' // Invalid email
      };
      
      // Act & Assert
      try {
        validationUtils.validateSchema(schema, invalidData);
        fail('Expected validation to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('age');
        expect(error.message).toContain('email');
      }
    });
  });
  
  describe('sanitizeFilters', () => {
    it('should sanitize query filters based on allowed fields', () => {
      // Arrange
      const rawFilters = {
        name: 'John',
        age: '30',
        status: 'active',
        sortBy: 'createdAt',
        malicious: 'DROP TABLE users;' // Should be removed
      };
      
      const allowedFields = ['name', 'age', 'status', 'sortBy'];
      
      // Act
      const sanitizedFilters = validationUtils.sanitizeFilters(rawFilters, allowedFields);
      
      // Assert
      expect(sanitizedFilters).toEqual({
        name: 'John',
        age: '30',
        status: 'active',
        sortBy: 'createdAt'
      });
      expect(sanitizedFilters.malicious).toBeUndefined();
    });

    it('should return empty object when no filters provided', () => {
      // Act
      const sanitizedFilters = validationUtils.sanitizeFilters(null, ['name', 'age']);
      
      // Assert
      expect(sanitizedFilters).toEqual({});
    });

    it('should return empty object when no allowed fields provided', () => {
      // Arrange
      const rawFilters = {
        name: 'John',
        age: '30'
      };
      
      // Act
      const sanitizedFilters = validationUtils.sanitizeFilters(rawFilters, []);
      
      // Assert
      expect(sanitizedFilters).toEqual({});
    });
  });
  
  describe('validatePaginationParams', () => {
    it('should return default pagination values when none provided', () => {
      // Act
      const pagination = validationUtils.validatePaginationParams({});
      
      // Assert
      expect(pagination).toEqual({
        page: 1,
        limit: 10
      });
    });

    it('should sanitize and validate pagination parameters', () => {
      // Arrange
      const params = {
        page: '2',
        limit: '20'
      };
      
      // Act
      const pagination = validationUtils.validatePaginationParams(params);
      
      // Assert
      expect(pagination).toEqual({
        page: 2,
        limit: 20
      });
    });

    it('should enforce minimum and maximum limits', () => {
      // Arrange
      const tooLowParams = {
        page: '0',  // Below minimum
        limit: '0'  // Below minimum
      };
      
      const tooHighParams = {
        page: '1',
        limit: '1000' // Above default maximum
      };
      
      // Act
      const lowResult = validationUtils.validatePaginationParams(tooLowParams);
      const highResult = validationUtils.validatePaginationParams(tooHighParams);
      
      // Assert
      expect(lowResult).toEqual({
        page: 1,  // Adjusted to minimum
        limit: 1  // Adjusted to minimum
      });
      
      expect(highResult).toEqual({
        page: 1,
        limit: 100  // Adjusted to maximum
      });
    });

    it('should allow custom maximum limit', () => {
      // Arrange
      const params = {
        page: '1',
        limit: '200'
      };
      
      const options = {
        maxLimit: 250  // Custom maximum
      };
      
      // Act
      const pagination = validationUtils.validatePaginationParams(params, options);
      
      // Assert
      expect(pagination).toEqual({
        page: 1,
        limit: 200  // Accepted because below custom maximum
      });
    });
  });
});
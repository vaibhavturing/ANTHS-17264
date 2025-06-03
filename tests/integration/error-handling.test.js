/**
 * Integration Tests for Error Handling
 * Tests the application's error handling and response formatting
 */

const request = require('supertest');
const app = require('../../src/app');
const helpers = require('../test-helpers');

// Mocking User model methods
const User = require('../../src/models/User');
User.findById = jest.fn();
User.findOne = jest.fn();

describe('Error Handling Integration', () => {
  describe('404 Not Found', () => {
    it('should return a structured 404 error for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent-route')
        .expect(404);
      
      expect(response.body).toEqual({
        success: false,
        message: expect.stringContaining('not found'),
        error: expect.any(Object)
      });
    });
  });
  
  describe('Validation Errors', () => {
    it('should return structured validation errors', async () => {
      // Create an admin user for testing
      const adminUser = await helpers.createTestUser({
        email: 'error-test-admin@example.com',
        role: 'admin'
      });
      const adminToken = helpers.generateToken(adminUser);
      
      // Send a request with invalid data
      const invalidUserData = {
        // Missing required fields
        email: 'not-an-email',  // Invalid email format
        password: '123'  // Too short
      };
      
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUserData)
        .expect(400);
      
      // Verify structured error response
      expect(response.body).toEqual({
        success: false,
        message: expect.stringContaining('validation'),
        error: {
          code: 'VALIDATION_ERROR',
          details: expect.any(Array)
        }
      });
      
      // Errors should include both validation failures
      expect(response.body.error.details.length).toBeGreaterThan(0);
      expect(response.body.error.details.some(d => d.field === 'email')).toBe(true);
      expect(response.body.error.details.some(d => d.field === 'password')).toBe(true);
    });
  });
  
  describe('Authentication Errors', () => {
    it('should return structured authentication errors', async () => {
      // Attempt to access protected route without token
      const response = await request(app)
        .get('/api/users')
        .expect(401);
      
      expect(response.body).toEqual({
        success: false,
        message: expect.stringContaining('authentication'),
        error: {
          code: 'AUTHENTICATION_ERROR'
        }
      });
    });
    
    it('should return structured errors for invalid tokens', async () => {
      // Use an invalid/expired token
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
      
      expect(response.body).toEqual({
        success: false,
        message: expect.stringContaining('token'),
        error: {
          code: 'AUTHENTICATION_ERROR'
        }
      });
    });
  });
  
  describe('Authorization Errors', () => {
    it('should return structured authorization errors', async () => {
      // Create a regular user
      const regularUser = await helpers.createTestUser({
        email: 'regular-user@example.com',
        role: 'user'
      });
      const regularToken = helpers.generateToken(regularUser);
      
      // Attempt to access admin-only route
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
      
      expect(response.body).toEqual({
        success: false,
        message: expect.stringContaining('permission'),
        error: {
          code: 'AUTHORIZATION_ERROR'
        }
      });
    });
  });
  
  describe('Database Operation Errors', () => {
    it('should handle and format database errors properly', async () => {
      // This requires a setup to trigger a database error
      // For example, a unique constraint violation
      
      // Create an admin user for testing
      const adminUser = await helpers.createTestUser({
        email: 'db-error-admin@example.com',
        role: 'admin'
      });
      const adminToken = helpers.generateToken(adminUser);
      
      // Create a user
      const firstUserData = {
        email: 'duplicate@example.com',
        password: 'Password123!',
        firstName: 'First',
        lastName: 'User'
      };
      
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(firstUserData)
        .expect(201);
      
      // Try to create another user with the same email
      const duplicateUserData = {
        email: 'duplicate@example.com', // Same email as above
        password: 'AnotherPass123!',
        firstName: 'Second',
        lastName: 'User'
      };
      
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateUserData)
        .expect(400);
      
      expect(response.body).toEqual({
        success: false,
        message: expect.stringMatching(/email.*exists|duplicate/i),
        error: expect.any(Object)
      });
    });
  });
  
  describe('Error Sanitization', () => {
    it('should sanitize error responses in production', async () => {
      // Store original NODE_ENV
      const originalEnv = process.env.NODE_ENV;
      
      try {
        // Temporarily set to production
        process.env.NODE_ENV = 'production';
        
        // Trigger a validation error
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            // Missing required fields
          })
          .expect(400);
        
        // Check that sensitive details are not included
        expect(response.body.error).not.toHaveProperty('stack');
        expect(response.body).not.toHaveProperty('details.source');
        
        // Basic error information should still be provided
        expect(response.body).toEqual({
          success: false,
          message: expect.any(String),
          error: expect.any(Object)
        });
      } finally {
        // Restore original NODE_ENV
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
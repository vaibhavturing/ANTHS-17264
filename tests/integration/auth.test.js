/**
 * Integration Tests for Auth Endpoints
 * Tests the authentication API endpoints
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const helpers = require('../test-helpers');

describe('Auth API Endpoints', () => {
  let testUserIds = [];
  
  beforeEach(async () => {
    // Clear all users before each test
    await User.deleteMany({});
    testUserIds = [];
  });
  
  afterAll(async () => {
    // Clean up any remaining test users
    await helpers.cleanupTestData(testUserIds);
  });
  
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);
      
      // Save user IDs for cleanup
      if (response.body.data && response.body.data.user && response.body.data.user._id) {
        testUserIds.push(response.body.data.user._id);
      }
      
      // Check response structure
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('email', userData.email);
      expect(response.body.data.user).toHaveProperty('firstName', userData.firstName);
      expect(response.body.data.user).toHaveProperty('lastName', userData.lastName);
      
      // User should NOT have password in response
      expect(response.body.data.user).not.toHaveProperty('password');
      
      // Verify user was created in database
      const createdUser = await User.findOne({ email: userData.email });
      expect(createdUser).toBeTruthy();
      expect(createdUser.email).toBe(userData.email);
    });

    it('should return 400 when registering with existing email', async () => {
      // Create a user first
      const existingUser = await helpers.createTestUser({
        email: 'existing@example.com'
      });
      testUserIds.push(existingUser._id);
      
      // Try to register with the same email
      const userData = {
        email: 'existing@example.com', // Same email as above
        password: 'NewPassword123!',
        firstName: 'Another',
        lastName: 'User'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);
      
      // Check error response
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should return 400 when registering with invalid data', async () => {
      const invalidData = {
        email: 'notanemail',  // Invalid email
        password: '123',      // Too short
        firstName: '',        // Empty
        lastName: 'User'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);
      
      // Check error response
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeTruthy();
    });
  });
  
  describe('POST /api/auth/login', () => {
    it('should login a user with valid credentials', async () => {
      // Create a user for testing
      const plainPassword = 'Password123!';
      const testUser = await helpers.createTestUser({
        email: 'logintest@example.com',
        password: plainPassword,
        role: 'patient'
      });
      testUserIds.push(testUser._id);
      
      // Attempt login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: plainPassword
        })
        .expect(200);
      
      // Check response structure
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('email', 'logintest@example.com');
      
      // Verify token is set in cookie if applicable
      if (response.headers['set-cookie']) {
        expect(response.headers['set-cookie'][0]).toContain('token=');
      }
    });

    it('should return 401 with invalid credentials', async () => {
      // Create a user for testing
      const testUser = await helpers.createTestUser({
        email: 'logintest@example.com',
        password: 'CorrectPassword123!'
      });
      testUserIds.push(testUser._id);
      
      // Attempt login with wrong password
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'WrongPassword123!'  // Wrong password
        })
        .expect(401);
      
      // Check error response
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should return 401 when user does not exist', async () => {
      // Attempt login with non-existent user
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!'
        })
        .expect(401);
      
      // Check error response
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });
  });
  
  describe('POST /api/auth/forgot-password', () => {
    it('should process forgot password request for existing user', async () => {
      // Create a user for testing
      const testUser = await helpers.createTestUser({
        email: 'forgotpassword@example.com'
      });
      testUserIds.push(testUser._id);
      
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'forgotpassword@example.com'
        })
        .expect(200);
      
      // Check response structure
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset');
    });

    it('should still return 200 when email does not exist for security', async () => {
      // This test ensures we don't leak whether an email exists in the system
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        })
        .expect(200);
      
      // Should look the same as a successful request
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset');
    });
  });
});
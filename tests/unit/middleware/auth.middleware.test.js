/**
 * Unit Tests for Auth Middleware
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const authMiddleware = require('../../../src/middleware/auth.middleware');
const { User } = require('../../../src/models/user.model');
const  AuthenticationError  = require('../../../src/utils/errors/AuthenticationError');
const  AuthorizationError  = require('../../../src/utils/errors/AuthorizationError');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/utils/logger');

User.findById = jest.fn();
User.findOne = jest.fn();

describe('Auth Middleware', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should set req.user and call next() when token is valid', async () => {
      // Arrange
      const req = {
        headers: {
          authorization: 'Bearer valid-token'
        }
      };
      const res = {};
      const next = jest.fn();
      
      // Mock jwt.verify to return a decoded token
      const decodedToken = { id: 'userId', role: 'user' };
      jwt.verify.mockReturnValue(decodedToken);
      
      // Mock User.findById to return a user
      const mockUser = { 
        _id: 'userId',
        email: 'test@example.com',
        role: 'user',
        active: true,
        toObject: jest.fn().mockReturnValue({
          _id: 'userId',
          email: 'test@example.com',
          role: 'user'
        })
      };
      User.findById.mockResolvedValue(mockUser);
      
      // Act
      await authMiddleware.authenticate(req, res, next);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String));
      expect(User.findById).toHaveBeenCalledWith('userId');
      expect(req.user).toBeDefined();
      expect(req.user._id).toBe('userId');
      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with AuthenticationError when no token is provided', async () => {
      // Arrange
      const req = {
        headers: {}  // No authorization header
      };
      const res = {};
      const next = jest.fn();
      
      // Act
      await authMiddleware.authenticate(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect(next.mock.calls[0][0].message).toContain('authentication token');
      expect(jwt.verify).not.toHaveBeenCalled();
      expect(User.findById).not.toHaveBeenCalled();
    });

    it('should call next with AuthenticationError when token is malformed', async () => {
      // Arrange
      const req = {
        headers: {
          authorization: 'not-a-valid-token-format'
        }
      };
      const res = {};
      const next = jest.fn();
      
      // Act
      await authMiddleware.authenticate(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect(next.mock.calls[0][0].message).toContain('Bearer token');
      expect(jwt.verify).not.toHaveBeenCalled();
      expect(User.findById).not.toHaveBeenCalled();
    });

    it('should call next with AuthenticationError when token verification fails', async () => {
      // Arrange
      const req = {
        headers: {
          authorization: 'Bearer invalid-token'
        }
      };
      const res = {};
      const next = jest.fn();
      
      // Mock jwt.verify to throw an error
      jwt.verify.mockImplementation(() => {
        throw new Error('Token invalid or expired');
      });
      
      // Act
      await authMiddleware.authenticate(req, res, next);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith('invalid-token', expect.any(String));
      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect(User.findById).not.toHaveBeenCalled();
    });

    it('should call next with AuthenticationError when user is not found', async () => {
      // Arrange
      const req = {
        headers: {
          authorization: 'Bearer valid-token'
        }
      };
      const res = {};
      const next = jest.fn();
      
      // Mock jwt.verify to return a decoded token
      const decodedToken = { id: 'nonexistentUserId', role: 'user' };
      jwt.verify.mockReturnValue(decodedToken);
      
      // Mock User.findById to not find the user
      User.findById.mockResolvedValue(null);
      
      // Act
      await authMiddleware.authenticate(req, res, next);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String));
      expect(User.findById).toHaveBeenCalledWith('nonexistentUserId');
      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect(next.mock.calls[0][0].message).toContain('no longer exists');
    });
  });

  describe('requireRole', () => {
    it('should call next() when user has required role', () => {
      // Arrange
      const req = {
        user: {
          _id: 'userId',
          role: 'admin'
        }
      };
      const res = {};
      const next = jest.fn();
      
      // Create middleware for specific role
      const requireAdminRole = authMiddleware.requireRole('admin');
      
      // Act
      requireAdminRole(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with AuthorizationError when user doesn\'t have required role', () => {
      // Arrange
      const req = {
        user: {
          _id: 'userId',
          role: 'user'  // Regular user, not admin
        }
      };
      const res = {};
      const next = jest.fn();
      
      // Create middleware for admin role
      const requireAdminRole = authMiddleware.requireRole('admin');
      
      // Act
      requireAdminRole(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect(next.mock.calls[0][0].message).toContain('admin role');
    });

    it('should call next with AuthorizationError when user is not authenticated', () => {
      // Arrange
      const req = {}; // No user property - not authenticated
      const res = {};
      const next = jest.fn();
      
      // Create middleware for specific role
      const requireAdminRole = authMiddleware.requireRole('admin');
      
      // Act
      requireAdminRole(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect(next.mock.calls[0][0].message).toContain('authenticated');
    });
  });

  describe('requireAnyRole', () => {
    it('should call next() when user has one of the required roles', () => {
      // Arrange
      const req = {
        user: {
          _id: 'userId',
          role: 'doctor'
        }
      };
      const res = {};
      const next = jest.fn();
      
      // Create middleware requiring any of multiple roles
      const requireMedicalRole = authMiddleware.requireAnyRole(['doctor', 'nurse', 'admin']);
      
      // Act
      requireMedicalRole(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with AuthorizationError when user doesn\'t have any required roles', () => {
      // Arrange
      const req = {
        user: {
          _id: 'userId',
          role: 'patient'  // Patient role, not a medical staff role
        }
      };
      const res = {};
      const next = jest.fn();
      
      // Create middleware requiring medical staff roles
      const requireMedicalRole = authMiddleware.requireAnyRole(['doctor', 'nurse', 'admin']);
      
      // Act
      requireMedicalRole(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect(next.mock.calls[0][0].message).toContain('required roles');
    });
  });
});
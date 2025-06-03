/**
 * Unit Tests for Auth Controller
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authController = require("../../../src/controllers/auth.controller");
const { User } = require("../../../src/models/user.model");
const config = require("../../../src/config/config");

// Mock dependencies
jest.mock("../../../src/models/user.model");
jest.mock("bcrypt");
jest.mock("jsonwebtoken");
jest.mock("../../../src/utils/logger");

describe("Auth Controller", () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("should create a new user and return status 201", async () => {
      // Arrange
      const req = {
        body: {
          email: "test@example.com",
          password: "Password123!",
          firstName: "John",
          lastName: "Doe"
        }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      // Mock User.findOne to return null (no existing user)
      User.findOne.mockResolvedValue(null);

      // Mock bcrypt.hash
      bcrypt.hash.mockResolvedValue("hashedpassword");

      // Mock User.prototype.save
      const savedUser = {
        _id: new mongoose.Types.ObjectId(),
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        role: "patient",
        active: true,
        toObject: jest.fn().mockReturnValue({
          _id: "userId",
          email: req.body.email,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          role: "patient"
        })
      };
      const saveMock = jest.fn().mockResolvedValue(savedUser);
      User.mockImplementation(() => ({
        save: saveMock,
        toObject: savedUser.toObject
      }));

      // Mock JWT token generation
      jwt.sign.mockReturnValue("mocked-token");

      // Act
      await authController.register(req, res);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: req.body.email });
      expect(bcrypt.hash).toHaveBeenCalledWith(req.body.password, expect.any(Number));
      expect(User).toHaveBeenCalledWith(
        expect.objectContaining({
          email: req.body.email,
          password: "hashedpassword",
          firstName: req.body.firstName,
          lastName: req.body.lastName
        })
      );
      expect(saveMock).toHaveBeenCalled();
      expect(jwt.sign).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          user: expect.any(Object),
          token: "mocked-token"
        })
      });
    });

    it("should return 400 when user with email already exists", async () => {
      // Arrange
      const req = {
        body: {
          email: "existing@example.com",
          password: "Password123!",
          firstName: "Jane",
          lastName: "Doe"
        }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      // Mock User.findOne to return an existing user
      User.findOne.mockResolvedValue({ email: req.body.email });

      // Act
      await authController.register(req, res);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: req.body.email });
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(User).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "User with this email already exists",
        error: expect.any(Object)
      });
    });
  });

  describe("login", () => {
    it("should login successfully and return user with token", async () => {
      // Arrange
      const req = {
        body: {
          email: "test@example.com",
          password: "Password123!"
        }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        cookie: jest.fn(),
        json: jest.fn()
      };

      // Mock found user
      const mockUser = {
        _id: "userId",
        email: req.body.email,
        password: "hashedPassword",
        role: "patient",
        active: true,
        comparePassword: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
          _id: "userId",
          email: req.body.email,
          role: "patient"
        })
      };

      // Mock User.findOne to return the user
      User.findOne.mockResolvedValue(mockUser);

      // Mock JWT token generation
      jwt.sign.mockReturnValue("mocked-token");

      // Act
      await authController.login(req, res);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: req.body.email });
      expect(mockUser.comparePassword).toHaveBeenCalledWith(req.body.password);
      expect(jwt.sign).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          user: expect.objectContaining({
            _id: "userId",
            email: req.body.email
          }),
          token: "mocked-token"
        })
      });
    });

    it("should return 401 when user is not found", async () => {
      // Arrange
      const req = {
        body: {
          email: "nonexistent@example.com",
          password: "Password123!"
        }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      // Mock User.findOne to return null (user not found)
      User.findOne.mockResolvedValue(null);

      // Act
      await authController.login(req, res);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: req.body.email });
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid credentials",
        error: expect.any(Object)
      });
    });

    it("should return 401 when password is incorrect", async () => {
      // Arrange
      const req = {
        body: {
          email: "test@example.com",
          password: "WrongPassword!"
        }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      // Mock found user with incorrect password
      const mockUser = {
        _id: "userId",
        email: req.body.email,
        password: "hashedPassword",
        comparePassword: jest.fn().mockResolvedValue(false) // Password doesn't match
      };

      // Mock User.findOne to return the user
      User.findOne.mockResolvedValue(mockUser);

      // Act
      await authController.login(req, res);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: req.body.email });
      expect(mockUser.comparePassword).toHaveBeenCalledWith(req.body.password);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid credentials",
        error: expect.any(Object)
      });
    });
  });
});

/**
 * Jest Test Setup
 * Configures the test environment before running tests
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const dotenv = require('dotenv');
const path = require('path');

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Set Node environment to test
process.env.NODE_ENV = 'test';

// Global variables for test environment
let mongod;

/**
 * Connect to the in-memory database
 */
const connectDB = async () => {
  // Create an in-memory MongoDB server
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  // Set MongoDB connection string to in-memory DB
  process.env.MONGODB_URI = uri;
  
  const mongooseOpts = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };

  // Connect to the in-memory database
  await mongoose.connect(uri, mongooseOpts);
  
  console.log('Connected to in-memory MongoDB');
};

/**
 * Clear all collections in the database
 */
const clearDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
    
    console.log('Database cleared');
  }
};

/**
 * Close the database connection
 */
const closeDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (mongod) {
      await mongod.stop();
    }
    console.log('Database connection closed');
  }
};

// Setup before any tests run
beforeAll(async () => {
  // Mock console methods to suppress logs during tests
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  
  // Keep error and warn logs visible
  // jest.spyOn(console, 'error').mockImplementation(() => {});
  // jest.spyOn(console, 'warn').mockImplementation(() => {});
  
  await connectDB();
});

// Clean up after each test
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});

// Clean up after all tests complete
afterAll(async () => {
  await closeDatabase();
  
  // Restore console methods
  jest.restoreAllMocks();
});

// Global test utilities
global.testUtils = {
  connectDB,
  clearDatabase,
  closeDatabase
};
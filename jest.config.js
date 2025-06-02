/**
 * Jest Configuration
 * Configures Jest testing framework settings for the Healthcare Management Application
 */

module.exports = {
  // The test environment that will be used for testing
  testEnvironment: 'node',
  
  // The root directory that Jest should scan for tests
  rootDir: '.',
  
  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/tests/**/*.test.js',
    '**/src/**/__tests__/**/*.js',
    '**/src/**/*.spec.js'
  ],
  
  // An array of regexp pattern strings that are matched against all test paths
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  
  // An array of regexp pattern strings that are matched against all source file paths
  // before re-running tests in watch mode
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/logs/'
  ],
  
  // A list of paths to directories that Jest should use to search for files in
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],
  
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  
  // An array of glob patterns indicating a set of files for which coverage 
  // information should be collected
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**'
  ],
  
  // The threshold enforcement for code coverage results
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70
    }
  },
  
  // Indicates whether each individual test should be reported during the run
  verbose: true,
  
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
  
  // Allows you to use a custom resolver
  resolver: undefined,
  
  // Setup files that will be executed before each test file
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Maximum number of workers used to run tests. Can be specified as % or a number.
  // E.g. maxWorkers: 10% will use 10% of your CPU amount + 1 as the maximum
  maxWorkers: '50%',
  
  // Whether to use watchman for file crawling
  watchman: true,
  
  // Timeout in milliseconds for each test
  testTimeout: 30000,
  
  // Global variables that are available in all test environments
  globals: {
    isDevelopment: false,
    isTestEnvironment: true
  }
};
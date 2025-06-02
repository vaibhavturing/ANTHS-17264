/**
 * Global Test Setup
 * Configures the environment before running tests
 */

process.env.NODE_ENV = 'test';
console.info('Setting up test environment with NODE_ENV:', process.env.NODE_ENV);

// Global setup for testing
global.testUtils = {
  createMockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  },
  
  createMockRequest: (overrides = {}) => {
    return {
      body: {},
      params: {},
      query: {},
      headers: {},
      cookies: {},
      ...overrides
    };
  }
};

// Setup process to handle unhandled promise rejections during tests
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection in tests:', err);
});
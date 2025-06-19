// cypress/support/e2e.js
// Support file for E2E testing
// NEW FILE: E2E test configuration

// Import commands and other configurations
import './commands';

// Configure global behavior
Cypress.on('uncaught:exception', (err, runnable) => {
  // Handle uncaught exceptions to prevent test failures
  console.error('Uncaught exception:', err.message);
  return false;
});

// Define screen sizes for responsive testing
export const screenSizes = {
  mobile: { width: 375, height: 667 }, // iPhone 8
  tablet: { width: 768, height: 1024 }, // iPad
  laptop: { width: 1280, height: 800 },
  desktop: { width: 1920, height: 1080 }
};

// Log environment and configuration
Cypress.on('test:before:run', () => {
  const browserInfo = Cypress.browser;
  console.log(`Running tests on ${browserInfo.name} v${browserInfo.majorVersion}`);
  console.log(`Viewport: ${Cypress.config('viewportWidth')}x${Cypress.config('viewportHeight')}`);
});

// Preserve cookies and localStorage between tests
beforeEach(() => {
  cy.restoreLocalStorage();
});

afterEach(() => {
  cy.saveLocalStorage();
});
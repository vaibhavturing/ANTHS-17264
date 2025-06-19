// cypress.config.js
// Configuration file for Cypress E2E testing
// NEW FILE: Setting up Cypress configuration for E2E testing

const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    trashAssetsBeforeRuns: true,
    
    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    
    // Environment variables
    env: {
      apiUrl: 'http://localhost:4000/api',
      patient: {
        email: 'testpatient@example.com',
        password: 'TestPassword123!',
      },
      doctor: {
        email: 'testdoctor@example.com',
        password: 'TestPassword123!',
      },
    },
    
    // Custom commands and plugins
    setupNodeEvents(on, config) {
      // Register plugins and event listeners
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        table(data) {
          console.table(data);
          return null;
        },
      });
      
      // Browser-specific configurations
      if (config.browser && config.browser.name === 'chrome') {
        on('before:browser:launch', (browser, launchOptions) => {
          // Force Chrome to use specific window size
          launchOptions.args.push('--window-size=1280,720');
          launchOptions.args.push('--disable-dev-shm-usage');
          return launchOptions;
        });
      }
      
      if (config.browser && config.browser.name === 'safari') {
        // Safari-specific configurations
        config.chromeWebSecurity = false;
      }
      
      return config;
    },
  },
  
  // Component Testing Configuration
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
  },
});
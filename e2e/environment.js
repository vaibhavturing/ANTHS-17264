// e2e/environment.js
// Environment setup for Detox mobile testing
// NEW FILE: Environment configuration for mobile testing

const { DetoxCircusEnvironment, SpecReporter, WorkerAssignReporter } = require('detox/runners/jest-circus');

class CustomDetoxEnvironment extends DetoxCircusEnvironment {
  constructor(config, context) {
    super(config, context);

    // Can override logger or other configurations here
    this.initTimeout = 300000; // 5 minutes
    
    // Add custom reporters
    this.registerListeners({
      SpecReporter,
      WorkerAssignReporter,
    });
  }
}

module.exports = CustomDetoxEnvironment;
// scripts/run-prelaunch-checks.js

/**
 * Pre-Launch Checks CLI Script
 * Run this script before deployment to verify system readiness
 */

const prelaunchCheckerService = require('../src/services/prelaunch-checker.service');
const logger = require('../src/utils/logger');

// Command-line argument parsing
const args = process.argv.slice(2);
const options = {
  // Parse any command line options
  environment: process.env.NODE_ENV || 'development',
  deploymentId: process.env.DEPLOYMENT_ID || `cli-${Date.now()}`,
  version: process.env.APP_VERSION || '0.0.0'
};

// Log startup info
logger.info('Starting pre-launch checks from CLI', options);

// Run pre-launch checks
prelaunchCheckerService.runAllChecks()
  .then(results => {
    console.log('\n=========================================');
    console.log(`Pre-launch Checks: ${results.overall.toUpperCase()}`);
    console.log('=========================================\n');
    
    console.log(`Environment: ${options.environment}`);
    console.log(`Deployment ID: ${options.deploymentId}`);
    console.log(`Version: ${options.version}`);
    console.log(`Timestamp: ${new Date(results.timestamp).toLocaleString()}`);
    console.log(`Checks completed: ${results.checksCompleted}/${results.checksTotal}\n`);
    
    console.log('Check details:');
    
    // Display each check result
    for (const [checkName, check] of Object.entries(results.checks)) {
      const statusColor = check.status === 'passed' ? '\x1b[32m' : 
                          check.status === 'failed' ? '\x1b[31m' : '\x1b[33m';
      const resetColor = '\x1b[0m';
      const duration = check.durationMs !== null ? 
        `(${(check.durationMs / 1000).toFixed(1)}s)` : '';
      
      console.log(`- ${checkName}: ${statusColor}${check.status.toUpperCase()}${resetColor} ${duration}`);
      
      // Show error details if failed
      if (check.status === 'failed' && check.details?.error) {
        console.log(`  Error: ${check.details.error}`);
      }
    }
    
    console.log('\nResults saved to logs/prelaunch-checks/');
    
    // Exit with appropriate code
    process.exit(results.overall === 'passed' ? 0 : 1);
  })
  .catch(error => {
    console.error('\n=========================================');
    console.error('Pre-launch Checks: ERROR');
    console.error('=========================================\n');
    console.error(`Error: ${error.message}`);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    // Exit with error code
    process.exit(1);
  });
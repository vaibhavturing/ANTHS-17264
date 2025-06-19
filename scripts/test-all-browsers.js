// scripts/test-all-browsers.js
// Script to run tests on multiple browsers
// NEW FILE: Utility script to test on multiple browsers

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Browsers to test - add or remove as needed
const browsers = [
  { name: 'chrome', displayName: 'Google Chrome' },
  { name: 'firefox', displayName: 'Mozilla Firefox' },
  { name: 'edge', displayName: 'Microsoft Edge', skip: process.platform !== 'win32' }, // Only on Windows
  { name: 'safari', displayName: 'Apple Safari', skip: process.platform !== 'darwin' } // Only on macOS
];

// Paths
const reportsDir = path.join(__dirname, '..', 'reports', 'cross-browser');

// Create reports directory if it doesn't exist
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// Run tests for each browser
browsers.forEach(browser => {
  if (browser.skip) {
    console.log(`Skipping ${browser.displayName} as it's not available on this platform.`);
    return;
  }
  
  const reportPath = path.join(reportsDir, `${browser.name}-results.xml`);
  
  console.log(`\n========================================`);
  console.log(`Running tests on ${browser.displayName}...`);
  console.log(`========================================\n`);
  
  try {
    execSync(`npx cypress run --browser ${browser.name} --reporter junit --reporter-options "mochaFile=${reportPath}"`, { 
      stdio: 'inherit',
      timeout: 600000 // 10 minutes timeout
    });
    console.log(`\n✅ Tests completed successfully on ${browser.displayName}`);
  } catch (error) {
    console.error(`\n❌ Tests failed on ${browser.displayName}: ${error.message}`);
  }
});

console.log(`\nTest reports saved to: ${reportsDir}`);
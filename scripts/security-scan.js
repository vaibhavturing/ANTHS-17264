/**
 * Automated Security Scanning Script
 * File: scripts/security-scan.js
 * 
 * Script for running automated security scans and processing results
 * 
 * Usage: node scripts/security-scan.js --type=nessus --file=./nessus-results.xml
 */
const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const { connectDB } = require('../src/config/database');
const SecurityScannerService = require('../src/services/securityScanner.service');
const logger = require('../src/utils/logger');
const User = require('../src/models/user.model');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('type', {
    alias: 't',
    description: 'Type of scan results',
    choices: ['nessus', 'zap', 'manual'],
    demandOption: true
  })
  .option('file', {
    alias: 'f',
    description: 'Path to the scan results file',
    type: 'string',
    demandOption: true
  })
  .option('userId', {
    alias: 'u',
    description: 'User ID to associate with the scan',
    type: 'string',
    default: 'system'
  })
  .help()
  .alias('help', 'h')
  .argv;

async function main() {
  try {
    // Connect to database
    await connectDB();
    logger.info('Connected to database');
    
    // Check if file exists
    const filePath = path.resolve(argv.file);
    await fs.access(filePath);
    
    // Find user or create system user
    let userId;
    
    if (argv.userId === 'system') {
      // Get or create a system user
      const systemUser = await User.findOne({ username: 'system' });
      
      if (systemUser) {
        userId = systemUser._id;
      } else {
        const newSystemUser = new User({
          username: 'system',
          email: 'system@healthcare-app.com',
          firstName: 'System',
          lastName: 'User',
          role: 'system',
          isActive: true
        });
        
        await newSystemUser.save();
        userId = newSystemUser._id;
      }
    } else {
      // Use provided user ID
      userId = mongoose.Types.ObjectId(argv.userId);
    }
    
    logger.info(`Processing ${argv.type} scan results from ${filePath}`);
    
    // Process scan results based on type
    let scanData;
    
    switch (argv.type.toLowerCase()) {
      case 'nessus':
        scanData = await SecurityScannerService.parseNessusResults(filePath);
        break;
      case 'zap':
        scanData = await SecurityScannerService.parseZapResults(filePath);
        break;
      case 'manual':
        const manualData = JSON.parse(await fs.readFile(filePath, 'utf8'));
        scanData = SecurityScannerService.processManualTestResults(manualData);
        break;
      default:
        throw new Error(`Unsupported scan type: ${argv.type}`);
    }
    
    // Register scan results in the database
    const result = await SecurityScannerService.registerScanResults(scanData, userId);
    
    logger.info(`Successfully registered scan with ID: ${result.scan._id}`);
    logger.info(`Registered ${result.vulnerabilityCount} vulnerabilities`);
    
    // Print summary by severity
    console.log('Vulnerability Summary:');
    console.log('---------------------');
    console.log(`Critical: ${result.scan.vulnerabilitiesByLevel.critical}`);
    console.log(`High: ${result.scan.vulnerabilitiesByLevel.high}`);
    console.log(`Medium: ${result.scan.vulnerabilitiesByLevel.medium}`);
    console.log(`Low: ${result.scan.vulnerabilitiesByLevel.low}`);
    console.log(`Info: ${result.scan.vulnerabilitiesByLevel.info}`);
    console.log('---------------------');
    console.log(`Total: ${result.vulnerabilityCount}`);
    
    // Disconnect from database
    await mongoose.disconnect();
    
    process.exit(0);
  } catch (error) {
    logger.error(`Error processing scan results: ${error.message}`);
    
    // Disconnect from database
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      logger.error(`Error disconnecting from database: ${disconnectError.message}`);
    }
    
    process.exit(1);
  }
}

// Run the main function
main();
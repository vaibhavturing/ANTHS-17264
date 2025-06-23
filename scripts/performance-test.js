#!/usr/bin/env node

/**
 * Performance Test Script
 * Command-line utility for running performance tests
 */

require('dotenv').config();
const performanceScenarios = require('../tests/performance/scenarios');
const loadTesting = require('../tests/performance/load-tests');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const logger = require('../src/utils/logger');

// Configure CLI options
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .option('type', {
    alias: 't',
    describe: 'Type of test to run',
    choices: ['benchmark', 'load', 'all'],
    default: 'benchmark'
  })
  .option('scenario', {
    alias: 's',
    describe: 'Specific scenario to test',
    type: 'string'
  })
  .option('iterations', {
    alias: 'i',
    describe: 'Number of test iterations',
    type: 'number',
    default: 5
  })
  .option('output', {
    alias: 'o',
    describe: 'Output file for results',
    type: 'string'
  })
  .option('url', {
    alias: 'u',
    describe: 'API URL',
    type: 'string',
    default: 'http://localhost:3000'
  })
  .option('connections', {
    alias: 'c',
    describe: 'Number of connections for load testing',
    type: 'number',
    default: 10
  })
  .option('duration', {
    alias: 'd',
    describe: 'Duration of load test in seconds',
    type: 'number',
    default: 30
  })
  .option('report', {
    alias: 'r',
    describe: 'Generate comparison report',
    type: 'boolean',
    default: true
  })
  .option('mongo', {
    describe: 'MongoDB connection string',
    type: 'string',
    default: process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare'
  })
  .example('$0 -t benchmark -s patientSearch', 'Run the patient search benchmark')
  .example('$0 -t load -s search -c 50 -d 60', 'Run load test on search with 50 connections for 60 seconds')
  .example('$0 -t all', 'Run all benchmarks and generate report')
  .epilog('Healthcare Management Application Performance Testing')
  .argv;

/**
 * Main function
 */
async function main() {
  try {
    logger.info('Starting performance tests');
    
    // Connect to MongoDB if running benchmarks
    if (argv.type === 'benchmark' || argv.type === 'all') {
      logger.info(`Connecting to MongoDB: ${argv.mongo}`);
      await mongoose.connect(argv.mongo);
      logger.info('Connected to MongoDB');
    }
    
    let results;
    
    // Run the appropriate tests
    if (argv.type === 'benchmark') {
      if (argv.scenario) {
        const scenarioFn = `benchmark${argv.scenario.charAt(0).toUpperCase()}${argv.scenario.slice(1)}`;
        
        if (typeof performanceScenarios[scenarioFn] !== 'function') {
          logger.error(`Unknown benchmark scenario: ${argv.scenario}`);
          process.exit(1);
        }
        
        logger.info(`Running benchmark: ${argv.scenario}`);
        results = await performanceScenarios[scenarioFn]({
          iterations: argv.iterations,
          saveResults: true
        });
      } else {
        logger.info('Running all benchmarks');
        results = await performanceScenarios.runAll({
          iterations: argv.iterations,
          saveResults: true,
          generateReport: argv.report
        });
      }
    } else if (argv.type === 'load') {
      if (!argv.scenario) {
        logger.error('Scenario is required for load testing');
        process.exit(1);
      }
      
      logger.info(`Running load test: ${argv.scenario}`);
      results = await loadTesting.runTest(argv.scenario, {
        duration: argv.duration,
        connections: argv.connections,
        url: argv.url,
        saveResults: true
      });
      
      // Compare with previous results if available
      const previousResults = await loadTesting.loadPreviousResults(argv.scenario);
      
      if (previousResults && argv.report) {
        const comparison = loadTesting.compareResults(results, previousResults, argv.scenario);
        results.comparison = comparison;
        
        logger.info(`Comparison with previous run:
  Latency: ${comparison.latency.average.diff.toFixed(2)}ms (${comparison.latency.average.percentChange}%)
  Requests/sec: ${comparison.requests.perSecond.diff.toFixed(2)} (${comparison.requests.perSecond.percentChange}%)
  Overall improvement: ${comparison.overallImprovement}%`);
      }
    } else if (argv.type === 'all') {
      // Run both benchmark and load tests
      logger.info('Running all benchmarks and load tests');
      
      const benchmarkResults = await performanceScenarios.runAll({
        iterations: argv.iterations,
        saveResults: true
      });
      
      // Run a subset of load tests to keep runtime reasonable
      const loadResults = {};
      for (const scenario of ['search', 'patientList']) {
        loadResults[scenario] = await loadTesting.runTest(scenario, {
          duration: argv.duration,
          connections: argv.connections,
          url: argv.url,
          saveResults: true
        });
      }
      
      results = {
        benchmarks: benchmarkResults,
        loadTests: loadResults
      };
      
      if (argv.report) {
        const report = await performanceScenarios.generateReport();
        results.report = report;
      }
    }
    
    // Save results to file if requested
    if (argv.output) {
      const outputPath = path.resolve(argv.output);
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      logger.info(`Results saved to ${outputPath}`);
    }
    
    logger.info('Performance tests completed');
    
    // Disconnect from MongoDB
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      logger.info('Disconnected from MongoDB');
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Error running performance tests:', error);
    
    // Disconnect from MongoDB
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    
    process.exit(1);
  }
}

main();
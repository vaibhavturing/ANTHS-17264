/**
 * Performance Test Runner
 * 
 * This script runs performance tests against the application to measure:
 * - API response times
 * - Throughput capabilities
 * - Performance under load
 * 
 * Results are saved to the metrics database for trend analysis.
 */

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const logger = require('../src/utils/logger');
require('dotenv').config();

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN;
const RESULTS_DIR = path.join(__dirname, '../metrics/performance');
const TEST_DURATION = 30; // seconds
const TEST_CONNECTIONS = 10;
const TEST_PIPELINE = 1;

// Test scenarios
const scenarios = [
  {
    name: 'healthCheck',
    url: `${API_URL}/api/health`,
    method: 'GET'
  },
  {
    name: 'getPatients',
    url: `${API_URL}/api/patients?limit=10&page=1`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`
    }
  },
  {
    name: 'getMedicalRecords',
    url: `${API_URL}/api/medical-records?limit=10&page=1`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`
    }
  }
];

/**
 * Run a single performance test scenario
 * @param {Object} scenario - Test scenario configuration
 * @returns {Promise<Object>} - Test results
 */
async function runScenario(scenario) {
  logger.info(`Running performance test for "${scenario.name}"`);

  const instance = autocannon({
    url: scenario.url,
    connections: TEST_CONNECTIONS,
    pipelining: TEST_PIPELINE,
    duration: TEST_DURATION,
    method: scenario.method,
    headers: scenario.headers || {},
    setupClient: (client) => {
      client.on('error', (error) => {
        logger.error(`Error in "${scenario.name}" test:`, error);
      });
    }
  });

  return new Promise((resolve) => {
    autocannon.track(instance);
    instance.on('done', (results) => {
      resolve(results);
    });
  });
}

/**
 * Save test results to file
 * @param {string} scenarioName - Name of the test scenario
 * @param {Object} results - Test results
 */
async function saveResults(scenarioName, results) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsDir = path.join(RESULTS_DIR, scenarioName);
    
    await mkdir(resultsDir, { recursive: true });
    
    const filePath = path.join(resultsDir, `${timestamp}.json`);
    await writeFile(
      filePath, 
      JSON.stringify({
        timestamp: new Date().toISOString(),
        scenario: scenarioName,
        results
      }, null, 2)
    );
    
    logger.info(`Saved ${scenarioName} test results to ${filePath}`);
  } catch (error) {
    logger.error(`Error saving test results: ${error.message}`);
  }
}

/**
 * Extract key performance metrics for database storage
 * @param {Object} results - Raw test results
 * @returns {Object} - Extracted metrics
 */
function extractMetrics(results) {
  return {
    requests: {
      average: results.requests.average,
      mean: results.requests.mean,
      stddev: results.requests.stddev,
      min: results.requests.min,
      max: results.requests.max,
      total: results.requests.total,
      sent: results.requests.sent
    },
    latency: {
      average: results.latency.average,
      mean: results.latency.mean,
      stddev: results.latency.stddev,
      min: results.latency.min,
      max: results.latency.max,
      p50: results.latency.p50,
      p90: results.latency.p90,
      p99: results.latency.p99,
    },
    throughput: {
      average: results.throughput.average,
      mean: results.throughput.mean,
      stddev: results.throughput.stddev,
      min: results.throughput.min,
      max: results.throughput.max,
      total: results.throughput.total
    },
    errors: results.errors,
    timeouts: results.timeouts,
    duration: results.duration,
    start: results.start,
    finish: results.finish
  };
}

/**
 * Main function to run all performance tests
 */
async function runPerformanceTests() {
  logger.info('Starting performance tests');
  
  try {
    for (const scenario of scenarios) {
      const results = await runScenario(scenario);
      await saveResults(scenario.name, results);
      
      // Log summary of results
      logger.info(`Results for ${scenario.name}:`);
      logger.info(`  Requests/sec: ${results.requests.average}`);
      logger.info(`  Latency (avg): ${results.latency.average} ms`);
      logger.info(`  Latency (p99): ${results.latency.p99} ms`);
      logger.info(`  HTTP Errors: ${results.errors}`);
      
      const metrics = extractMetrics(results);
      
      // Here we would typically store these metrics in a database
      // For now, we're just logging them
      logger.debug('Extracted metrics:', metrics);
    }
    
    logger.info('Performance tests completed successfully');
  } catch (error) {
    logger.error('Performance tests failed:', error);
    process.exit(1);
  }
}

// Run the tests when the script is executed directly
if (require.main === module) {
  runPerformanceTests();
}

module.exports = { runPerformanceTests };
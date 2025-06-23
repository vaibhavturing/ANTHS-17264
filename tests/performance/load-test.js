/**
 * Load Testing Script
 * Simulates heavy load on the Healthcare Management Application
 */

const autocannon = require('autocannon');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../../src/utils/logger');

// Default options
const DEFAULT_OPTIONS = {
  duration: 30, // seconds
  connections: 10,
  pipelining: 1,
  timeout: 10,
  headers: {
    'Content-Type': 'application/json'
  }
};

// Test scenarios
const SCENARIOS = {
  search: {
    method: 'GET',
    path: '/api/search?q=diabetes&type=all',
    title: 'Search API'
  },
  patientList: {
    method: 'GET',
    path: '/api/patients?limit=20&page=1',
    title: 'Patient Listing'
  },
  appointmentBooking: {
    method: 'POST',
    path: '/api/appointments',
    title: 'Appointment Booking',
    body: JSON.stringify({
      patientId: '000000000000000000000001',
      doctorId: '000000000000000000000002',
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      time: '10:00',
      duration: 30,
      type: 'Regular Checkup',
      notes: 'Load test appointment',
      status: 'scheduled'
    })
  },
  patientHistory: {
    method: 'GET',
    path: '/api/patient-medical-records/000000000000000000000001?includeDetails=true',
    title: 'Patient Medical History'
  },
  dashboard: {
    method: 'GET',
    path: '/api/metrics/business',
    title: 'Dashboard Metrics'
  }
};

/**
 * Load testing utility
 */
const loadTesting = {
  /**
   * Run a load test for a specific scenario
   * @param {string} scenarioName - Scenario name
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test results
   */
  async runTest(scenarioName, options = {}) {
    const scenario = SCENARIOS[scenarioName];
    if (!scenario) {
      throw new Error(`Unknown scenario: ${scenarioName}`);
    }
    
    // Merge options
    const testOptions = {
      ...DEFAULT_OPTIONS,
      ...options,
      url: options.url || 'http://localhost:3000',
      title: scenario.title,
      method: scenario.method,
      path: scenario.path
    };
    
    if (scenario.body && scenario.method !== 'GET') {
      testOptions.body = scenario.body;
    }
    
    // Add authentication if provided
    if (options.token) {
      testOptions.headers = {
        ...testOptions.headers,
        'Authorization': `Bearer ${options.token}`
      };
    }
    
    logger.info(`Starting load test for ${scenario.title}...`);
    
    // Run the test
    return new Promise((resolve, reject) => {
      const instance = autocannon(testOptions, (err, result) => {
        if (err) {
          logger.error(`Error running load test for ${scenario.title}:`, err);
          return reject(err);
        }
        
        logger.info(`Load test for ${scenario.title} completed`);
        
        // Save results
        if (options.saveResults) {
          const resultsDir = path.join(__dirname, '../../performance-results/load-tests');
          
          if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
          }
          
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `${scenarioName}-${timestamp}.json`;
          const filePath = path.join(resultsDir, filename);
          
          fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
          logger.info(`Load test results saved to ${filePath}`);
        }
        
        resolve(result);
      });
      
      // Log progress to console
      autocannon.track(instance, { renderProgressBar: true });
    });
  },
  
  /**
   * Run load tests for all scenarios
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test results for all scenarios
   */
  async runAllTests(options = {}) {
    // Get authentication token first
    let token = options.token;
    
    if (!token && !options.skipAuth) {
      try {
        logger.info('Getting authentication token...');
        
        const response = await axios.post(`${options.url || 'http://localhost:3000'}/api/auth/login`, {
          email: options.email || 'admin@example.com',
          password: options.password || 'password123'
        });
        
        token = response.data.token;
        logger.info('Authentication token acquired');
      } catch (error) {
        logger.error('Error getting authentication token:', error);
        
        if (!options.continueWithoutAuth) {
          throw error;
        }
      }
    }
    
    // Run all scenarios
    const testOptions = {
      ...options,
      token
    };
    
    const results = {};
    
    // Run tests sequentially to avoid resource contention
    for (const scenarioName of Object.keys(SCENARIOS)) {
      if (options.scenarios && !options.scenarios.includes(scenarioName)) {
        continue;
      }
      
      try {
        results[scenarioName] = await this.runTest(scenarioName, testOptions);
      } catch (error) {
        logger.error(`Error running ${scenarioName} load test:`, error);
        results[scenarioName] = { error: error.message };
      }
    }
    
    // Generate summary report
    if (options.generateReport) {
      const summary = this.generateSummaryReport(results);
      
      if (options.saveResults) {
        const resultsDir = path.join(__dirname, '../../performance-results/load-tests');
        
        if (!fs.existsSync(resultsDir)) {
          fs.mkdirSync(resultsDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `summary-${timestamp}.json`;
        const filePath = path.join(resultsDir, filename);
        
        fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));
        logger.info(`Load test summary saved to ${filePath}`);
      }
      
      results.summary = summary;
    }
    
    return results;
  },
  
  /**
   * Generate a summary report from test results
   * @param {Object} results - Test results
   * @returns {Object} Summary report
   */
  generateSummaryReport(results) {
    const summary = {
      timestamp: new Date().toISOString(),
      scenarios: {},
      overallLatency: {
        min: Number.MAX_SAFE_INTEGER,
        max: 0,
        average: 0,
        p95: 0,
        p99: 0
      },
      totalRequests: 0,
      totalErrors: 0,
      totalDuration: 0,
      averageRps: 0
    };
    
    let validScenarios = 0;
    
    // Process each scenario
    for (const [scenarioName, result] of Object.entries(results)) {
      if (result.error || !result.latency) {
        summary.scenarios[scenarioName] = { error: result.error || 'Invalid result' };
        continue;
      }
      
      summary.scenarios[scenarioName] = {
        title: SCENARIOS[scenarioName].title,
        method: SCENARIOS[scenarioName].method,
        path: SCENARIOS[scenarioName].path,
        latency: {
          min: result.latency.min,
          max: result.latency.max,
          average: result.latency.average,
          p95: result.latency.p95,
          p99: result.latency.p99
        },
        requests: {
          total: result.requests.total,
          perSecond: result.requests.average,
          successful: result.requests.total - (result.errors || 0),
          failed: result.errors || 0
        },
        throughput: {
          total: result.throughput.total,
          perSecond: result.throughput.average
        }
      };
      
      // Update overall statistics
      summary.overallLatency.min = Math.min(summary.overallLatency.min, result.latency.min);
      summary.overallLatency.max = Math.max(summary.overallLatency.max, result.latency.max);
      summary.overallLatency.average += result.latency.average;
      summary.overallLatency.p95 += result.latency.p95;
      summary.overallLatency.p99 += result.latency.p99;
      
      summary.totalRequests += result.requests.total;
      summary.totalErrors += (result.errors || 0);
      summary.totalDuration += result.duration;
      summary.averageRps += result.requests.average;
      
      validScenarios++;
    }
    
    // Calculate averages
    if (validScenarios > 0) {
      summary.overallLatency.average /= validScenarios;
      summary.overallLatency.p95 /= validScenarios;
      summary.overallLatency.p99 /= validScenarios;
      summary.averageRps /= validScenarios;
      
      if (summary.overallLatency.min === Number.MAX_SAFE_INTEGER) {
        summary.overallLatency.min = 0;
      }
    }
    
    return summary;
  },
  
  /**
   * Compare two load test results
   * @param {Object} current - Current test results
   * @param {Object} previous - Previous test results
   * @param {string} scenarioName - Scenario name for context
   * @returns {Object} Comparison results
   */
  compareResults(current, previous, scenarioName) {
    if (!current || !current.latency || !previous || !previous.latency) {
      return { error: 'Invalid test results for comparison' };
    }
    
    // Calculate differences and percentage changes
    const calculateDiff = (curr, prev) => {
      const diff = curr - prev;
      const percentChange = prev !== 0 ? (diff / prev) * 100 : 0;
      
      return {
        value: curr,
        previous: prev,
        diff,
        percentChange: parseFloat(percentChange.toFixed(2))
      };
    };
    
    const comparison = {
      scenario: scenarioName,
      title: SCENARIOS[scenarioName]?.title || 'Unknown Scenario',
      timestamp: new Date().toISOString(),
      latency: {
        min: calculateDiff(current.latency.min, previous.latency.min),
        max: calculateDiff(current.latency.max, previous.latency.max),
        average: calculateDiff(current.latency.average, previous.latency.average),
        p95: calculateDiff(current.latency.p95, previous.latency.p95),
        p99: calculateDiff(current.latency.p99, previous.latency.p99)
      },
      requests: {
        perSecond: calculateDiff(current.requests.average, previous.requests.average),
        total: calculateDiff(current.requests.total, previous.requests.total),
        failed: calculateDiff(current.errors || 0, previous.errors || 0)
      },
      throughput: {
        perSecond: calculateDiff(current.throughput.average, previous.throughput.average)
      }
    };
    
    // Calculate overall performance change
    // Lower latency and fewer errors are better, higher throughput and RPS are better
    const latencyImprovement = -comparison.latency.average.percentChange; // negative change in latency is good
    const throughputImprovement = comparison.throughput.perSecond.percentChange; // positive change in throughput is good
    const errorRateChange = comparison.requests.failed.percentChange; // negative change in errors is good
    
    // Weighted average (latency is most important)
    const overallImprovement = (latencyImprovement * 0.5) + 
                               (throughputImprovement * 0.3) - 
                               (errorRateChange * 0.2);
    
    comparison.overallImprovement = parseFloat(overallImprovement.toFixed(2));
    
    return comparison;
  },
  
  /**
   * Load previous test results for comparison
   * @param {string} scenarioName - Scenario name
   * @returns {Promise<Object|null>} Previous test results or null if not found
   */
  async loadPreviousResults(scenarioName) {
    try {
      const resultsDir = path.join(__dirname, '../../performance-results/load-tests');
      
      if (!fs.existsSync(resultsDir)) {
        return null;
      }
      
      // Get all files for this scenario
      const files = fs.readdirSync(resultsDir)
        .filter(file => file.startsWith(scenarioName) && file.endsWith('.json'))
        .sort(); // Sort by name, which includes timestamp
      
      if (files.length === 0) {
        return null;
      }
      
      // Get the most recent result
      const latestFile = files[files.length - 1];
      const filePath = path.join(resultsDir, latestFile);
      
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error(`Error loading previous results for ${scenarioName}:`, error);
      return null;
    }
  }
};

module.exports = loadTesting;
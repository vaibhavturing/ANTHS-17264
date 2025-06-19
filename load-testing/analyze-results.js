// load-testing/analyze-results.js
// Script to analyze the load test results
// Usage: node analyze-results.js path-to-results.json

const fs = require('fs');
const path = require('path');

// Get results file path from command line
const resultsFile = process.argv[2];

if (!resultsFile) {
  console.error('Please provide the path to the results JSON file');
  process.exit(1);
}

// Load and parse the results file
try {
  const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  analyzeResults(results);
} catch (error) {
  console.error('Error reading or parsing results file:', error.message);
  process.exit(1);
}

function analyzeResults(results) {
  console.log('=== LOAD TEST ANALYSIS ===');
  console.log(`Test duration: ${formatDuration(results.duration)}`);
  console.log(`Total requests: ${results.requests.total}`);
  console.log(`Successful requests: ${results.requests.completed}`);
  console.log(`Failed requests: ${results.requests.failed}`);
  console.log(`Success rate: ${(results.requests.completed / results.requests.total * 100).toFixed(2)}%`);
  console.log('\n=== RESPONSE TIMES (ms) ===');
  console.log(`Min: ${results.latency.min}`);
  console.log(`Max: ${results.latency.max}`);
  console.log(`Average: ${results.latency.mean.toFixed(2)}`);
  console.log(`Median: ${results.latency.median}`);
  console.log(`95th percentile: ${results.latency.p95}`);
  console.log(`99th percentile: ${results.latency.p99}`);
  
  console.log('\n=== REQUESTS PER SECOND ===');
  console.log(`Mean: ${results.rps.mean.toFixed(2)} req/sec`);
  console.log(`Max: ${results.rps.max.toFixed(2)} req/sec`);
  
  console.log('\n=== ERROR ANALYSIS ===');
  if (results.errors && Object.keys(results.errors).length > 0) {
    for (const [code, count] of Object.entries(results.errors)) {
      console.log(`${code}: ${count} errors`);
    }
  } else {
    console.log('No errors reported');
  }
  
  console.log('\n=== SCENARIO ANALYSIS ===');
  if (results.scenarioCounts) {
    for (const [scenario, count] of Object.entries(results.scenarioCounts)) {
      console.log(`${scenario}: ${count} users`);
    }
  }
  
  console.log('\n=== PERFORMANCE EVALUATION ===');
  
  // Define performance thresholds
  const thresholds = {
    p95ResponseTime: 500, // 95% of requests should be under 500ms
    errorRate: 0.01,      // Error rate should be under 1%
  };
  
  const errorRate = results.requests.failed / results.requests.total;
  const passedP95 = results.latency.p95 <= thresholds.p95ResponseTime;
  const passedErrorRate = errorRate <= thresholds.errorRate;
  
  console.log(`95% Response Time Threshold (${thresholds.p95ResponseTime}ms): ${passedP95 ? 'PASSED' : 'FAILED'}`);
  console.log(`Error Rate Threshold (${thresholds.errorRate * 100}%): ${passedErrorRate ? 'PASSED' : 'FAILED'}`);
  
  // Overall assessment
  if (passedP95 && passedErrorRate) {
    console.log('\nOVERALL: PASSED - System can handle the load');
  } else {
    console.log('\nOVERALL: FAILED - System optimization needed');
    
    // Provide specific recommendations
    console.log('\n=== OPTIMIZATION RECOMMENDATIONS ===');
    
    if (!passedP95) {
      console.log('- Response Time:');
      console.log('  * Consider additional caching for frequently accessed data');
      console.log('  * Optimize database queries (add indexes, use projections)');
      console.log('  * Add more application instances to distribute load');
      console.log('  * Increase database connection pool size');
    }
    
    if (!passedErrorRate) {
      console.log('- Error Rate:');
      console.log('  * Review error logs to identify common failure patterns');
      console.log('  * Implement retry mechanisms for transient errors');
      console.log('  * Check resource limits (memory, connections, etc.)');
      console.log('  * Ensure database can handle concurrent write operations');
    }
  }
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
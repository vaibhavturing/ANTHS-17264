/**
 * Memory Leak Detection Script
 * Runs memory usage analysis on the application
 */

const axios = require('axios');
const v8 = require('v8');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';
const ITERATIONS = 100;
const ENDPOINTS = [
  { method: 'GET', path: '/patients?limit=20' },
  { method: 'GET', path: '/appointments?limit=20' },
  { method: 'GET', path: '/medical-records?limit=20' },
  { method: 'GET', path: '/medications?limit=20' },
  // Add more endpoints to test here
];

// Create directory for snapshots
const snapshotDir = path.join(__dirname, '../diagnostics/memory-analysis');
if (!fs.existsSync(snapshotDir)) {
  fs.mkdirSync(snapshotDir, { recursive: true });
}

// Take heap snapshot
function takeSnapshot(name) {
  const filename = path.join(snapshotDir, `${name}-${Date.now()}.heapsnapshot`);
  const snapshot = v8.getHeapSnapshot();
  const fileStream = fs.createWriteStream(filename);
  snapshot.pipe(fileStream);
  console.log(`Snapshot saved to ${filename}`);
  return filename;
}

// Format memory size
function formatMemorySize(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Print memory usage
function printMemoryUsage(label) {
  const usage = process.memoryUsage();
  console.log(`Memory Usage (${label}):`);
  console.log(`  RSS: ${formatMemorySize(usage.rss)}`);
  console.log(`  Heap Total: ${formatMemorySize(usage.heapTotal)}`);
  console.log(`  Heap Used: ${formatMemorySize(usage.heapUsed)}`);
  console.log(`  External: ${formatMemorySize(usage.external)}`);
}

// Create API client with authentication
async function createApiClient() {
  // Get authentication token
  const authResponse = await axios.post(`${BASE_URL}/auth/login`, {
    email: process.env.TEST_USER_EMAIL || 'admin@example.com',
    password: process.env.TEST_USER_PASSWORD || 'password123'
  });
  
  const token = authResponse.data.token;
  
  // Return configured axios instance
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}

// Run memory test
async function runMemoryTest() {
  console.log('Starting memory leak detection...');
  printMemoryUsage('Initial');
  
  // Take initial snapshot
  takeSnapshot('initial');
  
  try {
    const api = await createApiClient();
    
    // Run tests for each endpoint
    for (const endpoint of ENDPOINTS) {
      console.log(`\nTesting endpoint: ${endpoint.method} ${endpoint.path}`);
      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();
      
      // Make repeated requests
      for (let i = 0; i < ITERATIONS; i++) {
        if (i % 10 === 0) {
          process.stdout.write('.');
        }
        
        try {
          if (endpoint.method === 'GET') {
            await api.get(endpoint.path);
          } else if (endpoint.method === 'POST') {
            await api.post(endpoint.path, endpoint.data || {});
          }
          
          // Force garbage collection if available
          global.gc && global.gc();
        } catch (err) {
          console.error(`Error on iteration ${i}: ${err.message}`);
        }
      }
      
      // Calculate and display results
      const endMemory = process.memoryUsage().heapUsed;
      const endTime = performance.now();
      const memoryDiff = endMemory - startMemory;
      const timeDiff = endTime - startTime;
      
      console.log(`\n${endpoint.method} ${endpoint.path} results:`);
      console.log(`  Iterations: ${ITERATIONS}`);
      console.log(`  Total time: ${(timeDiff / 1000).toFixed(2)}s`);
      console.log(`  Average time per request: ${(timeDiff / ITERATIONS).toFixed(2)}ms`);
      console.log(`  Memory change: ${formatMemorySize(memoryDiff)}`);
      console.log(`  Memory change per request: ${formatMemorySize(memoryDiff / ITERATIONS)}`);
      
      // Take endpoint-specific snapshot
      takeSnapshot(`after-${endpoint.method}-${endpoint.path.replace(/\//g, '-')}`);
    }
    
    // Take final snapshot
    printMemoryUsage('Final');
    takeSnapshot('final');
    
    console.log('\nMemory leak detection completed.');
    console.log('Analyze the heap snapshots using Chrome DevTools for detailed memory usage.');
    
  } catch (error) {
    console.error('Error during memory test:', error.message);
    process.exit(1);
  }
}

// Run the test
runMemoryTest();
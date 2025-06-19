/**
 * Load testing script for key application endpoints
 *
 * Tests application behavior under simulated user load.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p95<500'],   // 95% of requests must complete within 500ms
    'http_req_duration{staticAssets:yes}': ['p95<100'],  // 95% of static asset requests within 100ms
  },
};

export default function() {
  // Test key endpoints under load
}
/**
 * Record Access Tracker Middleware
 * File: src/middleware/record-access-tracker.middleware.js
 * 
 * This middleware tracks high volume record access and logs suspicious activity.
 * It monitors APIs that access sensitive patient data and medical records.
 */

const securityLogger = require('../services/securityLogger.service');
const config = require('../config/config');
const logger = require('../utils/logger');

// Memory-based access tracker (could be moved to Redis for distributed setup)
const accessTracker = {
  // Structure: { userId: { recordType: { count, firstAccess } } }
  records: {},
  
  // Cleanup interval (5 minutes)
  cleanupInterval: 5 * 60 * 1000,
  
  // Initialize the tracker
  init() {
    // Set up periodic cleanup to prevent memory leaks
    setInterval(() => this.cleanup(), this.cleanupInterval);
  },
  
  // Record an access
  trackAccess(userId, recordType) {
    if (!userId || !recordType) return;
    
    const now = Date.now();
    
    // Initialize user record if needed
    if (!this.records[userId]) {
      this.records[userId] = {};
    }
    
    // Initialize record type if needed
    if (!this.records[userId][recordType]) {
      this.records[userId][recordType] = {
        count: 0,
        firstAccess: now
      };
    }
    
    // Increment count
    this.records[userId][recordType].count++;
  },
  
  // Get access data for a user and record type
  getAccess(userId, recordType) {
    if (!this.records[userId] || !this.records[userId][recordType]) {
      return null;
    }
    
    return this.records[userId][recordType];
  },
  
  // Check if a user has suspicious access patterns
  checkSuspiciousAccess(userId, recordType) {
    const access = this.getAccess(userId, recordType);
    if (!access) return null;
    
    const now = Date.now();
    const minutesSinceFirstAccess = (now - access.firstAccess) / (60 * 1000);
    
    // Avoid division by zero
    if (minutesSinceFirstAccess < 0.1) return null;
    
    // Calculate rate (records per minute)
    const rate = access.count / minutesSinceFirstAccess;
    
    // Get thresholds from config or use defaults
    const thresholds = config.security?.monitoring?.recordAccessRateThresholds || {
      default: { medium: 10, high: 20, critical: 40 },
      patient: { medium: 6, high: 12, critical: 30 },
      medicalRecord: { medium: 5, high: 10, critical: 25 },
      prescription: { medium: 8, high: 15, critical: 35 }
    };
    
    // Get threshold for this record type or use default
    const threshold = thresholds[recordType] || thresholds.default;
    
    // Determine severity based on rate
    let severity = null;
    if (rate >= threshold.critical) {
      severity = 'critical';
    } else if (rate >= threshold.high) {
      severity = 'high';
    } else if (rate >= threshold.medium) {
      severity = 'medium';
    }
    
    // Return result if suspicious
    if (severity) {
      return {
        userId,
        recordType,
        count: access.count,
        timeWindowMinutes: minutesSinceFirstAccess,
        rate,
        severity
      };
    }
    
    return null;
  },
  
  // Clear old records to prevent memory leaks
  cleanup() {
    const now = Date.now();
    const cutoff = now - (60 * 60 * 1000); // 1 hour
    
    for (const userId in this.records) {
      for (const recordType in this.records[userId]) {
        const access = this.records[userId][recordType];
        
        // Remove records older than cutoff
        if (access.firstAccess < cutoff) {
          delete this.records[userId][recordType];
        }
      }
      
      // Clean up empty user entries
      if (Object.keys(this.records[userId]).length === 0) {
        delete this.records[userId];
      }
    }
  },
  
  // Reset tracking for testing
  reset() {
    this.records = {};
  }
};

// Initialize the tracker
accessTracker.init();

/**
 * Map request patterns to record types
 * @param {Object} req - Express request object
 * @returns {string|null} Record type or null if not tracked
 */
const getRecordTypeFromRequest = (req) => {
  const { path, method } = req;
  
  // URL patterns to track
  const patterns = [
    { regex: /\/api\/patients\/?$/, method: 'GET', recordType: 'patient' },
    { regex: /\/api\/patients\/[a-f0-9]+\/?$/, method: 'GET', recordType: 'patient' },
    { regex: /\/api\/medical-records\/?$/, method: 'GET', recordType: 'medicalRecord' },
    { regex: /\/api\/medical-records\/[a-f0-9]+\/?$/, method: 'GET', recordType: 'medicalRecord' },
    { regex: /\/api\/prescriptions\/?$/, method: 'GET', recordType: 'prescription' },
    { regex: /\/api\/prescriptions\/[a-f0-9]+\/?$/, method: 'GET', recordType: 'prescription' },
    { regex: /\/api\/patient-medical-records\/[a-f0-9]+\/?$/, method: 'GET', recordType: 'medicalRecord' },
    { regex: /\/api\/appointments\/?$/, method: 'GET', recordType: 'appointment' },
    { regex: /\/api\/appointments\/[a-f0-9]+\/?$/, method: 'GET', recordType: 'appointment' }
  ];
  
  // Find matching pattern
  for (const pattern of patterns) {
    if (pattern.regex.test(path) && pattern.method === method) {
      return pattern.recordType;
    }
  }
  
  return null;
};

/**
 * Middleware to track record access
 */
const recordAccessTrackerMiddleware = async (req, res, next) => {
  // Skip if no authenticated user
  if (!req.user || !req.user.id) {
    return next();
  }
  
  // Use non-blocking pattern to avoid slowing down the request
  const originalSend = res.send;
  
  res.send = function(body) {
    // Process after response is sent
    setImmediate(async () => {
      try {
        // Check if this request accesses records we want to track
        const recordType = getRecordTypeFromRequest(req);
        
        if (recordType) {
          // Track this access
          accessTracker.trackAccess(req.user.id, recordType);
          
          // Check for suspicious access patterns
          const suspiciousAccess = accessTracker.checkSuspiciousAccess(req.user.id, recordType);
          
          // Log suspicious access if detected
          if (suspiciousAccess) {
            await securityLogger.logMultipleRecordAccess(
              req.user.id,
              recordType,
              suspiciousAccess.count,
              suspiciousAccess.timeWindowMinutes,
              {
                severity: suspiciousAccess.severity,
                rate: suspiciousAccess.rate,
                path: req.originalUrl,
                method: req.method
              }
            );
          }
        }
      } catch (error) {
        // Log error but don't affect request processing
        logger.error(`Error in record access tracking: ${error.message}`);
      }
    });
    
    // Call the original send function
    originalSend.call(this, body);
  };
  
  next();
};

// Export middleware and tracker for testing
module.exports = {
  recordAccessTrackerMiddleware,
  accessTracker
};
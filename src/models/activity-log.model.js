// File: src/models/activity-log.model.js
// New file for activity logging model

const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const logger = require('../utils/logger');

/**
 * Activity Log Schema for HIPAA-compliant audit trails
 * Tracks user actions across the Healthcare Management Application
 */
const activityLogSchema = new mongoose.Schema({
  // User who performed the action (null for anonymous/system actions)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // Username for quick reference (in case user is deleted)
  username: {
    type: String
  },
  
  // User role at the time of action
  userRole: {
    type: String
  },
  
  // Action category (login, data_access, data_modification, etc.)
  category: {
    type: String,
    required: true,
    enum: [
      'authentication',     // Login attempts, logout, password changes
      'data_access',        // Viewing sensitive records
      'data_modification',  // Creating, updating, deleting records
      'permission',         // Permission or role changes
      'configuration',      // System configuration changes
      'user_management',    // User account operations
      'session_management', // Session actions
      'api_access',         // API endpoint access
      'export',             // Data export operations
      'system'              // System-level events
    ],
    index: true
  },
  
  // Specific action performed
  action: {
    type: String,
    required: true,
    index: true
  },
  
  // Status of the action (success, failure, denied, etc.)
  status: {
    type: String,
    required: true,
    enum: ['success', 'failure', 'denied', 'error', 'warning', 'info'],
    index: true
  },
  
  // IP address of client
  ipAddress: {
    type: String,
    required: true
  },
  
  // User agent string
  userAgent: {
    type: String
  },
  
  // Session ID associated with the action
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    index: true
  },
  
  // Resource type affected (patient, doctor, medical_record, etc.)
  resourceType: {
    type: String,
    index: true
  },
  
  // ID of affected resource
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  
  // Description of the activity
  description: {
    type: String,
    required: true
  },
  
  // Additional details (JSON object with context-specific information)
  // Sanitized to remove sensitive data
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Changes made (e.g., before/after values for updates)
  // Sanitized to remove sensitive data
  changes: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Reason for action (if provided by user)
  reason: {
    type: String
  },
  
  // Retention policy expiration (when this log should be deleted/archived)
  retentionDate: {
    type: Date,
    index: true
  }
}, baseSchema.baseOptions);

// Compound indexes for frequent queries
activityLogSchema.index({ category: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
activityLogSchema.index({ status: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

// Sanitize details and changes to remove sensitive information
activityLogSchema.pre('save', function(next) {
  try {
    // Sanitize details object
    if (this.details) {
      this.details = sanitizeObject(this.details);
    }
    
    // Sanitize changes object
    if (this.changes) {
      this.changes = sanitizeObject(this.changes);
    }
    
    // Set retention date based on category if not already set
    if (!this.retentionDate) {
      // Healthcare regulations typically require 6-7 years retention
      // Add more granular retention policies by category as needed
      const retentionYears = 7; // Default 7 years for HIPAA compliance
      
      this.retentionDate = new Date();
      this.retentionDate.setFullYear(this.retentionDate.getFullYear() + retentionYears);
    }
    
    next();
  } catch (error) {
    logger.error('Error sanitizing activity log data', { error: error.message });
    next(error);
  }
});

// Helper function to sanitize objects by removing sensitive fields
function sanitizeObject(obj) {
  if (!obj) return obj;
  
  const sanitized = { ...obj };
  
  // List of sensitive fields to remove or mask
  const sensitiveFields = [
    'password', 'passwordHash', 'ssn', 'socialSecurityNumber', 
    'creditCard', 'cvv', 'accessToken', 'refreshToken',
    'passwordResetToken'
  ];
  
  // Remove or mask sensitive fields
  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase();
    
    // Check if this is a sensitive field
    if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    }
    // Recursively sanitize nested objects
    else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key]);
    }
  });
  
  return sanitized;
}

// Static method to clean up expired logs based on retention policy
activityLogSchema.statics.cleanupExpiredLogs = async function() {
  try {
    const result = await this.deleteMany({
      retentionDate: { $lt: new Date() }
    });
    
    logger.info(`Cleaned up ${result.deletedCount || 0} expired activity logs`);
    return result;
  } catch (error) {
    logger.error('Failed to clean up expired activity logs', { error: error.message });
    throw error;
  }
};

// Static method to add a log entry
activityLogSchema.statics.addEntry = async function(logData) {
  try {
    // Create and return the log entry
    return await this.create(logData);
  } catch (error) {
    logger.error('Failed to create activity log entry', { error: error.message });
    // Log the error but don't throw (to avoid disrupting main app flow)
    return null;
  }
};

// Static method to get activity logs for a specific user
activityLogSchema.statics.getLogsForUser = async function(userId, options = {}) {
  const query = { userId };
  
  // Apply filters
  if (options.category) query.category = options.category;
  if (options.action) query.action = options.action;
  if (options.status) query.status = options.status;
  if (options.startDate || options.endDate) {
    query.createdAt = {};
    if (options.startDate) query.createdAt.$gte = new Date(options.startDate);
    if (options.endDate) query.createdAt.$lte = new Date(options.endDate);
  }
  
  // Build sort options
  const sort = options.sort || { createdAt: -1 };
  
  // Build pagination options
  const page = parseInt(options.page) || 1;
  const limit = parseInt(options.limit) || 20;
  const skip = (page - 1) * limit;
  
  // Execute query with pagination
  const logs = await this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
    
  // Get total count for pagination
  const total = await this.countDocuments(query);
  
  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to get resource access history
activityLogSchema.statics.getResourceAccessHistory = async function(resourceType, resourceId, options = {}) {
  const query = { 
    resourceType,
    resourceId
  };
  
  // Apply additional filters
  if (options.userId) query.userId = options.userId;
  if (options.action) query.action = options.action;
  if (options.status) query.status = options.status;
  if (options.startDate || options.endDate) {
    query.createdAt = {};
    if (options.startDate) query.createdAt.$gte = new Date(options.startDate);
    if (options.endDate) query.createdAt.$lte = new Date(options.endDate);
  }
  
  // Build sort options
  const sort = options.sort || { createdAt: -1 };
  
  // Build pagination options
  const page = parseInt(options.page) || 1;
  const limit = parseInt(options.limit) || 20;
  const skip = (page - 1) * limit;
  
  // Execute query
  const logs = await this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('userId', 'firstName lastName email role')
    .lean();
  
  // Get total count
  const total = await this.countDocuments(query);
  
  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to generate HIPAA compliance reports
activityLogSchema.statics.generateComplianceReport = async function(options = {}) {
  try {
    const query = {};
    
    // Apply filters
    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) query.createdAt.$gte = new Date(options.startDate);
      if (options.endDate) query.createdAt.$lte = new Date(options.endDate);
    }
    
    // Aggregation pipeline for compliance reports
    const pipeline = [
      { $match: query },
      
      // Group by category and status
      {
        $group: {
          _id: {
            category: '$category',
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      
      // Reshape for easier client-side processing
      {
        $group: {
          _id: '$_id.category',
          activities: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          },
          totalCount: { $sum: '$count' }
        }
      },
      
      // Final structure
      {
        $project: {
          category: '$_id',
          activities: 1,
          totalCount: 1,
          _id: 0
        }
      },
      
      // Sort by category
      { $sort: { category: 1 } }
    ];
    
    // Execute aggregation
    const categoryStats = await this.aggregate(pipeline);
    
    // Additional statistics for specific compliance requirements
    
    // 1. Failed login attempts
    const failedLogins = await this.countDocuments({
      category: 'authentication',
      action: 'login',
      status: 'failure',
      ...query
    });
    
    // 2. Unauthorized access attempts
    const unauthorizedAccess = await this.countDocuments({
      status: 'denied',
      ...query
    });
    
    // 3. Patient record operations
    const patientRecordOperations = await this.countDocuments({
      resourceType: 'patient',
      ...query
    });
    
    // 4. PHI exports
    const phiExports = await this.countDocuments({
      category: 'export',
      ...query
    });
    
    // 5. Permission changes
    const permissionChanges = await this.countDocuments({
      category: 'permission',
      ...query
    });
    
    return {
      timeframe: {
        startDate: options.startDate || 'All time',
        endDate: options.endDate || new Date()
      },
      summary: {
        totalEvents: await this.countDocuments(query),
        failedLogins,
        unauthorizedAccess,
        patientRecordOperations,
        phiExports,
        permissionChanges
      },
      categoryBreakdown: categoryStats
    };
  } catch (error) {
    logger.error('Failed to generate compliance report', { error: error.message });
    throw error;
  }
};

// Create the model
const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;
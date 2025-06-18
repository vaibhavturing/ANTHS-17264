// src/services/audit.service.js

const AuditLog = require('../models/auditLog.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Service to manage audit logging and reporting
 */
class AuditService {
  /**
   * Create a new audit log entry
   * @param {Object} logData - Log data
   * @returns {Promise<Object>} Created audit log
   */
  async createLog(logData) {
    try {
      // Get user details if userId is provided
      if (logData.userId) {
        const user = await User.findById(logData.userId).select('name email role');
        if (user) {
          logData.userDetails = {
            name: user.name,
            email: user.email,
            role: user.role
          };
        }
      }
      
      const auditLog = new AuditLog(logData);
      return await auditLog.save();
    } catch (error) {
      logger.error(`Error creating audit log: ${error.message}`, { error });
      // We don't want to throw an error here, as this would disrupt the main operation
      // Just log the error and return null
      return null;
    }
  }

  /**
   * Get audit logs with filtering options
   * @param {Object} filters - Filters to apply
   * @param {number} page - Page number
   * @param {number} limit - Results per page
   * @returns {Promise<Object>} Audit logs with pagination info
   */
  async getLogs(filters = {}, page = 1, limit = 20) {
    try {
      const query = this.buildQuery(filters);
      
      const skip = (page - 1) * limit;
      
      const [logs, totalCount] = await Promise.all([
        AuditLog.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(query)
      ]);
      
      return {
        data: logs,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error(`Error getting audit logs: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Build a MongoDB query from filter parameters
   * @param {Object} filters - Filter parameters
   * @returns {Object} MongoDB query object
   */
  buildQuery(filters) {
    const query = {};
    
    // Filter by entity type
    if (filters.entityType) {
      query.entityType = filters.entityType;
    }
    
    // Filter by entity ID
    if (filters.entityId) {
      query.entityId = mongoose.Types.ObjectId(filters.entityId);
    }
    
    // Filter by patient ID
    if (filters.patientId) {
      query.patientId = mongoose.Types.ObjectId(filters.patientId);
    }
    
    // Filter by user ID
    if (filters.userId) {
      query.userId = mongoose.Types.ObjectId(filters.userId);
    }
    
    // Filter by user role
    if (filters.userRole) {
      query['userDetails.role'] = filters.userRole;
    }
    
    // Filter by action
    if (filters.action) {
      query.action = filters.action;
    }
    
    // Filter by success/failure
    if (filters.successful !== undefined) {
      query.successful = filters.successful;
    }
    
    // Filter by date range
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }
    
    return query;
  }
  
  /**
   * Generate a report on record access for a specific patient
   * @param {string} patientId - Patient ID
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Report data
   */
  async generatePatientAccessReport(patientId, options = {}) {
    try {
      const { startDate, endDate } = options;
      
      // Build date filter
      const dateFilter = {};
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.$lte = new Date(endDate);
      }
      
      // Query for all logs related to this patient
      const query = {
        patientId: mongoose.Types.ObjectId(patientId),
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      };
      
      // Aggregate to get report data
      const accessLogs = await AuditLog.find(query)
        .sort({ createdAt: -1 })
        .lean();
      
      // Get unique users who accessed the records
      const userIds = [...new Set(accessLogs.map(log => log.userId.toString()))];
      
      // Get user details
      const users = await User.find({
        _id: { $in: userIds }
      }).select('name email role').lean();
      
      // Create a map of user IDs to user objects
      const userMap = {};
      users.forEach(user => {
        userMap[user._id.toString()] = user;
      });
      
      // Build summary statistics
      const summary = {
        totalAccesses: accessLogs.length,
        uniqueUsers: userIds.length,
        accessesByRole: {},
        accessesByAction: {
          view: 0,
          create: 0,
          update: 0,
          delete: 0
        }
      };
      
      // Count accesses by role and action
      accessLogs.forEach(log => {
        const userRole = log.userDetails?.role || userMap[log.userId.toString()]?.role || 'unknown';
        
        // Count by role
        if (!summary.accessesByRole[userRole]) {
          summary.accessesByRole[userRole] = 0;
        }
        summary.accessesByRole[userRole]++;
        
        // Count by action
        summary.accessesByAction[log.action]++;
      });
      
      // Format the logs with user details
      const formattedLogs = accessLogs.map(log => ({
        ...log,
        userDetails: log.userDetails || userMap[log.userId.toString()] || {
          name: 'Unknown User',
          email: 'unknown',
          role: 'unknown'
        }
      }));
      
      return {
        patientId,
        summary,
        logs: formattedLogs,
        timeframe: {
          startDate: startDate || accessLogs[accessLogs.length - 1]?.createdAt,
          endDate: endDate || new Date()
        }
      };
    } catch (error) {
      logger.error(`Error generating patient access report: ${error.message}`, { error, patientId });
      throw error;
    }
  }
  
  /**
   * Generate a summary report of system-wide access activity
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Report data
   */
  async generateSystemAccessReport(options = {}) {
    try {
      const { startDate, endDate, groupBy = 'day' } = options;
      
      // Build date filter
      const dateFilter = {};
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      } else {
        // Default to last 30 days if no start date
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateFilter.$gte = thirtyDaysAgo;
      }
      
      if (endDate) {
        dateFilter.$lte = new Date(endDate);
      }
      
      // Determine date grouping format
      let dateFormat;
      switch (groupBy) {
        case 'hour':
          dateFormat = { year: '$year', month: '$month', day: '$dayOfMonth', hour: '$hour' };
          break;
        case 'day':
          dateFormat = { year: '$year', month: '$month', day: '$dayOfMonth' };
          break;
        case 'week':
          dateFormat = { year: '$year', week: '$week' };
          break;
        case 'month':
          dateFormat = { year: '$year', month: '$month' };
          break;
        default:
          dateFormat = { year: '$year', month: '$month', day: '$dayOfMonth' };
      }
      
      // Build aggregation pipeline
      const pipeline = [
        // Match by date range
        {
          $match: {
            ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
          }
        },
        // Group by date, action, and role
        {
          $group: {
            _id: {
              date: dateFormat,
              action: '$action',
              role: '$userDetails.role'
            },
            count: { $sum: 1 }
          }
        },
        // Reshape for better usability
        {
          $group: {
            _id: '$_id.date',
            actions: {
              $push: {
                action: '$_id.action',
                role: '$_id.role',
                count: '$count'
              }
            },
            totalCount: { $sum: '$count' }
          }
        },
        // Sort by date
        { $sort: { '_id': 1 } }
      ];
      
      const accessStats = await AuditLog.aggregate(pipeline);
      
      // Format the results
      const formattedStats = accessStats.map(stat => {
        // Format the date string based on grouping
        let dateStr;
        const date = stat._id;
        
        if (date.hour !== undefined) {
          dateStr = `${date.year}-${date.month}-${date.day} ${date.hour}:00`;
        } else if (date.day !== undefined) {
          dateStr = `${date.year}-${date.month}-${date.day}`;
        } else if (date.week !== undefined) {
          dateStr = `${date.year}-W${date.week}`;
        } else {
          dateStr = `${date.year}-${date.month}`;
        }
        
        // Organize counts by action and role
        const actionCounts = {
          view: 0,
          create: 0,
          update: 0,
          delete: 0
        };
        
        const roleCounts = {};
        
        stat.actions.forEach(item => {
          // Count by action
          if (actionCounts[item.action] !== undefined) {
            actionCounts[item.action] += item.count;
          }
          
          // Count by role
          const role = item.role || 'unknown';
          if (!roleCounts[role]) {
            roleCounts[role] = 0;
          }
          roleCounts[role] += item.count;
        });
        
        return {
          date: dateStr,
          totalCount: stat.totalCount,
          byAction: actionCounts,
          byRole: roleCounts
        };
      });
      
      // Get overall summary statistics
      const overallSummary = {
        totalLogs: formattedStats.reduce((sum, stat) => sum + stat.totalCount, 0),
        byAction: {
          view: formattedStats.reduce((sum, stat) => sum + stat.byAction.view, 0),
          create: formattedStats.reduce((sum, stat) => sum + stat.byAction.create, 0),
          update: formattedStats.reduce((sum, stat) => sum + stat.byAction.update, 0),
          delete: formattedStats.reduce((sum, stat) => sum + stat.byAction.delete, 0)
        },
        byRole: formattedStats.reduce((roleSummary, stat) => {
          Object.entries(stat.byRole).forEach(([role, count]) => {
            if (!roleSummary[role]) {
              roleSummary[role] = 0;
            }
            roleSummary[role] += count;
          });
          return roleSummary;
        }, {})
      };
      
      return {
        timeframe: {
          startDate: dateFilter.$gte,
          endDate: dateFilter.$lte || new Date(),
          groupBy
        },
        summary: overallSummary,
        data: formattedStats
      };
    } catch (error) {
      logger.error(`Error generating system access report: ${error.message}`, { error });
      throw error;
    }
  }
}

module.exports = new AuditService();
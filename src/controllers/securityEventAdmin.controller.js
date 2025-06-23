/**
 * Security Event Admin Controller
 * File: src/controllers/securityEventAdmin.controller.js
 * 
 * This controller provides APIs for administrators to view and manage
 * security events, alerts, and suspicious activities.
 */

const { validationResult } = require('express-validator');
const SecurityEvent = require('../models/securityEvent.model');
const User = require('../models/user.model');
const securityLogger = require('../services/securityLogger.service');
const logger = require('../utils/logger');
const errorTypes = require('../constants/error-types');

/**
 * Get security events with filtering, sorting, and pagination
 * @route GET /api/admin/security/events
 */
exports.getSecurityEvents = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const {
      eventType,
      severity,
      status,
      userId,
      ip,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'timestamp',
      sortDirection = 'desc'
    } = req.query;

    // Build filter
    const filter = {};

    if (eventType) {
      filter.eventType = eventType;
    }

    if (severity) {
      filter.severity = severity;
    }

    if (status) {
      filter['handled.status'] = status;
    }

    if (userId) {
      filter['source.userId'] = userId;
    }

    if (ip) {
      filter['source.ip'] = ip;
    }

    // Add date range filter
    if (startDate || endDate) {
      filter.timestamp = {};
      
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortDirection === 'asc' ? 1 : -1;

    // Get total count
    const total = await SecurityEvent.countDocuments(filter);

    // Get security events
    const securityEvents = await SecurityEvent.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('source.userId', 'username firstName lastName email role')
      .populate('handled.handledBy', 'username firstName lastName');

    return res.status(200).json({
      status: 'success',
      data: {
        securityEvents,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error(`Error getting security events: ${error.message}`);
    next(error);
  }
};

/**
 * Get security event by ID
 * @route GET /api/admin/security/events/:id
 */
exports.getSecurityEventById = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    // Get security event
    const securityEvent = await SecurityEvent.findById(id)
      .populate('source.userId', 'username firstName lastName email role')
      .populate('handled.handledBy', 'username firstName lastName');

    if (!securityEvent) {
      return res.status(404).json({
        status: 'error',
        message: errorTypes.NOT_FOUND,
        details: 'Security event not found'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: securityEvent
    });
  } catch (error) {
    logger.error(`Error getting security event: ${error.message}`);
    next(error);
  }
};

/**
 * Update security event status
 * @route PATCH /api/admin/security/events/:id/status
 */
exports.updateSecurityEventStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { status, notes } = req.body;

    // Find security event
    const securityEvent = await SecurityEvent.findById(id);

    if (!securityEvent) {
      return res.status(404).json({
        status: 'error',
        message: errorTypes.NOT_FOUND,
        details: 'Security event not found'
      });
    }

    // Update status
    securityEvent.handled = {
      status,
      handledBy: req.user.id,
      handledAt: new Date(),
      notes: notes || ''
    };

    await securityEvent.save();

    return res.status(200).json({
      status: 'success',
      data: securityEvent
    });
  } catch (error) {
    logger.error(`Error updating security event status: ${error.message}`);
    next(error);
  }
};

/**
 * Get security statistics
 * @route GET /api/admin/security/stats
 */
exports.getSecurityStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.timestamp = {};
      
      if (startDate) {
        dateFilter.timestamp.$gte = new Date(startDate);
      }
      
      if (endDate) {
        dateFilter.timestamp.$lte = new Date(endDate);
      }
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      dateFilter.timestamp = { $gte: thirtyDaysAgo };
    }

    // Get event count by type
    const eventTypeCounts = await SecurityEvent.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get event count by severity
    const severityCounts = await SecurityEvent.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    // Get event count by status
    const statusCounts = await SecurityEvent.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$handled.status', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    // Get daily event count
    const dailyCounts = await SecurityEvent.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day'
            }
          },
          count: 1
        }
      }
    ]);

    // Get top IPs with security events
    const topIPs = await SecurityEvent.aggregate([
      { $match: dateFilter },
      { $match: { 'source.ip': { $exists: true, $ne: null } } },
      { $group: { _id: '$source.ip', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, ip: '$_id', count: 1 } }
    ]);

    // Get users with most security events
    const topUsers = await SecurityEvent.aggregate([
      { $match: dateFilter },
      { $match: { 'source.userId': { $exists: true, $ne: null } } },
      { $group: { _id: '$source.userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, userId: '$_id', count: 1 } }
    ]);
    
    // Look up user details
    const userIds = topUsers.map(item => item.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select('username firstName lastName email role');
    
    // Map user details to top users
    const topUsersWithDetails = topUsers.map(item => {
      const user = users.find(u => u._id.toString() === item.userId.toString());
      return {
        userId: item.userId,
        count: item.count,
        username: user ? user.username : 'Unknown',
        name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
        role: user ? user.role : 'Unknown'
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        eventTypeCounts,
        severityCounts: severityCounts.reduce((obj, item) => ({ 
          ...obj, 
          [item._id]: item.count 
        }), {}),
        statusCounts,
        dailyCounts,
        topIPs,
        topUsers: topUsersWithDetails
      }
    });
  } catch (error) {
    logger.error(`Error getting security stats: ${error.message}`);
    next(error);
  }
};

/**
 * Get high volume record access events
 * @route GET /api/admin/security/high-volume-access
 */
exports.getHighVolumeAccessEvents = async (req, res, next) => {
  try {
    const {
      userId,
      recordType,
      severity,
      days = 7,
      limit = 50
    } = req.query;

    const options = {
      userId,
      recordType,
      severity,
      days: parseInt(days),
      limit: parseInt(limit)
    };

    const events = await securityLogger.getHighVolumeAccessEvents(options);

    // Get user details if events found
    if (events.length > 0) {
      // Collect unique user IDs
      const userIds = [...new Set(events
        .map(event => event.source.userId)
        .filter(id => id)
      )];

      // Get user details
      const users = await User.find({ _id: { $in: userIds } })
        .select('username firstName lastName email role');
      
      // Create user lookup map
      const userMap = users.reduce((map, user) => {
        map[user._id.toString()] = user;
        return map;
      }, {});

      // Add user details to events
      events.forEach(event => {
        if (event.source.userId) {
          const userId = event.source.userId.toString();
          const user = userMap[userId];
          if (user) {
            event.userDetails = {
              username: user.username,
              name: `${user.firstName} ${user.lastName}`,
              email: user.email,
              role: user.role
            };
          }
        }
      });
    }

    return res.status(200).json({
      status: 'success',
      data: events
    });
  } catch (error) {
    logger.error(`Error getting high volume access events: ${error.message}`);
    next(error);
  }
};

/**
 * Get failed login attempts
 * @route GET /api/admin/security/failed-logins
 */
exports.getFailedLogins = async (req, res, next) => {
  try {
    const {
      username,
      ip,
      userId,
      hours = 24,
      limit = 50
    } = req.query;

    const events = await securityLogger.getRecentFailedLogins({
      username,
      ip,
      userId,
      hours: parseInt(hours),
      limit: parseInt(limit)
    });

    return res.status(200).json({
      status: 'success',
      data: events
    });
  } catch (error) {
    logger.error(`Error getting failed logins: ${error.message}`);
    next(error);
  }
};

/**
 * Get user security events
 * @route GET /api/admin/security/users/:userId/events
 */
exports.getUserSecurityEvents = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const {
      eventType,
      startDate,
      endDate,
      limit = 100
    } = req.query;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: errorTypes.NOT_FOUND,
        details: 'User not found'
      });
    }

    const options = {
      eventType,
      startDate,
      endDate,
      limit: parseInt(limit)
    };

    const events = await securityLogger.getUserSecurityEvents(userId, options);

    return res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          username: user.username,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.role
        },
        events
      }
    });
  } catch (error) {
    logger.error(`Error getting user security events: ${error.message}`);
    next(error);
  }
};
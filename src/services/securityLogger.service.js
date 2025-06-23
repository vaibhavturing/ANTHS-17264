/**
 * Security Logger Service
 * File: src/services/securityLogger.service.js
 * 
 * This service handles logging of security events, suspicious activities,
 * and sending alerts to administrators.
 */

const SecurityEvent = require('../models/securityEvent.model');
const User = require('../models/user.model');
const config = require('../config/config');
const logger = require('../utils/logger');
const emailService = require('./email.service');
const notificationService = require('./notification.service');
const { getClientIpInfo } = require('../utils/ipLookup');

class SecurityLoggerService {
  /**
   * Log a security event
   * @param {Object} eventData - Security event data
   * @returns {Promise<Object>} Created security event
   */
  async logSecurityEvent(eventData) {
    try {
      // Get IP information for context
      let ipInfo = null;
      if (eventData.source && eventData.source.ip) {
        ipInfo = await getClientIpInfo(eventData.source.ip);
      }

      // Create security event record
      const securityEvent = new SecurityEvent({
        ...eventData,
        source: {
          ...eventData.source,
          location: ipInfo || eventData.source.location
        },
        timestamp: eventData.timestamp || new Date()
      });

      await securityEvent.save();
      
      // Determine if this event should trigger an alert
      const shouldAlert = this.shouldTriggerAlert(securityEvent);
      
      if (shouldAlert) {
        await this.sendSecurityAlert(securityEvent);
      }

      return securityEvent;
    } catch (error) {
      logger.error(`Error logging security event: ${error.message}`);
      // Still log to system logs even if database logging fails
      logger.warn(`Security event [${eventData.eventType}]: ${JSON.stringify(eventData)}`);
      return null;
    }
  }

  /**
   * Log a failed login attempt
   * @param {Object} req - Express request object
   * @param {string} username - Attempted username
   * @param {string} reason - Failure reason
   * @returns {Promise<Object>} Created security event
   */
  async logFailedLogin(req, username, reason) {
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Check if attempt was for a valid username
    const user = await User.findOne({ 
      $or: [
        { username: username },
        { email: username }
      ]
    });

    return this.logSecurityEvent({
      eventType: 'authentication_failure',
      severity: user ? 'medium' : 'low', // Higher severity if valid username
      source: {
        ip: clientIp,
        userAgent,
        userId: user ? user._id : null
      },
      request: {
        method: req.method,
        path: req.originalUrl,
        headers: {
          'user-agent': userAgent,
          'accept': req.headers['accept'],
          'accept-language': req.headers['accept-language'],
          'referer': req.headers['referer']
        }
      },
      details: {
        username,
        reason,
        timestamp: new Date()
      }
    });
  }

  /**
   * Log a successful login
   * @param {Object} req - Express request object
   * @param {Object} user - User object
   * @returns {Promise<Object>} Created security event
   */
  async logSuccessfulLogin(req, user) {
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    return this.logSecurityEvent({
      eventType: 'authentication_success',
      severity: 'info',
      source: {
        ip: clientIp,
        userAgent,
        userId: user._id
      },
      request: {
        method: req.method,
        path: req.originalUrl
      },
      details: {
        username: user.username,
        timestamp: new Date()
      }
    });
  }

  /**
   * Log an access violation (unauthorized attempt)
   * @param {Object} req - Express request object
   * @param {string} resource - Resource being accessed
   * @param {string} requiredPermission - Required permission
   * @returns {Promise<Object>} Created security event
   */
  async logAccessViolation(req, resource, requiredPermission) {
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    return this.logSecurityEvent({
      eventType: 'access_violation',
      severity: 'medium',
      source: {
        ip: clientIp,
        userAgent,
        userId: req.user ? req.user.id : null
      },
      request: {
        method: req.method,
        path: req.originalUrl,
        query: req.query,
        params: req.params
      },
      details: {
        resource,
        requiredPermission,
        userRole: req.user ? req.user.role : null,
        timestamp: new Date()
      }
    });
  }

  /**
   * Log suspicious activity
   * @param {string} activityType - Type of suspicious activity
   * @param {Object} details - Activity details
   * @param {Object} source - Source information
   * @returns {Promise<Object>} Created security event
   */
  async logSuspiciousActivity(activityType, details, source) {
    return this.logSecurityEvent({
      eventType: 'suspicious_activity',
      severity: details.severity || 'medium',
      source,
      details: {
        activityType,
        ...details,
        timestamp: new Date()
      }
    });
  }

  /**
   * Log account lockout
   * @param {string} userId - User ID
   * @param {string} reason - Lockout reason
   * @param {Object} req - Express request object
   * @returns {Promise<Object>} Created security event
   */
  async logAccountLockout(userId, reason, req) {
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    return this.logSecurityEvent({
      eventType: 'account_lockout',
      severity: 'high',
      source: {
        ip: clientIp,
        userAgent,
        userId
      },
      request: {
        method: req.method,
        path: req.originalUrl
      },
      details: {
        reason,
        timestamp: new Date()
      }
    });
  }

  /**
   * Log multiple record access
   * @param {string} userId - User ID
   * @param {string} recordType - Type of record accessed
   * @param {number} count - Number of records accessed
   * @param {number} timeWindowMinutes - Time window in minutes
   * @param {Object} [actionDetails={}] - Additional details about the access
   * @returns {Promise<Object>} Created security event
   */
  async logMultipleRecordAccess(userId, recordType, count, timeWindowMinutes, actionDetails = {}) {
    const user = await User.findById(userId).select('username email role');
    
    return this.logSecurityEvent({
      eventType: 'high_volume_access',
      severity: this.calculateRecordAccessSeverity(count, timeWindowMinutes, recordType),
      source: {
        userId,
        userRole: user ? user.role : null
      },
      details: {
        recordType,
        recordCount: count,
        timeWindowMinutes,
        userInfo: user ? {
          username: user.username,
          role: user.role
        } : null,
        ...actionDetails,
        timestamp: new Date()
      }
    });
  }

  /**
   * Calculate severity for record access events
   * @param {number} count - Number of records accessed
   * @param {number} timeWindowMinutes - Time window in minutes
   * @param {string} recordType - Type of record accessed
   * @returns {string} Severity level
   */
  calculateRecordAccessSeverity(count, timeWindowMinutes, recordType) {
    // Different thresholds for different record types
    const thresholds = config.security.monitoring.recordAccessThresholds || {
      default: { medium: 50, high: 100, critical: 200 },
      patient: { medium: 30, high: 60, critical: 120 },
      medicalRecord: { medium: 25, high: 50, critical: 100 },
      prescription: { medium: 40, high: 80, critical: 150 }
    };
    
    // Get thresholds for this record type or use default
    const typeThresholds = thresholds[recordType] || thresholds.default;
    
    // Normalize count based on time window (convert to equivalent count per 5 minutes)
    const normalizedCount = count * (5 / timeWindowMinutes);
    
    // Determine severity based on normalized count
    if (normalizedCount >= typeThresholds.critical) {
      return 'critical';
    } else if (normalizedCount >= typeThresholds.high) {
      return 'high';
    } else if (normalizedCount >= typeThresholds.medium) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Check if a security event should trigger an alert
   * @param {Object} securityEvent - Security event
   * @returns {boolean} True if alert should be triggered
   */
  shouldTriggerAlert(securityEvent) {
    // Always alert for critical and high severity events
    if (['critical', 'high'].includes(securityEvent.severity)) {
      return true;
    }
    
    // Alert for medium severity events except authentication_failure
    if (securityEvent.severity === 'medium' && 
        securityEvent.eventType !== 'authentication_failure') {
      return true;
    }
    
    // Alert for specific event types regardless of severity
    const alwaysAlertEventTypes = [
      'account_lockout',
      'brute_force_attempt',
      'data_leakage',
      'configuration_change'
    ];
    
    if (alwaysAlertEventTypes.includes(securityEvent.eventType)) {
      return true;
    }
    
    // Check for repeated authentication failures
    if (securityEvent.eventType === 'authentication_failure') {
      return this.checkRepeatedFailures(securityEvent);
    }
    
    return false;
  }

  /**
   * Check for repeated authentication failures
   * @param {Object} securityEvent - Security event
   * @returns {Promise<boolean>} True if repeated failures detected
   */
  async checkRepeatedFailures(securityEvent) {
    try {
      // Look for multiple failures from the same IP in the last 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      
      const count = await SecurityEvent.countDocuments({
        eventType: 'authentication_failure',
        'source.ip': securityEvent.source.ip,
        timestamp: { $gte: tenMinutesAgo }
      });
      
      // Alert if 5 or more failures
      return count >= 5;
    } catch (error) {
      logger.error(`Error checking repeated failures: ${error.message}`);
      return false;
    }
  }

  /**
   * Send security alert to administrators
   * @param {Object} securityEvent - Security event
   * @returns {Promise<void>}
   */
  async sendSecurityAlert(securityEvent) {
    try {
      const alertTitle = this.getAlertTitle(securityEvent);
      const alertBody = this.formatAlertBody(securityEvent);
      
      // Get admin users to notify
      const adminUsers = await User.find({ 
        role: { $in: ['admin', 'security_analyst'] },
        isActive: true 
      }).select('email preferences');
      
      // Log the alert
      logger.warn(`Security Alert: ${alertTitle}`);
      
      // Send email notification
      await this.sendEmailAlert(adminUsers, alertTitle, alertBody, securityEvent);
      
      // Send in-app notification
      await this.sendInAppAlert(adminUsers, alertTitle, securityEvent);
      
      // Check if SMS/Push notification should be sent (for high/critical)
      if (['critical', 'high'].includes(securityEvent.severity)) {
        await this.sendUrgentAlerts(adminUsers, alertTitle, securityEvent);
      }
    } catch (error) {
      logger.error(`Error sending security alert: ${error.message}`);
    }
  }

  /**
   * Generate alert title based on security event
   * @param {Object} securityEvent - Security event
   * @returns {string} Alert title
   */
  getAlertTitle(securityEvent) {
    const severityPrefix = securityEvent.severity.toUpperCase();
    
    // Create title based on event type
    switch (securityEvent.eventType) {
      case 'authentication_failure':
        return `[${severityPrefix}] Repeated Login Failures Detected`;
      
      case 'access_violation':
        return `[${severityPrefix}] Unauthorized Access Attempt`;
      
      case 'account_lockout':
        return `[${severityPrefix}] User Account Locked`;
      
      case 'suspicious_activity':
        const activityType = securityEvent.details.activityType || 'activity';
        return `[${severityPrefix}] Suspicious ${activityType} Detected`;
      
      case 'high_volume_access':
        return `[${severityPrefix}] High Volume Record Access Detected`;
      
      case 'brute_force_attempt':
        return `[${severityPrefix}] Potential Brute Force Attack`;
      
      case 'data_leakage':
        return `[${severityPrefix}] Potential Data Leakage Detected`;
      
      case 'configuration_change':
        return `[${severityPrefix}] Critical Configuration Change`;
      
      default:
        return `[${severityPrefix}] Security Event: ${securityEvent.eventType}`;
    }
  }

  /**
   * Format alert body text based on security event
   * @param {Object} securityEvent - Security event
   * @returns {string} Formatted alert body
   */
  formatAlertBody(securityEvent) {
    let body = `Security Event Details:\n\n`;
    
    // Add event type and severity
    body += `Type: ${securityEvent.eventType}\n`;
    body += `Severity: ${securityEvent.severity}\n`;
    body += `Time: ${new Date(securityEvent.timestamp).toLocaleString()}\n\n`;
    
    // Add source information
    if (securityEvent.source) {
      body += `Source Information:\n`;
      if (securityEvent.source.ip) {
        body += `IP Address: ${securityEvent.source.ip}\n`;
      }
      if (securityEvent.source.location) {
        const location = securityEvent.source.location;
        const locationStr = [
          location.country,
          location.region,
          location.city
        ].filter(Boolean).join(', ');
        
        if (locationStr) {
          body += `Location: ${locationStr}\n`;
        }
      }
      if (securityEvent.source.userAgent) {
        body += `User Agent: ${securityEvent.source.userAgent}\n`;
      }
      if (securityEvent.source.userId) {
        body += `User ID: ${securityEvent.source.userId}\n`;
      }
      body += '\n';
    }
    
    // Add event-specific details
    if (securityEvent.details) {
      body += `Event Details:\n`;
      
      const details = securityEvent.details;
      
      // Format details based on event type
      switch (securityEvent.eventType) {
        case 'authentication_failure':
          body += `Username: ${details.username || 'unknown'}\n`;
          body += `Reason: ${details.reason || 'unknown'}\n`;
          break;
          
        case 'access_violation':
          body += `Resource: ${details.resource || 'unknown'}\n`;
          body += `Required Permission: ${details.requiredPermission || 'unknown'}\n`;
          body += `User Role: ${details.userRole || 'unknown'}\n`;
          break;
          
        case 'high_volume_access':
          body += `Record Type: ${details.recordType || 'unknown'}\n`;
          body += `Record Count: ${details.recordCount || 0}\n`;
          body += `Time Window: ${details.timeWindowMinutes || 0} minutes\n`;
          if (details.userInfo) {
            body += `Username: ${details.userInfo.username || 'unknown'}\n`;
            body += `Role: ${details.userInfo.role || 'unknown'}\n`;
          }
          break;
          
        default:
          // For other types, just include all details
          Object.keys(details).forEach(key => {
            if (key !== 'timestamp' && details[key] !== null && 
                details[key] !== undefined && typeof details[key] !== 'object') {
              body += `${key}: ${details[key]}\n`;
            }
          });
      }
    }
    
    // Add link to view in admin panel
    body += `\nView full details in the admin security dashboard:\n`;
    body += `${config.server.baseUrl}/admin/security/events/${securityEvent._id}`;
    
    return body;
  }

  /**
   * Send email alert to administrators
   * @param {Array<Object>} adminUsers - Admin users to notify
   * @param {string} title - Alert title
   * @param {string} body - Alert body
   * @param {Object} securityEvent - Security event
   * @returns {Promise<void>}
   */
  async sendEmailAlert(adminUsers, title, body, securityEvent) {
    try {
      const recipients = adminUsers
        .filter(user => {
          // Check if user has opted out of email alerts
          return !(user.preferences && 
                 user.preferences.notifications && 
                 user.preferences.notifications.disableSecurityEmails);
        })
        .map(user => user.email);
      
      if (recipients.length === 0) {
        logger.info('No recipients for security email alert');
        return;
      }
      
      await emailService.sendEmail({
        to: recipients,
        subject: title,
        text: body,
        priority: securityEvent.severity === 'critical' ? 'high' : 'normal'
      });
      
      logger.info(`Security email alert sent to ${recipients.length} recipients`);
    } catch (error) {
      logger.error(`Error sending email alert: ${error.message}`);
    }
  }

  /**
   * Send in-app notification to administrators
   * @param {Array<Object>} adminUsers - Admin users to notify
   * @param {string} title - Alert title
   * @param {Object} securityEvent - Security event
   * @returns {Promise<void>}
   */
  async sendInAppAlert(adminUsers, title, securityEvent) {
    try {
      for (const user of adminUsers) {
        await notificationService.createNotification({
          userId: user._id,
          type: 'security_alert',
          title,
          message: `Security event: ${securityEvent.eventType} with ${securityEvent.severity} severity`,
          data: {
            securityEventId: securityEvent._id,
            eventType: securityEvent.eventType,
            severity: securityEvent.severity
          },
          priority: this.mapSeverityToPriority(securityEvent.severity)
        });
      }
      
      logger.info(`In-app security alerts sent to ${adminUsers.length} recipients`);
    } catch (error) {
      logger.error(`Error sending in-app alerts: ${error.message}`);
    }
  }

  /**
   * Send urgent alerts (SMS/Push) to administrators for critical events
   * @param {Array<Object>} adminUsers - Admin users to notify
   * @param {string} title - Alert title
   * @param {Object} securityEvent - Security event
   * @returns {Promise<void>}
   */
  async sendUrgentAlerts(adminUsers, title, securityEvent) {
    try {
      // Filter users who have emergency contact methods
      const urgentRecipients = adminUsers.filter(user => 
        user.preferences && 
        (user.preferences.phoneNumber || 
         (user.preferences.notifications && user.preferences.notifications.pushEnabled))
      );
      
      if (urgentRecipients.length === 0) {
        logger.info('No recipients for urgent security alerts');
        return;
      }
      
      // Send SMS notifications
      for (const user of urgentRecipients) {
        if (user.preferences && user.preferences.phoneNumber) {
          await notificationService.sendSms({
            to: user.preferences.phoneNumber,
            message: `${title} - Please check the security dashboard immediately.`
          });
        }
        
        // Send push notifications
        if (user.preferences && 
            user.preferences.notifications && 
            user.preferences.notifications.pushEnabled) {
          await notificationService.sendPushNotification({
            userId: user._id,
            title,
            body: `Critical security event requires your attention.`,
            data: {
              securityEventId: securityEvent._id,
              eventType: securityEvent.eventType,
              severity: securityEvent.severity,
              url: `/admin/security/events/${securityEvent._id}`
            }
          });
        }
      }
      
      logger.info(`Urgent security alerts sent to ${urgentRecipients.length} recipients`);
    } catch (error) {
      logger.error(`Error sending urgent alerts: ${error.message}`);
    }
  }

  /**
   * Map severity level to notification priority
   * @param {string} severity - Severity level
   * @returns {string} Notification priority
   */
  mapSeverityToPriority(severity) {
    const mapping = {
      'critical': 'urgent',
      'high': 'high',
      'medium': 'normal',
      'low': 'low',
      'info': 'low'
    };
    return mapping[severity] || 'normal';
  }

  /**
   * Get recent failed login attempts for a user or IP
   * @param {Object} query - Query parameters
   * @returns {Promise<Array<Object>>} Recent login attempts
   */
  async getRecentFailedLogins(query) {
    try {
      // Start building the filter
      const filter = {
        eventType: 'authentication_failure'
      };
      
      // Add time range - default to last 24 hours
      const timeAgo = query.hours ? 
        new Date(Date.now() - query.hours * 60 * 60 * 1000) :
        new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      filter.timestamp = { $gte: timeAgo };
      
      // Add user or IP filter if provided
      if (query.userId) {
        filter['source.userId'] = query.userId;
      }
      
      if (query.ip) {
        filter['source.ip'] = query.ip;
      }
      
      if (query.username) {
        filter['details.username'] = query.username;
      }
      
      // Get the events
      return await SecurityEvent.find(filter)
        .sort({ timestamp: -1 })
        .limit(query.limit || 50);
    } catch (error) {
      logger.error(`Error getting recent failed logins: ${error.message}`);
      return [];
    }
  }

  /**
   * Get security events for a specific user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>} User security events
   */
  async getUserSecurityEvents(userId, options = {}) {
    try {
      const filter = {
        'source.userId': userId
      };
      
      // Add time range if specified
      if (options.startDate) {
        filter.timestamp = { $gte: new Date(options.startDate) };
        
        if (options.endDate) {
          filter.timestamp.$lte = new Date(options.endDate);
        }
      }
      
      // Add event type filter if specified
      if (options.eventType) {
        filter.eventType = options.eventType;
      }
      
      // Set default limit and sort
      const limit = options.limit || 100;
      const sort = options.sort || { timestamp: -1 };
      
      return await SecurityEvent.find(filter)
        .sort(sort)
        .limit(limit);
    } catch (error) {
      logger.error(`Error getting user security events: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get high volume record access events
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>} High volume access events
   */
  async getHighVolumeAccessEvents(options = {}) {
    try {
      const filter = {
        eventType: 'high_volume_access'
      };
      
      // Add severity filter
      if (options.severity) {
        filter.severity = options.severity;
      } else {
        // Default to medium and above
        filter.severity = { $in: ['medium', 'high', 'critical'] };
      }
      
      // Add time range - default to last 7 days
      const daysAgo = options.days || 7;
      filter.timestamp = { 
        $gte: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
      };
      
      // Add record type filter if specified
      if (options.recordType) {
        filter['details.recordType'] = options.recordType;
      }
      
      // Set default limit and sort
      const limit = options.limit || 50;
      
      return await SecurityEvent.find(filter)
        .sort({ timestamp: -1, severity: 1 })
        .limit(limit);
    } catch (error) {
      logger.error(`Error getting high volume access events: ${error.message}`);
      return [];
    }
  }
}

module.exports = new SecurityLoggerService();
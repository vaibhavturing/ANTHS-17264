/**
 * Business Metrics Utility
 * Collects and tracks business metrics for scaling and monitoring
 */

const metricsService = require('../services/metrics.service');
const logger = require('./logger');

/**
 * Business metrics tracking utility
 */
const businessMetrics = {
  /**
   * Track appointment booking
   * Used to measure appointments booked per minute
   * @param {Object} appointment - Appointment object
   * @param {boolean} isNew - Whether this is a new appointment
   */
  trackAppointment(appointment, isNew = true) {
    if (!appointment) return;

    try {
      // Only track new appointments (not updates) for rate calculations
      if (isNew) {
        metricsService.trackAppointmentsBooked();
      }

      // Additional appointment-specific tracking could be added here
      // For example, tracking by doctor, department, time of day, etc.
      if (appointment.doctorId) {
        this.trackDoctorUtilization(appointment.doctorId);
      }
    } catch (error) {
      logger.error('Error tracking appointment metrics:', error);
    }
  },

  /**
   * Track patient registration
   * @param {Object} patient - Patient object
   */
  trackPatientRegistration(patient) {
    if (!patient) return;

    try {
      metricsService.trackPatientRegistrations();
    } catch (error) {
      logger.error('Error tracking patient registration metrics:', error);
    }
  },

  /**
   * Track prescription creation
   * @param {Object} prescription - Prescription object
   */
  trackPrescription(prescription) {
    if (!prescription) return;
    
    try {
      metricsService.trackPrescriptionsCreated();
    } catch (error) {
      logger.error('Error tracking prescription metrics:', error);
    }
  },

  /**
   * Track doctor utilization
   * @param {string} doctorId - Doctor ID
   * @param {number} minutesBooked - Minutes booked (default 30)
   */
  async trackDoctorUtilization(doctorId, minutesBooked = 30) {
    if (!doctorId) return;
    
    try {
      // Use Redis to track doctor's booked time
      const redisClient = require('../config/redis.config').getCacheClient();
      if (!redisClient) return;
      
      // Current date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      const key = `metrics:doctor:${doctorId}:utilization:${today}`;
      
      // Increment booked minutes for today
      await redisClient.incrby(key, minutesBooked);
      
      // Set expiry to auto-cleanup (7 days)
      await redisClient.expire(key, 7 * 24 * 60 * 60);
    } catch (error) {
      logger.error('Error tracking doctor utilization:', error);
    }
  },

  /**
   * Track medical record access
   * Used to identify commonly accessed records for caching
   * @param {string} recordId - Record ID
   */
  async trackRecordAccess(recordId) {
    if (!recordId) return;
    
    try {
      // Use Redis to track record access frequency
      const redisClient = require('../config/redis.config').getCacheClient();
      if (!redisClient) return;
      
      const key = 'metrics:record:access:frequency';
      
      // Current hour timestamp for rolling window
      const hourWindow = Math.floor(Date.now() / 3600000);
      
      // Increment in sorted set with score as hour window
      await redisClient.zadd(key, hourWindow, `${hourWindow}:${recordId}`);
      
      // Also increment the access count for this record
      await redisClient.zincrby('metrics:record:access:count', 1, recordId);
      
      // Cleanup old entries (keep last 7 days)
      const cutoffTime = hourWindow - (24 * 7);
      await redisClient.zremrangebyscore(key, 0, cutoffTime);
      
      // Set expiry on both keys
      await redisClient.expire(key, 30 * 24 * 60 * 60);
      await redisClient.expire('metrics:record:access:count', 30 * 24 * 60 * 60);
    } catch (error) {
      logger.error('Error tracking record access:', error);
    }
  },

  /**
   * Get most frequently accessed records
   * @param {number} limit - Maximum number of records to return
   * @returns {Promise<Array>} Array of [recordId, count] pairs
   */
  async getMostAccessedRecords(limit = 10) {
    try {
      const redisClient = require('../config/redis.config').getCacheClient();
      if (!redisClient) return [];
      
      // Get top accessed records with counts
      const results = await redisClient.zrevrange(
        'metrics:record:access:count',
        0,
        limit - 1,
        'WITHSCORES'
      );
      
      // Convert to array of [recordId, count] pairs
      const records = [];
      for (let i = 0; i < results.length; i += 2) {
        records.push([results[i], parseInt(results[i + 1])]);
      }
      
      return records;
    } catch (error) {
      logger.error('Error getting most accessed records:', error);
      return [];
    }
  },

  /**
   * Get doctor utilization for a specific day
   * @param {string} doctorId - Doctor ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<number>} Minutes booked
   */
  async getDoctorUtilization(doctorId, date) {
    if (!doctorId) return 0;
    
    try {
      const redisClient = require('../config/redis.config').getCacheClient();
      if (!redisClient) return 0;
      
      // Use provided date or today
      const targetDate = date || new Date().toISOString().split('T')[0];
      const key = `metrics:doctor:${doctorId}:utilization:${targetDate}`;
      
      const minutes = await redisClient.get(key);
      return parseInt(minutes, 10) || 0;
    } catch (error) {
      logger.error('Error getting doctor utilization:', error);
      return 0;
    }
  },

  /**
   * Check if business metrics indicate need for scaling
   * @returns {Promise<Object>} Scaling recommendation with metrics
   */
  async checkScalingNeeds() {
    try {
      // Get current metrics
      const appointmentsPerMinute = await metricsService.getMetricRate('appointments_booked', 'minute');
      const patientsPerHour = await metricsService.getMetricRate('patient_registrations', 'hour');
      const prescriptionsPerHour = await metricsService.getMetricRate('prescriptions_created', 'hour');
      
      // Define thresholds for scaling (these would be configurable in production)
      const highLoad = {
        appointmentsPerMinute: 10,
        patientsPerHour: 50,
        prescriptionsPerHour: 100
      };
      
      const mediumLoad = {
        appointmentsPerMinute: 5,
        patientsPerHour: 30,
        prescriptionsPerHour: 60
      };
      
      // Determine current load level
      let scalingRecommendation = 'none';
      let reason = '';
      
      if (
        appointmentsPerMinute >= highLoad.appointmentsPerMinute ||
        patientsPerHour >= highLoad.patientsPerHour ||
        prescriptionsPerHour >= highLoad.prescriptionsPerHour
      ) {
        scalingRecommendation = 'scale_up_urgent';
        reason = 'High business load detected';
      } else if (
        appointmentsPerMinute >= mediumLoad.appointmentsPerMinute ||
        patientsPerHour >= mediumLoad.patientsPerHour ||
        prescriptionsPerHour >= mediumLoad.prescriptionsPerHour
      ) {
        scalingRecommendation = 'scale_up';
        reason = 'Medium business load detected';
      }
      
      return {
        scalingRecommendation,
        reason,
        metrics: {
          appointmentsPerMinute,
          patientsPerHour,
          prescriptionsPerHour,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Error checking scaling needs:', error);
      return {
        scalingRecommendation: 'unknown',
        reason: 'Error evaluating metrics',
        error: error.message
      };
    }
  }
};

module.exports = businessMetrics;
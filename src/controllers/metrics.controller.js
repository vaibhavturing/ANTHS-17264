/**
 * Metrics Controller
 * API endpoints for metrics and monitoring 
 */

const metricsService = require('../services/metrics.service');
const alertService = require('../services/alert.service');
const businessMetrics = require('../utils/businessMetrics');
const monitoringConfig = require('../config/monitoring.config');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

/**
 * Metrics controller
 */
const metricsController = {
  /**
   * Get system metrics
   * @route GET /api/metrics/system
   */
  getSystemMetrics: catchAsync(async (req, res) => {
    const cpuHistory = await metricsService.getMetricHistory('cpu_usage', 15);
    const memoryHistory = await metricsService.getMetricHistory('memory_usage', 15);
    
    // Format system metrics
    const systemMetrics = {
      cpu: {
        current: cpuHistory.length > 0 ? cpuHistory[cpuHistory.length - 1][1] : 0,
        history: cpuHistory.map(([timestamp, value]) => ({
          timestamp,
          value: Number(value.toFixed(2))
        }))
      },
      memory: {
        current: memoryHistory.length > 0 ? memoryHistory[memoryHistory.length - 1][1] : 0,
        history: memoryHistory.map(([timestamp, value]) => ({
          timestamp,
          value: Number(value.toFixed(2))
        }))
      },
      uptime: {
        server: process.uptime(),
        system: Math.floor(require('os').uptime())
      }
    };
    
    res.status(200).json({
      success: true,
      data: systemMetrics
    });
  }),

  /**
   * Get business metrics
   * @route GET /api/metrics/business
   */
  getBusinessMetrics: catchAsync(async (req, res) => {
    const businessMetricsData = await metricsService.getBusinessMetrics();
    
    res.status(200).json({
      success: true,
      data: businessMetricsData
    });
  }),

  /**
   * Get Prometheus metrics
   * @route GET /metrics
   */
  getPrometheusMetrics: catchAsync(async (req, res) => {
    if (!monitoringConfig.prometheus.enabled) {
      throw new AppError('Prometheus metrics are disabled', 404);
    }
    
    const metrics = await metricsService.getPrometheusMetrics();
    
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  }),

  /**
   * Get active alerts
   * @route GET /api/metrics/alerts
   */
  getAlerts: catchAsync(async (req, res) => {
    const activeAlerts = await alertService.getActiveAlerts();
    
    res.status(200).json({
      success: true,
      count: activeAlerts.length,
      data: activeAlerts
    });
  }),

  /**
   * Acknowledge an alert
   * @route POST /api/metrics/alerts/:id/acknowledge
   */
  acknowledgeAlert: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { acknowledgedBy } = req.body;
    
    if (!id) {
      throw new AppError('Alert ID is required', 400);
    }
    
    if (!acknowledgedBy) {
      throw new AppError('Acknowledger information is required', 400);
    }
    
    const success = await alertService.acknowledgeAlert(id, acknowledgedBy);
    
    if (!success) {
      throw new AppError('Alert not found or could not be acknowledged', 404);
    }
    
    res.status(200).json({
      success: true,
      message: 'Alert acknowledged successfully'
    });
  }),

  /**
   * Resolve an alert
   * @route POST /api/metrics/alerts/:id/resolve
   */
  resolveAlert: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { resolvedBy, resolution } = req.body;
    
    if (!id) {
      throw new AppError('Alert ID is required', 400);
    }
    
    if (!resolvedBy) {
      throw new AppError('Resolver information is required', 400);
    }
    
    const success = await alertService.resolveAlert(id, resolvedBy, resolution);
    
    if (!success) {
      throw new AppError('Alert not found or could not be resolved', 404);
    }
    
    res.status(200).json({
      success: true,
      message: 'Alert resolved successfully'
    });
  }),

  /**
   * Get scaling recommendations
   * @route GET /api/metrics/scaling
   */
  getScalingRecommendations: catchAsync(async (req, res) => {
    const recommendations = await businessMetrics.checkScalingNeeds();
    
    res.status(200).json({
      success: true,
      data: recommendations
    });
  }),

  /**
   * Get most accessed medical records
   * @route GET /api/metrics/records/most-accessed
   */
  getMostAccessedRecords: catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 10;
    const records = await businessMetrics.getMostAccessedRecords(limit);
    
    res.status(200).json({
      success: true,
      count: records.length,
      data: records.map(([recordId, count]) => ({
        recordId,
        accessCount: count
      }))
    });
  }),

  /**
   * Get doctor utilization
   * @route GET /api/metrics/doctors/:id/utilization
   */
  getDoctorUtilization: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { date } = req.query;
    
    if (!id) {
      throw new AppError('Doctor ID is required', 400);
    }
    
    const utilization = await businessMetrics.getDoctorUtilization(id, date);
    
    // Calculate utilization percentage (assuming 8-hour workday = 480 minutes)
    const utilizationPercentage = (utilization / 480) * 100;
    
    res.status(200).json({
      success: true,
      data: {
        doctorId: id,
        date: date || new Date().toISOString().split('T')[0],
        minutesBooked: utilization,
        utilizationPercentage: Number(utilizationPercentage.toFixed(2))
      }
    });
  }),

  /**
   * Test alert system
   * @route POST /api/metrics/alerts/test
   */
  testAlert: catchAsync(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Alert testing is disabled in production', 403);
    }
    
    const { severity = 'warning', message = 'Test alert' } = req.body;
    
    if (!['warning', 'critical'].includes(severity)) {
      throw new AppError('Invalid severity level. Must be "warning" or "critical"', 400);
    }
    
    // Send test alert
    const result = await alertService.sendAlert({
      name: 'test_alert',
      severity,
      message: `Test alert: ${message}`,
      value: 100,
      threshold: 90,
      metadata: {
        source: 'Manual test',
        initiatedBy: req.user ? req.user.username : 'unknown'
      }
    });
    
    res.status(200).json({
      success: result,
      message: result ? 'Test alert sent successfully' : 'Failed to send test alert'
    });
  })
};

module.exports = metricsController;
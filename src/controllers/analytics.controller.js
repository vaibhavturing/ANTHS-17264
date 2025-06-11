const asyncHandler = require('../utils/async-handler.util');
const { ResponseUtil } = require('../utils/response.util');
const analyticsService = require('../services/analytics.service');
const analyticsValidators = require('../validators/analytics.validator');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Controller for analytics-related endpoints
 */
const analyticsController = {
  /**
   * Generate a new analytics report
   */
  generateReport: asyncHandler(async (req, res) => {
    const { error, value } = analyticsValidators.validateReportRequest.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const report = await analyticsService.generateReport(
      value.reportType,
      value.filters || {},
      {
        bypassCache: value.bypassCache,
        isPublic: value.isPublic,
        aggregationLevel: value.aggregationLevel
      },
      req.user
    );
    
    if (value.format && value.format !== 'json') {
      // Export in the requested format
      const exportResult = await analyticsService.exportReport(
        report._id,
        value.format,
        {
          reason: value.reason || 'Generated report',
          anonymized: value.anonymized !== false,
          dataFields: value.includeFields,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        },
        req.user
      );
      
      // Send file download response
      return ResponseUtil.success(res, {
        message: `Report exported in ${value.format} format`,
        report: {
          _id: report._id,
          reportType: report.reportType,
          createdAt: report.createdAt
        },
        data: exportResult
      });
    }
    
    return ResponseUtil.success(res, {
      message: 'Report generated successfully',
      report
    });
  }),

  /**
   * Get all reports with optional filtering
   */
  getReports: asyncHandler(async (req, res) => {
    const filters = {};
    
    if (req.query.reportType) {
      filters.reportType = req.query.reportType;
    }
    
    if (req.query.createdBy) {
      filters.createdBy = req.query.createdBy;
    }
    
    if (req.query.isPublic) {
      filters.isPublic = req.query.isPublic === 'true';
    }
    
    const reports = await analyticsService.getReports(filters, req.user);
    
    return ResponseUtil.success(res, {
      count: reports.length,
      reports
    });
  }),

  /**
   * Get a specific report by ID
   */
  getReportById: asyncHandler(async (req, res) => {
    const report = await analyticsService.getReportById(req.params.id, req.user);
    
    return ResponseUtil.success(res, { report });
  }),

  /**
   * Export a report in the specified format
   */
  exportReport: asyncHandler(async (req, res) => {
    const { error, value } = analyticsValidators.validateReportExport.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const exportResult = await analyticsService.exportReport(
      value.reportId,
      value.exportFormat,
      {
        reason: value.reason,
        anonymized: value.anonymized !== false,
        dataFields: value.dataFields,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      },
      req.user
    );
    
    return ResponseUtil.success(res, {
      message: `Report exported in ${value.exportFormat} format`,
      data: exportResult
    });
  }),

  /**
   * Record a treatment outcome
   */
  recordTreatmentOutcome: asyncHandler(async (req, res) => {
    const { error, value } = analyticsValidators.validateTreatmentOutcome.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const outcome = await analyticsService.recordTreatmentOutcome(value);
    
    return ResponseUtil.success(res, {
      message: 'Treatment outcome recorded successfully',
      outcome
    }, 201);
  }),

  /**
   * Get treatment outcomes for a patient
   */
  getPatientTreatmentOutcomes: asyncHandler(async (req, res) => {
    const outcomes = await analyticsService.getPatientTreatmentOutcomes(req.params.patientId);
    
    return ResponseUtil.success(res, {
      count: outcomes.length,
      outcomes
    });
  }),

  /**
   * Record a population health metric
   */
  recordPopulationHealthMetric: asyncHandler(async (req, res) => {
    const { error, value } = analyticsValidators.validatePopulationHealthMetric.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const metric = await analyticsService.recordPopulationHealthMetric(value);
    
    return ResponseUtil.success(res, {
      message: 'Population health metric recorded successfully',
      metric
    }, 201);
  }),

  /**
   * Get population health metrics with optional filtering
   */
  getPopulationHealthMetrics: asyncHandler(async (req, res) => {
    const filters = {};
    
    if (req.query.metricType) {
      filters.metricType = req.query.metricType;
    }
    
    if (req.query.startDate && req.query.endDate) {
      filters.dateRange = {
        start: req.query.startDate,
        end: req.query.endDate
      };
    }
    
    if (req.query.zipCode) {
      filters.populationSegment = filters.populationSegment || {};
      filters.populationSegment.zipCode = req.query.zipCode;
    }
    
    if (req.query.gender && req.query.gender !== 'all') {
      filters.populationSegment = filters.populationSegment || {};
      filters.populationSegment.gender = req.query.gender;
    }
    
    if (req.query.diagnosisCode) {
      filters.populationSegment = filters.populationSegment || {};
      filters.populationSegment.diagnosisCodes = [req.query.diagnosisCode];
    }
    
    const metrics = await analyticsService.getPopulationHealthMetrics(filters);
    
    return ResponseUtil.success(res, {
      count: metrics.length,
      metrics
    });
  }),

  /**
   * Generate insights based on analytics data
   */
  generateInsights: asyncHandler(async (req, res) => {
    const params = req.body || {};
    
    const insights = await analyticsService.generateInsights(params);
    
    return ResponseUtil.success(res, {
      message: 'Insights generated successfully',
      insights
    });
  })
};

module.exports = analyticsController;
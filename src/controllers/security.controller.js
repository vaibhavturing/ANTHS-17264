/**
 * Security scanning and vulnerability management controller
 * File: src/controllers/security.controller.js
 * 
 * This controller handles security scanning results, vulnerability tracking,
 * and prioritization of security issues.
 */
const { validationResult } = require('express-validator');
const SecurityScan = require('../models/securityScan.model');
const Vulnerability = require('../models/vulnerability.model');
const logger = require('../utils/logger');
const errorTypes = require('../constants/error-types');

/**
 * Create a new security scan record
 * @route POST /api/security/scans
 */
exports.createScan = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { scanType, scanDate, scannerName, scannerVersion, summary } = req.body;
    
    const scan = new SecurityScan({
      scanType,
      scanDate: scanDate || new Date(),
      scannerName,
      scannerVersion,
      summary,
      createdBy: req.user.id
    });

    await scan.save();
    
    logger.info(`Security scan created: ${scan._id} using ${scannerName}`);
    
    return res.status(201).json({
      status: 'success',
      data: scan
    });
  } catch (error) {
    logger.error(`Error creating security scan: ${error.message}`);
    next(error);
  }
};

/**
 * Register vulnerabilities from scan
 * @route POST /api/security/vulnerabilities/batch
 */
exports.registerVulnerabilities = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { scanId, vulnerabilities } = req.body;
    
    // Validate scan exists
    const scan = await SecurityScan.findById(scanId);
    if (!scan) {
      return res.status(404).json({
        status: 'error',
        message: errorTypes.NOT_FOUND,
        details: 'Security scan not found'
      });
    }
    
    // Create vulnerabilities in bulk
    const vulnerabilityDocs = vulnerabilities.map(vuln => ({
      scanId,
      title: vuln.title,
      description: vuln.description,
      severity: vuln.severity,
      cvssScore: vuln.cvssScore,
      affected: {
        component: vuln.affected?.component,
        version: vuln.affected?.version,
        path: vuln.affected?.path
      },
      remediation: vuln.remediation,
      discoveredDate: vuln.discoveredDate || new Date(),
      status: 'open',
      createdBy: req.user.id
    }));
    
    const createdVulnerabilities = await Vulnerability.insertMany(vulnerabilityDocs);
    
    // Update scan with vulnerability count
    scan.vulnerabilitiesByLevel = {
      critical: vulnerabilityDocs.filter(v => v.severity === 'critical').length,
      high: vulnerabilityDocs.filter(v => v.severity === 'high').length,
      medium: vulnerabilityDocs.filter(v => v.severity === 'medium').length,
      low: vulnerabilityDocs.filter(v => v.severity === 'low').length,
      info: vulnerabilityDocs.filter(v => v.severity === 'info').length,
    };
    scan.vulnerabilityCount = vulnerabilityDocs.length;
    await scan.save();
    
    logger.info(`${createdVulnerabilities.length} vulnerabilities registered for scan ${scanId}`);
    
    return res.status(201).json({
      status: 'success',
      message: `${createdVulnerabilities.length} vulnerabilities registered`,
      data: {
        count: createdVulnerabilities.length,
        scanId
      }
    });
  } catch (error) {
    logger.error(`Error registering vulnerabilities: ${error.message}`);
    next(error);
  }
};

/**
 * Get vulnerability report
 * @route GET /api/security/vulnerabilities/report
 */
exports.getVulnerabilityReport = async (req, res, next) => {
  try {
    const { severity, status, component, limit, page } = req.query;
    const pageSize = parseInt(limit) || 20;
    const currentPage = parseInt(page) || 1;
    
    // Build query
    const query = {};
    if (severity) query.severity = severity;
    if (status) query.status = status;
    if (component) query['affected.component'] = component;
    
    // Get count and vulnerabilities
    const totalCount = await Vulnerability.countDocuments(query);
    
    const vulnerabilities = await Vulnerability.find(query)
      .sort({ cvssScore: -1, discoveredDate: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .populate('scanId', 'scanType scannerName scanDate');
    
    // Calculate severity stats
    const stats = {
      critical: await Vulnerability.countDocuments({ ...query, severity: 'critical', status: 'open' }),
      high: await Vulnerability.countDocuments({ ...query, severity: 'high', status: 'open' }),
      medium: await Vulnerability.countDocuments({ ...query, severity: 'medium', status: 'open' }),
      low: await Vulnerability.countDocuments({ ...query, severity: 'low', status: 'open' }),
      info: await Vulnerability.countDocuments({ ...query, severity: 'info', status: 'open' }),
      fixed: await Vulnerability.countDocuments({ ...query, status: 'fixed' }),
      inProgress: await Vulnerability.countDocuments({ ...query, status: 'in_progress' }),
      total: totalCount
    };
    
    return res.status(200).json({
      status: 'success',
      data: {
        vulnerabilities,
        pagination: {
          total: totalCount,
          page: currentPage,
          pageSize,
          pages: Math.ceil(totalCount / pageSize)
        },
        stats
      }
    });
  } catch (error) {
    logger.error(`Error getting vulnerability report: ${error.message}`);
    next(error);
  }
};

/**
 * Update vulnerability status
 * @route PATCH /api/security/vulnerabilities/:id/status
 */
exports.updateVulnerabilityStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const vulnerability = await Vulnerability.findById(id);
    if (!vulnerability) {
      return res.status(404).json({
        status: 'error',
        message: errorTypes.NOT_FOUND,
        details: 'Vulnerability not found'
      });
    }
    
    vulnerability.status = status;
    vulnerability.statusHistory.push({
      status,
      notes,
      changedBy: req.user.id,
      changedAt: new Date()
    });
    
    if (status === 'fixed') {
      vulnerability.fixedDate = new Date();
      vulnerability.fixedBy = req.user.id;
    }
    
    await vulnerability.save();
    
    logger.info(`Vulnerability ${id} status updated to ${status}`);
    
    return res.status(200).json({
      status: 'success',
      data: vulnerability
    });
  } catch (error) {
    logger.error(`Error updating vulnerability status: ${error.message}`);
    next(error);
  }
};

/**
 * Get prioritized vulnerabilities
 * @route GET /api/security/vulnerabilities/prioritized
 */
exports.getPrioritizedVulnerabilities = async (req, res, next) => {
  try {
    // First get critical vulnerabilities
    const criticalVulnerabilities = await Vulnerability.find({
      severity: 'critical',
      status: 'open'
    }).sort({ cvssScore: -1 }).limit(10);
    
    // Then get high vulnerabilities in sensitive components
    const sensitiveHighVulnerabilities = await Vulnerability.find({
      severity: 'high',
      status: 'open',
      $or: [
        { 'affected.component': { $regex: /auth|login|password|token|payment|billing/i } },
        { 'affected.path': { $regex: /auth|login|password|token|payment|billing/i } }
      ]
    }).sort({ cvssScore: -1 }).limit(10);
    
    // Get remaining high vulnerabilities
    const highVulnerabilities = await Vulnerability.find({
      severity: 'high',
      status: 'open',
      _id: { $nin: sensitiveHighVulnerabilities.map(v => v._id) }
    }).sort({ cvssScore: -1 }).limit(10);
    
    return res.status(200).json({
      status: 'success',
      data: {
        critical: criticalVulnerabilities,
        sensitiveHigh: sensitiveHighVulnerabilities,
        high: highVulnerabilities,
        recommendation: "Fix Critical vulnerabilities immediately, followed by High severity issues in sensitive components."
      }
    });
  } catch (error) {
    logger.error(`Error getting prioritized vulnerabilities: ${error.message}`);
    next(error);
  }
};
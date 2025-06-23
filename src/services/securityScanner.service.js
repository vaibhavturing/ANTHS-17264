/**
 * Security Scanner Service
 * File: src/services/securityScanner.service.js
 * 
 * Service for integrating with external security scanners and processing results
 */
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');
const logger = require('../utils/logger');
const SecurityScan = require('../models/securityScan.model');
const Vulnerability = require('../models/vulnerability.model');
const config = require('../config/config');

class SecurityScannerService {
  /**
   * Parse Nessus scan results
   * @param {string} filePath - Path to Nessus XML file
   * @returns {Promise<Object>} Parsed scan results
   */
  async parseNessusResults(filePath) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(fileContent);
      
      // Extract scan information
      const scanInfo = {
        scanType: 'automated',
        scannerName: 'Nessus',
        scannerVersion: result.NessusClientData_v2?.Policy?.policyName || 'Unknown',
        summary: `Nessus scan with ${result.NessusClientData_v2?.Policy?.policyName} policy`,
        scanDate: new Date()
      };
      
      // Extract vulnerabilities
      const vulnerabilities = [];
      
      if (result.NessusClientData_v2?.Report?.ReportHost) {
        const hosts = Array.isArray(result.NessusClientData_v2.Report.ReportHost) 
          ? result.NessusClientData_v2.Report.ReportHost 
          : [result.NessusClientData_v2.Report.ReportHost];
          
        hosts.forEach(host => {
          const items = Array.isArray(host.ReportItem) ? host.ReportItem : [host.ReportItem];
          
          items.forEach(item => {
            if (!item) return;
            
            // Map severity from Nessus to our system
            const severityMap = {
              '0': 'info',
              '1': 'low',
              '2': 'medium',
              '3': 'high',
              '4': 'critical'
            };
            
            const severity = severityMap[item.severity] || 'info';
            
            vulnerabilities.push({
              title: item.pluginName || 'Unknown vulnerability',
              description: item.description || 'No description provided',
              severity,
              cvssScore: item.cvss_base_score ? parseFloat(item.cvss_base_score) : null,
              cve: item.cve || null,
              affected: {
                component: item.pluginName,
                path: host.name || 'Unknown'
              },
              remediation: item.solution || 'No remediation provided',
              discoveredDate: new Date()
            });
          });
        });
      }
      
      return {
        scanInfo,
        vulnerabilities
      };
    } catch (error) {
      logger.error(`Error parsing Nessus results: ${error.message}`);
      throw new Error(`Failed to parse Nessus results: ${error.message}`);
    }
  }
  
  /**
   * Parse OWASP ZAP scan results
   * @param {string} filePath - Path to ZAP JSON file
   * @returns {Promise<Object>} Parsed scan results
   */
  async parseZapResults(filePath) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const zapResults = JSON.parse(fileContent);
      
      // Extract scan information
      const scanInfo = {
        scanType: 'automated',
        scannerName: 'OWASP ZAP',
        scannerVersion: zapResults.zapVersion || 'Unknown',
        summary: `OWASP ZAP scan with ${zapResults.alerts?.length || 0} findings`,
        scanDate: new Date()
      };
      
      // Extract vulnerabilities
      const vulnerabilities = [];
      
      if (zapResults.alerts && Array.isArray(zapResults.alerts)) {
        zapResults.alerts.forEach(alert => {
          // Map risk to severity
          const severityMap = {
            'Informational': 'info',
            'Low': 'low',
            'Medium': 'medium',
            'High': 'high',
            'Critical': 'critical'
          };
          
          const severity = severityMap[alert.risk] || 'info';
          
          vulnerabilities.push({
            title: alert.name || 'Unknown vulnerability',
            description: alert.description || 'No description provided',
            severity,
            cvssScore: null, // ZAP doesn't provide CVSS scores directly
            affected: {
              component: alert.name,
              path: alert.url || 'Unknown'
            },
            remediation: alert.solution || 'No remediation provided',
            discoveredDate: new Date()
          });
        });
      }
      
      return {
        scanInfo,
        vulnerabilities
      };
    } catch (error) {
      logger.error(`Error parsing ZAP results: ${error.message}`);
      throw new Error(`Failed to parse ZAP results: ${error.message}`);
    }
  }
  
  /**
   * Parse results from manual penetration testing
   * @param {Object} manualResults - Manual penetration test results
   * @returns {Object} Processed results
   */
  processManualTestResults(manualResults) {
    try {
      // Extract scan information
      const scanInfo = {
        scanType: 'penetration_test',
        scannerName: manualResults.tester || 'Manual Pen Test',
        scannerVersion: manualResults.methodology || 'Custom',
        summary: manualResults.summary || 'Manual penetration test',
        scanDate: new Date(manualResults.date) || new Date()
      };
      
      // Extract vulnerabilities
      const vulnerabilities = [];
      
      if (manualResults.findings && Array.isArray(manualResults.findings)) {
        manualResults.findings.forEach(finding => {
          vulnerabilities.push({
            title: finding.title || 'Unknown vulnerability',
            description: finding.description || 'No description provided',
            severity: finding.severity?.toLowerCase() || 'info',
            cvssScore: finding.cvssScore ? parseFloat(finding.cvssScore) : null,
            affected: {
              component: finding.component || 'Unknown',
              path: finding.path || 'Unknown'
            },
            remediation: finding.remediation || 'No remediation provided',
            discoveredDate: new Date(finding.date) || new Date()
          });
        });
      }
      
      return {
        scanInfo,
        vulnerabilities
      };
    } catch (error) {
      logger.error(`Error processing manual test results: ${error.message}`);
      throw new Error(`Failed to process manual test results: ${error.message}`);
    }
  }
  
  /**
   * Register scan and vulnerabilities in the database
   * @param {Object} scanData - Processed scan data
   * @param {string} userId - ID of the user registering the scan
   * @returns {Promise<Object>} Scan and vulnerability info
   */
  async registerScanResults(scanData, userId) {
    try {
      // Create scan record
      const scan = new SecurityScan({
        ...scanData.scanInfo,
        createdBy: userId
      });
      
      await scan.save();
      
      // Create vulnerability records
      const vulnerabilityDocs = scanData.vulnerabilities.map(vuln => ({
        scanId: scan._id,
        ...vuln,
        createdBy: userId
      }));
      
      const createdVulnerabilities = await Vulnerability.insertMany(vulnerabilityDocs);
      
      // Update scan with vulnerability count
      scan.vulnerabilityCount = vulnerabilityDocs.length;
      scan.vulnerabilitiesByLevel = {
        critical: vulnerabilityDocs.filter(v => v.severity === 'critical').length,
        high: vulnerabilityDocs.filter(v => v.severity === 'high').length,
        medium: vulnerabilityDocs.filter(v => v.severity === 'medium').length,
        low: vulnerabilityDocs.filter(v => v.severity === 'low').length,
        info: vulnerabilityDocs.filter(v => v.severity === 'info').length,
      };
      
      await scan.save();
      
      return {
        scan,
        vulnerabilityCount: createdVulnerabilities.length
      };
    } catch (error) {
      logger.error(`Error registering scan results: ${error.message}`);
      throw new Error(`Failed to register scan results: ${error.message}`);
    }
  }
  
  /**
   * Schedule automated security scanning
   * @param {string} scanType - Type of scan to schedule
   * @param {Object} options - Scan options
   * @returns {Promise<Object>} Schedule confirmation
   */
  async scheduleScan(scanType, options = {}) {
    // This would integrate with external scanning system APIs
    // Implementation would vary based on the specific scanner being used
    
    logger.info(`Scheduled ${scanType} scan with options: ${JSON.stringify(options)}`);
    
    return {
      scheduled: true,
      scanType,
      estimatedCompletion: new Date(Date.now() + 3600000) // Estimated 1 hour
    };
  }
}

module.exports = new SecurityScannerService();
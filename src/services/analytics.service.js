const { 
  AnalyticsReport, 
  ReportExport, 
  TreatmentOutcome, 
  PopulationHealthMetric 
} = require('../models/analytics.model');
const { Patient } = require('../models/patient.model');
const { Appointment } = require('../models/appointment.model');
const { MedicalRecord } = require('../models/medicalRecord.model');
const { Billing } = require('../models/billing.model');
const { InsuranceClaim } = require('../models/billing.model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { formatDate, dateDiffInDays, calculateAge } = require('../utils/date.util');
const { exportToPdf, exportToCsv, exportToExcel } = require('../utils/export.util');
const crypto = require('crypto');

/**
 * Service for generating and managing analytics reports
 */
const analyticsService = {
  /**
   * Generate a new analytics report
   * @param {string} reportType - Type of report to generate
   * @param {Object} filters - Filter criteria for the report
   * @param {Object} options - Additional options for report generation
   * @param {Object} user - User requesting the report
   * @returns {Promise<Object>} Generated report
   */
  generateReport: async (reportType, filters = {}, options = {}, user) => {
    try {
      logger.info(`Generating ${reportType} report`, { userId: user._id });
      
      // Check cache for existing recent report with same parameters
      if (!options.bypassCache) {
        const cachedReport = await findCachedReport(reportType, filters, user._id);
        if (cachedReport) {
          logger.info(`Using cached report: ${cachedReport._id}`);
          return cachedReport;
        }
      }
      
      // Generate the appropriate report based on type
      let reportData;
      switch (reportType) {
        case 'patient_demographics':
          reportData = await generatePatientDemographicsReport(filters);
          break;
        case 'health_trends':
          reportData = await generateHealthTrendsReport(filters);
          break;
        case 'appointment_adherence':
          reportData = await generateAppointmentAdherenceReport(filters);
          break;
        case 'treatment_outcomes':
          reportData = await generateTreatmentOutcomesReport(filters);
          break;
        case 'population_health':
          reportData = await generatePopulationHealthReport(filters);
          break;
        default:
          throw new ValidationError(`Unsupported report type: ${reportType}`);
      }
      
      // Create a new report in the database
      const report = new AnalyticsReport({
        reportType,
        parameters: filters,
        data: reportData,
        filteredBy: {
          department: filters.department,
          doctorId: filters.doctorId,
          dateRange: filters.dateRange,
          ageGroup: filters.ageGroup,
          gender: filters.gender,
          diagnosisCodes: filters.diagnosisCodes,
          treatmentCodes: filters.treatmentCodes
        },
        createdBy: user._id,
        isPublic: options.isPublic || false
      });
      
      await report.save();
      logger.info(`Report generated successfully: ${report._id}`);
      
      return report;
    } catch (error) {
      logger.error('Failed to generate analytics report', { error: error.message, reportType });
      throw error;
    }
  },

  /**
   * Get a specific report by ID
   * @param {string} reportId - Report ID
   * @param {Object} user - User requesting the report
   * @returns {Promise<Object>} Report
   */
  getReportById: async (reportId, user) => {
    try {
      const report = await AnalyticsReport.findById(reportId);
      
      if (!report) {
        throw new NotFoundError('Report not found');
      }
      
      // Check if user has permission to access this report
      if (!report.isPublic && report.createdBy.toString() !== user._id.toString()) {
        // Check if user has admin permissions
        const isAdmin = user.roles.includes('admin');
        
        if (!isAdmin) {
          throw new ValidationError('You do not have permission to access this report');
        }
      }
      
      return report;
    } catch (error) {
      logger.error('Failed to get report', { error: error.message, reportId });
      throw error;
    }
  },

  /**
   * Get all reports with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} user - User requesting the reports
   * @returns {Promise<Array>} List of reports
   */
  getReports: async (filters = {}, user) => {
    try {
      const query = { ...filters };
      
      // Non-admins can only see their own reports or public reports
      const isAdmin = user.roles.includes('admin');
      
      if (!isAdmin) {
        query.$or = [
          { createdBy: user._id },
          { isPublic: true }
        ];
      }
      
      const reports = await AnalyticsReport.find(query)
        .populate('createdBy', 'firstName lastName email')
        .sort({ createdAt: -1 });
      
      return reports;
    } catch (error) {
      logger.error('Failed to get reports', { error: error.message });
      throw error;
    }
  },

  /**
   * Export a report in the specified format
   * @param {string} reportId - Report ID
   * @param {string} format - Export format (pdf, csv, excel)
   * @param {Object} options - Export options
   * @param {Object} user - User requesting the export
   * @returns {Promise<Object>} Export result with file content
   */
  exportReport: async (reportId, format, options = {}, user) => {
    try {
      logger.info(`Exporting report ${reportId} in ${format} format`, { userId: user._id });
      
      // Get the report
      const report = await AnalyticsReport.findById(reportId);
      if (!report) {
        throw new NotFoundError('Report not found');
      }
      
      // Check if user has permission to export this report
      if (!report.isPublic && report.createdBy.toString() !== user._id.toString()) {
        const isAdmin = user.roles.includes('admin');
        if (!isAdmin) {
          throw new ValidationError('You do not have permission to export this report');
        }
      }
      
      // Process the report data for export
      const exportData = processDataForExport(report.data, options.anonymized);
      
      // Generate the export in the requested format
      let exportResult;
      switch (format.toLowerCase()) {
        case 'pdf':
          exportResult = await exportToPdf(exportData, report.reportType);
          break;
        case 'csv':
          exportResult = await exportToCsv(exportData);
          break;
        case 'excel':
          exportResult = await exportToExcel(exportData);
          break;
        case 'json':
          exportResult = {
            content: JSON.stringify(exportData, null, 2),
            contentType: 'application/json',
            filename: `${report.reportType}_${Date.now()}.json`
          };
          break;
        default:
          throw new ValidationError(`Unsupported export format: ${format}`);
      }
      
      // Track the export for audit purposes
      const exportRecord = new ReportExport({
        reportId: report._id,
        exportedBy: user._id,
        exportFormat: format.toLowerCase(),
        reason: options.reason || 'Data analysis',
        anonymized: options.anonymized !== false, // Default to true if not specified
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        dataFields: options.dataFields || Object.keys(exportData)
      });
      
      await exportRecord.save();
      
      return exportResult;
    } catch (error) {
      logger.error('Failed to export report', { error: error.message, reportId, format });
      throw error;
    }
  },

  /**
   * Record a treatment outcome
   * @param {Object} outcomeData - Treatment outcome data
   * @returns {Promise<Object>} Created outcome record
   */
  recordTreatmentOutcome: async (outcomeData) => {
    try {
      logger.info('Recording treatment outcome');
      
      // Check if there's an existing outcome for this treatment
      const existingOutcome = await TreatmentOutcome.findOne({
        patientId: outcomeData.patientId,
        medicalRecordId: outcomeData.medicalRecordId,
        treatmentCode: outcomeData.treatmentCode
      });
      
      if (existingOutcome) {
        // Update existing outcome
        const updatedOutcome = await TreatmentOutcome.findByIdAndUpdate(
          existingOutcome._id,
          outcomeData,
          { new: true, runValidators: true }
        );
        
        logger.info(`Treatment outcome updated: ${updatedOutcome._id}`);
        return updatedOutcome;
      }
      
      // Create new outcome record
      const outcome = new TreatmentOutcome(outcomeData);
      await outcome.save();
      
      logger.info(`Treatment outcome recorded: ${outcome._id}`);
      return outcome;
    } catch (error) {
      logger.error('Failed to record treatment outcome', { error: error.message });
      throw error;
    }
  },

  /**
   * Get treatment outcomes for a patient
   * @param {string} patientId - Patient ID
   * @returns {Promise<Array>} List of treatment outcomes
   */
  getPatientTreatmentOutcomes: async (patientId) => {
    try {
      const outcomes = await TreatmentOutcome.find({ patientId })
        .populate('medicalRecordId')
        .sort({ startDate: -1 });
      
      return outcomes;
    } catch (error) {
      logger.error('Failed to get patient treatment outcomes', { error: error.message, patientId });
      throw error;
    }
  },

  /**
   * Record a population health metric
   * @param {Object} metricData - Population health metric data
   * @returns {Promise<Object>} Created metric record
   */
  recordPopulationHealthMetric: async (metricData) => {
    try {
      logger.info(`Recording population health metric: ${metricData.metricName}`);
      
      const metric = new PopulationHealthMetric(metricData);
      await metric.save();
      
      logger.info(`Population health metric recorded: ${metric._id}`);
      return metric;
    } catch (error) {
      logger.error('Failed to record population health metric', { error: error.message });
      throw error;
    }
  },

  /**
   * Get population health metrics with optional filtering
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} List of population health metrics
   */
  getPopulationHealthMetrics: async (filters = {}) => {
    try {
      const query = { ...filters };
      
      // Handle date range filtering
      if (filters.dateRange) {
        query.date = {};
        if (filters.dateRange.start) {
          query.date.$gte = new Date(filters.dateRange.start);
        }
        if (filters.dateRange.end) {
          query.date.$lte = new Date(filters.dateRange.end);
        }
        delete query.dateRange;
      }
      
      // Handle population segment filtering
      if (filters.populationSegment) {
        for (const [key, value] of Object.entries(filters.populationSegment)) {
          query[`populationSegment.${key}`] = value;
        }
        delete query.populationSegment;
      }
      
      const metrics = await PopulationHealthMetric.find(query)
        .sort({ date: -1 });
      
      return metrics;
    } catch (error) {
      logger.error('Failed to get population health metrics', { error: error.message });
      throw error;
    }
  },

  /**
   * Generate insights based on analytics data
   * @param {Object} params - Parameters for insight generation
   * @returns {Promise<Object>} Generated insights
   */
  generateInsights: async (params = {}) => {
    try {
      logger.info('Generating analytics insights');
      
      // Get relevant data for insights
      const [
        patientDemographics,
        appointmentAdherence,
        treatmentOutcomes,
        populationHealthMetrics
      ] = await Promise.all([
        generatePatientDemographicsReport(params),
        generateAppointmentAdherenceReport(params),
        generateTreatmentOutcomesReport(params),
        generatePopulationHealthReport(params)
      ]);
      
      // Generate insights from the data
      const insights = {
        topFindings: extractTopFindings({
          patientDemographics,
          appointmentAdherence,
          treatmentOutcomes,
          populationHealthMetrics
        }),
        recommendations: generateRecommendations({
          patientDemographics,
          appointmentAdherence,
          treatmentOutcomes,
          populationHealthMetrics
        }),
        trends: identifyTrends({
          patientDemographics,
          appointmentAdherence,
          treatmentOutcomes,
          populationHealthMetrics
        }),
        riskFactors: identifyRiskFactors({
          patientDemographics,
          appointmentAdherence,
          treatmentOutcomes,
          populationHealthMetrics
        })
      };
      
      return insights;
    } catch (error) {
      logger.error('Failed to generate insights', { error: error.message });
      throw error;
    }
  }
};

/**
 * Find a cached report with the same parameters
 * @param {string} reportType - Type of report
 * @param {Object} filters - Filter criteria
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Cached report or null
 */
async function findCachedReport(reportType, filters, userId) {
  try {
    // Look for a recent report (less than 24 hours old) with the same parameters
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const report = await AnalyticsReport.findOne({
      reportType,
      'parameters': filters,
      createdAt: { $gt: oneDayAgo },
      $or: [
        { createdBy: userId },
        { isPublic: true }
      ]
    }).sort({ createdAt: -1 });
    
    return report;
  } catch (error) {
    logger.warn('Error finding cached report', { error: error.message });
    return null;
  }
}

/**
 * Generate patient demographics report
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Object>} Demographics report data
 */
async function generatePatientDemographicsReport(filters = {}) {
  try {
    logger.info('Generating patient demographics report');
    
    // Build the query based on filters
    const query = buildPatientQuery(filters);
    
    // Get the patients
    const patients = await Patient.find(query);
    
    if (!patients.length) {
      return {
        totalPatients: 0,
        message: 'No patients found matching the criteria'
      };
    }
    
    // Calculate age for each patient
    patients.forEach(patient => {
      if (patient.dateOfBirth) {
        patient.age = calculateAge(patient.dateOfBirth);
      }
    });
    
    // Calculate gender distribution
    const genderDistribution = patients.reduce((acc, patient) => {
      const gender = patient.gender || 'unspecified';
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate age distribution
    const ageGroups = {
      '0-17': 0,
      '18-34': 0,
      '35-50': 0,
      '51-65': 0,
      '66-80': 0,
      '80+': 0,
      'unknown': 0
    };
    
    patients.forEach(patient => {
      if (!patient.age) {
        ageGroups.unknown++;
      } else if (patient.age <= 17) {
        ageGroups['0-17']++;
      } else if (patient.age <= 34) {
        ageGroups['18-34']++;
      } else if (patient.age <= 50) {
        ageGroups['35-50']++;
      } else if (patient.age <= 65) {
        ageGroups['51-65']++;
      } else if (patient.age <= 80) {
        ageGroups['66-80']++;
      } else {
        ageGroups['80+']++;
      }
    });
    
    // Calculate geographic distribution
    const zipCodeDistribution = patients.reduce((acc, patient) => {
      if (patient.address && patient.address.zipCode) {
        acc[patient.address.zipCode] = (acc[patient.address.zipCode] || 0) + 1;
      }
      return acc;
    }, {});
    
    // Calculate insurance type distribution
    const insuranceTypeDistribution = {};
    const patientsWithInsurance = await Patient.find(query)
      .populate('insurance.provider');
    
    patientsWithInsurance.forEach(patient => {
      if (patient.insurance && patient.insurance.provider) {
        const provider = patient.insurance.provider.name || 'Unknown';
        insuranceTypeDistribution[provider] = (insuranceTypeDistribution[provider] || 0) + 1;
      }
    });
    
    // Calculate common diagnoses
    const medicalRecords = await MedicalRecord.find({
      patientId: { $in: patients.map(p => p._id) }
    });
    
    const diagnosisCounts = {};
    medicalRecords.forEach(record => {
      if (record.diagnosis && record.diagnosis.code) {
        diagnosisCounts[record.diagnosis.code] = (diagnosisCounts[record.diagnosis.code] || 0) + 1;
      }
    });
    
    // Sort diagnoses by frequency
    const commonDiagnoses = Object.entries(diagnosisCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, count }));
    
    // Calculate chronic condition prevalence
    const chronicConditions = {
      'diabetes': 0,
      'hypertension': 0,
      'asthma': 0,
      'heart_disease': 0,
      'cancer': 0,
      'copd': 0,
      'arthritis': 0,
      'depression': 0,
      'anxiety': 0,
      'obesity': 0
    };
    
    const chronicConditionCodes = {
      'diabetes': ['E11', 'E10'],
      'hypertension': ['I10', 'I11', 'I12', 'I13'],
      'asthma': ['J45'],
      'heart_disease': ['I20', 'I21', 'I22', 'I23', 'I24', 'I25'],
      'cancer': ['C'],
      'copd': ['J44'],
      'arthritis': ['M15', 'M16', 'M17', 'M18', 'M19'],
      'depression': ['F32', 'F33'],
      'anxiety': ['F40', 'F41'],
      'obesity': ['E66']
    };
    
    medicalRecords.forEach(record => {
      if (record.diagnosis && record.diagnosis.code) {
        for (const [condition, codes] of Object.entries(chronicConditionCodes)) {
          if (codes.some(code => record.diagnosis.code.startsWith(code))) {
            chronicConditions[condition]++;
            break;
          }
        }
      }
    });
    
    // Return the compiled demographics data
    return {
      totalPatients: patients.length,
      genderDistribution,
      ageDistribution: ageGroups,
      geographicDistribution: {
        byZipCode: zipCodeDistribution
      },
      insuranceDistribution: insuranceTypeDistribution,
      commonDiagnoses,
      chronicConditionPrevalence: chronicConditions
    };
  } catch (error) {
    logger.error('Failed to generate patient demographics report', { error: error.message });
    throw error;
  }
}

/**
 * Generate health trends report
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Object>} Health trends report data
 */
async function generateHealthTrendsReport(filters = {}) {
  try {
    logger.info('Generating health trends report');
    
    // Build the query based on filters
    const query = buildPatientQuery(filters);
    
    // Get the patients
    const patientIds = (await Patient.find(query).select('_id')).map(p => p._id);
    
    if (!patientIds.length) {
      return {
        message: 'No patients found matching the criteria'
      };
    }
    
    // Get medical records for these patients
    const medicalRecords = await MedicalRecord.find({
      patientId: { $in: patientIds }
    }).sort({ date: 1 });
    
    // Group records by date (using month resolution)
    const recordsByMonth = {};
    medicalRecords.forEach(record => {
      const date = new Date(record.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!recordsByMonth[monthKey]) {
        recordsByMonth[monthKey] = [];
      }
      
      recordsByMonth[monthKey].push(record);
    });
    
    // Analyze diagnosis trends over time
    const diagnosisTrends = {};
    Object.entries(recordsByMonth).forEach(([month, records]) => {
      const diagnosisCounts = {};
      
      records.forEach(record => {
        if (record.diagnosis && record.diagnosis.code) {
          diagnosisCounts[record.diagnosis.code] = (diagnosisCounts[record.diagnosis.code] || 0) + 1;
        }
      });
      
      // Get the top diagnoses for this month
      const topDiagnoses = Object.entries(diagnosisCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([code, count]) => ({ code, count }));
      
      diagnosisTrends[month] = {
        totalRecords: records.length,
        topDiagnoses
      };
    });
    
    // Analyze treatment outcomes over time
    const treatmentOutcomes = await TreatmentOutcome.find({
      patientId: { $in: patientIds }
    }).sort({ startDate: 1 });
    
    const treatmentOutcomesByMonth = {};
    treatmentOutcomes.forEach(outcome => {
      const date = new Date(outcome.startDate);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!treatmentOutcomesByMonth[monthKey]) {
        treatmentOutcomesByMonth[monthKey] = {
          total: 0,
          outcomes: {
            resolved: 0,
            improved: 0,
            unchanged: 0,
            worsened: 0,
            'n/a': 0
          }
        };
      }
      
      treatmentOutcomesByMonth[monthKey].total++;
      treatmentOutcomesByMonth[monthKey].outcomes[outcome.outcome]++;
    });
    
    // Analyze BMI trends
    const bmiTrends = {};
    const patients = await Patient.find({
      _id: { $in: patientIds },
      'vitalSigns.bmi': { $exists: true }
    }).select('_id vitalSigns');
    
    patients.forEach(patient => {
      if (patient.vitalSigns && patient.vitalSigns.length > 0) {
        patient.vitalSigns.forEach(vs => {
          if (vs.bmi && vs.date) {
            const date = new Date(vs.date);
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            
            if (!bmiTrends[monthKey]) {
              bmiTrends[monthKey] = {
                values: [],
                average: 0
              };
            }
            
            bmiTrends[monthKey].values.push(vs.bmi);
          }
        });
      }
    });
    
    // Calculate average BMI for each month
    Object.keys(bmiTrends).forEach(month => {
      const values = bmiTrends[month].values;
      bmiTrends[month].average = values.reduce((sum, val) => sum + val, 0) / values.length;
      bmiTrends[month].count = values.length;
      
      // Calculate distribution by BMI category
      const categories = {
        underweight: 0,  // < 18.5
        normal: 0,       // 18.5 - 24.9
        overweight: 0,   // 25 - 29.9
        obese: 0         // >= 30
      };
      
      values.forEach(bmi => {
        if (bmi < 18.5) categories.underweight++;
        else if (bmi < 25) categories.normal++;
        else if (bmi < 30) categories.overweight++;
        else categories.obese++;
      });
      
      bmiTrends[month].categories = categories;
    });
    
    // Analyze blood pressure trends
    const bpTrends = {};
    const patientsWithBP = await Patient.find({
      _id: { $in: patientIds },
      'vitalSigns.bloodPressure': { $exists: true }
    }).select('_id vitalSigns');
    
    patientsWithBP.forEach(patient => {
      if (patient.vitalSigns && patient.vitalSigns.length > 0) {
        patient.vitalSigns.forEach(vs => {
          if (vs.bloodPressure && vs.bloodPressure.systolic && vs.bloodPressure.diastolic && vs.date) {
            const date = new Date(vs.date);
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            
            if (!bpTrends[monthKey]) {
              bpTrends[monthKey] = {
                systolic: [],
                diastolic: [],
                averageSystolic: 0,
                averageDiastolic: 0
              };
            }
            
            bpTrends[monthKey].systolic.push(vs.bloodPressure.systolic);
            bpTrends[monthKey].diastolic.push(vs.bloodPressure.diastolic);
          }
        });
      }
    });
    
    // Calculate average blood pressure for each month
    Object.keys(bpTrends).forEach(month => {
      const systolic = bpTrends[month].systolic;
      const diastolic = bpTrends[month].diastolic;
      
      bpTrends[month].averageSystolic = systolic.reduce((sum, val) => sum + val, 0) / systolic.length;
      bpTrends[month].averageDiastolic = diastolic.reduce((sum, val) => sum + val, 0) / diastolic.length;
      bpTrends[month].count = systolic.length;
      
      // Calculate distribution by BP category
      const categories = {
        normal: 0,            // < 120/80
        elevated: 0,          // 120-129/<80
        hypertension1: 0,     // 130-139/80-89
        hypertension2: 0,     // >= 140/>=90
        hypertensiveCrisis: 0 // > 180/>120
      };
      
      for (let i = 0; i < systolic.length; i++) {
        const sys = systolic[i];
        const dia = diastolic[i];
        
        if (sys > 180 || dia > 120) categories.hypertensiveCrisis++;
        else if (sys >= 140 || dia >= 90) categories.hypertension2++;
        else if (sys >= 130 || dia >= 80) categories.hypertension1++;
        else if (sys >= 120 && dia < 80) categories.elevated++;
        else categories.normal++;
      }
      
      bpTrends[month].categories = categories;
    });
    
    // Return the compiled health trends data
    return {
      diagnosisTrends,
      treatmentOutcomes: treatmentOutcomesByMonth,
      vitalSignsTrends: {
        bmi: bmiTrends,
        bloodPressure: bpTrends
      }
    };
  } catch (error) {
    logger.error('Failed to generate health trends report', { error: error.message });
    throw error;
  }
}

/**
 * Generate appointment adherence report
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Object>} Appointment adherence report data
 */
async function generateAppointmentAdherenceReport(filters = {}) {
  try {
    logger.info('Generating appointment adherence report');
    
    // Build query for patients
    const patientQuery = buildPatientQuery(filters);
    
    // Get patient IDs that match the query
    const patientIds = (await Patient.find(patientQuery).select('_id')).map(p => p._id);
    
    if (!patientIds.length) {
      return {
        message: 'No patients found matching the criteria'
      };
    }
    
    // Build query for appointments
    const appointmentQuery = {
      patientId: { $in: patientIds }
    };
    
    // Add date range filter if specified
    if (filters.dateRange) {
      appointmentQuery.appointmentDate = {};
      if (filters.dateRange.start) {
        appointmentQuery.appointmentDate.$gte = new Date(filters.dateRange.start);
      }
      if (filters.dateRange.end) {
        appointmentQuery.appointmentDate.$lte = new Date(filters.dateRange.end);
      }
    }
    
    // Get all appointments
    const appointments = await Appointment.find(appointmentQuery);
    
    // Calculate overall statistics
    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter(a => a.status === 'completed').length;
    const cancelledAppointments = appointments.filter(a => a.status === 'cancelled').length;
    const noShowAppointments = appointments.filter(a => a.status === 'no_show').length;
    const rescheduledAppointments = appointments.filter(a => a.status === 'rescheduled').length;
    
    // Adherence rate (completed appointments divided by scheduled non-cancelled)
    const scheduledNonCancelled = totalAppointments - cancelledAppointments - rescheduledAppointments;
    const adherenceRate = scheduledNonCancelled > 0 
      ? (completedAppointments / scheduledNonCancelled) * 100 
      : 0;
    
    // Group appointments by patient for individual adherence rates
    const appointmentsByPatient = {};
    appointments.forEach(appointment => {
      const patientId = appointment.patientId.toString();
      
      if (!appointmentsByPatient[patientId]) {
        appointmentsByPatient[patientId] = {
          total: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
          rescheduled: 0
        };
      }
      
      appointmentsByPatient[patientId].total++;
      
      switch (appointment.status) {
        case 'completed':
          appointmentsByPatient[patientId].completed++;
          break;
        case 'cancelled':
          appointmentsByPatient[patientId].cancelled++;
          break;
        case 'no_show':
          appointmentsByPatient[patientId].noShow++;
          break;
        case 'rescheduled':
          appointmentsByPatient[patientId].rescheduled++;
          break;
      }
    });
    
    // Calculate adherence rate for each patient
    Object.values(appointmentsByPatient).forEach(patient => {
      const scheduledNonCancelled = patient.total - patient.cancelled - patient.rescheduled;
      patient.adherenceRate = scheduledNonCancelled > 0 
        ? (patient.completed / scheduledNonCancelled) * 100 
        : 0;
    });
    
    // Group adherence rates into buckets
    const adherenceDistribution = {
      '0-25%': 0,
      '26-50%': 0,
      '51-75%': 0,
      '76-100%': 0
    };
    
    Object.values(appointmentsByPatient).forEach(patient => {
      if (patient.adherenceRate <= 25) adherenceDistribution['0-25%']++;
      else if (patient.adherenceRate <= 50) adherenceDistribution['26-50%']++;
      else if (patient.adherenceRate <= 75) adherenceDistribution['51-75%']++;
      else adherenceDistribution['76-100%']++;
    });
    
    // Calculate adherence by appointment type
    const adherenceByType = {};
    appointments.forEach(appointment => {
      const appointmentType = appointment.appointmentType || 'unspecified';
      
      if (!adherenceByType[appointmentType]) {
        adherenceByType[appointmentType] = {
          total: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
          rescheduled: 0,
          adherenceRate: 0
        };
      }
      
      adherenceByType[appointmentType].total++;
      
      switch (appointment.status) {
        case 'completed':
          adherenceByType[appointmentType].completed++;
          break;
        case 'cancelled':
          adherenceByType[appointmentType].cancelled++;
          break;
        case 'no_show':
          adherenceByType[appointmentType].noShow++;
          break;
        case 'rescheduled':
          adherenceByType[appointmentType].rescheduled++;
          break;
      }
    });
    
    // Calculate adherence rate for each appointment type
    Object.values(adherenceByType).forEach(type => {
      const scheduledNonCancelled = type.total - type.cancelled - type.rescheduled;
      type.adherenceRate = scheduledNonCancelled > 0 
        ? (type.completed / scheduledNonCancelled) * 100 
        : 0;
    });
    
    // Calculate adherence trends over time
    const adherenceTrendsByMonth = {};
    appointments.forEach(appointment => {
      const date = new Date(appointment.appointmentDate);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!adherenceTrendsByMonth[monthKey]) {
        adherenceTrendsByMonth[monthKey] = {
          total: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
          rescheduled: 0,
          adherenceRate: 0
        };
      }
      
      adherenceTrendsByMonth[monthKey].total++;
      
      switch (appointment.status) {
        case 'completed':
          adherenceTrendsByMonth[monthKey].completed++;
          break;
        case 'cancelled':
          adherenceTrendsByMonth[monthKey].cancelled++;
          break;
        case 'no_show':
          adherenceTrendsByMonth[monthKey].noShow++;
          break;
        case 'rescheduled':
          adherenceTrendsByMonth[monthKey].rescheduled++;
          break;
      }
    });
    
    // Calculate adherence rate for each month
    Object.values(adherenceTrendsByMonth).forEach(month => {
      const scheduledNonCancelled = month.total - month.cancelled - month.rescheduled;
      month.adherenceRate = scheduledNonCancelled > 0 
        ? (month.completed / scheduledNonCancelled) * 100 
        : 0;
    });
    
    // Return the compiled appointment adherence data
    return {
      overallStatistics: {
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        noShowAppointments,
        rescheduledAppointments,
        adherenceRate: parseFloat(adherenceRate.toFixed(2))
      },
      adherenceDistribution,
      adherenceByType,
      adherenceTrends: adherenceTrendsByMonth
    };
  } catch (error) {
    logger.error('Failed to generate appointment adherence report', { error: error.message });
    throw error;
  }
}

/**
 * Generate treatment outcomes report
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Object>} Treatment outcomes report data
 */
async function generateTreatmentOutcomesReport(filters = {}) {
  try {
    logger.info('Generating treatment outcomes report');
    
    // Build query for patients
    const patientQuery = buildPatientQuery(filters);
    
    // Get patient IDs that match the query
    const patientIds = (await Patient.find(patientQuery).select('_id')).map(p => p._id);
    
    if (!patientIds.length) {
      return {
        message: 'No patients found matching the criteria'
      };
    }
    
    // Build query for treatment outcomes
    const treatmentQuery = {
      patientId: { $in: patientIds }
    };
    
    // Add date range filter if specified
    if (filters.dateRange) {
      treatmentQuery.startDate = {};
      if (filters.dateRange.start) {
        treatmentQuery.startDate.$gte = new Date(filters.dateRange.start);
      }
      if (filters.dateRange.end) {
        treatmentQuery.startDate.$lte = new Date(filters.dateRange.end);
      }
    }
    
    // Add treatment code filter if specified
    if (filters.treatmentCodes && filters.treatmentCodes.length) {
      treatmentQuery.treatmentCode = { $in: filters.treatmentCodes };
    }
    
    // Add diagnosis code filter if specified
    if (filters.diagnosisCodes && filters.diagnosisCodes.length) {
      treatmentQuery.diagnosisCode = { $in: filters.diagnosisCodes };
    }
    
    // Get all treatment outcomes
    const treatmentOutcomes = await TreatmentOutcome.find(treatmentQuery);
    
    // Calculate overall effectiveness
    const totalTreatments = treatmentOutcomes.length;
    
    // Outcome distribution
    const outcomeDistribution = {
      resolved: 0,
      improved: 0,
      unchanged: 0,
      worsened: 0,
      'n/a': 0
    };
    
    treatmentOutcomes.forEach(treatment => {
      outcomeDistribution[treatment.outcome]++;
    });
    
    // Calculate success rate (resolved or improved)
    const successfulOutcomes = outcomeDistribution.resolved + outcomeDistribution.improved;
    const successRate = totalTreatments > 0 
      ? (successfulOutcomes / totalTreatments) * 100 
      : 0;
    
    // Group by treatment code
    const outcomesByTreatment = {};
    treatmentOutcomes.forEach(treatment => {
      const treatmentCode = treatment.treatmentCode;
      
      if (!outcomesByTreatment[treatmentCode]) {
        outcomesByTreatment[treatmentCode] = {
          total: 0,
          outcomes: {
            resolved: 0,
            improved: 0,
            unchanged: 0,
            worsened: 0,
            'n/a': 0
          },
          averageEffectivenessRating: 0,
          effectivenessRatings: [],
          successRate: 0
        };
      }
      
      outcomesByTreatment[treatmentCode].total++;
      outcomesByTreatment[treatmentCode].outcomes[treatment.outcome]++;
      
      if (treatment.effectivenessRating) {
        outcomesByTreatment[treatmentCode].effectivenessRatings.push(treatment.effectivenessRating);
      }
    });
    
    // Calculate average effectiveness rating and success rate for each treatment
    Object.values(outcomesByTreatment).forEach(treatment => {
      const totalRatings = treatment.effectivenessRatings.length;
      
      treatment.averageEffectivenessRating = totalRatings > 0
        ? treatment.effectivenessRatings.reduce((sum, rating) => sum + rating, 0) / totalRatings
        : 0;
      
      const successfulOutcomes = treatment.outcomes.resolved + treatment.outcomes.improved;
      treatment.successRate = treatment.total > 0 
        ? (successfulOutcomes / treatment.total) * 100 
        : 0;
    });
    
    // Group by diagnosis code
    const outcomesByDiagnosis = {};
    treatmentOutcomes.forEach(treatment => {
      const diagnosisCode = treatment.diagnosisCode;
      
      if (!outcomesByDiagnosis[diagnosisCode]) {
        outcomesByDiagnosis[diagnosisCode] = {
          total: 0,
          outcomes: {
            resolved: 0,
            improved: 0,
            unchanged: 0,
            worsened: 0,
            'n/a': 0
          },
          successRate: 0,
          treatmentCounts: {}
        };
      }
      
      outcomesByDiagnosis[diagnosisCode].total++;
      outcomesByDiagnosis[diagnosisCode].outcomes[treatment.outcome]++;
      
      // Count treatments used for this diagnosis
      const treatmentCode = treatment.treatmentCode;
      outcomesByDiagnosis[diagnosisCode].treatmentCounts[treatmentCode] = 
        (outcomesByDiagnosis[diagnosisCode].treatmentCounts[treatmentCode] || 0) + 1;
    });
    
    // Calculate success rate for each diagnosis
    Object.values(outcomesByDiagnosis).forEach(diagnosis => {
      const successfulOutcomes = diagnosis.outcomes.resolved + diagnosis.outcomes.improved;
      diagnosis.successRate = diagnosis.total > 0 
        ? (successfulOutcomes / diagnosis.total) * 100 
        : 0;
    });
    
    // Calculate side effect frequency
    const sideEffectFrequency = {};
    let totalSideEffects = 0;
    
    treatmentOutcomes.forEach(treatment => {
      if (treatment.sideEffects && treatment.sideEffects.length) {
        treatment.sideEffects.forEach(sideEffect => {
          const description = sideEffect.description.toLowerCase();
          
          if (!sideEffectFrequency[description]) {
            sideEffectFrequency[description] = {
              total: 0,
              byTreatmentCode: {},
              bySeverity: {
                mild: 0,
                moderate: 0,
                severe: 0
              }
            };
          }
          
          sideEffectFrequency[description].total++;
          sideEffectFrequency[description].bySeverity[sideEffect.severity]++;
          
          const treatmentCode = treatment.treatmentCode;
          sideEffectFrequency[description].byTreatmentCode[treatmentCode] = 
            (sideEffectFrequency[description].byTreatmentCode[treatmentCode] || 0) + 1;
          
          totalSideEffects++;
        });
      }
    });
    
    // Calculate patient satisfaction
    const satisfactionRatings = [];
    let totalFeedback = 0;
    
    treatmentOutcomes.forEach(treatment => {
      if (treatment.patientFeedback && treatment.patientFeedback.satisfactionRating) {
        satisfactionRatings.push(treatment.patientFeedback.satisfactionRating);
        totalFeedback++;
      }
    });
    
    const averageSatisfaction = totalFeedback > 0
      ? satisfactionRatings.reduce((sum, rating) => sum + rating, 0) / totalFeedback
      : 0;
    
    // Distribution of satisfaction ratings
    const satisfactionDistribution = {
      '1-2': 0,
      '3-4': 0,
      '5-6': 0,
      '7-8': 0,
      '9-10': 0
    };
    
    satisfactionRatings.forEach(rating => {
      if (rating <= 2) satisfactionDistribution['1-2']++;
      else if (rating <= 4) satisfactionDistribution['3-4']++;
      else if (rating <= 6) satisfactionDistribution['5-6']++;
      else if (rating <= 8) satisfactionDistribution['7-8']++;
      else satisfactionDistribution['9-10']++;
    });
    
    // Treatment duration analysis
    const treatmentDurations = [];
    
    treatmentOutcomes.forEach(treatment => {
      if (treatment.startDate && treatment.endDate) {
        const duration = dateDiffInDays(
          new Date(treatment.startDate),
          new Date(treatment.endDate)
        );
        
        treatmentDurations.push({
          treatmentCode: treatment.treatmentCode,
          diagnosisCode: treatment.diagnosisCode,
          durationDays: duration,
          outcome: treatment.outcome
        });
      }
    });
    
    // Return the compiled treatment outcomes data
    return {
      overallStatistics: {
        totalTreatments,
        outcomeDistribution,
        successRate: parseFloat(successRate.toFixed(2))
      },
      treatmentEffectiveness: outcomesByTreatment,
      diagnosisOutcomes: outcomesByDiagnosis,
      sideEffects: {
        totalSideEffects,
        frequency: sideEffectFrequency
      },
      patientSatisfaction: {
        totalFeedback,
        averageSatisfaction: parseFloat(averageSatisfaction.toFixed(2)),
        distribution: satisfactionDistribution
      },
      treatmentDurations
    };
  } catch (error) {
    logger.error('Failed to generate treatment outcomes report', { error: error.message });
    throw error;
  }
}

/**
 * Generate population health report
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Object>} Population health report data
 */
async function generatePopulationHealthReport(filters = {}) {
  try {
    logger.info('Generating population health report');
    
    // Get population health metrics from the database
    const metricQuery = {};
    
    // Apply date range filter if specified
    if (filters.dateRange) {
      metricQuery.date = {};
      if (filters.dateRange.start) {
        metricQuery.date.$gte = new Date(filters.dateRange.start);
      }
      if (filters.dateRange.end) {
        metricQuery.date.$lte = new Date(filters.dateRange.end);
      }
    }
    
    // Apply diagnosis code filter if specified
    if (filters.diagnosisCodes && filters.diagnosisCodes.length) {
      metricQuery['populationSegment.diagnosisCodes'] = { $in: filters.diagnosisCodes };
    }
    
    // Apply zip code filter if specified
    if (filters.zipCodes && filters.zipCodes.length) {
      metricQuery['populationSegment.zipCode'] = { $in: filters.zipCodes };
    }
    
    // Get population health metrics
    const metrics = await PopulationHealthMetric.find(metricQuery)
      .sort({ date: -1 });
    
    // Group metrics by type
    const metricsByType = {};
    metrics.forEach(metric => {
      if (!metricsByType[metric.metricType]) {
        metricsByType[metric.metricType] = [];
      }
      
      metricsByType[metric.metricType].push({
        name: metric.metricName,
        value: metric.metricValue,
        unit: metric.unit,
        date: metric.date,
        populationSegment: metric.populationSegment,
        sampleSize: metric.sampleSize,
        confidence: metric.confidence
      });
    });
    
    // Build query for patients to get current population health based on patient data
    const patientQuery = buildPatientQuery(filters);
    
    // Get patients matching query
    const patients = await Patient.find(patientQuery)
      .populate('medicalRecords')
      .populate('appointments');
    
    if (patients.length === 0) {
      return {
        metrics: metricsByType,
        message: 'No patients found matching the criteria for current population health analysis'
      };
    }
    
    // Calculate current disease prevalence
    const diagnosisCounts = {};
    let totalDiagnoses = 0;
    
    patients.forEach(patient => {
      if (patient.medicalRecords) {
        patient.medicalRecords.forEach(record => {
          if (record.diagnosis && record.diagnosis.code) {
            const code = record.diagnosis.code;
            diagnosisCounts[code] = (diagnosisCounts[code] || 0) + 1;
            totalDiagnoses++;
          }
        });
      }
    });
    
    // Sort and limit to top diagnoses
    const topDiagnoses = Object.entries(diagnosisCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({
        code,
        count,
        prevalence: (count / patients.length) * 100
      }));
    
    // Calculate readmission rates
    let readmissionCount = 0;
    let dischargeCount = 0;
    
    patients.forEach(patient => {
      if (patient.hospitalizations) {
        dischargeCount += patient.hospitalizations.length;
        
        // Check for readmissions (hospitalizations within 30 days of a discharge)
        for (let i = 1; i < patient.hospitalizations.length; i++) {
          const prevDischarge = new Date(patient.hospitalizations[i-1].dischargeDate);
          const currAdmission = new Date(patient.hospitalizations[i].admissionDate);
          
          if (dateDiffInDays(prevDischarge, currAdmission) <= 30) {
            readmissionCount++;
          }
        }
      }
    });
    
    const readmissionRate = dischargeCount > 0 
      ? (readmissionCount / dischargeCount) * 100 
      : 0;
    
    // Calculate vaccination rates
    const vaccinationCounts = {
      total: patients.length,
      vaccinated: 0
    };
    
    patients.forEach(patient => {
      if (patient.immunizations && patient.immunizations.length > 0) {
        vaccinationCounts.vaccinated++;
      }
    });
    
    const vaccinationRate = (vaccinationCounts.vaccinated / vaccinationCounts.total) * 100;
    
    // Calculate screening compliance rates
    const screeningCounts = {
      total: patients.length,
      screened: 0
    };
    
    patients.forEach(patient => {
      if (patient.screenings && patient.screenings.length > 0) {
        screeningCounts.screened++;
      }
    });
    
    const screeningRate = (screeningCounts.screened / screeningCounts.total) * 100;
    
    // Calculate chronic condition management metrics
    const chronicConditions = {
      'diabetes': { total: 0, controlled: 0 },
      'hypertension': { total: 0, controlled: 0 },
      'asthma': { total: 0, controlled: 0 },
      'copd': { total: 0, controlled: 0 },
      'heart_disease': { total: 0, controlled: 0 }
    };
    
    // Thresholds for "controlled" conditions (simplified example)
    const controlThresholds = {
      'diabetes': (patient) => {
        if (patient.vitalSigns && patient.vitalSigns.length > 0) {
          const latestVitals = patient.vitalSigns[patient.vitalSigns.length - 1];
          return latestVitals.bloodGlucose && latestVitals.bloodGlucose < 140;
        }
        return false;
      },
      'hypertension': (patient) => {
        if (patient.vitalSigns && patient.vitalSigns.length > 0) {
          const latestVitals = patient.vitalSigns[patient.vitalSigns.length - 1];
          return latestVitals.bloodPressure && 
                 latestVitals.bloodPressure.systolic < 140 && 
                 latestVitals.bloodPressure.diastolic < 90;
        }
        return false;
      },
      'asthma': (patient) => {
        // Simplified check - in reality this would check for recent asthma attacks
        return patient.emergencyVisits && patient.emergencyVisits.length === 0;
      },
      'copd': (patient) => {
        // Simplified check
        return patient.emergencyVisits && patient.emergencyVisits.length === 0;
      },
      'heart_disease': (patient) => {
        if (patient.vitalSigns && patient.vitalSigns.length > 0) {
          const latestVitals = patient.vitalSigns[patient.vitalSigns.length - 1];
          return latestVitals.bloodPressure && 
                 latestVitals.bloodPressure.systolic < 140 && 
                 latestVitals.bloodPressure.diastolic < 90;
        }
        return false;
      }
    };
    
    const chronicConditionCodes = {
      'diabetes': ['E11', 'E10'],
      'hypertension': ['I10', 'I11', 'I12', 'I13'],
      'asthma': ['J45'],
      'copd': ['J44'],
      'heart_disease': ['I20', 'I21', 'I22', 'I23', 'I24', 'I25']
    };
    
    patients.forEach(patient => {
      if (patient.medicalRecords) {
        patient.medicalRecords.forEach(record => {
          if (record.diagnosis && record.diagnosis.code) {
            for (const [condition, codes] of Object.entries(chronicConditionCodes)) {
              if (codes.some(code => record.diagnosis.code.startsWith(code))) {
                chronicConditions[condition].total++;
                
                // Check if condition is controlled based on thresholds
                if (controlThresholds[condition](patient)) {
                  chronicConditions[condition].controlled++;
                }
                
                break;
              }
            }
          }
        });
      }
    });
    
    // Calculate control rates for each chronic condition
    const chronicManagementRates = {};
    Object.entries(chronicConditions).forEach(([condition, data]) => {
      chronicManagementRates[condition] = data.total > 0
        ? (data.controlled / data.total) * 100
        : 0;
    });
    
    // Calculate wellness visit rates
    const wellnessVisitCounts = {
      total: patients.length,
      hadWellnessVisit: 0
    };
    
    patients.forEach(patient => {
      if (patient.appointments) {
        const hadWellnessVisit = patient.appointments.some(appointment => 
          appointment.appointmentType === 'wellness' || 
          appointment.appointmentType === 'physical' || 
          appointment.appointmentType === 'preventive'
        );
        
        if (hadWellnessVisit) {
          wellnessVisitCounts.hadWellnessVisit++;
        }
      }
    });
    
    const wellnessVisitRate = (wellnessVisitCounts.hadWellnessVisit / wellnessVisitCounts.total) * 100;
    
    // Calculate average BMI
    const bmiValues = [];
    patients.forEach(patient => {
      if (patient.vitalSigns && patient.vitalSigns.length > 0) {
        const latestVitals = patient.vitalSigns[patient.vitalSigns.length - 1];
        if (latestVitals.bmi) {
          bmiValues.push(latestVitals.bmi);
        }
      }
    });
    
    const averageBMI = bmiValues.length > 0
      ? bmiValues.reduce((sum, bmi) => sum + bmi, 0) / bmiValues.length
      : 0;
    
    // Calculate Blood Pressure averages
    const bpValues = {
      systolic: [],
      diastolic: []
    };
    
    patients.forEach(patient => {
      if (patient.vitalSigns && patient.vitalSigns.length > 0) {
        const latestVitals = patient.vitalSigns[patient.vitalSigns.length - 1];
        if (latestVitals.bloodPressure && 
            latestVitals.bloodPressure.systolic && 
            latestVitals.bloodPressure.diastolic) {
          bpValues.systolic.push(latestVitals.bloodPressure.systolic);
          bpValues.diastolic.push(latestVitals.bloodPressure.diastolic);
        }
      }
    });
    
    const averageSystolic = bpValues.systolic.length > 0
      ? bpValues.systolic.reduce((sum, val) => sum + val, 0) / bpValues.systolic.length
      : 0;
    
    const averageDiastolic = bpValues.diastolic.length > 0
      ? bpValues.diastolic.reduce((sum, val) => sum + val, 0) / bpValues.diastolic.length
      : 0;
    
    // Return the compiled population health data
    return {
      storedMetrics: metricsByType,
      currentMetrics: {
        diseasePrevalence: {
          topDiagnoses,
          populationSize: patients.length
        },
        readmissionRate: {
          rate: parseFloat(readmissionRate.toFixed(2)),
          readmissions: readmissionCount,
          discharges: dischargeCount
        },
        vaccinationRate: {
          rate: parseFloat(vaccinationRate.toFixed(2)),
          vaccinated: vaccinationCounts.vaccinated,
          total: vaccinationCounts.total
        },
        screeningRate: {
          rate: parseFloat(screeningRate.toFixed(2)),
          screened: screeningCounts.screened,
          total: screeningCounts.total
        },
        chronicConditionManagement: {
          conditions: chronicConditions,
          controlRates: chronicManagementRates
        },
        wellnessVisitRate: {
          rate: parseFloat(wellnessVisitRate.toFixed(2)),
          hadWellnessVisit: wellnessVisitCounts.hadWellnessVisit,
          total: wellnessVisitCounts.total
        },
        averageBMI: parseFloat(averageBMI.toFixed(2)),
        averageBloodPressure: {
          systolic: parseFloat(averageSystolic.toFixed(2)),
          diastolic: parseFloat(averageDiastolic.toFixed(2)),
          samplesCount: bpValues.systolic.length
        }
      }
    };
  } catch (error) {
    logger.error('Failed to generate population health report', { error: error.message });
    throw error;
  }
}

/**
 * Build MongoDB query for patients based on filter criteria
 * @param {Object} filters - Filter criteria
 * @returns {Object} MongoDB query object
 */
function buildPatientQuery(filters = {}) {
  const query = {};
  
  // Handle doctor filter
  if (filters.doctorId) {
    query.primaryCareProvider = filters.doctorId;
  }
  
  // Handle department filter
  if (filters.department) {
    query.department = filters.department;
  }
  
  // Handle gender filter
  if (filters.gender && filters.gender !== 'all') {
    query.gender = filters.gender;
  }
  
  // Handle age group filter
  if (filters.ageGroup) {
    const now = new Date();
    let minAge, maxAge;
    
    switch (filters.ageGroup) {
      case '0-17':
        minAge = 0; maxAge = 17;
        break;
      case '18-34':
        minAge = 18; maxAge = 34;
        break;
      case '35-50':
        minAge = 35; maxAge = 50;
        break;
      case '51-65':
        minAge = 51; maxAge = 65;
        break;
      case '66-80':
        minAge = 66; maxAge = 80;
        break;
      case '80+':
        minAge = 80; maxAge = 150; // Set a high upper limit
        break;
    }
    
    if (minAge !== undefined) {
      const maxBirthDate = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate());
      const minBirthDate = new Date(now.getFullYear() - maxAge - 1, now.getMonth(), now.getDate());
      
      query.dateOfBirth = {
        $lte: maxBirthDate,
        $gte: minBirthDate
      };
    }
  }
  
  // Handle zip code filter
  if (filters.zipCodes && filters.zipCodes.length) {
    query['address.zipCode'] = { $in: filters.zipCodes };
  }
  
  // Handle insurance type filter
  if (filters.insuranceTypes && filters.insuranceTypes.length) {
    query['insurance.type'] = { $in: filters.insuranceTypes };
  }
  
  return query;
}

/**
 * Process data for export, with optional anonymization
 * @param {Object} data - Report data to export
 * @param {boolean} anonymize - Whether to anonymize the data
 * @returns {Object} Processed data for export
 */
function processDataForExport(data, anonymize = true) {
  // Clone the data to avoid modifying the original
  const exportData = JSON.parse(JSON.stringify(data));
  
  if (anonymize) {
    // Remove or hash any personally identifiable information
    anonymizeData(exportData);
  }
  
  return exportData;
}

/**
 * Recursively anonymize data by removing or hashing PII
 * @param {Object|Array} data - Data to anonymize
 */
function anonymizeData(data) {
  if (!data) return;
  
  if (Array.isArray(data)) {
    data.forEach(item => anonymizeData(item));
    return;
  }
  
  if (typeof data === 'object') {
    for (const key in data) {
      // Check if this is a PII field that needs to be anonymized
      if (isPIIField(key)) {
        if (key.includes('Id') || key.includes('Code')) {
          // Hash IDs and codes instead of removing them
          data[key] = hashValue(data[key]);
        } else {
          // Remove other PII
          delete data[key];
        }
      } else if (typeof data[key] === 'object' || Array.isArray(data[key])) {
        // Recursively process nested objects and arrays
        anonymizeData(data[key]);
      }
    }
  }
}

/**
 * Check if a field name indicates personally identifiable information
 * @param {string} fieldName - Field name to check
 * @returns {boolean} Whether the field contains PII
 */
function isPIIField(fieldName) {
  const piiFields = [
    'name', 'firstName', 'lastName', 'email', 'phone', 'address',
    'socialSecurityNumber', 'ssn', 'dateOfBirth', 'birthdate',
    'licenseNumber', 'passport', 'patientName', 'patientId'
  ];
  
  return piiFields.some(piiField => 
    fieldName.toLowerCase().includes(piiField.toLowerCase())
  );
}

/**
 * Create a hash of a value for anonymization
 * @param {string|number} value - Value to hash
 * @returns {string} Hashed value
 */
function hashValue(value) {
  if (value === null || value === undefined) return null;
  
  const valueStr = String(value);
  return crypto.createHash('sha256').update(valueStr).digest('hex').substring(0, 10);
}

/**
 * Extract top findings from analytics data
 * @param {Object} data - Analytics data
 * @returns {Array} Top findings
 */
function extractTopFindings(data) {
  const findings = [];
  
  // Example findings from demographics
  if (data.patientDemographics) {
    // Find top chronic condition
    if (data.patientDemographics.chronicConditionPrevalence) {
      const topCondition = Object.entries(data.patientDemographics.chronicConditionPrevalence)
        .sort((a, b) => b[1] - a[1])[0];
      
      if (topCondition && topCondition[1] > 0) {
        findings.push({
          category: 'demographics',
          finding: `High prevalence of ${topCondition[0]} in the patient population`,
          priority: 'high'
        });
      }
    }
  }
  
  // Example findings from appointment adherence
  if (data.appointmentAdherence && data.appointmentAdherence.overallStatistics) {
    const adherenceRate = data.appointmentAdherence.overallStatistics.adherenceRate;
    
    if (adherenceRate < 70) {
      findings.push({
        category: 'appointment_adherence',
        finding: `Low appointment adherence rate (${adherenceRate.toFixed(1)}%)`,
        priority: 'high'
      });
    } else if (adherenceRate > 90) {
      findings.push({
        category: 'appointment_adherence',
        finding: `Excellent appointment adherence rate (${adherenceRate.toFixed(1)}%)`,
        priority: 'low'
      });
    }
  }
  
  // Example findings from treatment outcomes
  if (data.treatmentOutcomes && data.treatmentOutcomes.overallStatistics) {
    const successRate = data.treatmentOutcomes.overallStatistics.successRate;
    
    if (successRate < 60) {
      findings.push({
        category: 'treatment_outcomes',
        finding: `Low treatment success rate (${successRate.toFixed(1)}%)`,
        priority: 'high'
      });
    } else if (successRate > 85) {
      findings.push({
        category: 'treatment_outcomes',
        finding: `High treatment success rate (${successRate.toFixed(1)}%)`,
        priority: 'low'
      });
    }
  }
  
  // Example findings from population health
  if (data.populationHealthMetrics && data.populationHealthMetrics.currentMetrics) {
    const metrics = data.populationHealthMetrics.currentMetrics;
    
    // Check vaccination rate
    if (metrics.vaccinationRate && metrics.vaccinationRate.rate < 70) {
      findings.push({
        category: 'population_health',
        finding: `Low vaccination rate (${metrics.vaccinationRate.rate.toFixed(1)}%)`,
        priority: 'medium'
      });
    }
    
    // Check readmission rate
    if (metrics.readmissionRate && metrics.readmissionRate.rate > 15) {
      findings.push({
        category: 'population_health',
        finding: `High readmission rate (${metrics.readmissionRate.rate.toFixed(1)}%)`,
        priority: 'high'
      });
    }
  }
  
  return findings;
}

/**
 * Generate recommendations based on analytics data
 * @param {Object} data - Analytics data
 * @returns {Array} Recommendations
 */
function generateRecommendations(data) {
  const recommendations = [];
  
  // Example recommendations from demographics
  if (data.patientDemographics) {
    // Recommendations based on age distribution
    if (data.patientDemographics.ageDistribution) {
      const elderlyCount = data.patientDemographics.ageDistribution['66-80'] + 
                          data.patientDemographics.ageDistribution['80+'];
      const totalPatients = data.patientDemographics.totalPatients;
      
      if (elderlyCount / totalPatients > 0.3) {
        recommendations.push({
          category: 'demographics',
          recommendation: 'Consider expanding geriatric care services for the high elderly population',
          priority: 'medium'
        });
      }
    }
  }
  
  // Example recommendations from appointment adherence
  if (data.appointmentAdherence && data.appointmentAdherence.overallStatistics) {
    const noShows = data.appointmentAdherence.overallStatistics.noShowAppointments;
    const total = data.appointmentAdherence.overallStatistics.totalAppointments;
    
    if (noShows / total > 0.1) {
      recommendations.push({
        category: 'appointment_adherence',
        recommendation: 'Implement appointment reminder system to reduce high no-show rate',
        priority: 'high'
      });
    }
  }
  
  // Example recommendations from treatment outcomes
  if (data.treatmentOutcomes && data.treatmentOutcomes.treatmentEffectiveness) {
    // Find treatments with low success rates
    const lowEffectivenessTreatments = Object.entries(data.treatmentOutcomes.treatmentEffectiveness)
      .filter(([_, data]) => data.successRate < 50 && data.total > 5)
      .map(([code, _]) => code);
    
    if (lowEffectivenessTreatments.length > 0) {
      recommendations.push({
        category: 'treatment_outcomes',
        recommendation: `Review treatment protocols for treatments with low success rates: ${lowEffectivenessTreatments.join(', ')}`,
        priority: 'high'
      });
    }
  }
  
  // Example recommendations from population health
  if (data.populationHealthMetrics && data.populationHealthMetrics.currentMetrics) {
    const metrics = data.populationHealthMetrics.currentMetrics;
    
    // Chronic condition management recommendations
    if (metrics.chronicConditionManagement && metrics.chronicConditionManagement.controlRates) {
      const rates = metrics.chronicConditionManagement.controlRates;
      const lowControlled = Object.entries(rates)
        .filter(([_, rate]) => rate < 60)
        .map(([condition, _]) => condition);
      
      if (lowControlled.length > 0) {
        recommendations.push({
          category: 'population_health',
          recommendation: `Develop improved management programs for poorly controlled conditions: ${lowControlled.join(', ')}`,
          priority: 'high'
        });
      }
    }
  }
  
  return recommendations;
}

/**
 * Identify trends in analytics data
 * @param {Object} data - Analytics data
 * @returns {Array} Identified trends
 */
function identifyTrends(data) {
  const trends = [];
  
  // Example: Identify trends in appointment adherence
  if (data.appointmentAdherence && data.appointmentAdherence.adherenceTrends) {
    const trendData = Object.entries(data.appointmentAdherence.adherenceTrends)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        period: month,
        adherenceRate: data.adherenceRate
      }));
    
    if (trendData.length >= 3) {
      // Simple trend detection
      let increasing = true;
      let decreasing = true;
      
      for (let i = 1; i < trendData.length; i++) {
        if (trendData[i].adherenceRate <= trendData[i-1].adherenceRate) {
          increasing = false;
        }
        if (trendData[i].adherenceRate >= trendData[i-1].adherenceRate) {
          decreasing = false;
        }
      }
      
      if (increasing) {
        trends.push({
          category: 'appointment_adherence',
          trend: 'Increasing appointment adherence rates over time',
          direction: 'positive'
        });
      } else if (decreasing) {
        trends.push({
          category: 'appointment_adherence',
          trend: 'Decreasing appointment adherence rates over time',
          direction: 'negative'
        });
      }
    }
  }
  
  // Example: Identify trends in health metrics
  if (data.patientDemographics && data.populationHealthMetrics) {
    // Compare disease prevalence to national/regional averages
    // This is simplified - in reality you would compare to actual benchmarks
    const diabetesPrevalence = data.patientDemographics.chronicConditionPrevalence?.diabetes || 0;
    const totalPatients = data.patientDemographics.totalPatients || 1;
    const diabetesRate = (diabetesPrevalence / totalPatients) * 100;
    
    // National average diabetes rate (hypothetical)
    const nationalDiabetesRate = 10.5; 
    
    if (diabetesRate > nationalDiabetesRate * 1.2) {
      trends.push({
        category: 'population_health',
        trend: `Diabetes prevalence (${diabetesRate.toFixed(1)}%) is significantly higher than national average (${nationalDiabetesRate}%)`,
        direction: 'negative'
      });
    }
  }
  
  return trends;
}

/**
 * Identify risk factors in analytics data
 * @param {Object} data - Analytics data
 * @returns {Array} Identified risk factors
 */
function identifyRiskFactors(data) {
  const riskFactors = [];
  
  // Example: Risk factors based on demographics and treatment outcomes
  if (data.patientDemographics && data.treatmentOutcomes) {
    // Look for conditions with high prevalence and low treatment success
    const highPrevalenceConditions = data.patientDemographics.commonDiagnoses
      ?.slice(0, 3)
      .map(d => d.code) || [];
    
    const lowSuccessRateDiagnoses = data.treatmentOutcomes.diagnosisOutcomes
      ? Object.entries(data.treatmentOutcomes.diagnosisOutcomes)
          .filter(([_, data]) => data.successRate < 60 && data.total > 5)
          .map(([code, _]) => code)
      : [];
    
    // Find intersection of high prevalence and low success
    const highRiskConditions = highPrevalenceConditions.filter(
      code => lowSuccessRateDiagnoses.includes(code)
    );
    
    if (highRiskConditions.length > 0) {
      riskFactors.push({
        category: 'clinical',
        factor: `High prevalence conditions with low treatment success: ${highRiskConditions.join(', ')}`,
        severity: 'high'
      });
    }
  }
  
  // Example: Risk factors based on appointment adherence
  if (data.appointmentAdherence) {
    const appointmentTypes = data.appointmentAdherence.adherenceByType || {};
    
    // Find appointment types with low adherence
    const lowAdherenceTypes = Object.entries(appointmentTypes)
      .filter(([_, data]) => data.adherenceRate < 60 && data.total > 5)
      .map(([type, _]) => type);
    
    if (lowAdherenceTypes.length > 0) {
      riskFactors.push({
        category: 'operational',
        factor: `Low adherence for appointment types: ${lowAdherenceTypes.join(', ')}`,
        severity: 'medium'
      });
    }
  }
  
  // Example: Risk factors based on population health
  if (data.populationHealthMetrics && data.populationHealthMetrics.currentMetrics) {
    const metrics = data.populationHealthMetrics.currentMetrics;
    
    // Check screening rates
    if (metrics.screeningRate && metrics.screeningRate.rate < 50) {
      riskFactors.push({
        category: 'preventive',
        factor: `Very low screening rate (${metrics.screeningRate.rate.toFixed(1)}%)`,
        severity: 'high'
      });
    }
    
    // Check hypertension control
    if (metrics.chronicConditionManagement?.controlRates?.hypertension < 50) {
      riskFactors.push({
        category: 'clinical',
        factor: 'Poor hypertension control rates increase risk of cardiovascular events',
        severity: 'high'
      });
    }
  }
  
  return riskFactors;
}

module.exports = analyticsService;
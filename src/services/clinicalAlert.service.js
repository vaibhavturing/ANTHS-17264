const ClinicalAlert = require('../models/clinicalAlert.model');
const UserAlertPreference = require('../models/userAlertPreference.model');
const Patient = require('../models/patient.model');
const Medication = require('../models/medication.model');
const LabResult = require('../models/labResult.model');
const Diagnosis = require('../models/diagnosis.model');
const logger = require('../utils/logger');
const ApiError = require('../utils/api-error');

class ClinicalAlertService {
  /**
   * Get relevant alerts for a patient during an encounter
   * @param {String} patientId - Patient ID
   * @param {String} userId - User ID (doctor)
   * @param {Object} context - Additional context (medications, diagnoses, etc.)
   * @returns {Promise<Array>} Array of applicable alerts
   */
  async getPatientAlerts(patientId, userId, context = {}) {
    try {
      // Get patient data
      const patient = await Patient.findById(patientId);
      if (!patient) {
        throw new ApiError(404, 'Patient not found');
      }
      
      // Prepare context for alert evaluation
      const alertContext = await this.buildAlertContext(patient, context);
      
      // Get all active alerts
      const activeAlerts = await ClinicalAlert.find({ isActive: true });
      
      // Filter alerts by user preferences
      const userPreferences = await this.getUserAlertPreferences(userId);
      
      // If global alerts are disabled and user is a doctor, only return critical alerts
      if (
        userPreferences && 
        userPreferences.globalAlertStatus === 'disabled'
      ) {
        return [];
      }
      
      if (
        userPreferences && 
        userPreferences.globalAlertStatus === 'critical-only'
      ) {
        activeAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
      }
      
      // Apply alert evaluation to find applicable alerts
      const applicableAlerts = await this.evaluateAlerts(activeAlerts, alertContext, userPreferences);
      
      // Format and return alerts
      return this.formatAlerts(applicableAlerts, userPreferences);
    } catch (error) {
      logger.error('Error getting patient alerts:', error);
      throw error;
    }
  }

  /**
   * Build context object for alert evaluation
   * @param {Object} patient - Patient document
   * @param {Object} context - Additional context provided by caller
   * @returns {Promise<Object>} Alert context object
   */
  async buildAlertContext(patient, context) {
    const alertContext = {
      patient: {
        id: patient._id,
        age: this.calculateAge(patient.dateOfBirth),
        gender: patient.gender,
        demographics: patient.demographics || {}
      },
      currentDate: new Date()
    };
    
    // Add diagnoses if not provided
    if (!context.diagnoses) {
      alertContext.diagnoses = await Diagnosis.find({ 
        patient: patient._id,
        isActive: true
      });
    } else {
      alertContext.diagnoses = context.diagnoses;
    }
    
    // Add medications if not provided
    if (!context.medications) {
      // Get active medications for this patient
      alertContext.medications = await Medication.find({
        _id: { $in: patient.activeMedications || [] }
      });
    } else {
      alertContext.medications = context.medications;
    }
    
    // Add lab results if not provided
    if (!context.labResults) {
      // Get recent lab results (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      alertContext.labResults = await LabResult.find({
        patient: patient._id,
        resultDate: { $gte: thirtyDaysAgo }
      });
    } else {
      alertContext.labResults = context.labResults;
    }
    
    // Add additional context
    Object.assign(alertContext, context);
    
    return alertContext;
  }

  /**
   * Calculate age from date of birth
   * @param {Date} dateOfBirth - Date of birth
   * @returns {Number} Age in years
   */
  calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Get user alert preferences
   * @param {String} userId - User ID
   * @returns {Promise<Object>} User alert preferences
   */
  async getUserAlertPreferences(userId) {
    try {
      let preferences = await UserAlertPreference.findOne({ user: userId });
      
      if (!preferences) {
        // Create default preferences if none exist
        preferences = await this.createDefaultPreferences(userId);
      }
      
      return preferences;
    } catch (error) {
      logger.error('Error getting user alert preferences:', error);
      return null; // Return null so alerts still work even if preferences fail
    }
  }

  /**
   * Create default preferences for a user
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Created preferences
   */
  async createDefaultPreferences(userId) {
    try {
      // Create default preferences with all alerts enabled
      const defaultPreferences = new UserAlertPreference({
        user: userId,
        globalAlertStatus: 'enabled',
        categoryPreferences: [
          { category: 'drug-interaction', status: 'enabled' },
          { category: 'preventive-care', status: 'enabled' },
          { category: 'diagnosis-alert', status: 'enabled' },
          { category: 'lab-alert', status: 'enabled' },
          { category: 'best-practice', status: 'enabled' },
          { category: 'administrative', status: 'enabled' }
        ],
        alertPreferences: []
      });
      
      await defaultPreferences.save();
      return defaultPreferences;
    } catch (error) {
      logger.error('Error creating default preferences:', error);
      throw error;
    }
  }

  /**
   * Evaluate alerts against context to find applicable ones
   * @param {Array} alerts - All active alerts
   * @param {Object} context - Alert evaluation context
   * @param {Object} preferences - User alert preferences
   * @returns {Promise<Array>} Applicable alerts
   */
  async evaluateAlerts(alerts, context, preferences) {
    if (!alerts || !alerts.length) return [];
    
    const applicableAlerts = [];
    
    for (const alert of alerts) {
      // Skip alert if user has disabled it
      if (this.isAlertDisabled(alert, preferences)) {
        continue;
      }
      
      // Check if alert applies to this context
      if (await this.evaluateAlert(alert, context)) {
        applicableAlerts.push(alert);
      }
    }
    
    return applicableAlerts;
  }

  /**
   * Check if an alert is disabled for a user
   * @param {Object} alert - Alert to check
   * @param {Object} preferences - User preferences
   * @returns {Boolean} True if alert is disabled
   */
  isAlertDisabled(alert, preferences) {
    if (!preferences) return false;
    
    // Check individual alert preference
    const alertPref = preferences.alertPreferences.find(
      p => p.alert.toString() === alert._id.toString()
    );
    
    if (alertPref && alertPref.status === 'disabled') {
      return true;
    }
    
    if (alertPref && alertPref.status === 'muted') {
      // Check if mute period has expired
      if (alertPref.muteUntil && alertPref.muteUntil > new Date()) {
        return true;
      }
    }
    
    // Check category preference
    const categoryPref = preferences.categoryPreferences.find(
      p => p.category === alert.category
    );
    
    if (categoryPref && categoryPref.status === 'disabled') {
      return true;
    }
    
    if (categoryPref && categoryPref.status === 'muted') {
      // For categories, muted is essentially disabled as there's no time limit
      return true;
    }
    
    // System-defined critical alerts can't be disabled
    if (alert.isSystemDefined && alert.severity === 'critical') {
      return false;
    }
    
    return false;
  }

  /**
   * Evaluate a single alert against the context
   * @param {Object} alert - Alert to evaluate
   * @param {Object} context - Evaluation context
   * @returns {Promise<Boolean>} True if alert applies
   */
  async evaluateAlert(alert, context) {
    // If there are no trigger conditions, the alert doesn't apply
    if (!alert.triggerConditions || !alert.triggerConditions.length) {
      return false;
    }
    
    // An alert applies if ANY of its trigger conditions are met
    for (const condition of alert.triggerConditions) {
      if (await this.evaluateTriggerCondition(condition, context)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Evaluate a single trigger condition
   * @param {Object} condition - Trigger condition
   * @param {Object} context - Evaluation context
   * @returns {Promise<Boolean>} True if condition is met
   */
  async evaluateTriggerCondition(condition, context) {
    switch (condition.type) {
      case 'diagnosis':
        return this.evaluateDiagnosisCondition(condition, context);
      
      case 'medication':
        return this.evaluateMedicationCondition(condition, context);
      
      case 'lab-result':
        return this.evaluateLabResultCondition(condition, context);
      
      case 'patient-demographic':
        return this.evaluateDemographicCondition(condition, context);
      
      case 'seasonal':
        return this.evaluateSeasonalCondition(condition, context);
      
      case 'appointment-type':
        return this.evaluateAppointmentTypeCondition(condition, context);
      
      case 'custom':
        return this.evaluateCustomCondition(condition, context);
      
      default:
        return false;
    }
  }

  /**
   * Evaluate a diagnosis-based condition
   * @param {Object} condition - Trigger condition
   * @param {Object} context - Evaluation context
   * @returns {Boolean} True if condition is met
   */
  evaluateDiagnosisCondition(condition, context) {
    if (!context.diagnoses || !context.diagnoses.length) {
      return false;
    }
    
    // Check if any patient diagnosis matches the codes in the condition
    return context.diagnoses.some(diagnosis => {
      return condition.codes.includes(diagnosis.code);
    });
  }

  /**
   * Evaluate a medication-based condition
   * @param {Object} condition - Trigger condition
   * @param {Object} context - Evaluation context
   * @returns {Boolean} True if condition is met
   */
  evaluateMedicationCondition(condition, context) {
    if (!context.medications || !context.medications.length) {
      return false;
    }
    
    // Check if any patient medication matches the codes in the condition
    return context.medications.some(medication => {
      // Match by ID
      if (condition.codes.includes(medication._id.toString())) {
        return true;
      }
      
      // Match by generic name
      if (condition.codes.includes(medication.genericName)) {
        return true;
      }
      
      // Match by classification
      if (condition.codes.includes(medication.classification)) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * Evaluate a lab result condition
   * @param {Object} condition - Trigger condition
   * @param {Object} context - Evaluation context
   * @returns {Boolean} True if condition is met
   */
  evaluateLabResultCondition(condition, context) {
    if (!context.labResults || !context.labResults.length) {
      return false;
    }
    
    // Check if any lab result matches the condition
    return context.labResults.some(result => {
      // Match by test code
      if (!condition.codes.includes(result.testCode)) {
        return false;
      }
      
      // If there's a value range, check if result is in range
      if (condition.valueRange) {
        const value = parseFloat(result.value);
        
        // Skip if value is not a number
        if (isNaN(value)) {
          return false;
        }
        
        const min = condition.valueRange.min;
        const max = condition.valueRange.max;
        
        // Check min if specified
        if (min !== undefined && min !== null && value < min) {
          return false;
        }
        
        // Check max if specified
        if (max !== undefined && max !== null && value > max) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Evaluate a demographic-based condition
   * @param {Object} condition - Trigger condition
   * @param {Object} context - Evaluation context
   * @returns {Boolean} True if condition is met
   */
  evaluateDemographicCondition(condition, context) {
    const patient = context.patient;
    
    if (!patient) {
      return false;
    }
    
    // Check demographic criteria
    for (const code of condition.codes) {
      // Age range checks
      if (code.startsWith('age>')) {
        const minAge = parseInt(code.substring(4));
        if (patient.age > minAge) {
          return true;
        }
      }
      else if (code.startsWith('age<')) {
        const maxAge = parseInt(code.substring(4));
        if (patient.age < maxAge) {
          return true;
        }
      }
      else if (code.startsWith('age=')) {
        const exactAge = parseInt(code.substring(4));
        if (patient.age === exactAge) {
          return true;
        }
      }
      // Gender checks
      else if (code === `gender=${patient.gender}`) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Evaluate a seasonal condition
   * @param {Object} condition - Trigger condition
   * @param {Object} context - Evaluation context
   * @returns {Boolean} True if condition is met
   */
  evaluateSeasonalCondition(condition, context) {
    const currentDate = context.currentDate || new Date();
    const month = currentDate.getMonth() + 1; // 1-12
    
    // Check if current month is in the condition codes
    for (const code of condition.codes) {
      if (code.startsWith('month=')) {
        const monthList = code.substring(6).split(',');
        for (const monthStr of monthList) {
          if (parseInt(monthStr) === month) {
            return true;
          }
        }
      }
      
      // Check for season codes
      if (code === 'season=winter' && [12, 1, 2].includes(month)) {
        return true;
      }
      if (code === 'season=spring' && [3, 4, 5].includes(month)) {
        return true;
      }
      if (code === 'season=summer' && [6, 7, 8].includes(month)) {
        return true;
      }
      if (code === 'season=fall' && [9, 10, 11].includes(month)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Evaluate an appointment type condition
   * @param {Object} condition - Trigger condition
   * @param {Object} context - Evaluation context
   * @returns {Boolean} True if condition is met
   */
  evaluateAppointmentTypeCondition(condition, context) {
    if (!context.appointment) {
      return false;
    }
    
    return condition.codes.includes(context.appointment.type);
  }

  /**
   * Evaluate a custom condition
   * @param {Object} condition - Trigger condition
   * @param {Object} context - Evaluation context
   * @returns {Boolean} True if condition is met
   */
  evaluateCustomCondition(condition, context) {
    // Custom conditions can have specific logic
    // Here we just check for exact matches in the codes
    
    // Example: if code is 'diabetes+hypertension'
    // Check if patient has both diabetes and hypertension diagnoses
    
    // For this example, we'll just return false
    // In a real implementation, this would have custom logic
    return false;
  }

  /**
   * Format alerts with user preferences
   * @param {Array} alerts - Applicable alerts
   * @param {Object} preferences - User preferences
   * @returns {Array} Formatted alerts
   */
  formatAlerts(alerts, preferences) {
    if (!alerts || !alerts.length) return [];
    
    return alerts.map(alert => {
      const formatted = {
        id: alert._id,
        title: alert.title,
        description: alert.description,
        severity: alert.severity,
        category: alert.category,
        source: alert.source,
        autoDismiss: alert.autoDismiss,
        dismissTimeout: alert.dismissTimeout,
        recommendedAction: alert.recommendedAction
      };
      
      // Apply user customizations if any
      if (preferences) {
        const alertPref = preferences.alertPreferences.find(
          p => p.alert.toString() === alert._id.toString()
        );
        
        if (alertPref) {
          // Override severity if customized
          if (alertPref.customSeverity) {
            formatted.severity = alertPref.customSeverity;
          }
          
          // Override text if customized
          if (alertPref.customText) {
            if (alertPref.customText.title) {
              formatted.title = alertPref.customText.title;
            }
            
            if (alertPref.customText.description) {
              formatted.description = alertPref.customText.description;
            }
          }
        }
      }
      
      return formatted;
    });
  }

  /**
   * Update user alert preferences
   * @param {String} userId - User ID
   * @param {Object} updates - Preference updates
   * @returns {Promise<Object>} Updated preferences
   */
  async updateUserPreferences(userId, updates) {
    try {
      let preferences = await UserAlertPreference.findOne({ user: userId });
      
      if (!preferences) {
        preferences = await this.createDefaultPreferences(userId);
      }
      
      // Update global settings if provided
      if (updates.globalAlertStatus) {
        preferences.globalAlertStatus = updates.globalAlertStatus;
      }
      
      // Update category preferences if provided
      if (updates.categoryPreferences && updates.categoryPreferences.length) {
        for (const categoryUpdate of updates.categoryPreferences) {
          const existingIndex = preferences.categoryPreferences.findIndex(
            p => p.category === categoryUpdate.category
          );
          
          if (existingIndex >= 0) {
            // Update existing preference
            preferences.categoryPreferences[existingIndex].status = categoryUpdate.status;
            if (categoryUpdate.reasonForMuting) {
              preferences.categoryPreferences[existingIndex].reasonForMuting = categoryUpdate.reasonForMuting;
            }
          } else {
            // Add new preference
            preferences.categoryPreferences.push(categoryUpdate);
          }
        }
      }
      
      // Update individual alert preferences if provided
      if (updates.alertPreferences && updates.alertPreferences.length) {
        for (const alertUpdate of updates.alertPreferences) {
          const existingIndex = preferences.alertPreferences.findIndex(
            p => p.alert.toString() === alertUpdate.alert.toString()
          );
          
          if (existingIndex >= 0) {
            // Update existing preference
            Object.assign(preferences.alertPreferences[existingIndex], alertUpdate);
          } else {
            // Add new preference
            preferences.alertPreferences.push(alertUpdate);
          }
        }
      }
      
      await preferences.save();
      return preferences;
    } catch (error) {
      logger.error('Error updating user preferences:', error);
      throw error;
    }
  }

  /**
   * Get clinical alerts (for admin management)
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Alerts with pagination
   */
  async getAlerts(options = {}) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        category, 
        severity,
        isActive,
        search
      } = options;
      
      const skip = (page - 1) * limit;
      
      // Build query
      const query = {};
      
      if (category) {
        query.category = category;
      }
      
      if (severity) {
        query.severity = severity;
      }
      
      if (isActive !== undefined) {
        query.isActive = isActive;
      }
      
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Execute query with pagination
      const [alerts, total] = await Promise.all([
        ClinicalAlert.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        ClinicalAlert.countDocuments(query)
      ]);
      
      return {
        alerts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting alerts:', error);
      throw error;
    }
  }

  /**
   * Create a new clinical alert
   * @param {Object} alertData - Alert data
   * @returns {Promise<Object>} Created alert
   */
  async createAlert(alertData) {
    try {
      const alert = new ClinicalAlert(alertData);
      await alert.save();
      return alert;
    } catch (error) {
      logger.error('Error creating alert:', error);
      throw error;
    }
  }

  /**
   * Update a clinical alert
   * @param {String} alertId - Alert ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated alert
   */
  async updateAlert(alertId, updateData) {
    try {
      const alert = await ClinicalAlert.findById(alertId);
      
      if (!alert) {
        throw new ApiError(404, 'Alert not found');
      }
      
      // Prevent updating system-defined properties for system alerts
      if (alert.isSystemDefined) {
        delete updateData.isSystemDefined;
        delete updateData.category; // Don't allow category changes for system alerts
      }
      
      Object.assign(alert, updateData);
      await alert.save();
      
      return alert;
    } catch (error) {
      logger.error('Error updating alert:', error);
      throw error;
    }
  }

  /**
   * Delete a clinical alert
   * @param {String} alertId - Alert ID
   * @returns {Promise<Boolean>} Success status
   */
  async deleteAlert(alertId) {
    try {
      const alert = await ClinicalAlert.findById(alertId);
      
      if (!alert) {
        throw new ApiError(404, 'Alert not found');
      }
      
      // Prevent deleting system-defined alerts
      if (alert.isSystemDefined) {
        throw new ApiError(403, 'Cannot delete system-defined alerts');
      }
      
      await ClinicalAlert.deleteOne({ _id: alertId });
      
      // Also delete all user preferences for this alert
      await UserAlertPreference.updateMany(
        { 'alertPreferences.alert': alertId },
        { $pull: { alertPreferences: { alert: alertId } } }
      );
      
      return true;
    } catch (error) {
      logger.error('Error deleting alert:', error);
      throw error;
    }
  }
  
  /**
   * Seed the database with sample clinical alerts
   * @returns {Promise<Number>} Number of alerts created
   */
  async seedSampleAlerts() {
    try {
      const sampleAlerts = [
        // Preventive care alert for flu vaccine for diabetics
        {
          title: "Recommend flu vaccine for diabetic patients",
          description: "Annual influenza vaccination is recommended for all patients with diabetes to reduce risk of complications from influenza.",
          category: "preventive-care",
          severity: "warning",
          triggerConditions: [
            {
              type: "diagnosis",
              codes: ["E11", "E10", "250"] // Diabetes ICD-10 codes
            },
            {
              type: "seasonal",
              codes: ["season=fall"] // Fall season
            }
          ],
          source: {
            name: "American Diabetes Association",
            url: "https://www.diabetes.org/",
            lastUpdated: new Date("2023-01-15")
          },
          evidenceLevel: "I",
          recommendedAction: {
            text: "Administer seasonal influenza vaccine",
            actionType: "vaccination"
          },
          isSystemDefined: true,
          isActive: true
        },
        // Drug interaction alert
        {
          title: "Potential drug interaction detected",
          description: "Concurrent use of warfarin and NSAIDs may increase risk of bleeding.",
          category: "drug-interaction",
          severity: "critical",
          triggerConditions: [
            {
              type: "medication",
              codes: ["warfarin"] // Medication generic name
            },
            {
              type: "medication",
              codes: ["ibuprofen", "naproxen", "diclofenac", "celecoxib"] // NSAIDs
            }
          ],
          source: {
            name: "FDA Drug Interactions",
            url: "https://www.fda.gov/",
            lastUpdated: new Date("2023-02-10")
          },
          evidenceLevel: "II",
          recommendedAction: {
            text: "Consider alternative pain management or adjust dosing with increased monitoring for bleeding.",
            actionType: "other"
          },
          isSystemDefined: true,
          isActive: true
        },
        // Best practice alert
        {
          title: "HbA1c test recommended",
          description: "Hemoglobin A1c testing is recommended every 3-6 months for patients with diabetes.",
          category: "best-practice",
          severity: "info",
          triggerConditions: [
            {
              type: "diagnosis",
              codes: ["E11", "E10"] // Diabetes
            }
          ],
          source: {
            name: "American Diabetes Association",
            url: "https://www.diabetes.org/",
            lastUpdated: new Date("2023-03-22")
          },
          evidenceLevel: "I",
          recommendedAction: {
            text: "Order HbA1c test if not done in the past 3 months",
            actionType: "order-test"
          },
          isSystemDefined: true,
          isActive: true
        },
        // Lab alert
        {
          title: "Elevated potassium level",
          description: "Patient has hyperkalemia. Consider immediate intervention.",
          category: "lab-alert",
          severity: "critical",
          triggerConditions: [
            {
              type: "lab-result",
              codes: ["K+", "potassium"],
              valueRange: {
                min: 5.5,
                unit: "mmol/L"
              }
            }
          ],
          source: {
            name: "Clinical Guidelines",
            url: "https://www.clinicalguidelines.gov/",
            lastUpdated: new Date("2023-01-05")
          },
          evidenceLevel: "I",
          recommendedAction: {
            text: "Assess patient immediately and consider treatment to lower potassium levels",
            actionType: "other"
          },
          isSystemDefined: true,
          isActive: true
        },
        // Demographic-based alert
        {
          title: "Colonoscopy screening recommendation",
          description: "Colonoscopy screening is recommended for adults aged 45-75 years.",
          category: "preventive-care",
          severity: "info",
          triggerConditions: [
            {
              type: "patient-demographic",
              codes: ["age>45", "age<76"]
            }
          ],
          source: {
            name: "US Preventive Services Task Force",
            url: "https://www.uspreventiveservicestaskforce.org/",
            lastUpdated: new Date("2023-05-18")
          },
          evidenceLevel: "I",
          recommendedAction: {
            text: "Discuss colonoscopy screening options if not done in the past 10 years",
            actionType: "order-test"
          },
          isSystemDefined: true,
          isActive: true
        }
      ];
      
      // Check if alerts already exist to avoid duplication
      const existingCount = await ClinicalAlert.countDocuments({ isSystemDefined: true });
      
      if (existingCount > 0) {
        return 0; // Skip if sample alerts are already seeded
      }
      
      // Insert sample alerts
      await ClinicalAlert.insertMany(sampleAlerts);
      
      return sampleAlerts.length;
    } catch (error) {
      logger.error('Error seeding sample alerts:', error);
      throw error;
    }
  }
}

module.exports = new ClinicalAlertService();
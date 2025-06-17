const axios = require('axios');
const config = require('../config/config');
const LabResult = require('../models/labResult.model');
const Patient = require('../models/patient.model');
const logger = require('../utils/logger');
const { NotFoundError, IntegrationError, ValidationError } = require('../utils/errors');

/**
 * Service for integrating with external lab systems and processing lab results
 */
const labIntegrationService = {
  /**
   * Configure lab system connections
   * @type {Object}
   */
  labConnections: {
    // Example lab system configurations
    labCorp: {
      baseUrl: config.LAB_CORP_API_URL || 'https://api.labcorp.example.com/v1',
      apiKey: config.LAB_CORP_API_KEY,
      username: config.LAB_CORP_USERNAME,
      password: config.LAB_CORP_PASSWORD,
      enabled: config.LAB_CORP_ENABLED === 'true',
      format: 'hl7'
    },
    questDiagnostics: {
      baseUrl: config.QUEST_API_URL || 'https://api.questdiagnostics.example.com/v1',
      apiKey: config.QUEST_API_KEY,
      clientId: config.QUEST_CLIENT_ID,
      clientSecret: config.QUEST_CLIENT_SECRET,
      enabled: config.QUEST_ENABLED === 'true',
      format: 'fhir'
    }
    // Additional lab systems can be added here
  },

  /**
   * Get list of configured lab systems
   * @returns {Array} List of available lab connections
   */
  getAvailableLabs: () => {
    return Object.entries(labIntegrationService.labConnections)
      .filter(([_, config]) => config.enabled)
      .map(([name, config]) => ({
        name,
        baseUrl: config.baseUrl,
        format: config.format
      }));
  },

  /**
   * Authenticate with lab system API
   * @param {string} labName - Name of the lab system
   * @returns {Promise<Object>} Authentication tokens or credentials
   */
  authenticateWithLabSystem: async (labName) => {
    try {
      const labConfig = labIntegrationService.labConnections[labName];
      
      if (!labConfig || !labConfig.enabled) {
        throw new NotFoundError(`Lab system ${labName} not found or not enabled`);
      }

      // Different labs have different authentication methods
      if (labName === 'labCorp') {
        const response = await axios.post(`${labConfig.baseUrl}/auth`, {
          username: labConfig.username,
          password: labConfig.password
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': labConfig.apiKey
          }
        });
        
        return {
          accessToken: response.data.accessToken,
          expiresIn: response.data.expiresIn
        };
      } 
      else if (labName === 'questDiagnostics') {
        const response = await axios.post(`${labConfig.baseUrl}/oauth2/token`, {
          grant_type: 'client_credentials',
          client_id: labConfig.clientId,
          client_secret: labConfig.clientSecret
        }, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        return {
          accessToken: response.data.access_token,
          expiresIn: response.data.expires_in,
          tokenType: response.data.token_type
        };
      }
      
      throw new IntegrationError(`Authentication method not implemented for ${labName}`);
    } catch (error) {
      logger.error(`Failed to authenticate with lab system: ${labName}`, {
        error: error.message,
        stack: error.stack
      });
      throw new IntegrationError(`Authentication failed for lab system: ${labName}`);
    }
  },

  /**
   * Fetch pending lab results for a patient
   * @param {string} patientId - MongoDB ID of the patient
   * @param {string} labName - Name of the lab system
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} List of lab results
   */
  fetchPendingLabResults: async (patientId, labName, options = {}) => {
    try {
      // Verify patient exists
      const patient = await Patient.findById(patientId);
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      // Get external patient identifier for the lab system
      const externalId = patient.externalIds?.find(id => id.system === labName)?.value;
      if (!externalId && !options.allowFuzzyMatch) {
        throw new ValidationError(`Patient has no external ID for ${labName}`);
      }

      // Authenticate with lab system
      const auth = await labIntegrationService.authenticateWithLabSystem(labName);
      
      // Fetch results based on lab system
      let results = [];
      const labConfig = labIntegrationService.labConnections[labName];

      if (labName === 'labCorp') {
        // For LabCorp integration
        const response = await axios.get(`${labConfig.baseUrl}/patients/${externalId}/results`, {
          headers: {
            'Authorization': `Bearer ${auth.accessToken}`,
            'X-API-Key': labConfig.apiKey
          },
          params: {
            status: 'final',
            fromDate: options.fromDate || undefined,
            toDate: options.toDate || undefined
          }
        });
        results = response.data.results;
      } 
      else if (labName === 'questDiagnostics') {
        // For Quest Diagnostics integration
        const patientParams = externalId ? 
          `patient=${externalId}` : 
          `family=${patient.lastName}&given=${patient.firstName}&birthdate=${patient.dateOfBirth}`;
          
        const response = await axios.get(
          `${labConfig.baseUrl}/Observation?${patientParams}&status=final`,
          {
            headers: {
              'Authorization': `${auth.tokenType} ${auth.accessToken}`,
              'Accept': 'application/fhir+json'
            }
          }
        );
        results = response.data.entry || [];
      }

      return results;
    } catch (error) {
      logger.error(`Failed to fetch lab results from ${labName}`, {
        error: error.message,
        patientId
      });
      throw error;
    }
  },

  /**
   * Process and import lab results
   * @param {Array} rawLabData - Raw lab data from external system
   * @param {string} patientId - MongoDB ID of the patient
   * @param {string} orderedById - MongoDB ID of the doctor who ordered the test
   * @param {string} source - Source of the data (lab system name)
   * @param {string} format - Format of the data (hl7, fhir, etc.)
   * @returns {Promise<Array>} Processed and saved lab results
   */
  processAndImportLabResults: async (rawLabData, patientId, orderedById, source, format) => {
    try {
      // Check if patient exists
      const patientExists = await Patient.exists({ _id: patientId });
      if (!patientExists) {
        throw new NotFoundError('Patient not found');
      }

      // Parse and transform the lab data based on its format
      const transformedResults = await labIntegrationService.transformLabData(
        rawLabData, format, source
      );

      // Check for existing lab results to avoid duplicates
      const savedResults = [];
      const processingErrors = [];

      for (const result of transformedResults) {
        try {
          const existingResult = await LabResult.findOne({
            patient: patientId,
            externalReferenceId: result.externalReferenceId,
            labId: result.labId
          });

          if (existingResult) {
            logger.info('Skipping duplicate lab result', {
              patientId,
              externalReferenceId: result.externalReferenceId
            });
            continue;
          }

          // Set patient and ordering provider IDs
          result.patient = patientId;
          result.orderedBy = orderedById;
          result.integrationSource = format === 'manual' ? 'manual' : 'api';
          
          // Save raw data for debugging/auditing
          result.rawData = typeof rawLabData === 'string' ? 
            rawLabData : JSON.stringify(rawLabData);

          // Process trend analysis
          await labIntegrationService.performTrendAnalysis(result);

          // Process abnormal flags 
          await labIntegrationService.evaluateAbnormalValues(result);

          // Create and save the lab result
          const labResult = new LabResult(result);
          await labResult.save();

          savedResults.push(labResult);
          
          logger.info('Successfully imported lab result', {
            patientId,
            resultId: labResult._id,
            source,
            externalReferenceId: result.externalReferenceId
          });
        } catch (error) {
          logger.error('Failed to process individual lab result', {
            error: error.message,
            result: result.externalReferenceId
          });
          
          processingErrors.push({
            externalReferenceId: result.externalReferenceId,
            error: error.message
          });
        }
      }

      return {
        saved: savedResults,
        errors: processingErrors,
        total: transformedResults.length,
        processed: savedResults.length
      };
    } catch (error) {
      logger.error('Failed to process and import lab results', {
        error: error.message,
        patientId,
        source
      });
      throw error;
    }
  },

  /**
   * Transform lab data from external format to our data model
   * @param {Object|string} rawData - Raw lab data
   * @param {string} format - Format of the data
   * @param {string} source - Source of the data
   * @returns {Promise<Array>} Transformed lab results
   */
  transformLabData: async (rawData, format, source) => {
    // This would be a complex function handling different formats
    // Here's a simplified version
    try {
      if (format === 'hl7') {
        // In a real implementation, use a proper HL7 parser
        // This is just a placeholder example
        return labIntegrationService.parseHL7Data(rawData, source);
      } 
      else if (format === 'fhir') {
        return labIntegrationService.parseFHIRData(rawData, source);
      }
      else if (format === 'manual') {
        // For manual entry, data is already in our format
        return Array.isArray(rawData) ? rawData : [rawData];
      }
      else {
        throw new ValidationError(`Unsupported lab data format: ${format}`);
      }
    } catch (error) {
      logger.error('Error transforming lab data', {
        error: error.message,
        format,
        source
      });
      throw error;
    }
  },

  /**
   * Parse HL7 format data
   * @param {string} hl7Data - HL7 formatted data
   * @param {string} source - Source of the data
   * @returns {Array} Parsed lab results
   */
  parseHL7Data: (hl7Data, source) => {
    // In a real implementation, use a proper HL7 parser library
    // This is a simplified example
    try {
      // Example HL7 parsing logic (simplified)
      const results = [];
      
      // Mock implementation - in production use a proper HL7 parser
      const segments = hl7Data.split('\n');
      let currentResult = null;
      
      for (const segment of segments) {
        const segmentType = segment.substring(0, 3);
        
        if (segmentType === 'MSH') {
          // Message header - extract lab facility info
          const parts = segment.split('|');
          const labFacilityName = parts[4] || 'Unknown Lab';
          
          currentResult = {
            labFacilityName,
            labId: source,
            results: [],
            integrationSource: 'hl7'
          };
        }
        else if (segmentType === 'PID' && currentResult) {
          // Patient info - we already have patient ID from our system
          // Just for reference, could extract external patient ID here
        }
        else if (segmentType === 'OBR' && currentResult) {
          // Order info
          const parts = segment.split('|');
          
          currentResult.externalReferenceId = parts[3] || `${Date.now()}`;
          currentResult.panelCode = parts[4] || '';
          currentResult.panelName = parts[4] ? parts[4].split('^')[1] : '';
          currentResult.collectionDate = new Date(parts[7] || Date.now());
        }
        else if (segmentType === 'OBX' && currentResult) {
          // Result info
          const parts = segment.split('|');
          
          const testResult = {
            testCode: parts[3] ? parts[3].split('^')[0] : '',
            testName: parts[3] ? parts[3].split('^')[1] : 'Unknown Test',
            value: parts[5] || '',
            units: parts[6] || '',
            referenceRanges: []
          };
          
          // Process reference range
          if (parts[7]) {
            const rangeParts = parts[7].split('-');
            if (rangeParts.length === 2) {
              testResult.referenceRanges.push({
                gender: 'all',
                lowerBound: parseFloat(rangeParts[0]),
                upperBound: parseFloat(rangeParts[1]),
                units: testResult.units
              });
            }
          }
          
          // Process abnormal flags
          if (parts[8]) {
            testResult.abnormalFlags = [{
              flag: parts[8],
              severity: parts[8] === 'C' ? 'critical' : 'moderate',
              autoGenerated: true
            }];
          }
          
          currentResult.results.push(testResult);
        }
        else if (segmentType === 'NTE' && currentResult && currentResult.results.length > 0) {
          // Notes for the last result
          const parts = segment.split('|');
          const lastResult = currentResult.results[currentResult.results.length - 1];
          lastResult.notes = (lastResult.notes ? lastResult.notes + ' ' : '') + (parts[3] || '');
        }
        else if (segmentType === 'FTS' && currentResult) {
          // End of message, save the current result
          results.push(currentResult);
          currentResult = null;
        }
      }
      
      // Add the last result if not already added
      if (currentResult) {
        results.push(currentResult);
      }
      
      return results;
    } catch (error) {
      logger.error('Error parsing HL7 data', { error: error.message });
      throw new Error(`Failed to parse HL7 data: ${error.message}`);
    }
  },

  /**
   * Parse FHIR format data
   * @param {Object} fhirData - FHIR formatted data
   * @param {string} source - Source of the data
   * @returns {Array} Parsed lab results
   */
  parseFHIRData: (fhirData, source) => {
    try {
      const results = [];
      let currentBundle = null;
      
      // Check if this is a FHIR Bundle
      if (fhirData.resourceType === 'Bundle' && fhirData.entry && Array.isArray(fhirData.entry)) {
        // Group entries by diagnostic report
        const diagnosticReports = fhirData.entry
          .filter(entry => entry.resource.resourceType === 'DiagnosticReport');
          
        const observations = fhirData.entry
          .filter(entry => entry.resource.resourceType === 'Observation');
        
        // Process each diagnostic report
        for (const reportEntry of diagnosticReports) {
          const report = reportEntry.resource;
          
          currentBundle = {
            externalReferenceId: report.id,
            labId: source,
            labFacilityName: report.performer?.[0]?.display || 'Unknown Lab',
            collectionDate: new Date(report.effectiveDateTime || Date.now()),
            reportDate: new Date(report.issued || Date.now()),
            panelCode: report.code?.coding?.[0]?.code || '',
            panelName: report.code?.text || report.code?.coding?.[0]?.display || '',
            results: [],
            integrationSource: 'fhir'
          };
          
          // Find all observations referenced by this report
          if (report.result && Array.isArray(report.result)) {
            for (const resultRef of report.result) {
              const observationId = resultRef.reference.split('/').pop();
              const observation = observations.find(o => 
                o.resource.id === observationId
              )?.resource;
              
              if (observation) {
                const testResult = {
                  testCode: observation.code?.coding?.[0]?.code || '',
                  testName: observation.code?.text || observation.code?.coding?.[0]?.display || 'Unknown Test',
                  value: observation.valueQuantity?.value || observation.valueString || '',
                  units: observation.valueQuantity?.unit || '',
                  status: observation.status || 'final',
                  referenceRanges: []
                };
                
                // Process reference ranges
                if (observation.referenceRange && observation.referenceRange.length > 0) {
                  for (const range of observation.referenceRange) {
                    const referenceRange = {
                      gender: 'all', // Default, may be specified in a real implementation
                      lowerBound: range.low?.value !== undefined ? range.low.value : Number.MIN_SAFE_INTEGER,
                      upperBound: range.high?.value !== undefined ? range.high.value : Number.MAX_SAFE_INTEGER,
                      units: range.low?.unit || range.high?.unit || testResult.units
                    };
                    
                    // Add age or gender specifics if available
                    if (range.appliesTo && range.appliesTo.length > 0) {
                      for (const applicability of range.appliesTo) {
                        if (applicability.coding && applicability.coding.length > 0) {
                          const code = applicability.coding[0].code;
                          if (code === 'male' || code === 'female') {
                            referenceRange.gender = code;
                          }
                          // Age ranges would be handled similarly
                        }
                      }
                    }
                    
                    testResult.referenceRanges.push(referenceRange);
                  }
                }
                
                // Process interpretation (abnormal flags)
                if (observation.interpretation && observation.interpretation.length > 0) {
                  testResult.abnormalFlags = observation.interpretation.map(interp => ({
                    flag: interp.coding?.[0]?.code === 'H' ? 'H' : 
                          interp.coding?.[0]?.code === 'L' ? 'L' : 
                          interp.coding?.[0]?.code === 'A' ? 'A' : 'N',
                    severity: interp.coding?.[0]?.code === 'HH' || 
                              interp.coding?.[0]?.code === 'LL' ? 'critical' : 'moderate',
                    description: interp.text || '',
                    autoGenerated: true
                  }));
                }
                
                // Add notes if available
                if (observation.note && observation.note.length > 0) {
                  testResult.notes = observation.note.map(n => n.text).join(' ');
                }
                
                currentBundle.results.push(testResult);
              }
            }
          }
          
          results.push(currentBundle);
        }
        
        // Handle case where no DiagnosticReport exists but Observations are present
        if (results.length === 0 && observations.length > 0) {
          // Group observations by effective date
          const observationsByDate = {};
          
          for (const obsEntry of observations) {
            const obs = obsEntry.resource;
            const dateKey = obs.effectiveDateTime?.split('T')[0] || 'unknown';
            
            if (!observationsByDate[dateKey]) {
              observationsByDate[dateKey] = [];
            }
            
            observationsByDate[dateKey].push(obs);
          }
          
          // Create a result bundle for each date
          for (const [dateKey, dateObs] of Object.entries(observationsByDate)) {
            currentBundle = {
              externalReferenceId: `${source}-${dateKey}-${Date.now()}`,
              labId: source,
              labFacilityName: dateObs[0].performer?.[0]?.display || 'Unknown Lab',
              collectionDate: new Date(dateKey !== 'unknown' ? dateKey : Date.now()),
              reportDate: new Date(dateObs[0].issued || Date.now()),
              results: [],
              integrationSource: 'fhir'
            };
            
            // Process each observation
            for (const obs of dateObs) {
              const testResult = {
                testCode: obs.code?.coding?.[0]?.code || '',
                testName: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown Test',
                value: obs.valueQuantity?.value || obs.valueString || obs.valueCodeableConcept?.text || '',
                units: obs.valueQuantity?.unit || '',
                status: obs.status || 'final',
                referenceRanges: [],
                notes: obs.note ? obs.note.map(n => n.text).join(' ') : ''
              };
              
              // Process reference ranges as above
              if (obs.referenceRange && obs.referenceRange.length > 0) {
                // Similar logic as above
              }
              
              // Process interpretation as above
              if (obs.interpretation && obs.interpretation.length > 0) {
                // Similar logic as above
              }
              
              currentBundle.results.push(testResult);
            }
            
            results.push(currentBundle);
          }
        }
      } 
      else {
        throw new ValidationError('Invalid FHIR data format');
      }
      
      return results;
    } catch (error) {
      logger.error('Error parsing FHIR data', { error: error.message });
      throw new Error(`Failed to parse FHIR data: ${error.message}`);
    }
  },

  /**
   * Detect abnormal values and set appropriate flags
   * @param {Object} labResult - Lab result object
   * @returns {Promise<void>} Promise indicating completion
   */
  evaluateAbnormalValues: async (labResult) => {
    try {
      // Only process results without flags already set
      for (const result of labResult.results) {
        // Skip if abnormal flags already exist
        if (result.abnormalFlags && result.abnormalFlags.length > 0) {
          continue;
        }

        // Get applicable reference range for the result
        const range = labIntegrationService.findApplicableReferenceRange(result);
        
        // Skip if no reference range found or value is not a number
        if (!range || isNaN(parseFloat(result.value))) {
          continue;
        }

        const value = parseFloat(result.value);
        
        // Check if value is outside the reference range
        if (value < range.lowerBound) {
          result.abnormalFlags = [{
            flag: value < range.lowerBound * 0.7 ? 'C' : 'L', // Critical if very low
            severity: value < range.lowerBound * 0.7 ? 'critical' : 'moderate',
            description: `Value (${value}) is below the reference range (${range.lowerBound} - ${range.upperBound} ${range.units})`,
            autoGenerated: true
          }];
        } 
        else if (value > range.upperBound) {
          result.abnormalFlags = [{
            flag: value > range.upperBound * 1.5 ? 'C' : 'H', // Critical if very high
            severity: value > range.upperBound * 1.5 ? 'critical' : 'moderate',
            description: `Value (${value}) is above the reference range (${range.lowerBound} - ${range.upperBound} ${range.units})`,
            autoGenerated: true
          }];
        }
      }

      // Update clinical significance
      const hasCritical = labResult.results.some(result => 
        result.abnormalFlags && result.abnormalFlags.some(flag => flag.flag === 'C')
      );
      
      const hasAbnormal = labResult.results.some(result => 
        result.abnormalFlags && result.abnormalFlags.length > 0
      );

      labResult.clinicalSignificance = {
        ...labResult.clinicalSignificance,
        hasCriticalValues: hasCritical,
        hasAbnormalValues: hasAbnormal,
        summary: labIntegrationService.generateClinicalSummary(labResult)
      };
    } catch (error) {
      logger.error('Error evaluating abnormal values', { error: error.message });
      throw error;
    }
  },

  /**
   * Find the applicable reference range for a test result
   * @param {Object} testResult - Test result object
   * @returns {Object|null} Applicable reference range or null
   */
  findApplicableReferenceRange: (testResult) => {
    if (!testResult.referenceRanges || testResult.referenceRanges.length === 0) {
      return null;
    }

    // For this example, just return the first reference range
    // In a real implementation, you would select the appropriate range
    // based on gender, age, etc.
    return testResult.referenceRanges[0];
  },

  /**
   * Generate a clinical summary of the lab result
   * @param {Object} labResult - Lab result object
   * @returns {string} Clinical summary text
   */
  generateClinicalSummary: (labResult) => {
    const abnormalResults = labResult.results.filter(result => 
      result.abnormalFlags && result.abnormalFlags.length > 0
    );
    
    if (abnormalResults.length === 0) {
      return 'All test results are within normal ranges.';
    }

    const summaryParts = abnormalResults.map(result => {
      const flag = result.abnormalFlags[0];
      const direction = flag.flag === 'H' ? 'high' : flag.flag === 'L' ? 'low' : 'abnormal';
      const severity = flag.severity === 'critical' ? 'critically' : 'moderately';
      
      return `${result.testName} is ${severity} ${direction} (${result.value} ${result.units})`;
    });

    if (abnormalResults.length === 1) {
      return summaryParts[0];
    }
    
    return `Multiple abnormal results detected: ${summaryParts.join('; ')}`;
  },

  /**
   * Perform trend analysis on lab results
   * @param {Object} labResult - Current lab result
   * @returns {Promise<void>} Promise indicating completion
   */
  performTrendAnalysis: async (labResult) => {
    try {
      // Initialize trend analysis array
      labResult.trendAnalysis = [];
      
      // For each test result, find previous results of the same test
      for (const currentTest of labResult.results) {
        // Skip if not a numerical value
        if (isNaN(parseFloat(currentTest.value))) {
          continue;
        }

        // Find the most recent previous result for this test
        const previousResults = await LabResult.find({
          patient: labResult.patient,
          'results.testCode': currentTest.testCode,
          collectionDate: { $lt: labResult.collectionDate }
        })
        .sort({ collectionDate: -1 })
        .limit(1);

        if (previousResults.length === 0) {
          // No previous result found, mark as new
          labResult.trendAnalysis.push({
            testCode: currentTest.testCode,
            currentValue: currentTest.value,
            direction: 'new',
            significance: 'undetermined'
          });
          continue;
        }

        const previousResult = previousResults[0];
        
        // Find the matching test in the previous result
        const previousTest = previousResult.results.find(result => 
          result.testCode === currentTest.testCode
        );

        if (!previousTest || isNaN(parseFloat(previousTest.value))) {
          // Previous test not found or not numerical, mark as new
          labResult.trendAnalysis.push({
            testCode: currentTest.testCode,
            currentValue: currentTest.value,
            direction: 'new',
            significance: 'undetermined'
          });
          continue;
        }

        // Calculate changes
        const currentValue = parseFloat(currentTest.value);
        const previousValue = parseFloat(previousTest.value);
        const absoluteChange = currentValue - previousValue;
        const percentChange = previousValue !== 0 ? 
          ((currentValue - previousValue) / Math.abs(previousValue)) * 100 : 0;

        // Determine direction
        let direction;
        if (Math.abs(percentChange) < 2) {
          direction = 'unchanged';
        } else if (currentValue > previousValue) {
          direction = 'increased';
        } else {
          direction = 'decreased';
        }

        // Determine significance
        let significance;
        
        // Check if the result has reference ranges
        const hasReferenceRange = currentTest.referenceRanges && 
                                  currentTest.referenceRanges.length > 0;
        
        // Get the applicable reference range
        const range = hasReferenceRange ? 
          labIntegrationService.findApplicableReferenceRange(currentTest) : null;

        if (range) {
          const midpoint = (range.upperBound + range.lowerBound) / 2;
          const rangeSpan = range.upperBound - range.lowerBound;
          
          // Previous abnormal, now normal
          const previousWasHigh = previousValue > range.upperBound;
          const previousWasLow = previousValue < range.lowerBound;
          const currentIsNormal = currentValue >= range.lowerBound && 
                                  currentValue <= range.upperBound;
          
          // Normal to abnormal
          const previousWasNormal = previousValue >= range.lowerBound && 
                                    previousValue <= range.upperBound;
          const currentIsHigh = currentValue > range.upperBound;
          const currentIsLow = currentValue < range.lowerBound;

          if ((previousWasHigh || previousWasLow) && currentIsNormal) {
            significance = 'significant-improvement';
          }
          else if (previousWasNormal && (currentIsHigh || currentIsLow)) {
            significance = 'significant-deterioration';
          }
          // Both abnormal, but improved
          else if (previousWasHigh && currentValue < previousValue) {
            significance = Math.abs(percentChange) > 10 ? 
              'significant-improvement' : 'mild-improvement';
          }
          else if (previousWasLow && currentValue > previousValue) {
            significance = Math.abs(percentChange) > 10 ? 
              'significant-improvement' : 'mild-improvement';
          }
          // Both abnormal, but worse
          else if (previousWasHigh && currentValue > previousValue) {
            significance = Math.abs(percentChange) > 10 ? 
              'significant-deterioration' : 'mild-deterioration';
          }
          else if (previousWasLow && currentValue < previousValue) {
            significance = Math.abs(percentChange) > 10 ? 
              'significant-deterioration' : 'mild-deterioration';
          }
          // Both normal, but trending toward abnormal
          else if (previousWasNormal && currentIsNormal) {
            if (direction === 'unchanged') {
              significance = 'unchanged';
            }
            // If moving away from midpoint of reference range
            else if ((currentValue > midpoint && direction === 'increased') ||
                    (currentValue < midpoint && direction === 'decreased')) {
              significance = Math.abs(percentChange) > 20 ? 
                'mild-deterioration' : 'unchanged';
            }
            // If moving toward midpoint of reference range
            else {
              significance = 'mild-improvement';
            }
          }
          else {
            significance = 'undetermined';
          }
        } 
        else {
          // No reference range, use percentage change
          if (Math.abs(percentChange) < 5) {
            significance = 'unchanged';
          } 
          else if (Math.abs(percentChange) < 15) {
            significance = direction === 'increased' ? 'mild-deterioration' : 'mild-improvement';
          } 
          else {
            significance = direction === 'increased' ? 
              'significant-deterioration' : 'significant-improvement';
          }

          // Reverse for tests where higher is better (e.g., HDL cholesterol)
          const testsWhereHigherIsBetter = ['HDL'];
          if (testsWhereHigherIsBetter.includes(currentTest.testCode)) {
            if (significance === 'mild-deterioration') significance = 'mild-improvement';
            else if (significance === 'significant-deterioration') significance = 'significant-improvement';
            else if (significance === 'mild-improvement') significance = 'mild-deterioration';
            else if (significance === 'significant-improvement') significance = 'significant-deterioration';
          }
        }

        // Add to trend analysis
        labResult.trendAnalysis.push({
          testCode: currentTest.testCode,
          previousValue,
          currentValue,
          percentChange: parseFloat(percentChange.toFixed(2)),
          absoluteChange: parseFloat(absoluteChange.toFixed(4)),
          direction,
          previousTestDate: previousResult.collectionDate,
          significance
        });
      }
    } catch (error) {
      logger.error('Error performing trend analysis', { error: error.message });
      throw error;
    }
  },

  /**
   * Get all lab results for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Lab results with pagination
   */
  getPatientLabResults: async (patientId, options = {}) => {
    try {
      const query = { patient: patientId };
      
      // Apply filters
      if (options.startDate) {
        query.collectionDate = { $gte: new Date(options.startDate) };
      }
      
      if (options.endDate) {
        query.collectionDate = { 
          ...query.collectionDate,
          $lte: new Date(options.endDate)
        };
      }
      
      if (options.testCode) {
        query['results.testCode'] = options.testCode;
      }
      
      if (options.abnormalOnly) {
        query['clinicalSignificance.hasAbnormalValues'] = true;
      }
      
      if (options.criticalOnly) {
        query['clinicalSignificance.hasCriticalValues'] = true;
      }
      
      // Set up pagination
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;
      
      // Get total count
      const total = await LabResult.countDocuments(query);
      
      // Get paginated results
      let resultsQuery = LabResult.find(query)
        .sort({ collectionDate: -1 })
        .skip(skip)
        .limit(limit);
        
      // Apply population
      if (options.populate) {
        resultsQuery = resultsQuery.populate('orderedBy', 'firstName lastName');
      }
      
      const results = await resultsQuery;
      
      return {
        results,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting patient lab results', { 
        error: error.message,
        patientId
      });
      throw error;
    }
  },

  /**
   * Get test result history for a specific test
   * @param {string} patientId - Patient ID
   * @param {string} testCode - Test code
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Test result history
   */
  getTestHistory: async (patientId, testCode, options = {}) => {
    try {
      const query = { 
        patient: patientId,
        'results.testCode': testCode
      };
      
      // Apply date range filter
      if (options.startDate || options.endDate) {
        query.collectionDate = {};
        
        if (options.startDate) {
          query.collectionDate.$gte = new Date(options.startDate);
        }
        
        if (options.endDate) {
          query.collectionDate.$lte = new Date(options.endDate);
        }
      }
      
      // Get matching lab results
      const labResults = await LabResult.find(query)
        .sort({ collectionDate: options.sortDirection === 'asc' ? 1 : -1 })
        .limit(options.limit || 20);
      
      // Extract the specific test from each lab result
      const testHistory = labResults.map(result => {
        const test = result.results.find(r => r.testCode === testCode);
        
        if (!test) return null;
        
        // Get trend analysis for this test if available
        const trend = result.trendAnalysis.find(t => t.testCode === testCode);
        
        return {
          date: result.collectionDate,
          value: test.value,
          units: test.units,
          abnormalFlags: test.abnormalFlags || [],
          referenceRanges: test.referenceRanges || [],
          labId: result.labId,
          labName: result.labFacilityName,
          trend: trend || null,
          resultId: result._id
        };
      }).filter(Boolean);
      
      return testHistory;
    } catch (error) {
      logger.error('Error getting test history', { 
        error: error.message,
        patientId,
        testCode
      });
      throw error;
    }
  },

  /**
   * Schedule regular lab result imports
   * @param {number} intervalMinutes - Interval in minutes
   * @returns {Object} Timer identifier
   */
  scheduleRegularImports: (intervalMinutes = 60) => {
    logger.info(`Scheduling regular lab result imports every ${intervalMinutes} minutes`);
    
    // In a real implementation, this would use a more robust task scheduler
    // But for simplicity, we'll use setInterval
    const timerId = setInterval(async () => {
      try {
        logger.info('Running scheduled lab result import');
        
        // Get all active lab connections
        const labs = labIntegrationService.getAvailableLabs();
        
        for (const lab of labs) {
          // In a real system, you would get a list of patients with pending results
          // For example, those who had tests ordered recently
          logger.info(`Checking for new results from ${lab.name}`);
          
          // Process pending results for all patients with recent orders
          // This is a placeholder for a real implementation
          // processAllPendingResults(lab.name);
        }
      } catch (error) {
        logger.error('Error in scheduled lab result import', { error: error.message });
      }
    }, intervalMinutes * 60 * 1000);
    
    return {
      timerId,
      intervalMinutes,
      stop: () => clearInterval(timerId)
    };
  }
};

module.exports = labIntegrationService;
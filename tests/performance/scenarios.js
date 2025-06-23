/**
 * Performance Test Scenarios
 * Defines standardized performance test scenarios for the application
 */

const axios = require('axios');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const benchmarkService = require('../../src/services/benchmark.service');
const logger = require('../../src/utils/logger');

// Models
const Appointment = require('../../src/models/appointment.model');
const MedicalRecord = require('../../src/models/medicalRecord.model');
const Patient = require('../../src/models/patient.model');
const Prescription = require('../../src/models/prescription.model');
const User = require('../../src/models/user.model');

// API client setup
const createApiClient = () => {
  const API_URL = process.env.API_URL || 'http://localhost:3000/api';
  let token = null;
  
  const client = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  // Add authentication interceptor
  client.interceptors.request.use(async (config) => {
    if (!token) {
      try {
        // Login to get token
        const response = await axios.post(`${API_URL}/auth/login`, {
          email: process.env.TEST_USER_EMAIL || 'admin@example.com',
          password: process.env.TEST_USER_PASSWORD || 'password123'
        });
        
        token = response.data.token;
      } catch (error) {
        logger.error('Error authenticating for performance tests:', error);
        throw new Error('Authentication failed for performance tests');
      }
    }
    
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  
  return client;
};

/**
 * Performance test scenarios
 */
const performanceScenarios = {
  /**
   * Run all benchmarks
   * @param {Object} options - Options for all benchmarks
   * @returns {Promise<Object>} Benchmark results
   */
  async runAll(options = {}) {
    const results = {};
    
    // Database scenario tests
    if (!options.skipDatabase) {
      results.patientSearch = await this.benchmarkPatientSearch(options);
      results.appointmentQuery = await this.benchmarkAppointmentQuery(options);
      results.medicalRecordQuery = await this.benchmarkMedicalRecordQuery(options);
      results.prescriptionGeneration = await this.benchmarkPrescriptionGeneration(options);
    }
    
    // API scenario tests
    if (!options.skipApi) {
      results.searchApi = await this.benchmarkSearchApi(options);
      results.appointmentBookingApi = await this.benchmarkAppointmentBookingApi(options);
      results.patientHistoryApi = await this.benchmarkPatientHistoryApi(options);
      results.dashboardLoadingApi = await this.benchmarkDashboardLoadingApi(options);
    }
    
    // Generate overall report
    if (options.generateReport) {
      results.report = await benchmarkService.generateReport();
    }
    
    return results;
  },
  
  /**
   * Benchmark patient search query
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkPatientSearch(options = {}) {
    const queryFn = async () => {
      // Complex search query
      return await Patient.aggregate([
        {
          $match: {
            $or: [
              { 'name.first': { $regex: 'Jo', $options: 'i' } },
              { 'name.last': { $regex: 'Sm', $options: 'i' } },
              { email: { $regex: 'example', $options: 'i' } }
            ]
          }
        },
        {
          $lookup: {
            from: 'medicalrecords',
            localField: '_id',
            foreignField: 'patientId',
            as: 'records'
          }
        },
        {
          $project: {
            fullName: { $concat: ['$name.first', ' ', '$name.last'] },
            email: 1,
            gender: 1,
            dateOfBirth: 1,
            contactNumber: 1,
            recordCount: { $size: '$records' }
          }
        },
        {
          $sort: { 'name.last': 1, 'name.first': 1 }
        },
        {
          $limit: 20
        }
      ]);
    };
    
    return await benchmarkService.benchmarkQuery(
      'Patient Search Performance',
      queryFn,
      {
        iterations: options.iterations || 5,
        warmup: options.warmup || 2,
        model: 'Patient',
        operation: 'search',
        clearAppCache: false,
        metadata: {
          description: 'Complex patient search with name matching and record count'
        }
      }
    );
  },
  
  /**
   * Benchmark appointment query
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkAppointmentQuery(options = {}) {
    const queryFn = async () => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      
      return await Appointment.aggregate([
        {
          $match: {
            date: { 
              $gte: startOfDay,
              $lt: endOfDay
            },
            status: { $in: ['scheduled', 'confirmed'] }
          }
        },
        {
          $lookup: {
            from: 'doctors',
            localField: 'doctorId',
            foreignField: '_id',
            as: 'doctor'
          }
        },
        {
          $lookup: {
            from: 'patients',
            localField: 'patientId',
            foreignField: '_id',
            as: 'patient'
          }
        },
        {
          $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true }
        },
        {
          $unwind: { path: '$patient', preserveNullAndEmptyArrays: true }
        },
        {
          $project: {
            _id: 1,
            date: 1,
            time: 1,
            status: 1,
            type: 1,
            notes: 1,
            'doctor.name': 1,
            'doctor._id': 1,
            'patient.name': 1,
            'patient._id': 1,
            'patient.contactNumber': 1
          }
        },
        {
          $sort: { date: 1, time: 1 }
        }
      ]);
    };
    
    return await benchmarkService.benchmarkQuery(
      'Appointment Schedule Query',
      queryFn,
      {
        iterations: options.iterations || 5,
        warmup: options.warmup || 2,
        model: 'Appointment',
        operation: 'daily_schedule',
        clearAppCache: false,
        metadata: {
          description: 'Today\'s appointment schedule with doctor and patient details'
        }
      }
    );
  },
  
  /**
   * Benchmark medical record query
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkMedicalRecordQuery(options = {}) {
    const queryFn = async () => {
      // Get a sample patient ID for testing
      const samplePatient = await Patient.findOne().lean();
      const patientId = samplePatient ? samplePatient._id : new ObjectId();
      
      return await MedicalRecord.aggregate([
        {
          $match: { patientId: patientId }
        },
        {
          $lookup: {
            from: 'doctors',
            localField: 'doctorId',
            foreignField: '_id',
            as: 'doctor'
          }
        },
        {
          $sort: { date: -1 }
        },
        {
          $lookup: {
            from: 'prescriptions',
            let: { recordId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$medicalRecordId', '$$recordId'] }
                }
              },
              {
                $lookup: {
                  from: 'medications',
                  localField: 'medications.medicationId',
                  foreignField: '_id',
                  as: 'medicationDetails'
                }
              }
            ],
            as: 'prescriptions'
          }
        },
        {
          $project: {
            _id: 1,
            date: 1,
            diagnosis: 1,
            symptoms: 1,
            notes: 1,
            attachments: 1,
            doctor: { $arrayElemAt: ['$doctor', 0] },
            prescriptions: 1,
            vitalSigns: 1
          }
        }
      ]);
    };
    
    return await benchmarkService.benchmarkQuery(
      'Patient Medical History Query',
      queryFn,
      {
        iterations: options.iterations || 5,
        warmup: options.warmup || 2,
        model: 'MedicalRecord',
        operation: 'patient_history',
        clearAppCache: false,
        metadata: {
          description: 'Patient medical history with prescriptions and medications'
        }
      }
    );
  },
  
  /**
   * Benchmark prescription generation
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkPrescriptionGeneration(options = {}) {
    const generateFn = async () => {
      // Get sample data for test
      const sampleDoctor = await User.findOne({ roles: 'doctor' }).lean();
      const samplePatient = await Patient.findOne().lean();
      const sampleRecord = await MedicalRecord.findOne().lean();
      
      // Create a new prescription
      const prescriptionData = {
        patientId: samplePatient ? samplePatient._id : new ObjectId(),
        doctorId: sampleDoctor ? sampleDoctor._id : new ObjectId(),
        medicalRecordId: sampleRecord ? sampleRecord._id : new ObjectId(),
        date: new Date(),
        medications: [
          {
            medicationId: new ObjectId(),
            dosage: '10mg',
            frequency: 'twice daily',
            duration: '7 days',
            notes: 'Take with food'
          },
          {
            medicationId: new ObjectId(),
            dosage: '500mg',
            frequency: 'three times daily',
            duration: '5 days',
            notes: 'Avoid alcohol'
          }
        ],
        instructions: 'Rest and drink plenty of fluids',
        status: 'draft'
      };
      
      // Don't actually save to the database in test mode
      if (options.dryRun) {
        return prescriptionData;
      }
      
      const prescription = new Prescription(prescriptionData);
      return await prescription.validate();
    };
    
    return await benchmarkService.benchmarkOperation(
      'Prescription Generation',
      generateFn,
      [],
      {
        iterations: options.iterations || 10,
        warmup: options.warmup || 3,
        metadata: {
          description: 'Generate and validate a new prescription'
        }
      }
    );
  },
  
  /**
   * Benchmark search API
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkSearchApi(options = {}) {
    // Create API client
    const apiClient = createApiClient();
    
    const requestFn = async () => {
      return await apiClient.get('/search', {
        params: {
          q: 'diabetes',
          type: 'all',
          from: '2022-01-01',
          to: '2023-12-31',
          limit: 10
        }
      });
    };
    
    return await benchmarkService.benchmarkEndpoint(
      'Search API Performance',
      requestFn,
      {
        iterations: options.iterations || 5,
        warmup: options.warmup || 2,
        method: 'GET',
        endpoint: '/search',
        metadata: {
          description: 'Search API with filtering and pagination'
        }
      }
    );
  },
  
  /**
   * Benchmark appointment booking API
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkAppointmentBookingApi(options = {}) {
    // Create API client
    const apiClient = createApiClient();
    
    // Get test data
    const getTestData = async () => {
      // Get a sample patient and doctor
      const patientsRes = await apiClient.get('/patients', { params: { limit: 1 } });
      const doctorsRes = await apiClient.get('/users', { params: { roles: 'doctor', limit: 1 } });
      
      const patientId = patientsRes.data.data[0]?._id || '000000000000000000000001';
      const doctorId = doctorsRes.data.data[0]?._id || '000000000000000000000002';
      
      // Create appointment data for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      return {
        patientId,
        doctorId,
        date: tomorrow.toISOString().split('T')[0],
        time: '10:00',
        duration: 30,
        type: 'Regular Checkup',
        notes: 'Performance test appointment',
        status: 'scheduled'
      };
    };
    
    // Only get test data once
    const testData = await getTestData();
    
    const requestFn = async () => {
      // Don't actually book if in dry run mode
      if (options.dryRun) {
        return { data: { success: true, data: testData } };
      }
      
      return await apiClient.post('/appointments', {
        ...testData,
        // Make each test unique with timestamp
        notes: `Performance test appointment - ${Date.now()}`
      });
    };
    
    return await benchmarkService.benchmarkEndpoint(
      'Appointment Booking API',
      requestFn,
      {
        iterations: options.iterations || 5,
        warmup: options.warmup || 1,
        method: 'POST',
        endpoint: '/appointments',
        metadata: {
          description: 'Book a new appointment'
        }
      }
    );
  },
  
  /**
   * Benchmark patient history API
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkPatientHistoryApi(options = {}) {
    // Create API client
    const apiClient = createApiClient();
    
    // Get a patient ID for testing
    const getPatientId = async () => {
      const patientsRes = await apiClient.get('/patients', { params: { limit: 1 } });
      return patientsRes.data.data[0]?._id || '000000000000000000000001';
    };
    
    const patientId = await getPatientId();
    
    const requestFn = async () => {
      return await apiClient.get(`/patient-medical-records/${patientId}`, {
        params: {
          includeDetails: true,
          includePrescriptions: true
        }
      });
    };
    
    return await benchmarkService.benchmarkEndpoint(
      'Patient History API',
      requestFn,
      {
        iterations: options.iterations || 5,
        warmup: options.warmup || 1,
        method: 'GET',
        endpoint: '/patient-medical-records/:id',
        metadata: {
          description: 'Get complete patient medical history'
        }
      }
    );
  },
  
  /**
   * Benchmark dashboard loading API
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkDashboardLoadingApi(options = {}) {
    // Create API client
    const apiClient = createApiClient();
    
    const requestFn = async () => {
      // Get all data needed for dashboard in parallel
      const [
        appointmentsRes,
        patientsRes,
        recentRecordsRes,
        metricsRes
      ] = await Promise.all([
        apiClient.get('/appointments', { params: { limit: 5, status: 'scheduled' } }),
        apiClient.get('/patients', { params: { limit: 10 } }),
        apiClient.get('/medical-records', { params: { limit: 5, sort: '-date' } }),
        apiClient.get('/metrics/business')
      ]);
      
      return {
        appointments: appointmentsRes.data,
        patients: patientsRes.data,
        recentRecords: recentRecordsRes.data,
        metrics: metricsRes.data
      };
    };
    
    return await benchmarkService.benchmarkEndpoint(
      'Dashboard Loading API',
      requestFn,
      {
        iterations: options.iterations || 3,
        warmup: options.warmup || 1,
        method: 'MULTIPLE',
        endpoint: 'Dashboard APIs',
        metadata: {
          description: 'Load all data needed for dashboard'
        }
      }
    );
  }
};

module.exports = performanceScenarios;
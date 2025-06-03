/**
 * End-to-End Tests for Patient API
 * Tests the complete patient management workflow
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const { User } = require('../../../src/models/user.model');
const Patient = require('../../src/models/patient.model');
const helpers = require('../test-helpers');

User.findById = jest.fn();
User.findOne = jest.fn();

describe('Patient API E2E', () => {
  let adminUser;
  let adminToken;
  let doctorUser;
  let doctorToken;
  let patientUser;
  let patientToken;
  let patientId;
  
  let testUserIds = [];
  let testPatientIds = [];
  
  // Setup test users and tokens before running tests
  beforeAll(async () => {
    // Create an admin user
    adminUser = await helpers.createTestUser({
      email: 'admin@example.com',
      role: 'admin'
    });
    testUserIds.push(adminUser._id);
    adminToken = helpers.generateToken(adminUser);
    
    // Create a doctor user
    doctorUser = await helpers.createTestUser({
      email: 'doctor@example.com',
      role: 'doctor'
    });
    testUserIds.push(doctorUser._id);
    doctorToken = helpers.generateToken(doctorUser);
    
    // Create a patient user
    patientUser = await helpers.createTestUser({
      email: 'patient@example.com',
      role: 'patient'
    });
    testUserIds.push(patientUser._id);
    patientToken = helpers.generateToken(patientUser);
    
    // Create a patient record for the patient user
    const patientData = await helpers.createTestPatient({
      userId: patientUser._id,
      firstName: 'Test',
      lastName: 'Patient',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'female'
    });
    testPatientIds.push(patientData._id);
    patientId = patientData._id;
  });
  
  // Clean up after all tests
  afterAll(async () => {
    await helpers.cleanupTestData(testUserIds, testPatientIds);
  });
  
  describe('GET /api/patients', () => {
    it('should allow admins to list all patients', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('patients');
      expect(Array.isArray(response.body.data.patients)).toBe(true);
    });
    
    it('should allow doctors to list patients', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('patients');
    });
    
    it('should not allow patients to list all patients', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);
      
      expect(response.body.success).toBe(false);
    });
    
    it('should reject unauthorized requests', async () => {
      await request(app)
        .get('/api/patients')
        .expect(401);
    });
  });
  
  describe('GET /api/patients/:id', () => {
    it('should allow a patient to access their own record', async () => {
      const response = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('patient');
      expect(response.body.data.patient._id.toString()).toBe(patientId.toString());
    });
    
    it('should allow doctors to access patient records', async () => {
      const response = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('patient');
    });
    
    it('should not allow a patient to access another patient\'s record', async () => {
      // Create another patient
      const anotherPatient = await helpers.createTestPatient();
      testPatientIds.push(anotherPatient._id);
      
      // Try to access with original patient token
      const response = await request(app)
        .get(`/api/patients/${anotherPatient._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/patients', () => {
    it('should allow admins to create new patients', async () => {
      const newPatientData = {
        firstName: 'New',
        lastName: 'Patient',
        dateOfBirth: '1995-05-15',
        gender: 'male',
        contactInformation: {
          email: 'newpatient@example.com',
          phone: '555-123-4567',
          address: '123 New Street'
        }
      };
      
      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newPatientData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('patient');
      expect(response.body.data.patient.firstName).toBe(newPatientData.firstName);
      
      // Store for cleanup
      if (response.body.data.patient._id) {
        testPatientIds.push(response.body.data.patient._id);
      }
    });
    
    it('should not allow patients to create new patients', async () => {
      const newPatientData = {
        firstName: 'Another',
        lastName: 'Patient',
        dateOfBirth: '1990-10-10',
        gender: 'female'
      };
      
      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(newPatientData)
        .expect(403);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PATCH /api/patients/:id', () => {
    it('should allow a patient to update their own record', async () => {
      const updateData = {
        contactInformation: {
          phone: '555-999-8888'
        }
      };
      
      const response = await request(app)
        .patch(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('patient');
      expect(response.body.data.patient.contactInformation.phone).toBe(updateData.contactInformation.phone);
    });
    
    it('should allow doctors to update patient records', async () => {
      const updateData = {
        medicalInformation: {
          allergies: ['Penicillin']
        }
      };
      
      const response = await request(app)
        .patch(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('patient');
      expect(response.body.data.patient.medicalInformation.allergies).toEqual(updateData.medicalInformation.allergies);
    });
  });
  
  describe('DELETE /api/patients/:id', () => {
    it('should only allow admins to delete patients', async () => {
      // Create a temporary patient to delete
      const tempPatient = await helpers.createTestPatient();
      
      // Try to delete as doctor (should fail)
      const doctorResponse = await request(app)
        .delete(`/api/patients/${tempPatient._id}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(403);
      
      expect(doctorResponse.body.success).toBe(false);
      
      // Try to delete as admin (should succeed)
      const adminResponse = await request(app)
        .delete(`/api/patients/${tempPatient._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(adminResponse.body.success).toBe(true);
      
      // Verify patient is soft deleted
      const deletedPatient = await Patient.findById(tempPatient._id);
      expect(deletedPatient.active).toBe(false);
    });
  });
  
  // Full workflow test
  describe('Complete Patient Workflow', () => {
    let workflowPatientId;
    
    it('should support the complete patient management lifecycle', async () => {
      // Step 1: Admin creates a new patient
      const newPatientData = {
        firstName: 'Workflow',
        lastName: 'Patient',
        dateOfBirth: '2000-01-01',
        gender: 'male',
        contactInformation: {
          email: 'workflow@example.com',
          phone: '555-000-1111'
        }
      };
      
      const createResponse = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newPatientData)
        .expect(201);
      
      workflowPatientId = createResponse.body.data.patient._id;
      testPatientIds.push(workflowPatientId);
      
      // Step 2: Doctor updates the patient's medical information
      const medicalUpdate = {
        medicalInformation: {
          allergies: ['Peanuts'],
          bloodType: 'A+',
          medications: ['Lisinopril 10mg']
        }
      };
      
      await request(app)
        .patch(`/api/patients/${workflowPatientId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(medicalUpdate)
        .expect(200);
      
      // Step 3: Verify patient medical information is updated
      const getResponse = await request(app)
        .get(`/api/patients/${workflowPatientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(getResponse.body.data.patient.medicalInformation.allergies).toEqual(['Peanuts']);
      expect(getResponse.body.data.patient.medicalInformation.bloodType).toBe('A+');
      
      // Step 4: Admin updates the patient's insurance information
      const insuranceUpdate = {
        insurance: {
          provider: 'HealthPlus',
          policyNumber: 'HP12345678',
          groupNumber: 'G12345'
        }
      };
      
      await request(app)
        .patch(`/api/patients/${workflowPatientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(insuranceUpdate)
        .expect(200);
      
      // Step 5: Verify all updates are reflected
      const finalResponse = await request(app)
        .get(`/api/patients/${workflowPatientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      const patient = finalResponse.body.data.patient;
      expect(patient.firstName).toBe(newPatientData.firstName);
      expect(patient.medicalInformation.allergies).toEqual(['Peanuts']);
      expect(patient.insurance.provider).toBe('HealthPlus');
    });
  });
});
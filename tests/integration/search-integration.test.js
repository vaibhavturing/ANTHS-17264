// src/tests/integration/search-integration.test.js
/**
 * Integration test for search functionality
 * 
 * Tests verify that:
 * 1. Search properly indexes and retrieves data across multiple collections
 * 2. Search respects user permissions and access controls
 * 3. Advanced filtering and result pagination works correctly
 * 4. Search performs adequately with larger datasets
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const { 
  User, 
  Patient, 
  Doctor, 
  MedicalRecord, 
  ClinicalNote, 
  Prescription
} = require('../../models');
const { generateAuthToken } = require('../utils/test-auth-helper');
const { setupTestDatabase, teardownTestDatabase } = require('../utils/test-db-setup');
const { generateTestRecords } = require('../utils/test-data-generator');

describe('Search Service Integration', () => {
  let doctorUser, patientUser, nurseUser;
  let doctorId, patientId, patientIdNoAccess;
  let doctorToken, patientToken, nurseToken;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create test users
    doctorUser = await User.create({
      email: 'searchdoctor@example.com',
      password: 'hashedPassword123',
      firstName: 'Search',
      lastName: 'Doctor',
      role: 'doctor'
    });
    
    patientUser = await User.create({
      email: 'searchpatient@example.com',
      password: 'hashedPassword456',
      firstName: 'Search',
      lastName: 'Patient',
      role: 'patient'
    });
    
    nurseUser = await User.create({
      email: 'searchnurse@example.com',
      password: 'hashedPassword789',
      firstName: 'Search',
      lastName: 'Nurse',
      role: 'nurse',
      departmentId: 'cardiology'
    });
    
    // Create doctor profile
    doctorId = (await Doctor.create({
      userId: doctorUser._id,
      specialty: 'Internal Medicine',
      licenseNumber: 'SEARCH123'
    }))._id;
    
    doctorUser.doctorId = doctorId;
    await doctorUser.save();
    
    // Create patient with access to doctor
    patientId = (await Patient.create({
      userId: patientUser._id,
      dateOfBirth: '1980-05-15',
      gender: 'male',
      primaryDoctor: doctorId,
      diagnoses: [
        { condition: 'Type 2 Diabetes Mellitus', dateHappened: '2023-06-01', status: 'active' },
        { condition: 'Hypertension', dateHappened: '2022-09-15', status: 'active' }
      ],
      assignedDepartments: ['cardiology']
    }))._id;
    
    patientUser.patientId = patientId;
    await patientUser.save();
    
    // Create patient with no relationship to test users
    patientIdNoAccess = (await Patient.create({
      firstName: 'No',
      lastName: 'Access',
      dateOfBirth: '1975-10-20',
      gender: 'female',
      primaryDoctor: new mongoose.Types.ObjectId(), // Different doctor
      diagnoses: [
        { condition: 'Asthma', dateHappened: '2021-03-10', status: 'active' }
      ]
    }))._id;
    
    // Generate tokens
    doctorToken = await generateAuthToken(doctorUser);
    patientToken = await generateAuthToken(patientUser);
    nurseToken = await generateAuthToken(nurseUser);
    
    // Generate test records for the patients
    await generateTestRecords({
      patientId,
      doctorId,
      recordCount: 50,
      noteCount: 20,
      prescriptionCount: 10,
      includeKeywords: ['diabetes', 'hypertension', 'blood pressure', 'A1C', 'metformin']
    });
    
    await generateTestRecords({
      patientId: patientIdNoAccess,
      doctorId: new mongoose.Types.ObjectId(),
      recordCount: 20,
      noteCount: 10,
      prescriptionCount: 5,
      includeKeywords: ['asthma', 'inhaler', 'wheezing', 'albuterol']
    });
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('Full-text Search Integration', () => {
    test('should search across multiple record types with access control', async () => {
      // Act - Doctor searches for diabetes
      const doctorSearchResponse = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ 
          query: 'diabetes',
          page: 1,
          limit: 20
        })
        .expect(200);
      
      // Assert - Should only find records from patients the doctor has access to
      expect(doctorSearchResponse.body.total).toBeGreaterThan(0);
      expect(doctorSearchResponse.body.results.length).toBeGreaterThan(0);
      
      // All results should be for patientId, none for patientIdNoAccess
      doctorSearchResponse.body.results.forEach(result => {
        expect(result.patientId).toBe(patientId.toString());
      });
      
      // Act - Patient searches own records
      const patientSearchResponse = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${patientToken}`)
        .query({ 
          query: 'diabetes',
          page: 1,
          limit: 20
        })
        .expect(200);
      
      // Assert - Patient should only see their own records
      expect(patientSearchResponse.body.total).toBeGreaterThan(0);
      patientSearchResponse.body.results.forEach(result => {
        expect(result.patientId).toBe(patientId.toString());
      });
      
      // Act - Nurse searches
      const nurseSearchResponse = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${nurseToken}`)
        .query({ 
          query: 'diabetes',
          page: 1,
          limit: 20
        })
        .expect(200);
      
      // Assert - Nurse should only see records from their department
      expect(nurseSearchResponse.body.total).toBeGreaterThan(0);
      nurseSearchResponse.body.results.forEach(result => {
        expect(result.patientId).toBe(patientId.toString());
      });
      
      // Act - Search with no results
      const noResultsResponse = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ 
          query: 'pneumonia', // Not in our test data
          page: 1,
          limit: 20
        })
        .expect(200);
      
      // Assert - Should return empty results
      expect(noResultsResponse.body.total).toBe(0);
      expect(noResultsResponse.body.results.length).toBe(0);
    });
    
    test('should filter search results by type, date range, and year', async () => {
      // Act - Search only clinical notes
      const notesResponse = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ 
          query: 'blood pressure',
          recordType: 'clinicalNote',
          page: 1,
          limit: 20
        })
        .expect(200);
      
      // Assert - Should only return clinical notes
      expect(notesResponse.body.results.length).toBeGreaterThan(0);
      notesResponse.body.results.forEach(result => {
        expect(result.recordType).toBe('clinicalNote');
      });
      
      // Act - Search only for this year
      const currentYear = new Date().getFullYear();
      const yearResponse = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ 
          query: 'diabetes',
          year: currentYear,
          page: 1,
          limit: 20
        })
        .expect(200);
      
      // Assert - All results should be from this year
      yearResponse.body.results.forEach(result => {
        const resultDate = new Date(result.date);
        expect(resultDate.getFullYear()).toBe(currentYear);
      });
      
      // Act - Search with date range
      const startDate = '2023-01-01';
      const endDate = '2023-12-31';
      const dateRangeResponse = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ 
          query: 'diabetes',
          startDate,
          endDate,
          page: 1,
          limit: 20
        })
        .expect(200);
      
      // Assert - All results should be within date range
      expect(dateRangeResponse.body.results.length).toBeGreaterThan(0);
      dateRangeResponse.body.results.forEach(result => {
        const resultDate = new Date(result.date);
        expect(resultDate >= new Date(startDate)).toBe(true);
        expect(resultDate <= new Date(endDate)).toBe(true);
      });
    });
    
    test('should find patients with specific conditions', async () => {
      // Act - Search for patients with diabetes
      const response = await request(app)
        .get('/api/search/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ 
          condition: 'diabetes',
          page: 1,
          limit: 10
        })
        .expect(200);
      
      // Assert - Should find the patient with diabetes
      expect(response.body.total).toBeGreaterThan(0);
      const patientFound = response.body.patients.some(p => 
        p._id.toString() === patientId.toString()
      );
      expect(patientFound).toBe(true);
      
      // The patient with no access should not be found even if they had the condition
      const noAccessPatientFound = response.body.patients.some(p => 
        p._id.toString() === patientIdNoAccess.toString()
      );
      expect(noAccessPatientFound).toBe(false);
    });
    
    test('should paginate search results correctly', async () => {
      // Act - First page
      const page1Response = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ 
          query: 'blood',
          page: 1,
          limit: 5
        })
        .expect(200);
      
      // Act - Second page
      const page2Response = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ 
          query: 'blood',
          page: 2,
          limit: 5
        })
        .expect(200);
      
      // Assert - Should have different results on different pages
      expect(page1Response.body.results).toHaveLength(5);
      
      if (page2Response.body.results.length > 0) {
        // Only check if there are actually results on page 2
        const page1Ids = page1Response.body.results.map(r => r._id);
        const page2Ids = page2Response.body.results.map(r => r._id);
        
        // No overlap between pages
        const overlap = page1Ids.filter(id => page2Ids.includes(id));
        expect(overlap).toHaveLength(0);
      }
      
      // Meta information should be correct
      expect(page1Response.body.page).toBe(1);
      expect(page2Response.body.page).toBe(2);
      expect(page1Response.body.limit).toBe(5);
      expect(page1Response.body.total).toBe(page2Response.body.total);
    });
    
    test('should perform combined queries across record types', async () => {
      // Act - Search for metformin prescriptions
      const response = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ 
          query: 'metformin',
          recordType: 'prescription',
          page: 1, 
          limit: 10
        })
        .expect(200);
      
      // Assert - Should find metformin prescriptions
      expect(response.body.results.some(r => 
        r.recordType === 'prescription' && r.summary.toLowerCase().includes('metformin')
      )).toBe(true);
    });
  });

  describe('Search Performance', () => {
    test('should return search results quickly with larger result sets', async () => {
      // This is a basic performance test - more extensive tests would be done with dedicated tools
      const startTime = Date.now();
      
      await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ 
          query: 'blood', // Common term that should return many results
          page: 1,
          limit: 50
        })
        .expect(200);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Response should be under 1 second even with fairly large result set
      expect(responseTime).toBeLessThan(1000);
    });
  });
});
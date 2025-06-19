// src/tests/integration/medical-imaging-integration.test.js
/**
 * Integration test for medical imaging workflows
 * 
 * Tests verify that:
 * 1. Medical images can be uploaded, stored, and retrieved securely
 * 2. DICOM metadata is properly extracted and indexed
 * 3. Images are properly associated with patient records
 * 4. Access controls properly restrict image access
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../../app');
const { 
  User, 
  Patient, 
  Doctor, 
  MedicalFile, 
  MedicalRecord 
} = require('../../models');
const { generateAuthToken } = require('../utils/test-auth-helper');
const { setupTestDatabase, teardownTestDatabase } = require('../utils/test-db-setup');
const { createTestImage } = require('../utils/test-file-helper');

describe('Medical Imaging Integration', () => {
  let doctorUser, patientUser, nurseUser, adminUser;
  let doctorId, patientId;
  let doctorToken, patientToken, nurseToken, adminToken;
  let testImagePath, testDicomPath, testPdfPath;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create test files
    testImagePath = await createTestImage('test-xray.jpg', 300, 400);
    
    // Point to test DICOM and PDF files in test assets folder
    testDicomPath = path.join(__dirname, '../assets/test-dicom.dcm');
    testPdfPath = path.join(__dirname, '../assets/test-report.pdf');
    
    if (!fs.existsSync(testDicomPath)) {
      // Create dummy DICOM file for testing if real one doesn't exist
      fs.writeFileSync(testDicomPath, 'DICM' + Buffer.alloc(128).fill('TEST DICOM FILE'));
    }
    
    if (!fs.existsSync(testPdfPath)) {
      // Create dummy PDF file for testing if real one doesn't exist
      fs.writeFileSync(testPdfPath, '%PDF-1.4\nTest PDF Content');
    }
    
    // Create test users
    doctorUser = await User.create({
      email: 'radiologist@example.com',
      password: 'hashedPassword123',
      firstName: 'Dr.',
      lastName: 'Radiologist',
      role: 'doctor'
    });
    
    patientUser = await User.create({
      email: 'imaging-patient@example.com',
      password: 'hashedPassword456',
      firstName: 'Imaging',
      lastName: 'Patient',
      role: 'patient'
    });
    
    nurseUser = await User.create({
      email: 'nurse@example.com',
      password: 'hashedPassword789',
      firstName: 'Test',
      lastName: 'Nurse',
      role: 'nurse'
    });
    
    adminUser = await User.create({
      email: 'admin@example.com',
      password: 'hashedPasswordABC',
      firstName: 'System',
      lastName: 'Admin',
      role: 'admin'
    });
    
    // Create doctor profile
    doctorId = (await Doctor.create({
      userId: doctorUser._id,
      specialty: 'Radiology',
      licenseNumber: 'RAD12345'
    }))._id;
    
    doctorUser.doctorId = doctorId;
    await doctorUser.save();
    
    // Create patient profile
    patientId = (await Patient.create({
      userId: patientUser._id,
      dateOfBirth: '1975-10-20',
      gender: 'female',
      primaryDoctor: doctorId
    }))._id;
    
    patientUser.patientId = patientId;
    await patientUser.save();
    
    // Generate tokens
    doctorToken = await generateAuthToken(doctorUser);
    patientToken = await generateAuthToken(patientUser);
    nurseToken = await generateAuthToken(nurseUser);
    adminToken = await generateAuthToken(adminUser);
  });

  afterAll(async () => {
    await teardownTestDatabase();
    
    // Cleanup test files
    try {
      fs.unlinkSync(testImagePath);
    } catch (err) {
      console.error('Could not delete test image:', err);
    }
  });
  
  afterEach(async () => {
    // Clean files between tests
    await MedicalFile.deleteMany({});
    await MedicalRecord.deleteMany({});
  });

  describe('Medical Image Upload and Retrieval', () => {
    test('should upload DICOM image and extract metadata', async () => {
      // Act - Upload DICOM file
      const response = await request(app)
        .post('/api/medical-files/upload')
        .set('Authorization', `Bearer ${doctorToken}`)
        .field('patientId', patientId.toString())
        .field('fileType', 'dicom')
        .field('fileDescription', 'Chest X-ray')
        .field('studyDate', '2025-06-15')
        .field('tags', JSON.stringify(['chest', 'x-ray', 'routine']))
        .attach('file', testDicomPath)
        .expect(201);
      
      const fileId = response.body._id;
      
      // Assert - File created with proper metadata
      expect(response.body.patientId).toBe(patientId.toString());
      expect(response.body.uploadedBy).toBe(doctorUser._id.toString());
      expect(response.body.fileType).toBe('dicom');
      
      // DICOM metadata should be extracted
      expect(response.body.metadata).toBeTruthy();
      
      // Check if a medical record entry was created for the image
      const medicalRecord = await MedicalRecord.findOne({ 
        patientId,
        type: 'imaging',
        relatedFileId: fileId
      });
      expect(medicalRecord).toBeTruthy();
      expect(medicalRecord.summary).toContain('Chest X-ray');
      
      // Verify file can be retrieved
      await request(app)
        .get(`/api/medical-files/${fileId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);
    });
    
    test('should properly enforce access control for medical images', async () => {
      // Step 1: Upload image as doctor
      const uploadResponse = await request(app)
        .post('/api/medical-files/upload')
        .set('Authorization', `Bearer ${doctorToken}`)
        .field('patientId', patientId.toString())
        .field('fileType', 'image')
        .field('fileDescription', 'MRI Scan')
        .field('studyDate', '2025-06-16')
        .field('tags', JSON.stringify(['brain', 'mri']))
        .attach('file', testImagePath)
        .expect(201);
      
      const fileId = uploadResponse.body._id;
      
      // Step 2: Patient should be able to access their own image
      await request(app)
        .get(`/api/medical-files/${fileId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      // Step 3: Nurse without access to this patient should be denied
      await request(app)
        .get(`/api/medical-files/${fileId}`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(403);
      
      // Step 4: Admin should have access (for audit purposes)
      await request(app)
        .get(`/api/medical-files/${fileId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      // Verify access logging
      const fileWithAccessLogs = await MedicalFile.findById(fileId);
      expect(fileWithAccessLogs.accessLogs.length).toBeGreaterThan(0);
      
      // Should contain entries for doctor, patient, admin, and failed nurse access
      const accessUsers = fileWithAccessLogs.accessLogs.map(log => log.userId.toString());
      expect(accessUsers).toContain(doctorUser._id.toString());
      expect(accessUsers).toContain(patientUser._id.toString());
      expect(accessUsers).toContain(adminUser._id.toString());
      
      // Failed access attempts should still be logged
      const nurseAccessAttempt = fileWithAccessLogs.accessLogs.find(
        log => log.userId.toString() === nurseUser._id.toString()
      );
      expect(nurseAccessAttempt).toBeTruthy();
      expect(nurseAccessAttempt.accessGranted).toBe(false);
    });
    
    test('should allow medical imaging search by metadata and tags', async () => {
      // Arrange - Upload multiple files
      await request(app)
        .post('/api/medical-files/upload')
        .set('Authorization', `Bearer ${doctorToken}`)
        .field('patientId', patientId.toString())
        .field('fileType', 'dicom')
        .field('fileDescription', 'Chest X-ray')
        .field('studyDate', '2025-06-15')
        .field('tags', JSON.stringify(['chest', 'x-ray', 'routine']))
        .attach('file', testDicomPath)
        .expect(201);
      
      await request(app)
        .post('/api/medical-files/upload')
        .set('Authorization', `Bearer ${doctorToken}`)
        .field('patientId', patientId.toString())
        .field('fileType', 'dicom')
        .field('fileDescription', 'Lumbar Spine MRI')
        .field('studyDate', '2025-06-16')
        .field('tags', JSON.stringify(['spine', 'mri', 'lumbar']))
        .attach('file', testDicomPath)
        .expect(201);
      
      await request(app)
        .post('/api/medical-files/upload')
        .set('Authorization', `Bearer ${doctorToken}`)
        .field('patientId', patientId.toString())
        .field('fileType', 'pdf')
        .field('fileDescription', 'Radiology Report - Chest')
        .field('studyDate', '2025-06-15')
        .field('tags', JSON.stringify(['chest', 'report', 'radiology']))
        .attach('file', testPdfPath)
        .expect(201);
      
      // Act & Assert - Search by tag
      let searchResponse = await request(app)
        .get('/api/medical-files/search')
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ 
          patientId: patientId.toString(),
          tags: 'chest'
        })
        .expect(200);
      
      expect(searchResponse.body.files).toHaveLength(2); // X-ray and report
      
      // Search by type
      searchResponse = await request(app)
        .get('/api/medical-files/search')
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ 
          patientId: patientId.toString(),
          fileType: 'dicom'
        })
        .expect(200);
      
      expect(searchResponse.body.files).toHaveLength(2); // Both DICOM files
      
      // Search by date range
      searchResponse = await request(app)
        .get('/api/medical-files/search')
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ 
          patientId: patientId.toString(),
          startDate: '2025-06-16',
          endDate: '2025-06-16'
        })
        .expect(200);
      
      expect(searchResponse.body.files).toHaveLength(1); // Just the MRI from the 16th
      expect(searchResponse.body.files[0].fileDescription).toContain('MRI');
    });
  });

  describe('Medical Imaging with Patient Records Integration', () => {
    test('should properly link imaging studies to medical records', async () => {
      // Step 1: Create a patient encounter/visit
      const visitData = {
        patientId: patientId.toString(),
        providerId: doctorId.toString(),
        visitType: 'Imaging',
        visitDate: '2025-06-18',
        chiefComplaint: 'Low back pain',
        status: 'completed'
      };
      
      const visitResponse = await request(app)
        .post('/api/patient-visits')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(visitData)
        .expect(201);
      
      const visitId = visitResponse.body._id;
      
      // Step 2: Create a medical record for the imaging order
      const recordData = {
        patientId: patientId.toString(),
        providerId: doctorId.toString(),
        type: 'imaging-order',
        visitId: visitId,
        date: '2025-06-18',
        summary: 'Lumbar spine MRI ordered',
        content: {
          orderType: 'MRI',
          region: 'Lumbar Spine',
          reason: 'Chronic low back pain with radiculopathy',
          instructions: 'Check for disc herniation and nerve impingement'
        }
      };
      
      const recordResponse = await request(app)
        .post('/api/medical-records')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(recordData)
        .expect(201);
      
      const recordId = recordResponse.body._id;
      
      // Step 3: Upload imaging study and link to the order
      const fileData = await request(app)
        .post('/api/medical-files/upload')
        .set('Authorization', `Bearer ${doctorToken}`)
        .field('patientId', patientId.toString())
        .field('fileType', 'dicom')
        .field('fileDescription', 'Lumbar Spine MRI')
        .field('studyDate', '2025-06-18')
        .field('relatedRecordId', recordId)
        .field('tags', JSON.stringify(['spine', 'mri', 'lumbar']))
        .attach('file', testDicomPath)
        .expect(201);
      
      const fileId = fileData.body._id;
      
      // Step 4: Create radiology report referencing the image
      const reportData = {
        patientId: patientId.toString(),
        providerId: doctorId.toString(),
        type: 'radiology-report',
        visitId: visitId,
        relatedFileIds: [fileId],
        date: '2025-06-19',
        summary: 'Lumbar spine MRI findings',
        content: {
          findings: 'L4-L5 disc herniation with mild nerve root impingement',
          impression: 'Degenerative disc disease with herniation',
          recommendations: 'Physical therapy and pain management referral'
        }
      };
      
      await request(app)
        .post('/api/medical-records')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(reportData)
        .expect(201);
      
      // Step 5: Verify complete patient record includes linked imaging and reports
      const patientRecordResponse = await request(app)
        .get(`/api/patients/${patientId}/medical-records`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ includeFiles: 'true' })
        .expect(200);
      
      // Should contain the imaging order, the file, and the radiology report
      expect(patientRecordResponse.body.records).toHaveLength(3);
      
      // Find the radiology report record and verify it has the file linked
      const report = patientRecordResponse.body.records.find(r => r.type === 'radiology-report');
      expect(report).toBeTruthy();
      expect(report.relatedFileIds).toContain(fileId);
      
      // Verify the file itself is included
      expect(patientRecordResponse.body.files).toHaveLength(1);
      expect(patientRecordResponse.body.files[0]._id).toBe(fileId);
    });
  });
});
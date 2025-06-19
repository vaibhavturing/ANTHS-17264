// src/tests/integration/prescription-pharmacy-integration.test.js
/**
 * Integration test for prescription and pharmacy workflow
 * 
 * Tests verify the end-to-end process of:
 * 1. Creating a prescription
 * 2. Checking drug interactions
 * 3. Doctor signing the prescription
 * 4. Transmitting to the pharmacy
 * 5. Pharmacy processing the prescription
 */

const request = require('supertest');
const app = require('../../app');
const { 
  User, 
  Doctor, 
  Patient, 
  Medication, 
  Pharmacy,
  Prescription,
  Notification 
} = require('../../models');
const { generateAuthToken } = require('../utils/test-auth-helper');
const { setupTestDatabase, teardownTestDatabase } = require('../utils/test-db-setup');

describe('Prescription-Pharmacy Integration', () => {
  let doctorUser, patientUser, pharmacyUser;
  let doctorId, patientId, pharmacyId;
  let doctorToken, patientToken, pharmacyToken;
  let medication1Id, medication2Id;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create test users
    doctorUser = await User.create({
      email: 'prescriber@example.com',
      password: 'hashedPassword123',
      firstName: 'Dr.',
      lastName: 'Prescriber',
      role: 'doctor'
    });
    
    patientUser = await User.create({
      email: 'rx-patient@example.com',
      password: 'hashedPassword456',
      firstName: 'Prescription',
      lastName: 'Patient',
      role: 'patient'
    });
    
    pharmacyUser = await User.create({
      email: 'pharmacist@example.com',
      password: 'hashedPassword789',
      firstName: 'Pharmacy',
      lastName: 'Staff',
      role: 'pharmacist'
    });
    
    // Create doctor profile
    doctorId = (await Doctor.create({
      userId: doctorUser._id,
      specialty: 'Family Medicine',
      licenseNumber: 'RX12345',
      prescriptionAuthority: true
    }))._id;
    
    doctorUser.doctorId = doctorId;
    await doctorUser.save();
    
    // Create patient profile
    patientId = (await Patient.create({
      userId: patientUser._id,
      dateOfBirth: '1985-05-15',
      gender: 'male',
      primaryDoctor: doctorId,
      allergies: ['penicillin'],
      currentMedications: []
    }))._id;
    
    patientUser.patientId = patientId;
    await patientUser.save();
    
    // Create pharmacy
    pharmacyId = (await Pharmacy.create({
      name: 'Test Pharmacy',
      address: {
        street: '123 Main St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      },
      phone: '555-123-4567',
      email: 'pharmacy@example.com',
      hours: [
        { day: 'Monday', open: '09:00', close: '18:00' },
        { day: 'Tuesday', open: '09:00', close: '18:00' },
        { day: 'Wednesday', open: '09:00', close: '18:00' },
        { day: 'Thursday', open: '09:00', close: '18:00' },
        { day: 'Friday', open: '09:00', close: '18:00' }
      ],
      pharmacists: [pharmacyUser._id]
    }))._id;
    
    pharmacyUser.pharmacyId = pharmacyId;
    await pharmacyUser.save();
    
    // Create medications for testing
    medication1Id = (await Medication.create({
      name: 'Lisinopril',
      genericName: 'Lisinopril',
      strength: '10mg',
      form: 'tablet',
      classification: 'ACE inhibitor',
      requiresPrescription: true,
      commonDosages: ['5mg daily', '10mg daily', '20mg daily'],
      interactions: [],
      contraindications: ['pregnancy', 'history of angioedema'],
      sideEffects: ['dry cough', 'dizziness', 'headache']
    }))._id;
    
    medication2Id = (await Medication.create({
      name: 'Amoxicillin',
      genericName: 'Amoxicillin',
      strength: '500mg',
      form: 'capsule',
      classification: 'penicillin antibiotic',
      requiresPrescription: true,
      commonDosages: ['500mg every 8 hours', '875mg every 12 hours'],
      interactions: [],
      contraindications: ['allergic to penicillin'],
      sideEffects: ['diarrhea', 'rash', 'nausea']
    }))._id;
    
    // Generate tokens
    doctorToken = await generateAuthToken(doctorUser);
    patientToken = await generateAuthToken(patientUser);
    pharmacyToken = await generateAuthToken(pharmacyUser);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });
  
  afterEach(async () => {
    // Clean prescriptions and notifications between tests
    await Prescription.deleteMany({});
    await Notification.deleteMany({});
  });

  describe('E-Prescription Workflow', () => {
    test('should detect drug allergies during prescription creation', async () => {
      // Arrange - Prescription for antibiotic with penicillin allergy
      const prescriptionData = {
        patientId: patientId.toString(),
        doctorId: doctorId.toString(),
        medicationId: medication2Id.toString(), // Amoxicillin (penicillin)
        sig: 'Take 1 capsule by mouth 3 times daily for 10 days',
        quantity: 30,
        refills: 0,
        dispenseAsWritten: true,
        pharmacyId: pharmacyId.toString()
      };
      
      // Act - Try to create prescription with allergen
      const response = await request(app)
        .post('/api/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(prescriptionData)
        .expect(400);
      
      // Assert - Should warn about allergy
      expect(response.body.message).toContain('Patient is allergic to penicillin');
      
      // Verify no prescription created
      const prescriptions = await Prescription.find({ patientId });
      expect(prescriptions).toHaveLength(0);
    });
    
    test('should complete full prescription lifecycle with pharmacy integration', async () => {
      // Step 1: Create prescription
      const prescriptionData = {
        patientId: patientId.toString(),
        doctorId: doctorId.toString(),
        medicationId: medication1Id.toString(), // Lisinopril
        sig: 'Take 1 tablet by mouth daily',
        quantity: 30,
        refills: 2,
        dispenseAsWritten: false,
        pharmacyId: pharmacyId.toString()
      };
      
      const createResponse = await request(app)
        .post('/api/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(prescriptionData)
        .expect(201);
      
      const prescriptionId = createResponse.body._id;
      
      // Verify prescription created with pending status
      let prescription = await Prescription.findById(prescriptionId);
      expect(prescription).toBeTruthy();
      expect(prescription.status).toBe('pending');
      
      // Step 2: Doctor signs the prescription
      const signatureData = {
        signature: 'Dr. Prescriber Electronic Signature'
      };
      
      await request(app)
        .post(`/api/prescriptions/${prescriptionId}/sign`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(signatureData)
        .expect(200);
      
      // Verify prescription signed
      prescription = await Prescription.findById(prescriptionId);
      expect(prescription.status).toBe('active');
      expect(prescription.signature).toBeTruthy();
      expect(prescription.signedAt).toBeTruthy();
      
      // Step 3: Transmit to pharmacy
      const transmitData = {
        method: 'electronic'
      };
      
      await request(app)
        .post(`/api/prescriptions/${prescriptionId}/transmit`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(transmitData)
        .expect(200);
      
      // Verify transmission status
      prescription = await Prescription.findById(prescriptionId);
      expect(prescription.transmissionStatus).toBe('sent');
      expect(prescription.transmittedAt).toBeTruthy();
      
      // Verify pharmacy notification
      const pharmacyNotifications = await Notification.find({
        message: expect.stringContaining('New prescription received')
      });
      expect(pharmacyNotifications).toHaveLength(1);
      
      // Step 4: Pharmacy processing - Received
      await request(app)
        .patch(`/api/prescriptions/${prescriptionId}/pharmacy-status`)
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ status: 'received' })
        .expect(200);
      
      // Step 5: Pharmacy processing - Ready for pickup
      await request(app)
        .patch(`/api/prescriptions/${prescriptionId}/pharmacy-status`)
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ status: 'ready' })
        .expect(200);
      
      // Verify patient notification for pickup
      const pickupNotifications = await Notification.find({
        userId: patientUser._id,
        message: expect.stringContaining('ready for pickup')
      });
      expect(pickupNotifications).toHaveLength(1);
      
      // Step 6: Pharmacy marks as dispensed
      const dispenseData = {
        status: 'dispensed',
        dispensedDetails: {
          dispensedDate: new Date().toISOString(),
          dispensedBy: pharmacyUser._id.toString(),
          quantityDispensed: 30,
          remainingRefills: 2
        }
      };
      
      await request(app)
        .patch(`/api/prescriptions/${prescriptionId}/pharmacy-status`)
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send(dispenseData)
        .expect(200);
      
      // Verify final prescription status
      prescription = await Prescription.findById(prescriptionId);
      expect(prescription.pharmacyStatus).toBe('dispensed');
      expect(prescription.dispensedDetails.remainingRefills).toBe(2);
      
      // Verify doctor notification of dispensing
      const dispensedNotifications = await Notification.find({
        userId: doctorUser._id,
        message: expect.stringContaining('dispensed')
      });
      expect(dispensedNotifications).toHaveLength(1);
    });
    
    test('should handle prescription refill process', async () => {
      // Step 1: Create and sign initial prescription
      const prescriptionData = {
        patientId: patientId.toString(),
        doctorId: doctorId.toString(),
        medicationId: medication1Id.toString(), // Lisinopril
        sig: 'Take 1 tablet by mouth daily',
        quantity: 30,
        refills: 1,
        dispenseAsWritten: false,
        pharmacyId: pharmacyId.toString()
      };
      
      const createResponse = await request(app)
        .post('/api/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(prescriptionData)
        .expect(201);
      
      const prescriptionId = createResponse.body._id;
      
      // Sign prescription
      await request(app)
        .post(`/api/prescriptions/${prescriptionId}/sign`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ signature: 'Dr. Prescriber Electronic Signature' })
        .expect(200);
      
      // Transmit to pharmacy
      await request(app)
        .post(`/api/prescriptions/${prescriptionId}/transmit`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ method: 'electronic' })
        .expect(200);
      
      // Mark as dispensed with 1 refill remaining
      const dispenseData = {
        status: 'dispensed',
        dispensedDetails: {
          dispensedDate: new Date().toISOString(),
          dispensedBy: pharmacyUser._id.toString(),
          quantityDispensed: 30,
          remainingRefills: 1
        }
      };
      
      await request(app)
        .patch(`/api/prescriptions/${prescriptionId}/pharmacy-status`)
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send(dispenseData)
        .expect(200);
      
      // Clear notifications
      await Notification.deleteMany({});
      
      // Step 2: Patient requests refill
      await request(app)
        .post(`/api/prescriptions/${prescriptionId}/request-refill`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          requestNotes: 'Running low on medication'
        })
        .expect(200);
      
      // Verify pharmacy received refill request
      const refillNotifications = await Notification.find({
        message: expect.stringContaining('refill request')
      });
      expect(refillNotifications.length).toBeGreaterThan(0);
      
      // Step 3: Pharmacy processes refill
      const refillData = {
        status: 'dispensed',
        dispensedDetails: {
          dispensedDate: new Date().toISOString(),
          dispensedBy: pharmacyUser._id.toString(),
          quantityDispensed: 30,
          remainingRefills: 0,
          isRefill: true
        }
      };
      
      await request(app)
        .patch(`/api/prescriptions/${prescriptionId}/pharmacy-status`)
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send(refillData)
        .expect(200);
      
      // Verify refill processed and no refills remaining
      const updatedPrescription = await Prescription.findById(prescriptionId);
      expect(updatedPrescription.dispensedDetails.remainingRefills).toBe(0);
      expect(updatedPrescription.refillHistory).toHaveLength(1);
      
      // Step 4: Try to request another refill (should fail)
      const noRefillsResponse = await request(app)
        .post(`/api/prescriptions/${prescriptionId}/request-refill`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          requestNotes: 'Need another refill'
        })
        .expect(400);
      
      expect(noRefillsResponse.body.message).toContain('No refills remaining');
    });
  });
});
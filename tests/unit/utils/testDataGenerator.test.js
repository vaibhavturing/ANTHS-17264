const mongoose = require('mongoose');
const { 
  generateFakePatient, 
  generateFakePatientBatch, 
  generateMedicalRecord,
  generatePrescription 
} = require('../../../src/utils/testDataGenerator');

describe('Test Data Generator Utility', () => {
  describe('generateFakePatient', () => {
    it('should generate a fake patient with default options', () => {
      const patient = generateFakePatient();
      
      expect(patient).toHaveProperty('_id');
      expect(patient).toHaveProperty('firstName');
      expect(patient).toHaveProperty('lastName');
      expect(patient).toHaveProperty('email');
      expect(patient).toHaveProperty('phoneNumber');
      expect(patient).toHaveProperty('dateOfBirth');
      expect(patient).toHaveProperty('gender');
      expect(patient).toHaveProperty('address');
      expect(patient).toHaveProperty('emergencyContact');
      expect(patient).toHaveProperty('medicalConditions');
      expect(Array.isArray(patient.medicalConditions)).toBe(true);
      expect(patient.medicalConditions.length).toBeGreaterThan(0);
    });
    
    it('should generate a patient with specific gender', () => {
      const patient = generateFakePatient({ gender: 'female' });
      expect(patient.gender).toBe('female');
    });
    
    it('should generate a patient with specific email', () => {
      const email = 'test.patient@example.com';
      const patient = generateFakePatient({ email });
      expect(patient.email).toBe(email);
    });
  });
  
  describe('generateMedicalRecord', () => {
    it('should generate a medical record for a patient', () => {
      const patient = generateFakePatient();
      const record = generateMedicalRecord(patient);
      
      expect(record).toHaveProperty('_id');
      expect(record).toHaveProperty('patientId');
      expect(record.patientId).toEqual(patient._id);
      expect(record).toHaveProperty('recordType');
      expect(record).toHaveProperty('date');
      expect(record).toHaveProperty('provider');
      expect(record).toHaveProperty('chiefComplaint');
      expect(record).toHaveProperty('vitalSigns');
      expect(record).toHaveProperty('assessment');
      expect(record).toHaveProperty('plan');
      expect(record).toHaveProperty('medications');
    });
  });
  
  describe('generatePrescription', () => {
    it('should generate a prescription for a patient and doctor', () => {
      const patient = generateFakePatient();
      const doctor = {
        _id: new mongoose.Types.ObjectId(),
        firstName: 'Test',
        lastName: 'Doctor',
        specialty: 'Family Medicine'
      };
      
      const prescription = generatePrescription(patient, doctor);
      
      expect(prescription).toHaveProperty('_id');
      expect(prescription).toHaveProperty('patientId');
      expect(prescription.patientId).toEqual(patient._id);
      expect(prescription).toHaveProperty('doctorId');
      expect(prescription.doctorId).toEqual(doctor._id);
      expect(prescription).toHaveProperty('date');
      expect(prescription).toHaveProperty('status');
      expect(prescription).toHaveProperty('medications');
      expect(prescription).toHaveProperty('pharmacy');
      expect(prescription).toHaveProperty('instructions');
    });
  });
  
  describe('generateFakePatientBatch', () => {
    it('should generate multiple patients', () => {
      const count = 5;
      const { patients } = generateFakePatientBatch(count);
      
      expect(Array.isArray(patients)).toBe(true);
      expect(patients.length).toBe(count);
    });
    
    it('should generate patients with medical records', () => {
      const { patients, medicalRecords } = generateFakePatientBatch(3, true);
      
      expect(Array.isArray(patients)).toBe(true);
      expect(patients.length).toBe(3);
      expect(Array.isArray(medicalRecords)).toBe(true);
      expect(medicalRecords.length).toBeGreaterThan(0);
    });
    
    it('should generate patients with prescriptions', () => {
      const { patients, prescriptions } = generateFakePatientBatch(3, false, true);
      
      expect(Array.isArray(patients)).toBe(true);
      expect(patients.length).toBe(3);
      expect(Array.isArray(prescriptions)).toBe(true);
      expect(prescriptions.length).toBeGreaterThan(0);
    });
  });
});
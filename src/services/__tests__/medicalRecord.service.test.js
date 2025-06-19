// src/services/__tests__/medicalRecord.service.test.js
/**
 * Unit tests for medical record service
 * 
 * Tests verify that access control to medical records is properly enforced
 * based on user roles and relationships.
 */

const medicalRecordService = require('../../services/medicalRecord.service');
const { MedicalRecord, User, Patient, Doctor } = require('../../models');
const { AccessDeniedError } = require('../../errors');

// Mock models and authentication helper
jest.mock('../../models', () => ({
  MedicalRecord: {
    findById: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn()
  },
  User: {
    findById: jest.fn()
  },
  Patient: {
    findById: jest.fn()
  },
  Doctor: {
    findById: jest.fn()
  }
}));

jest.mock('../../utils/auth-helper', () => ({
  checkPermission: jest.fn()
}));

describe('Medical Record Service - Access Control', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  describe('getMedicalRecord', () => {
    test('should allow access to patient viewing their own record', async () => {
      // Arrange
      const recordId = 'record123';
      const userId = 'user123';
      const patientId = 'patient123';
      
      const mockRecord = {
        _id: recordId,
        patientId: patientId,
        type: 'Lab Result',
        content: 'Blood test results',
        date: '2025-06-15'
      };
      
      const mockUser = {
        _id: userId,
        role: 'patient',
        patientId: patientId
      };
      
      // Mock implementations
      MedicalRecord.findById.mockResolvedValue(mockRecord);
      User.findById.mockResolvedValue(mockUser);
      
      // Act
      const result = await medicalRecordService.getMedicalRecord(recordId, userId);
      
      // Assert
      expect(result).toEqual(mockRecord);
      expect(MedicalRecord.findById).toHaveBeenCalledWith(recordId);
    });
    
    test('should allow access to doctor treating the patient', async () => {
      // Arrange
      const recordId = 'record123';
      const userId = 'user456';
      const doctorId = 'doctor456';
      const patientId = 'patient123';
      
      const mockRecord = {
        _id: recordId,
        patientId: patientId,
        type: 'Lab Result',
        content: 'Blood test results',
        date: '2025-06-15'
      };
      
      const mockUser = {
        _id: userId,
        role: 'doctor',
        doctorId: doctorId
      };
      
      const mockPatient = {
        _id: patientId,
        primaryDoctor: doctorId,
        careTeam: [doctorId]
      };
      
      // Mock implementations
      MedicalRecord.findById.mockResolvedValue(mockRecord);
      User.findById.mockResolvedValue(mockUser);
      Patient.findById.mockResolvedValue(mockPatient);
      
      // Act
      const result = await medicalRecordService.getMedicalRecord(recordId, userId);
      
      // Assert
      expect(result).toEqual(mockRecord);
    });
    
    test('should deny access to unauthorized users', async () => {
      // Arrange
      const recordId = 'record123';
      const userId = 'user789';
      const doctorId = 'doctor789';
      const patientId = 'patient123';
      
      const mockRecord = {
        _id: recordId,
        patientId: patientId,
        type: 'Lab Result',
        content: 'Blood test results',
        date: '2025-06-15'
      };
      
      const mockUser = {
        _id: userId,
        role: 'doctor',
        doctorId: doctorId
      };
      
      const mockPatient = {
        _id: patientId,
        primaryDoctor: 'doctor456',
        careTeam: ['doctor456', 'doctor123']
      };
      
      // Mock implementations
      MedicalRecord.findById.mockResolvedValue(mockRecord);
      User.findById.mockResolvedValue(mockUser);
      Patient.findById.mockResolvedValue(mockPatient);
      
      // Act & Assert
      await expect(medicalRecordService.getMedicalRecord(recordId, userId))
        .rejects.toThrow(AccessDeniedError);
    });
  });
});
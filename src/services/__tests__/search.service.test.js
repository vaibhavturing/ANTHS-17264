// src/services/__tests__/search.service.test.js
/**
 * Unit tests for search service
 * 
 * Tests verify that search functionality properly filters results
 * based on query parameters and user access levels.
 */

const searchService = require('../../services/search.service');
const { MedicalRecord, Patient, User } = require('../../models');

// Mock the models
jest.mock('../../models', () => ({
  MedicalRecord: {
    find: jest.fn(),
    aggregate: jest.fn()
  },
  Patient: {
    find: jest.fn()
  },
  User: {
    findById: jest.fn()
  },
  ClinicalNote: {
    find: jest.fn()
  }
}));

jest.mock('../../utils/auth-helper', () => ({
  checkPermission: jest.fn()
}));

describe('Search Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('searchMedicalRecords', () => {
    test('should filter records by type correctly', async () => {
      // Arrange
      const userId = 'user123';
      const doctorId = 'doctor123';
      const searchParams = {
        query: 'diabetes',
        recordType: 'Lab Result'
      };
      
      const mockUser = {
        _id: userId,
        role: 'doctor',
        doctorId: doctorId
      };
      
      const mockPatients = [
        { _id: 'patient1', primaryDoctor: doctorId },
        { _id: 'patient2', primaryDoctor: doctorId }
      ];
      
      const mockRecords = [
        { _id: 'record1', patientId: 'patient1', type: 'Lab Result', content: 'Diabetes test results' },
        { _id: 'record2', patientId: 'patient1', type: 'Lab Result', content: 'Cholesterol test' }
      ];
      
      // Mock implementations
      User.findById.mockResolvedValue(mockUser);
      Patient.find.mockResolvedValue(mockPatients);
      MedicalRecord.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockRecords)
        })
      });
      MedicalRecord.aggregate.mockResolvedValue([{ count: 2 }]);
      
      // Act
      const result = await searchService.searchMedicalRecords(searchParams, userId);
      
      // Assert
      expect(result.records).toEqual(mockRecords);
      expect(result.total).toBe(2);
      expect(MedicalRecord.find).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: { $in: ['patient1', 'patient2'] },
          type: 'Lab Result',
          $text: { $search: 'diabetes' }
        })
      );
    });
    
    test('should filter records by date range correctly', async () => {
      // Arrange
      const userId = 'user123';
      const doctorId = 'doctor123';
      const searchParams = {
        query: '',
        startDate: '2025-01-01',
        endDate: '2025-06-19'
      };
      
      const mockUser = {
        _id: userId,
        role: 'doctor',
        doctorId: doctorId
      };
      
      const mockPatients = [
        { _id: 'patient1', primaryDoctor: doctorId }
      ];
      
      const mockRecords = [
        { _id: 'record1', patientId: 'patient1', date: '2025-03-15', content: 'Test results' }
      ];
      
      // Mock implementations
      User.findById.mockResolvedValue(mockUser);
      Patient.find.mockResolvedValue(mockPatients);
      MedicalRecord.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockRecords)
        })
      });
      MedicalRecord.aggregate.mockResolvedValue([{ count: 1 }]);
      
      // Act
      const result = await searchService.searchMedicalRecords(searchParams, userId);
      
      // Assert
      expect(result.records).toEqual(mockRecords);
      expect(MedicalRecord.find).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: { $in: ['patient1'] },
          date: { 
            $gte: new Date('2025-01-01'), 
            $lte: new Date('2025-06-19') 
          }
        })
      );
    });
    
    test('should limit search results by user access level', async () => {
      // Arrange
      const userId = 'user789';
      const searchParams = {
        query: 'diabetes'
      };
      
      const mockUser = {
        _id: userId,
        role: 'nurse',
        departmentId: 'dept1'
      };
      
      const mockPatients = [
        { _id: 'patient3', assignedDepartments: ['dept1'] }
      ];
      
      const mockRecords = [
        { _id: 'record3', patientId: 'patient3', content: 'Diabetes monitoring' }
      ];
      
      // Mock implementations
      User.findById.mockResolvedValue(mockUser);
      Patient.find.mockResolvedValue(mockPatients);
      MedicalRecord.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockRecords)
        })
      });
      MedicalRecord.aggregate.mockResolvedValue([{ count: 1 }]);
      
      // Act
      const result = await searchService.searchMedicalRecords(searchParams, userId);
      
      // Assert
      expect(result.records).toEqual(mockRecords);
      expect(Patient.find).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedDepartments: 'dept1'
        })
      );
      expect(MedicalRecord.find).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: { $in: ['patient3'] }
        })
      );
    });
  });
});
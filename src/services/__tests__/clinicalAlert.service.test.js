// src/services/__tests__/clinicalAlert.service.test.js
/**
 * Unit tests for clinical alert service
 * 
 * Tests verify that the system correctly generates clinical alerts
 * based on patient data and best practice guidelines.
 */

const clinicalAlertService = require('../../services/clinicalAlert.service');
const { Patient, ClinicalAlert, UserAlertPreference } = require('../../models');

// Mock models
jest.mock('../../models', () => ({
  Patient: {
    findById: jest.fn()
  },
  ClinicalAlert: {
    find: jest.fn()
  },
  UserAlertPreference: {
    findOne: jest.fn()
  }
}));

describe('Clinical Alert Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('generateAlertsForPatient', () => {
    test('should generate diabetes care alerts for diabetic patients', async () => {
      // Arrange
      const patientId = 'patient123';
      const userId = 'doctor456';
      
      // Mock patient with diabetes diagnosis
      const mockPatient = {
        _id: patientId,
        diagnoses: [
          { condition: 'Type 2 Diabetes Mellitus', dateHappened: '2024-01-15', status: 'active' }
        ],
        labs: [
          { name: 'HbA1c', value: 8.5, date: '2025-05-20' }
        ],
        lastEyeExam: '2024-06-01',
        lastFootExam: null
      };
      
      // Mock alert guidelines
      const mockAlerts = [
        {
          _id: 'alert1',
          condition: 'Type 2 Diabetes Mellitus',
          triggerCriteria: {
            type: 'lab',
            name: 'HbA1c',
            operator: '>',
            value: 8.0
          },
          recommendation: 'Consider medication adjustment for better glycemic control',
          severity: 'medium'
        },
        {
          _id: 'alert2',
          condition: 'Type 2 Diabetes Mellitus',
          triggerCriteria: {
            type: 'exam',
            name: 'footExam',
            operator: 'missing',
            timePeriod: '12months'
          },
          recommendation: 'Schedule comprehensive foot examination',
          severity: 'high'
        }
      ];
      
      // Mock user has no muted alerts
      const mockPreferences = {
        userId,
        mutedAlerts: []
      };
      
      // Mock implementations
      Patient.findById.mockResolvedValue(mockPatient);
      ClinicalAlert.find.mockResolvedValue(mockAlerts);
      UserAlertPreference.findOne.mockResolvedValue(mockPreferences);
      
      // Act
      const result = await clinicalAlertService.generateAlertsForPatient(patientId, userId);
      
      // Assert
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(expect.objectContaining({
        alertId: 'alert1',
        severity: 'medium',
        recommendation: 'Consider medication adjustment for better glycemic control'
      }));
      expect(result).toContainEqual(expect.objectContaining({
        alertId: 'alert2',
        severity: 'high',
        recommendation: 'Schedule comprehensive foot examination'
      }));
    });
    
    test('should not show alerts that have been muted by the user', async () => {
      // Arrange
      const patientId = 'patient123';
      const userId = 'doctor456';
      
      // Mock patient with diabetes diagnosis
      const mockPatient = {
        _id: patientId,
        diagnoses: [
          { condition: 'Type 2 Diabetes Mellitus', dateHappened: '2024-01-15', status: 'active' }
        ],
        labs: [
          { name: 'HbA1c', value: 8.5, date: '2025-05-20' }
        ]
      };
      
      // Mock alert guidelines
      const mockAlerts = [
        {
          _id: 'alert1',
          condition: 'Type 2 Diabetes Mellitus',
          triggerCriteria: {
            type: 'lab',
            name: 'HbA1c',
            operator: '>',
            value: 8.0
          },
          recommendation: 'Consider medication adjustment for better glycemic control',
          severity: 'medium'
        }
      ];
      
      // Mock user has muted the alert
      const mockPreferences = {
        userId,
        mutedAlerts: ['alert1']
      };
      
      // Mock implementations
      Patient.findById.mockResolvedValue(mockPatient);
      ClinicalAlert.find.mockResolvedValue(mockAlerts);
      UserAlertPreference.findOne.mockResolvedValue(mockPreferences);
      
      // Act
      const result = await clinicalAlertService.generateAlertsForPatient(patientId, userId);
      
      // Assert
      expect(result).toHaveLength(0);
    });
    
    test('should identify preventative care opportunities', async () => {
      // Arrange
      const patientId = 'patient123';
      const userId = 'doctor456';
      
      // Mock elderly patient
      const mockPatient = {
        _id: patientId,
        dateOfBirth: '1950-05-15', // 75 years old
        immunizations: [
          { type: 'Influenza', date: '2024-01-10' }
        ],
        // No pneumococcal vaccine
      };
      
      // Mock preventative care alert
      const mockAlerts = [
        {
          _id: 'alert3',
          condition: 'Age > 65',
          triggerCriteria: {
            type: 'immunization',
            name: 'Pneumococcal',
            operator: 'missing'
          },
          recommendation: 'Consider pneumococcal vaccination',
          severity: 'medium',
          evidence: 'CDC guidelines recommend pneumococcal vaccination for all adults 65 and older'
        }
      ];
      
      // Mock user preferences
      const mockPreferences = {
        userId,
        mutedAlerts: []
      };
      
      // Mock implementations
      Patient.findById.mockResolvedValue(mockPatient);
      ClinicalAlert.find.mockResolvedValue(mockAlerts);
      UserAlertPreference.findOne.mockResolvedValue(mockPreferences);
      
      // Act
      const result = await clinicalAlertService.generateAlertsForPatient(patientId, userId);
      
      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        alertId: 'alert3',
        severity: 'medium',
        recommendation: 'Consider pneumococcal vaccination',
        evidence: expect.any(String)
      });
    });
  });
});
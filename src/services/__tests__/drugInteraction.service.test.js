// src/services/__tests__/drugInteraction.service.test.js
/**
 * Unit tests for drug interaction service 
 * 
 * Tests verify that the system correctly identifies drug interactions
 * and provides appropriate warning levels.
 */

const drugInteractionService = require('../../services/drugInteraction.service');
const { Medication, Patient } = require('../../models');

// Mock the models to isolate the service functionality
jest.mock('../../models', () => ({
  Medication: {
    findById: jest.fn(),
    find: jest.fn()
  },
  Patient: {
    findById: jest.fn()
  }
}));

describe('Drug Interaction Service', () => {
  beforeEach(() => {
    // Clear all mock implementations and calls before each test
    jest.clearAllMocks();
  });

  describe('checkInteractions', () => {
    test('should identify severe drug interactions', async () => {
      // Arrange
      const patientId = 'patient123';
      const newMedicationId = 'med789';
      
      // Mock patient's current medications
      Patient.findById.mockResolvedValue({
        _id: patientId,
        currentMedications: [
          { medicationId: 'med456', dosage: '10mg', frequency: 'daily' }
        ]
      });
      
      // Mock medication data for current medication
      Medication.findById.mockResolvedValueOnce({
        _id: 'med456',
        name: 'Warfarin',
        interactionsList: ['med789']
      });
      
      // Mock medication data for new medication
      Medication.findById.mockResolvedValueOnce({
        _id: 'med789',
        name: 'Aspirin',
        interactionsList: ['med456'],
        interactionSeverity: {
          'med456': 'severe'
        }
      });
      
      // Act
      const result = await drugInteractionService.checkInteractions(patientId, newMedicationId);
      
      // Assert
      expect(result).toEqual({
        hasInteractions: true,
        interactions: [{
          medicationId: 'med456',
          medicationName: 'Warfarin',
          severity: 'severe',
          description: expect.any(String)
        }]
      });
    });
    
    test('should return no interactions when medications are compatible', async () => {
      // Arrange
      const patientId = 'patient123';
      const newMedicationId = 'med789';
      
      // Mock patient's current medications
      Patient.findById.mockResolvedValue({
        _id: patientId,
        currentMedications: [
          { medicationId: 'med456', dosage: '10mg', frequency: 'daily' }
        ]
      });
      
      // Mock medication data for current medication
      Medication.findById.mockResolvedValueOnce({
        _id: 'med456',
        name: 'Lisinopril',
        interactionsList: []
      });
      
      // Mock medication data for new medication
      Medication.findById.mockResolvedValueOnce({
        _id: 'med789',
        name: 'Metformin',
        interactionsList: []
      });
      
      // Act
      const result = await drugInteractionService.checkInteractions(patientId, newMedicationId);
      
      // Assert
      expect(result).toEqual({
        hasInteractions: false,
        interactions: []
      });
    });
    
    test('should check for allergic reactions', async () => {
      // Arrange
      const patientId = 'patient123';
      const newMedicationId = 'med789';
      
      // Mock patient's allergies
      Patient.findById.mockResolvedValue({
        _id: patientId,
        allergies: ['penicillin'],
        currentMedications: []
      });
      
      // Mock medication containing allergen
      Medication.findById.mockResolvedValue({
        _id: 'med789',
        name: 'Amoxicillin',
        classification: 'penicillin',
        ingredients: ['amoxicillin trihydrate']
      });
      
      // Act
      const result = await drugInteractionService.checkInteractions(patientId, newMedicationId);
      
      // Assert
      expect(result).toEqual({
        hasInteractions: true,
        interactions: [{
          type: 'allergy',
          allergen: 'penicillin',
          severity: 'high',
          description: expect.any(String)
        }]
      });
    });
  });
});
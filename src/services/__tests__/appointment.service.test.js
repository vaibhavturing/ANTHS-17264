// src/services/__tests__/appointment.service.test.js
/**
 * Unit tests for appointment service focusing on scheduling logic
 * 
 * Tests verify that the system correctly prevents double bookings and
 * handles scheduling conflicts appropriately.
 */

const appointmentService = require('../../services/appointment.service');
const { Appointment, Doctor } = require('../../models');

// Mock the models to isolate the service functionality
jest.mock('../../models', () => ({
  Appointment: {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn()
  },
  Doctor: {
    findById: jest.fn()
  }
}));

describe('Appointment Service - Scheduling Logic', () => {
  beforeEach(() => {
    // Clear all mock implementations and calls before each test
    jest.clearAllMocks();
  });

  describe('createAppointment', () => {
    test('should create appointment when no scheduling conflict exists', async () => {
      // Arrange
      const newAppointment = {
        doctorId: 'doctor123',
        patientId: 'patient123',
        date: '2025-06-20',
        startTime: '10:00',
        endTime: '10:30',
        status: 'scheduled',
        reason: 'Annual checkup'
      };
      
      // Mock: No existing appointments in the time slot
      Appointment.find.mockResolvedValue([]);
      Doctor.findById.mockResolvedValue({ 
        availability: [{ day: 'Friday', startTime: '09:00', endTime: '17:00' }] 
      });
      Appointment.create.mockResolvedValue(newAppointment);
      
      // Act
      const result = await appointmentService.createAppointment(newAppointment);
      
      // Assert
      expect(Appointment.find).toHaveBeenCalled();
      expect(Appointment.create).toHaveBeenCalledWith(newAppointment);
      expect(result).toEqual(newAppointment);
    });
    
    test('should reject appointment when a scheduling conflict exists', async () => {
      // Arrange
      const newAppointment = {
        doctorId: 'doctor123',
        patientId: 'patient123',
        date: '2025-06-20',
        startTime: '10:00',
        endTime: '10:30',
        status: 'scheduled',
        reason: 'Annual checkup'
      };
      
      // Mock: Existing appointment in the same time slot
      Appointment.find.mockResolvedValue([{
        doctorId: 'doctor123',
        patientId: 'patient456',
        date: '2025-06-20',
        startTime: '10:00',
        endTime: '10:30',
        status: 'scheduled'
      }]);
      Doctor.findById.mockResolvedValue({ 
        availability: [{ day: 'Friday', startTime: '09:00', endTime: '17:00' }] 
      });
      
      // Act & Assert
      await expect(appointmentService.createAppointment(newAppointment))
        .rejects.toThrow('Appointment time slot is already booked');
      expect(Appointment.create).not.toHaveBeenCalled();
    });
    
    test('should reject appointment when outside doctor availability', async () => {
      // Arrange
      const newAppointment = {
        doctorId: 'doctor123',
        patientId: 'patient123',
        date: '2025-06-21', // Saturday
        startTime: '10:00',
        endTime: '10:30',
        status: 'scheduled',
        reason: 'Annual checkup'
      };
      
      // Mock: No existing appointments, but doctor not available on Saturday
      Appointment.find.mockResolvedValue([]);
      Doctor.findById.mockResolvedValue({ 
        availability: [
          { day: 'Monday', startTime: '09:00', endTime: '17:00' },
          { day: 'Friday', startTime: '09:00', endTime: '17:00' }
        ] 
      });
      
      // Act & Assert
      await expect(appointmentService.createAppointment(newAppointment))
        .rejects.toThrow('Doctor is not available at this time');
      expect(Appointment.create).not.toHaveBeenCalled();
    });
  });
});
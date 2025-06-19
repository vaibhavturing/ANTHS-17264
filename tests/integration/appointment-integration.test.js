// src/tests/integration/appointment-integration.test.js
/**
 * Integration test for appointment booking workflow
 * 
 * Tests verify that booking an appointment properly updates:
 * 1. The appointment database
 * 2. The doctor's calendar
 * 3. The patient's appointment list
 * 4. Any related notification systems
 */

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../app');
const { 
  Appointment, 
  Doctor, 
  Patient, 
  User, 
  Notification 
} = require('../../models');
const { generateAuthToken } = require('../utils/test-auth-helper');
const { setupTestDatabase, teardownTestDatabase } = require('../utils/test-db-setup');

describe('Appointment Integration', () => {
  let doctorUser, patientUser, doctorId, patientId, doctorToken, patientToken;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create test users and related entities
    doctorUser = await User.create({
      email: 'doctor@example.com',
      password: 'hashedPassword123',
      firstName: 'Dr.',
      lastName: 'Test',
      role: 'doctor'
    });
    
    patientUser = await User.create({
      email: 'patient@example.com',
      password: 'hashedPassword456',
      firstName: 'Patient',
      lastName: 'Test',
      role: 'patient'
    });
    
    doctorId = (await Doctor.create({
      userId: doctorUser._id,
      specialty: 'Family Medicine',
      licenseNumber: 'TEST12345',
      availability: [
        { day: 'Monday', startTime: '09:00', endTime: '17:00' }
      ]
    }))._id;
    
    doctorUser.doctorId = doctorId;
    await doctorUser.save();
    
    patientId = (await Patient.create({
      userId: patientUser._id,
      dateOfBirth: '1980-01-01',
      gender: 'female',
      primaryDoctor: doctorId
    }))._id;
    
    patientUser.patientId = patientId;
    await patientUser.save();
    
    // Generate authentication tokens
    doctorToken = await generateAuthToken(doctorUser);
    patientToken = await generateAuthToken(patientUser);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });
  
  afterEach(async () => {
    // Clean appointments and notifications between tests
    await Appointment.deleteMany({});
    await Notification.deleteMany({});
  });

  describe('Appointment Booking Workflow', () => {
    test('should create appointment and update related systems', async () => {
      // Arrange
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + ((8 - appointmentDate.getDay()) % 7 || 7)); // Next Monday
      
      const appointmentData = {
        doctorId: doctorId.toString(),
        patientId: patientId.toString(),
        date: appointmentDate.toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '10:30',
        status: 'scheduled',
        reason: 'Annual checkup',
        notes: 'First visit'
      };
      
      // Act
      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(appointmentData)
        .expect(201);
      
      // Assert - Verify appointment was created
      expect(response.body).toMatchObject({
        doctorId: doctorId.toString(),
        patientId: patientId.toString(),
        status: 'scheduled',
        reason: 'Annual checkup'
      });
      
      const appointmentId = response.body._id;
      
      // Verify appointment exists in database
      const savedAppointment = await Appointment.findById(appointmentId);
      expect(savedAppointment).toBeTruthy();
      expect(savedAppointment.status).toBe('scheduled');
      
      // Verify doctor calendar was updated
      const doctorResponse = await request(app)
        .get(`/api/doctors/${doctorId}/appointments`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);
      
      expect(doctorResponse.body.appointments).toContainEqual(
        expect.objectContaining({
          _id: appointmentId,
          patientId: patientId.toString()
        })
      );
      
      // Verify patient appointments were updated
      const patientResponse = await request(app)
        .get(`/api/patients/${patientId}/appointments`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      expect(patientResponse.body.appointments).toContainEqual(
        expect.objectContaining({
          _id: appointmentId,
          doctorId: doctorId.toString()
        })
      );
      
      // Verify notifications were created
      const doctorNotifications = await Notification.find({ 
        userId: doctorUser._id,
        relatedTo: 'appointment',
        relatedId: appointmentId
      });
      expect(doctorNotifications).toHaveLength(1);
      
      const patientNotifications = await Notification.find({ 
        userId: patientUser._id,
        relatedTo: 'appointment',
        relatedId: appointmentId
      });
      expect(patientNotifications).toHaveLength(1);
    });
    
    test('should reject double booking and maintain database consistency', async () => {
      // Arrange - Create initial appointment
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + ((8 - appointmentDate.getDay()) % 7 || 7)); // Next Monday
      
      const appointmentData = {
        doctorId: doctorId.toString(),
        patientId: patientId.toString(),
        date: appointmentDate.toISOString().split('T')[0],
        startTime: '11:00',
        endTime: '11:30',
        status: 'scheduled',
        reason: 'Annual checkup'
      };
      
      await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(appointmentData)
        .expect(201);
      
      // Act - Try to create overlapping appointment
      const duplicateAppointmentData = {
        doctorId: doctorId.toString(),
        patientId: patientId.toString(),
        date: appointmentDate.toISOString().split('T')[0],
        startTime: '11:15', // Overlapping time
        endTime: '11:45',
        status: 'scheduled',
        reason: 'Follow-up'
      };
      
      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(duplicateAppointmentData)
        .expect(400);
      
      // Assert - Verify error message
      expect(response.body.message).toContain('already booked');
      
      // Verify only one appointment exists
      const appointments = await Appointment.find({
        doctorId,
        date: appointmentDate.toISOString().split('T')[0]
      });
      expect(appointments).toHaveLength(1);
      expect(appointments[0].startTime).toBe('11:00');
    });
  });

  describe('Appointment Rescheduling', () => {
    test('should update all related systems when an appointment is rescheduled', async () => {
      // Arrange - Create initial appointment
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + ((8 - appointmentDate.getDay()) % 7 || 7)); // Next Monday
      
      const appointmentData = {
        doctorId: doctorId.toString(),
        patientId: patientId.toString(),
        date: appointmentDate.toISOString().split('T')[0],
        startTime: '14:00',
        endTime: '14:30',
        status: 'scheduled',
        reason: 'Consultation'
      };
      
      const createResponse = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(appointmentData)
        .expect(201);
      
      const appointmentId = createResponse.body._id;
      
      // Clear notifications from creation
      await Notification.deleteMany({});
      
      // Act - Reschedule appointment
      const newDate = new Date(appointmentDate);
      newDate.setDate(newDate.getDate() + 1); // Next Tuesday
      
      const rescheduleData = {
        date: newDate.toISOString().split('T')[0],
        startTime: '15:00',
        endTime: '15:30'
      };
      
      await request(app)
        .patch(`/api/appointments/${appointmentId}/reschedule`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(rescheduleData)
        .expect(200);
      
      // Assert - Verify appointment was updated
      const updatedAppointment = await Appointment.findById(appointmentId);
      expect(updatedAppointment.date).toBe(newDate.toISOString().split('T')[0]);
      expect(updatedAppointment.startTime).toBe('15:00');
      
      // Verify notifications were created
      const rescheduledNotifications = await Notification.find({
        relatedTo: 'appointment',
        relatedId: appointmentId,
        message: expect.stringContaining('rescheduled')
      });
      expect(rescheduledNotifications).toHaveLength(2); // One for doctor, one for patient
      
      // Verify doctor calendar was updated
      const doctorResponse = await request(app)
        .get(`/api/doctors/${doctorId}/appointments`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ date: newDate.toISOString().split('T')[0] })
        .expect(200);
      
      expect(doctorResponse.body.appointments).toContainEqual(
        expect.objectContaining({
          _id: appointmentId,
          startTime: '15:00'
        })
      );
    });
  });

  describe('Appointment Cancellation', () => {
    test('should properly update all systems when an appointment is cancelled', async () => {
      // Arrange - Create initial appointment
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + ((8 - appointmentDate.getDay()) % 7 || 7)); // Next Monday
      
      const appointmentData = {
        doctorId: doctorId.toString(),
        patientId: patientId.toString(),
        date: appointmentDate.toISOString().split('T')[0],
        startTime: '15:30',
        endTime: '16:00',
        status: 'scheduled',
        reason: 'Follow-up'
      };
      
      const createResponse = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(appointmentData)
        .expect(201);
      
      const appointmentId = createResponse.body._id;
      
      // Clear notifications from creation
      await Notification.deleteMany({});
      
      // Act - Cancel appointment
      const cancelData = {
        cancellationReason: 'Patient request',
        cancelledBy: 'patient'
      };
      
      await request(app)
        .patch(`/api/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(cancelData)
        .expect(200);
      
      // Assert - Verify appointment status updated
      const updatedAppointment = await Appointment.findById(appointmentId);
      expect(updatedAppointment.status).toBe('cancelled');
      expect(updatedAppointment.cancellationReason).toBe('Patient request');
      
      // Verify notifications were created
      const cancelledNotifications = await Notification.find({
        relatedTo: 'appointment',
        relatedId: appointmentId,
        message: expect.stringContaining('cancelled')
      });
      expect(cancelledNotifications).toHaveLength(2); // One for doctor, one for patient
      
      // Verify doctor calendar shows cancelled
      const doctorResponse = await request(app)
        .get(`/api/doctors/${doctorId}/appointments`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .query({ 
          date: appointmentDate.toISOString().split('T')[0],
          includeStatus: 'all'
        })
        .expect(200);
      
      const cancelledAppointment = doctorResponse.body.appointments.find(
        app => app._id === appointmentId
      );
      expect(cancelledAppointment.status).toBe('cancelled');
      
      // Verify time slot is now available for booking again
      const newAppointmentData = {
        doctorId: doctorId.toString(),
        patientId: patientId.toString(),
        date: appointmentDate.toISOString().split('T')[0],
        startTime: '15:30', // Same time as cancelled appointment
        endTime: '16:00',
        status: 'scheduled',
        reason: 'Urgent care'
      };
      
      await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(newAppointmentData)
        .expect(201); // Should succeed since previous one was cancelled
    });
  });
});
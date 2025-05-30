/**
 * Healthcare Management Application
 * Model Index File
 * 
 * Exports all models for easy importing throughout the application
 */

const { User, ROLES } = require('./user.model');
const { Patient, BLOOD_TYPES } = require('./patient.model');
const { Doctor, SPECIALTIES } = require('./doctor.model');
const { Appointment, APPOINTMENT_STATUS, APPOINTMENT_TYPES } = require('./appointment.model');
const { MedicalRecord, RECORD_TYPES } = require('./medicalRecord.model');

module.exports = {
  User, 
  ROLES,
  Patient,
  BLOOD_TYPES,
  Doctor,
  SPECIALTIES,
  Appointment,
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPES,
  MedicalRecord,
  RECORD_TYPES
};
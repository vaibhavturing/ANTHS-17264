// src/models/index.js
const User = require('./user.model');
const Patient = require('./patient.model');
const Doctor = require('./doctor.model');
const Appointment = require('./appointment.model');
const MedicalRecord = require('./medicalRecord.model');
// const Permission = require('./permission.model');
// const Role = require('./role.model');
const VerificationToken = require('./verification-token.model');
const RefreshToken = require('./refreshToken.model');
const Session = require('./session.model');
const TokenBlacklist = require('./token-blacklist.model');
const ActivityLog = require('./activity-log.model');
const patientProfileVersion = require('./patientProfileVersion.model');
const communication = require('./communication.model');
const notification = require('./notification.model');
const coommunication = require('./communication.model');
const billing = require('./billing.model');
const insurance = require('./insurance.model');
const analytics = require('./analytics.model');
const appointmentType = require('./appointmentType.model');
const schedule = require('./schedule.model');
const availability = require('./availability.model');
const recurringAppointmentSeries = require('./recurringAppointment.model');
/**
 * CHANGES:
 * - Added VerificationToken to the exports
 */
module.exports = {
  User,
  Patient,
  Doctor,
  Appointment,
  TokenBlacklist,
  MedicalRecord,
  Session,
  RefreshToken,
  notification,
  communication,
  ActivityLog,
  patientProfileVersion,
  VerificationToken,
  billing,
  insurance,
  analytics,
  appointmentType,
  schedule,
  availability,
  recurringAppointmentSeries
};
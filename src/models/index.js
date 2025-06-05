// src/models/index.js
const User = require('./user.model');
const Patient = require('./patient.model');
const Doctor = require('./doctor.model');
const Appointment = require('./appointment.model');
const MedicalRecord = require('./medicalRecord.model');
const Permission = require('./permission.model');
const Role = require('./role.model');
const VerificationToken = require('./verification-token.model');
const Patient = require('./patient.model');
const  RefreshToken = require('./refresh-token.model');
const Session = require('./session.model');
const TokenBlacklist = require('./token-blacklist.model');

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
  Permission,
  Session,
  RefreshToken,
  Role,
  VerificationToken
};
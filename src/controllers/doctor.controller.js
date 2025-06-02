/**
 * Doctor Controller
 * Handles all doctor profile and professional information operations
 */

const logger = require('../utils/logger');
const asyncHandler = require('../utils/async-handler.util');
const { success } = require('../utils/response.util');
const Doctor = require('../models/doctor.model');
const Patient = require('../models/patient.model');
const { NotFoundError } = require('../utils/errors/NotFoundError');
const auditLogger = require('../utils/audit-logger');

/**
 * Get all doctors with pagination and filtering
 */
const getDoctors = asyncHandler(async (req, res) => {
  const {
    page = 1, 
    limit = 10, 
    specialty, 
    available,
    search,
    sortBy = 'lastName',
    sortOrder = 'asc'
  } = req.query;

  const skip = (page - 1) * limit;
  const query = { active: true };

  if (specialty) query['professionalDetails.specialties'] = specialty;
  if (available === 'true') query['availability.isAvailable'] = true;

  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { 'contactInformation.email': { $regex: search, $options: 'i' } },
      { 'professionalDetails.title': { $regex: search, $options: 'i' } }
    ];
  }

  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const isAuthenticated = !!req.user;

  const projection = isAuthenticated
    ? {
        password: 0,
        refreshToken: 0,
        'credentials.licenseNumber': 0,
        'credentials.DEANumber': 0
      }
    : {
        firstName: 1,
        lastName: 1,
        professionalDetails: 1,
        availability: 1,
        specialties: 1,
        education: 1,
        profileImage: 1
      };

  const [doctors, total] = await Promise.all([
    Doctor.find(query)
      .select(projection)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ [sortBy]: sortDirection })
      .lean(),
    Doctor.countDocuments(query)
  ]);

  if (isAuthenticated) {
    auditLogger.logDataAccess({
      userId: req.user.id,
      action: 'list',
      resourceType: 'doctor',
      resourceId: 'multiple',
      metadata: {
        filters: { specialty, available, search },
        resultCount: doctors.length
      }
    });
  }

  const totalPages = Math.ceil(total / limit);

  return success(res, {
    doctors,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages
    }
  });
});

/**
 * Get a doctor by ID
 */
const getDoctorById = asyncHandler(async (req, res) => {
  const doctorId = req.params.id;
  const isAuthenticated = !!req.user;

  let projection = {};
  if (!isAuthenticated) {
    projection = {
      firstName: 1,
      lastName: 1,
      professionalDetails: 1,
      availability: 1,
      specialties: 1,
      education: 1,
      profileImage: 1
    };
  } else if (req.user.role === 'admin' || req.user.id === doctorId) {
    projection = {
      password: 0,
      refreshToken: 0
    };
  } else {
    projection = {
      password: 0,
      refreshToken: 0,
      'credentials.licenseNumber': 0,
      'credentials.DEANumber': 0
    };
  }

  const doctor = await Doctor.findById(doctorId)
    .select(projection)
    .lean();

  if (!doctor) throw new NotFoundError('Doctor not found');

  if (isAuthenticated) {
    auditLogger.logDataAccess({
      userId: req.user.id,
      action: 'view',
      resourceType: 'doctor',
      resourceId: doctorId,
      metadata: {
        isDoctorSelf: req.user.id === doctorId
      }
    });
  }

  return success(res, { doctor });
});

/**
 * Get list of specialties
 */
const getSpecialties = asyncHandler(async (req, res) => {
  const specialties = [
    'Cardiology', 'Dermatology', 'Endocrinology', 'Family Medicine',
    'Gastroenterology', 'Hematology', 'Infectious Disease', 'Internal Medicine',
    'Nephrology', 'Neurology', 'Obstetrics and Gynecology', 'Oncology',
    'Ophthalmology', 'Orthopedics', 'Otolaryngology', 'Pediatrics',
    'Psychiatry', 'Pulmonology', 'Radiology', 'Rheumatology', 'Urology'
  ];
  return success(res, { specialties });
});

/**
 * Create a new doctor
 */
const createDoctor = asyncHandler(async (req, res) => {
  const doctor = new Doctor(req.body);
  await doctor.save();

  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'create',
    resourceType: 'doctor',
    resourceId: doctor._id.toString(),
    changes: {
      changedFields: Object.keys(req.body)
    }
  });

  logger.info('New doctor created', { doctorId: doctor._id });
  const doctorResponse = doctor.toObject();
  delete doctorResponse.password;
  delete doctorResponse.refreshToken;

  return success(res, { doctor: doctorResponse }, 201);
});

/**
 * Update a doctor
 */
const updateDoctor = asyncHandler(async (req, res) => {
  const doctorId = req.params.id;
  const updateData = req.body;
  delete updateData.password;
  delete updateData.refreshToken;
  delete updateData.userId;

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new NotFoundError('Doctor not found');

  const previousData = doctor.toObject();
  Object.assign(doctor, updateData);

  doctor.updatedAt = new Date();
  doctor.updatedBy = req.user.id;
  await doctor.save();

  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'update',
    resourceType: 'doctor',
    resourceId: doctorId,
    changes: {
      changedFields: Object.keys(updateData),
      previousData
    }
  });

  logger.info('Doctor updated', { doctorId });
  const doctorResponse = doctor.toObject();
  delete doctorResponse.password;
  delete doctorResponse.refreshToken;

  return success(res, { doctor: doctorResponse });
});

/**
 * Partial update
 */
const partialUpdateDoctor = updateDoctor; // same logic, reused

/**
 * Soft delete
 */
const deleteDoctor = asyncHandler(async (req, res) => {
  const doctorId = req.params.id;
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new NotFoundError('Doctor not found');

  doctor.active = false;
  doctor.deactivatedAt = new Date();
  doctor.deactivatedBy = req.user.id;
  await doctor.save();

  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'delete',
    resourceType: 'doctor',
    resourceId: doctorId
  });

  logger.info('Doctor deactivated', { doctorId });
  return success(res, { message: 'Doctor successfully deleted' });
});

/**
 * Update credentials
 */
const updateDoctorCredentials = asyncHandler(async (req, res) => {
  const doctorId = req.params.id;
  const { credentials } = req.body;

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new NotFoundError('Doctor not found');

  const previousCredentials = doctor.credentials;
  doctor.credentials = credentials;
  doctor.updatedAt = new Date();
  doctor.updatedBy = req.user.id;
  await doctor.save();

  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'update_credentials',
    resourceType: 'doctor',
    resourceId: doctorId,
    changes: {
      previousCredentials,
      newCredentials: credentials,
      requiresVerification: true
    }
  });

  logger.info('Doctor credentials updated', { doctorId });
  const doctorResponse = doctor.toObject();
  delete doctorResponse.password;
  delete doctorResponse.refreshToken;

  return success(res, {
    doctor: doctorResponse,
    message: 'Credentials updated and pending verification'
  });
});

/**
 * Get schedule
 */
const getDoctorSchedule = asyncHandler(async (req, res) => {
  const doctorId = req.params.id;
  const doctor = await Doctor.findById(doctorId)
    .select('availability schedule')
    .lean();
  if (!doctor) throw new NotFoundError('Doctor not found');

  return success(res, {
    availability: doctor.availability,
    schedule: doctor.schedule
  });
});

/**
 * Update schedule
 */
const updateDoctorSchedule = asyncHandler(async (req, res) => {
  const doctorId = req.params.id;
  const { availability, schedule } = req.body;

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new NotFoundError('Doctor not found');

  const previousAvailability = doctor.availability;
  const previousSchedule = doctor.schedule;

  if (availability) doctor.availability = availability;
  if (schedule) doctor.schedule = schedule;

  doctor.updatedAt = new Date();
  doctor.updatedBy = req.user.id;
  await doctor.save();

  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'update_schedule',
    resourceType: 'doctor',
    resourceId: doctorId,
    changes: {
      previousAvailability,
      newAvailability: availability,
      previousSchedule,
      newSchedule: schedule
    }
  });

  logger.info('Doctor schedule updated', { doctorId });

  return success(res, {
    availability: doctor.availability,
    schedule: doctor.schedule
  });
});

/**
 * Get doctor’s assigned patients
 */
const getDoctorPatients = asyncHandler(async (req, res) => {
  const doctorId = req.params.id;
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new NotFoundError('Doctor not found');

  const [patients, total] = await Promise.all([
    Patient.find({ assignedDoctors: doctorId })
      .select('firstName lastName dateOfBirth gender medicalInformation.patientId')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ lastName: 1, firstName: 1 })
      .lean(),
    Patient.countDocuments({ assignedDoctors: doctorId })
  ]);

  auditLogger.logDataAccess({
    userId: req.user.id,
    action: 'list',
    resourceType: 'doctor_patients',
    resourceId: doctorId,
    metadata: { patientCount: patients.length }
  });

  const totalPages = Math.ceil(total / limit);

  return success(res, {
    patients,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages
    }
  });
});

module.exports = {
  getDoctors,
  getDoctorById,
  getSpecialties,
  createDoctor,
  updateDoctor,
  partialUpdateDoctor,
  deleteDoctor,
  updateDoctorCredentials,
  getDoctorSchedule,
  updateDoctorSchedule,
  getDoctorPatients
};

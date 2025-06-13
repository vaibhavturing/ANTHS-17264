const appointmentTypeService = require('../services/appointmentType.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const logger = require('../utils/logger');

/**
 * Controller for appointment type operations
 */
const appointmentTypeController = {
  /**
   * Create a new appointment type
   * @route POST /api/appointment-types
   */
  createAppointmentType: asyncHandler(async (req, res) => {
    const appointmentType = await appointmentTypeService.createAppointmentType(req.body);
    return ResponseUtil.success(res, { appointmentType }, 201);
  }),

  /**
   * Get all appointment types
   * @route GET /api/appointment-types
   */
  getAllAppointmentTypes: asyncHandler(async (req, res) => {
    const filter = {};
    
    // Apply filters if provided
    if (req.query.isActive) {
      filter.isActive = req.query.isActive === 'true';
    }
    
    if (req.query.isVirtual) {
      filter.isVirtual = req.query.isVirtual === 'true';
    }
    
    if (req.query.specialty) {
      filter.specialties = req.query.specialty;
    }
    
    const appointmentTypes = await appointmentTypeService.getAllAppointmentTypes(filter);
    return ResponseUtil.success(res, { appointmentTypes });
  }),

  /**
   * Get appointment type by ID
   * @route GET /api/appointment-types/:id
   */
  getAppointmentTypeById: asyncHandler(async (req, res) => {
    const appointmentType = await appointmentTypeService.getAppointmentTypeById(req.params.id);
    return ResponseUtil.success(res, { appointmentType });
  }),

  /**
   * Update appointment type
   * @route PUT /api/appointment-types/:id
   */
  updateAppointmentType: asyncHandler(async (req, res) => {
    const updatedAppointmentType = await appointmentTypeService.updateAppointmentType(
      req.params.id,
      req.body
    );
    return ResponseUtil.success(res, { appointmentType: updatedAppointmentType });
  }),

  /**
   * Delete appointment type
   * @route DELETE /api/appointment-types/:id
   */
  deleteAppointmentType: asyncHandler(async (req, res) => {
    await appointmentTypeService.deleteAppointmentType(req.params.id);
    return ResponseUtil.success(res, { message: 'Appointment type deleted successfully' });
  }),

  /**
   * Get appointment types for a specific doctor
   * @route GET /api/doctors/:doctorId/appointment-types
   */
  getAppointmentTypesForDoctor: asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    const activeOnly = req.query.activeOnly !== 'false'; // Default to true
    
    const appointmentTypes = await appointmentTypeService.getAppointmentTypesForDoctor(
      doctorId,
      activeOnly
    );
    
    return ResponseUtil.success(res, { appointmentTypes });
  }),

  /**
   * Update doctor-specific settings for an appointment type
   * @route PUT /api/appointment-types/:id/doctor-settings/:doctorId
   */
  updateDoctorSettings: asyncHandler(async (req, res) => {
    const { id, doctorId } = req.params;
    const settings = req.body;
    
    const updatedAppointmentType = await appointmentTypeService.updateDoctorSettings(
      id,
      doctorId,
      settings
    );
    
    return ResponseUtil.success(res, { 
      message: 'Doctor settings updated successfully',
      appointmentType: updatedAppointmentType
    });
  })
};

module.exports = appointmentTypeController;
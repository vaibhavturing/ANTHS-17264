const appointmentTypeService = require('../services/appointmentType.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const { ValidationError } = require('../utils/errors');
const appointmentTypeValidator = require('../validators/appointmentType.validator');

/**
 * Controller for appointment type operations in the Healthcare Management Application
 */
const appointmentTypeController = {
  /**
   * Create a new appointment type
   * @route POST /api/appointment-types
   * @access Private (Admin)
   */
  createAppointmentType: asyncHandler(async (req, res) => {
    // Validate request data
    const { error, value } = appointmentTypeValidator.create.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid appointment type data', error.details);
    }
    
    const appointmentType = await appointmentTypeService.createAppointmentType(value);
    
    return ResponseUtil.success(res, { 
      message: 'Appointment type created successfully',
      appointmentType 
    }, 201);
  }),
  
  /**
   * Get all appointment types
   * @route GET /api/appointment-types
   * @access Private
   */
  getAppointmentTypes: asyncHandler(async (req, res) => {
    // Extract filter parameters
    const filters = {};
    
    // Allow filtering by active status
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }
    
    const appointmentTypes = await appointmentTypeService.getAppointmentTypes(filters);
    
    return ResponseUtil.success(res, { 
      count: appointmentTypes.length,
      appointmentTypes 
    });
  }),
  
  /**
   * Get appointment type by ID
   * @route GET /api/appointment-types/:id
   * @access Private
   */
  getAppointmentTypeById: asyncHandler(async (req, res) => {
    const appointmentType = await appointmentTypeService.getAppointmentTypeById(req.params.id);
    
    return ResponseUtil.success(res, { appointmentType });
  }),
  
  /**
   * Update appointment type
   * @route PUT /api/appointment-types/:id
   * @access Private (Admin)
   */
  updateAppointmentType: asyncHandler(async (req, res) => {
    // Validate request data
    const { error, value } = appointmentTypeValidator.update.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid appointment type data', error.details);
    }
    
    const appointmentType = await appointmentTypeService.updateAppointmentType(
      req.params.id,
      value
    );
    
    return ResponseUtil.success(res, { 
      message: 'Appointment type updated successfully',
      appointmentType 
    });
  }),
  
  /**
   * Delete appointment type
   * @route DELETE /api/appointment-types/:id
   * @access Private (Admin)
   */
  deleteAppointmentType: asyncHandler(async (req, res) => {
    const result = await appointmentTypeService.deleteAppointmentType(req.params.id);
    
    return ResponseUtil.success(res, { 
      message: 'Appointment type deleted successfully'
    });
  }),
  
  /**
   * Get appointment types for a specific doctor
   * @route GET /api/appointment-types/doctor/:doctorId
   * @access Private
   */
  getAppointmentTypesForDoctor: asyncHandler(async (req, res) => {
    const appointmentTypes = await appointmentTypeService.getAppointmentTypesForDoctor(
      req.params.doctorId
    );
    
    return ResponseUtil.success(res, { 
      count: appointmentTypes.length,
      appointmentTypes 
    });
  }),
  
  /**
   * Initialize default appointment types
   * @route POST /api/appointment-types/initialize
   * @access Private (Admin)
   */
  initializeDefaultTypes: asyncHandler(async (req, res) => {
    const result = await appointmentTypeService.initializeDefaultTypes();
    
    return ResponseUtil.success(res, { 
      message: 'Default appointment types initialized successfully',
      result 
    });
  })
};

module.exports = appointmentTypeController;
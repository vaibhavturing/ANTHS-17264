// File: src/controllers/appointmentType.controller.js
const appointmentTypeService = require('../services/appointmentType.service');
const asyncHandler = require('../utils/async-handler.util');
const { ResponseUtil } = require('../utils/response.util');
const { ApiError } = require('../utils/errors');

/**
 * Appointment Type Controller
 * Handles API requests related to appointment types
 */
const appointmentTypeController = {
  /**
   * Create a new appointment type
   */
  createAppointmentType: asyncHandler(async (req, res) => {
    const typeData = req.body;
    
    const appointmentType = await appointmentTypeService.createAppointmentType(typeData);
    
    return ResponseUtil.success(res, {
      message: 'Appointment type created successfully',
      appointmentType
    }, 201);
  }),
  
  /**
   * Update an appointment type
   */
  updateAppointmentType: asyncHandler(async (req, res) => {
    const { typeId } = req.params;
    const updateData = req.body;
    
    const appointmentType = await appointmentTypeService.updateAppointmentType(
      typeId,
      updateData
    );
    
    return ResponseUtil.success(res, {
      message: 'Appointment type updated successfully',
      appointmentType
    });
  }),
  
  /**
   * Get appointment type by ID
   */
  getAppointmentTypeById: asyncHandler(async (req, res) => {
    const { typeId } = req.params;
    
    const appointmentType = await appointmentTypeService.getAppointmentTypeById(typeId);
    
    return ResponseUtil.success(res, { appointmentType });
  }),
  
  /**
   * Get all appointment types with optional filtering
   */
  getAllAppointmentTypes: asyncHandler(async (req, res) => {
    const filters = {
      status: req.query.status,
      department: req.query.department,
      minDuration: req.query.minDuration ? Number(req.query.minDuration) : undefined,
      maxDuration: req.query.maxDuration ? Number(req.query.maxDuration) : undefined,
      isOnlineBookable: req.query.isOnlineBookable !== undefined ? 
        req.query.isOnlineBookable === 'true' : undefined
    };
    
    const appointmentTypes = await appointmentTypeService.getAllAppointmentTypes(filters);
    
    return ResponseUtil.success(res, {
      count: appointmentTypes.length,
      appointmentTypes
    });
  }),
  
  /**
   * Get appointment types for a department
   */
  getAppointmentTypesByDepartment: asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const activeOnly = req.query.activeOnly !== 'false';
    
    const appointmentTypes = await appointmentTypeService.getAppointmentTypesByDepartment(
      departmentId,
      activeOnly
    );
    
    return ResponseUtil.success(res, {
      count: appointmentTypes.length,
      appointmentTypes
    });
  }),
  
  /**
   * Toggle appointment type status (active/inactive)
   */
  toggleAppointmentTypeStatus: asyncHandler(async (req, res) => {
    const { typeId } = req.params;
    const { status } = req.body;
    
    if (!status || !['active', 'inactive'].includes(status)) {
      throw new ApiError('Valid status (active, inactive) is required', 400);
    }
    
    const appointmentType = await appointmentTypeService.toggleAppointmentTypeStatus(
      typeId,
      status
    );
    
    return ResponseUtil.success(res, {
      message: `Appointment type status changed to ${status}`,
      appointmentType
    });
  })
};

module.exports = appointmentTypeController;
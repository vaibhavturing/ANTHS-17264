const recurringAppointmentService = require('../services/recurringAppointment.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const { ValidationError } = require('../utils/errors');
const recurringAppointmentValidator = require('../validators/recurringAppointment.validator');

/**
 * Controller for recurring appointment operations
 * in the Healthcare Management Application
 */
const recurringAppointmentController = {
  /**
   * Create a new recurring appointment series
   * @route POST /api/recurring-appointments
   * @access Private
   */
  createRecurringSeries: asyncHandler(async (req, res) => {
    // Validate request data
    const { error, value } = recurringAppointmentValidator.create.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid recurring appointment data', error.details);
    }
    
    const result = await recurringAppointmentService.createRecurringSeries(value);
    
    return ResponseUtil.success(res, { 
      message: 'Recurring appointment series created successfully',
      series: result.series,
      appointments: result.appointments
    }, 201);
  }),
  
  /**
   * Get a recurring appointment series by ID
   * @route GET /api/recurring-appointments/:id
   * @access Private
   */
  getRecurringSeriesById: asyncHandler(async (req, res) => {
    const options = {
      populateAppointments: true,
      populatePatient: true,
      populateDoctor: true,
      populateAppointmentType: true
    };
    
    const series = await recurringAppointmentService.getRecurringSeriesById(
      req.params.id,
      options
    );
    
    return ResponseUtil.success(res, { series });
  }),
  
  /**
   * Get recurring series for a patient
   * @route GET /api/recurring-appointments/patient/:patientId
   * @access Private
   */
  getPatientRecurringSeries: asyncHandler(async (req, res) => {
    // Extract filter parameters
    const filters = {};
    
    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    if (req.query.startDate) {
      filters.startDate = req.query.startDate;
    }
    
    if (req.query.endDate) {
      filters.endDate = req.query.endDate;
    }
    
    const series = await recurringAppointmentService.getPatientRecurringSeries(
      req.params.patientId,
      filters
    );
    
    return ResponseUtil.success(res, { 
      count: series.length,
      series 
    });
  }),
  
  /**
   * Update a recurring appointment series
   * @route PUT /api/recurring-appointments/:id
   * @access Private
   */
  updateRecurringSeries: asyncHandler(async (req, res) => {
    // Validate request data
    const { error, value } = recurringAppointmentValidator.update.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid recurring appointment data', error.details);
    }
    
    // Get update mode (all, thisAndFuture, this)
    const updateMode = req.query.mode || 'all';
    
    const result = await recurringAppointmentService.updateRecurringSeries(
      req.params.id,
      value,
      updateMode
    );
    
    return ResponseUtil.success(res, { 
      message: 'Recurring appointment series updated successfully',
      series: result.series,
      updatedAppointments: result.updatedAppointments
    });
  }),
  
  /**
   * Cancel a recurring appointment series
   * @route POST /api/recurring-appointments/:id/cancel
   * @access Private
   */
  cancelRecurringSeries: asyncHandler(async (req, res) => {
    // Validate request data
    const { error, value } = recurringAppointmentValidator.cancel.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid cancellation data', error.details);
    }
    
    // Get cancel mode (all, future)
    const cancelMode = req.query.mode || 'all';
    
    const result = await recurringAppointmentService.cancelRecurringSeries(
      req.params.id,
      {
        reason: value.reason,
        cancelMode,
        startDate: value.startDate
      }
    );
    
    return ResponseUtil.success(res, { 
      message: 'Recurring appointment series cancelled successfully',
      result
    });
  })
};

module.exports = recurringAppointmentController;
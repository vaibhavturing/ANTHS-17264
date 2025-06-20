// src/controllers/scheduled-task.controller.js
const scheduledTaskService = require('../services/scheduled-task.service');
const { BadRequestError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Controller for scheduled task operations
 */
const scheduledTaskController = {
  /**
   * Run a scheduled task immediately
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  runTaskNow: async (req, res, next) => {
    try {
      const { taskName } = req.params;
      
      // Validate task name
      const validTasks = [
        'daily-appointment-reminders',
        'patient-statistics-report',
        'appointment-statistics-report',
        'doctor-workload-report',
        'queue-cleanup'
      ];
      
      if (!validTasks.includes(taskName)) {
        throw new BadRequestError(`Invalid task name. Must be one of: ${validTasks.join(', ')}`);
      }
      
      // Run the task
      const result = await scheduledTaskService.runTaskNow(taskName);
      
      res.status(202).json({
        success: true,
        message: `Task "${taskName}" has been initiated`,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = scheduledTaskController;
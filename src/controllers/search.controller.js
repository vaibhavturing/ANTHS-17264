// src/controllers/search.controller.js

const SearchService = require('../services/search.service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Controller for search functionality
 */
class SearchController {
  /**
   * Search across medical records, notes, and reports
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @returns {Response} JSON response
   */
  async searchRecords(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        query, diagnosis, fromDate, toDate, doctorId, contentType 
      } = req.query;
      const page = parseInt(req.query.page || 1);
      const limit = parseInt(req.query.limit || 20);

      // Perform the search
      const results = await SearchService.searchRecords(
        { query, diagnosis, fromDate, toDate, doctorId, contentType },
        page,
        limit
      );

      return res.json({
        success: true,
        ...results,
        page,
        limit
      });
    } catch (error) {
      logger.error(`Error in searchRecords: ${error.message}`, { error });
      return res.status(500).json({
        success: false,
        message: 'An error occurred while searching records'
      });
    }
  }

  /**
   * Search patients with filters
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @returns {Response} JSON response
   */
  async searchPatients(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { query, diagnosis, year } = req.query;
      const page = parseInt(req.query.page || 1);
      const limit = parseInt(req.query.limit || 20);

      // Perform the patient search
      const results = await SearchService.searchPatients(
        { query, diagnosis, year },
        page,
        limit
      );

      return res.json({
        success: true,
        ...results
      });
    } catch (error) {
      logger.error(`Error in searchPatients: ${error.message}`, { error });
      return res.status(500).json({
        success: false,
        message: 'An error occurred while searching patients'
      });
    }
  }
}

module.exports = new SearchController();
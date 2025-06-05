const asyncHandler = require('../utils/async-handler.util');
const patientSearchService = require('../services/patient-search.service');
const { ResponseUtil } = require('../utils/response.util');
const logger = require('../utils/logger');
const { ValidationError, AuthorizationError } = require('../utils/errors');

/**
 * Controller for advanced patient search endpoints
 */
const patientSearchController = {
  /**
   * Search patients with advanced filtering
   * @route GET /api/patients/search/advanced
   */
  advancedSearch: asyncHandler(async (req, res) => {
    try {
      const startTime = new Date(); // Track execution time
      const user = req.user;
      
      // Extract search parameters from query string
      const searchParams = {
        name: req.query.name,
        medicalRecordNumber: req.query.mrn,
        ssn: req.query.ssn,
        phone: req.query.phone,
        dateOfBirth: req.query.dob,
        ageFrom: req.query.ageFrom,
        ageTo: req.query.ageTo,
        gender: req.query.gender,
        registrationStatus: req.query.status,
        registrationDateFrom: req.query.regDateFrom,
        registrationDateTo: req.query.regDateTo,
        insuranceProvider: req.query.insurance,
        bloodType: req.query.bloodType,
        condition: req.query.condition,
        primaryCarePhysician: req.query.doctor,
        recentActivity: req.query.recentActivity
      };
      
      // Extract pagination and sorting options
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortField: req.query.sortField || 'registrationDate',
        sortOrder: req.query.sortOrder || 'desc',
        startTime
      };
      
      const result = await patientSearchService.searchPatients(searchParams, options, user);
      
      return ResponseUtil.success(res, {
        data: result.patients,
        pagination: result.pagination,
        facets: result.facets,
        metadata: result.searchMetadata
      });
    } catch (error) {
      logger.error('Error in advanced patient search', { error: error.message });
      
      if (error instanceof ValidationError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          400,
          'VALIDATION_ERROR'
        );
      }
      
      return ResponseUtil.error(
        res, 
        'Failed to search patients', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Export search results to file
   * @route GET /api/patients/search/export
   */
  exportSearchResults: asyncHandler(async (req, res) => {
    try {
      const user = req.user;
      
      // Check user permissions
      if (!['admin', 'doctor'].includes(user.role)) {
        throw new AuthorizationError('You do not have permission to export patient data');
      }
      
      // Extract search parameters from query string
      const searchParams = {
        name: req.query.name,
        medicalRecordNumber: req.query.mrn,
        ssn: req.query.ssn,
        phone: req.query.phone,
        dateOfBirth: req.query.dob,
        ageFrom: req.query.ageFrom,
        ageTo: req.query.ageTo,
        gender: req.query.gender,
        registrationStatus: req.query.status,
        registrationDateFrom: req.query.regDateFrom,
        registrationDateTo: req.query.regDateTo,
        insuranceProvider: req.query.insurance,
        bloodType: req.query.bloodType,
        condition: req.query.condition,
        primaryCarePhysician: req.query.doctor,
        recentActivity: req.query.recentActivity
      };
      
      // Get export format
      const format = req.query.format || 'csv';
      if (!['csv', 'excel', 'pdf'].includes(format)) {
        throw new ValidationError('Invalid export format. Supported formats: csv, excel, pdf');
      }
      
      const exportData = await patientSearchService.exportSearchResults(
        searchParams,
        format,
        user
      );
      
      // Set appropriate content type header based on format
      let contentType, filename;
      switch(format) {
        case 'csv':
          contentType = 'text/csv';
          filename = 'patient-data.csv';
          break;
        case 'excel':
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          filename = 'patient-data.xlsx';
          break;
        case 'pdf':
          contentType = 'application/pdf';
          filename = 'patient-data.pdf';
          break;
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      // Send the file
      res.send(exportData);
    } catch (error) {
      logger.error('Error exporting search results', { error: error.message });
      
      if (error instanceof ValidationError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          400,
          'VALIDATION_ERROR'
        );
      }
      
      if (error instanceof AuthorizationError) {
        return ResponseUtil.error(
          res,
          error.message,
          403,
          'FORBIDDEN'
        );
      }
      
      return ResponseUtil.error(
        res, 
        'Failed to export search results', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Save a search query for later reuse
   * @route POST /api/patients/search/save
   */
  saveSearch: asyncHandler(async (req, res) => {
    try {
      const { name, searchParams } = req.body;
      const userId = req.user._id;
      
      if (!name) {
        throw new ValidationError('Search name is required');
      }
      
      const savedSearch = await patientSearchService.saveSearch(userId, name, searchParams);
      
      return ResponseUtil.success(res, {
        message: 'Search saved successfully',
        data: savedSearch
      });
    } catch (error) {
      logger.error('Error saving search', { error: error.message });
      
      if (error instanceof ValidationError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          400,
          'VALIDATION_ERROR'
        );
      }
      
      return ResponseUtil.error(
        res, 
        'Failed to save search', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Get saved searches for the current user
   * @route GET /api/patients/search/saved
   */
  getSavedSearches: asyncHandler(async (req, res) => {
    try {
      const userId = req.user._id;
      
      const savedSearches = await patientSearchService.getSavedSearches(userId);
      
      return ResponseUtil.success(res, {
        data: savedSearches
      });
    } catch (error) {
      logger.error('Error retrieving saved searches', { error: error.message });
      
      return ResponseUtil.error(
        res, 
        'Failed to retrieve saved searches', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Get search history for the current user
   * @route GET /api/patients/search/history
   */
  getSearchHistory: asyncHandler(async (req, res) => {
    try {
      const userId = req.user._id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      
      const searchHistory = await patientSearchService.getSearchHistory(
        userId,
        { page, limit }
      );
      
      return ResponseUtil.success(res, {
        data: searchHistory.history,
        pagination: searchHistory.pagination
      });
    } catch (error) {
      logger.error('Error retrieving search history', { error: error.message });
      
      return ResponseUtil.error(
        res, 
        'Failed to retrieve search history', 
        500,
        'SERVER_ERROR'
      );
    }
  })
};

module.exports = patientSearchController;
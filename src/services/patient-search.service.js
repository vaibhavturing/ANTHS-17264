const Patient = require('../models/patient.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { ValidationError, AuthorizationError } = require('../utils/errors');
const exportUtils = require('../utils/export.util');
const config = require('../config/config');

/**
 * Advanced patient search service
 * Provides comprehensive search functionality with multiple criteria
 */
const patientSearchService = {
  /**
   * Search patients with advanced filtering and fuzzy matching
   * @param {Object} searchParams - Search parameters and filters
   * @param {Object} options - Pagination and sorting options
   * @param {Object} user - User performing the search
   * @returns {Promise<Object>} Search results and metadata
   */
  searchPatients: async (searchParams, options = {}, user) => {
    try {
      logger.debug('Starting advanced patient search', { searchParams, options });
      
      // Default pagination options
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      
      // Default sorting options
      const sortField = options.sortField || 'registrationDate';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sortOptions = { [sortField]: sortOrder };
      
      // Build base query
      const query = buildSearchQuery(searchParams, user);
      
      // Execute search with aggregation pipeline for advanced features
      const aggregationPipeline = buildAggregationPipeline(searchParams, user, sortOptions, skip, limit);
      
      const results = await Patient.aggregate(aggregationPipeline);
      
      // Count total matching documents (without pagination)
      const countPipeline = buildAggregationPipeline(searchParams, user, null, null, null, true);
      const countResults = await Patient.aggregate(countPipeline);
      
      const total = countResults.length > 0 ? countResults[0].total : 0;
      
      // Create facets for analytics
      const facets = await generateSearchFacets(searchParams, user);
      
      return {
        patients: results,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        },
        facets,
        searchMetadata: {
          criteria: Object.keys(searchParams).filter(key => searchParams[key] !== undefined && searchParams[key] !== '').length,
          executionTimeMs: new Date() - options.startTime || 0
        }
      };
    } catch (error) {
      logger.error('Error in advanced patient search', {
        error: error.message,
        searchParams,
        user: user?._id
      });
      
      throw error;
    }
  },
  
  /**
   * Export search results to specified format
   * @param {Object} searchParams - Search parameters and filters
   * @param {string} format - Export format (csv, excel, pdf)
   * @param {Object} user - User requesting the export
   * @returns {Promise<Buffer|string>} Exported data
   */
  exportSearchResults: async (searchParams, format = 'csv', user) => {
    try {
      // Verify user has export permissions
      if (!['admin', 'doctor'].includes(user.role)) {
        throw new AuthorizationError('You do not have permission to export patient data');
      }
      
      // Run search without pagination to get all results
      const aggregationPipeline = buildAggregationPipeline(
        searchParams,
        user,
        { registrationDate: -1 }, // default sort
        0,  // no skip
        config.EXPORT_MAX_RECORDS || 1000  // limit max records for export
      );
      
      const patients = await Patient.aggregate(aggregationPipeline);
      
      if (patients.length === 0) {
        throw new ValidationError('No data to export');
      }
      
      // Process patients data to prepare for export
      // Remove sensitive fields and format data according to export requirements
      const preparedData = patients.map(patient => preparePatientDataForExport(patient, user.role));
      
      // Generate export file in requested format
      let exportedData;
      
      switch(format.toLowerCase()) {
        case 'csv':
          exportedData = await exportUtils.generateCSV(preparedData);
          break;
        case 'excel':
          exportedData = await exportUtils.generateExcel(preparedData, 'Patients');
          break;
        case 'pdf':
          exportedData = await exportUtils.generatePDF(preparedData, {
            title: 'Patient Search Results',
            creator: `${user.firstName} ${user.lastName}`,
            subject: 'Healthcare Management System - Patient Search',
            keywords: 'patients, healthcare, search results',
          });
          break;
        default:
          throw new ValidationError('Invalid export format. Supported formats: csv, excel, pdf');
      }
      
      logger.info('Search results exported successfully', {
        format,
        recordCount: patients.length,
        userId: user._id,
        userRole: user.role
      });
      
      return exportedData;
    } catch (error) {
      logger.error('Error exporting search results', {
        error: error.message,
        format,
        user: user?._id
      });
      
      throw error;
    }
  },
  
  /**
   * Get patient search history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} Search history
   */
  getSearchHistory: async (userId, options = {}) => {
    try {
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      
      // In a real implementation, this would query a SearchHistory model
      // For now, we'll return a placeholder response
      return {
        history: [],
        pagination: {
          total: 0,
          page,
          limit, 
          pages: 0
        }
      };
    } catch (error) {
      logger.error('Error retrieving search history', {
        error: error.message,
        userId
      });
      
      throw error;
    }
  },
  
  /**
   * Save a search query for later reuse
   * @param {string} userId - User ID
   * @param {string} name - Search name
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} Saved search
   */
  saveSearch: async (userId, name, searchParams) => {
    try {
      // In a real implementation, this would save to a SavedSearch model
      // For now, we'll return a placeholder response
      return {
        id: mongoose.Types.ObjectId(),
        name,
        searchParams,
        userId,
        createdAt: new Date()
      };
    } catch (error) {
      logger.error('Error saving search', {
        error: error.message,
        userId,
        name
      });
      
      throw error;
    }
  },
  
  /**
   * Get saved searches for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Saved searches
   */
  getSavedSearches: async (userId) => {
    try {
      // In a real implementation, this would query a SavedSearch model
      // For now, we'll return a placeholder response
      return [];
    } catch (error) {
      logger.error('Error retrieving saved searches', {
        error: error.message,
        userId
      });
      
      throw error;
    }
  }
};

/**
 * Build the MongoDB query for patient search
 * @private
 * @param {Object} searchParams - Search parameters
 * @param {Object} user - User performing the search
 * @returns {Object} MongoDB query
 */
function buildSearchQuery(searchParams, user) {
  const query = {};
  
  // Basic search criteria
  if (searchParams.medicalRecordNumber) {
    query.medicalRecordNumber = searchParams.medicalRecordNumber;
  }
  
  // SSN search (exact match only and requires admin or doctor role)
  if (searchParams.ssn && ['admin', 'doctor'].includes(user.role)) {
    // In a real implementation, we would need to handle encrypted SSNs
    // For this example, we're using a simplified approach
    query.ssn = searchParams.ssn;
  }
  
  // Phone number search
  if (searchParams.phone) {
    // Remove formatting and search in both phone fields
    const cleanedPhone = searchParams.phone.replace(/\D/g, '');
    query.$or = [
      { phoneNumber: new RegExp(cleanedPhone, 'i') },
      { alternatePhoneNumber: new RegExp(cleanedPhone, 'i') }
    ];
  }
  
  // Date of birth (exact match)
  if (searchParams.dateOfBirth) {
    query.dateOfBirth = new Date(searchParams.dateOfBirth);
  }
  
  // Age range search
  if (searchParams.ageFrom || searchParams.ageTo) {
    query.dateOfBirth = query.dateOfBirth || {};
    
    if (searchParams.ageFrom) {
      const maxBirthDate = new Date();
      maxBirthDate.setFullYear(maxBirthDate.getFullYear() - parseInt(searchParams.ageFrom));
      query.dateOfBirth.$lte = maxBirthDate;
    }
    
    if (searchParams.ageTo) {
      const minBirthDate = new Date();
      minBirthDate.setFullYear(minBirthDate.getFullYear() - parseInt(searchParams.ageTo) - 1);
      minBirthDate.setDate(minBirthDate.getDate() + 1); // Add one day to get inclusive range
      query.dateOfBirth.$gte = minBirthDate;
    }
  }
  
  // Registration date range
  if (searchParams.registrationDateFrom || searchParams.registrationDateTo) {
    query.registrationDate = {};
    
    if (searchParams.registrationDateFrom) {
      query.registrationDate.$gte = new Date(searchParams.registrationDateFrom);
    }
    
    if (searchParams.registrationDateTo) {
      const toDate = new Date(searchParams.registrationDateTo);
      toDate.setDate(toDate.getDate() + 1); // Include the end date (end of day)
      query.registrationDate.$lte = toDate;
    }
  }
  
  // Insurance provider
  if (searchParams.insuranceProvider) {
    query['insurance.provider'] = new RegExp(searchParams.insuranceProvider, 'i');
  }
  
  // Registration status
  if (searchParams.registrationStatus) {
    query.registrationStatus = searchParams.registrationStatus;
  }
  
  // Gender
  if (searchParams.gender) {
    query.gender = searchParams.gender;
  }
  
  // Blood type
  if (searchParams.bloodType) {
    query.bloodType = searchParams.bloodType;
  }
  
  // Medical condition search
  if (searchParams.condition) {
    query.$or = query.$or || [];
    query.$or.push(
      { 'medicalHistory.condition': new RegExp(searchParams.condition, 'i') },
      { 'allergies.allergen': new RegExp(searchParams.condition, 'i') },
      { 'medications.name': new RegExp(searchParams.condition, 'i') }
    );
  }
  
  // Primary care physician
  if (searchParams.primaryCarePhysician) {
    query['primaryCarePhysician.name'] = new RegExp(searchParams.primaryCarePhysician, 'i');
  }
  
  // Recent activity (last updated within days)
  if (searchParams.recentActivity) {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(searchParams.recentActivity));
    query['lastUpdated.date'] = { $gte: daysAgo };
  }
  
  return query;
}

/**
 * Build aggregation pipeline for advanced search features
 * @private
 * @param {Object} searchParams - Search parameters
 * @param {Object} user - User performing the search
 * @param {Object} sortOptions - Sorting options
 * @param {number} skip - Number of documents to skip
 * @param {number} limit - Number of documents to return
 * @param {boolean} countOnly - Whether to include only count stage
 * @returns {Array} Aggregation pipeline
 */
function buildAggregationPipeline(searchParams, user, sortOptions, skip, limit, countOnly = false) {
  const pipeline = [];
  
  // Lookup to join with user data for name search
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'user',
      foreignField: '_id',
      as: 'userData'
    }
  });
  
  // Unwind the result of lookup to access user fields
  pipeline.push({
    $unwind: {
      path: '$userData',
      preserveNullAndEmptyArrays: true
    }
  });
  
  // Add calculated fields
  pipeline.push({
    $addFields: {
      fullName: { $concat: ['$userData.firstName', ' ', '$userData.lastName'] },
      age: {
        $floor: {
          $divide: [
            { $subtract: [new Date(), '$dateOfBirth'] },
            365 * 24 * 60 * 60 * 1000
          ]
        }
      }
    }
  });
  
  // Match stage - apply all filters
  const matchStage = { $match: {} };
  
  // Add query filters from buildSearchQuery
  Object.assign(matchStage.$match, buildSearchQuery(searchParams, user));
  
  // Name search with fuzzy matching
  if (searchParams.name) {
    // For exact matches
    const exactMatch = {
      $or: [
        { fullName: new RegExp(`^${searchParams.name}$`, 'i') },
        { 'userData.firstName': new RegExp(`^${searchParams.name}$`, 'i') },
        { 'userData.lastName': new RegExp(`^${searchParams.name}$`, 'i') }
      ]
    };
    
    // For partial matches (starts with)
    const startsWithMatch = {
      $or: [
        { fullName: new RegExp(`^${searchParams.name}`, 'i') },
        { 'userData.firstName': new RegExp(`^${searchParams.name}`, 'i') },
        { 'userData.lastName': new RegExp(`^${searchParams.name}`, 'i') }
      ]
    };
    
    // For fuzzy matches (contains)
    const fuzzyMatch = {
      $or: [
        { fullName: new RegExp(searchParams.name, 'i') },
        { 'userData.firstName': new RegExp(searchParams.name, 'i') },
        { 'userData.lastName': new RegExp(searchParams.name, 'i') }
      ]
    };
    
    // Create a combined query with weighted scoring
    matchStage.$match.$or = [exactMatch, startsWithMatch, fuzzyMatch];
    
    // Add text score for sorting by relevance
    pipeline.unshift({
      $search: {
        // This uses the Atlas Search operator (requires MongoDB Atlas)
        // In a non-Atlas environment, you might need a different approach
        compound: {
          should: [
            {
              text: {
                query: searchParams.name,
                path: ['userData.firstName', 'userData.lastName', 'fullName'],
                fuzzy: { maxEdits: 1, prefixLength: 2 },
                score: { boost: { value: 3 } }
              }
            }
          ]
        }
      }
    });
  }
  
  pipeline.push(matchStage);
  
  // If this is just for counting, return early with count stage
  if (countOnly) {
    pipeline.push({ $count: 'total' });
    return pipeline;
  }
  
  // Sort stage
  if (sortOptions) {
    // If we did a text search, allow sorting by text score
    if (searchParams.name && sortOptions.relevance) {
      pipeline.push({ $sort: { score: -1 } });
    } else {
      pipeline.push({ $sort: sortOptions });
    }
  }
  
  // Pagination
  if (skip !== null && skip !== undefined) {
    pipeline.push({ $skip: skip });
  }
  
  if (limit !== null && limit !== undefined) {
    pipeline.push({ $limit: limit });
  }
  
  // Project stage - select fields based on user role
  pipeline.push({
    $project: getProjectionForRole(user.role)
  });
  
  return pipeline;
}

/**
 * Get MongoDB projection object based on user role
 * @private
 * @param {string} role - User role
 * @returns {Object} MongoDB projection
 */
function getProjectionForRole(role) {
  // Base fields that all roles can see
  const baseProjection = {
    _id: 1,
    user: 1,
    userData: 1,
    fullName: 1,
    dateOfBirth: 1,
    age: 1,
    gender: 1,
    phoneNumber: 1,
    address: 1,
    registrationStatus: 1,
    registrationDate: 1,
    insurance: { provider: 1 },
    profileCompleteness: 1
  };
  
  // Add role-specific fields
  switch(role) {
    case 'admin':
      return {
        ...baseProjection,
        bloodType: 1,
        allergies: 1,
        medications: 1,
        medicalHistory: 1,
        familyMedicalHistory: 1,
        primaryCarePhysician: 1,
        emergencyContacts: 1,
        vitalSigns: 1,
        lifestyle: 1,
        mentalHealth: 1,
        preventiveCare: 1,
        insurance: 1,
        lastUpdated: 1
      };
      
    case 'doctor':
      return {
        ...baseProjection,
        bloodType: 1,
        allergies: 1,
        medications: 1,
        medicalHistory: 1,
        familyMedicalHistory: 1,
        vitalSigns: 1,
        lifestyle: 1,
        mentalHealth: 1,
        preventiveCare: 1,
        primaryCarePhysician: 1,
        emergencyContacts: 1,
        lastUpdated: 1
      };
      
    case 'nurse':
      return {
        ...baseProjection,
        bloodType: 1,
        allergies: 1,
        medications: 1,
        medicalHistory: 1,
        vitalSigns: 1,
        primaryCarePhysician: 1,
        emergencyContacts: 1
      };
      
    case 'receptionist':
      return baseProjection;
      
    default:
      return baseProjection;
  }
}

/**
 * Prepare patient data for export by formatting and filtering fields
 * @private
 * @param {Object} patient - Patient data
 * @param {string} role - User role requesting export
 * @returns {Object} Prepared patient data
 */
function preparePatientDataForExport(patient, role) {
  // Create a simplified and formatted version of patient data for export
  const exportData = {
    patientName: patient.fullName,
    dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : '',
    age: patient.age || '',
    gender: patient.gender || '',
    phone: patient.phoneNumber || '',
    address: patient.address ? 
      `${patient.address.street}, ${patient.address.city}, ${patient.address.state} ${patient.address.zipCode}` : '',
    registrationDate: patient.registrationDate ? new Date(patient.registrationDate).toLocaleDateString() : '',
    status: patient.registrationStatus || '',
    insuranceProvider: patient.insurance?.provider || '',
    bloodType: patient.bloodType || '',
    primaryCarePhysician: patient.primaryCarePhysician?.name || ''
  };
  
  // Add role-specific fields
  if (['admin', 'doctor'].includes(role)) {
    // Add medical conditions (limited to first 3 for readability)
    exportData.medicalConditions = patient.medicalHistory ? 
      patient.medicalHistory
        .slice(0, 3)
        .map(h => h.condition)
        .join(', ') : '';
    
    // Add allergies (limited to first 3)
    exportData.allergies = patient.allergies ?
      patient.allergies
        .slice(0, 3)
        .map(a => a.allergen)
        .join(', ') : '';
    
    // Add medications (limited to first 3)
    exportData.medications = patient.medications ?
      patient.medications
        .slice(0, 3)
        .map(m => `${m.name} ${m.dosage}`)
        .join(', ') : '';
      
    // Last updated info
    exportData.lastUpdated = patient.lastUpdated?.date ?
      new Date(patient.lastUpdated.date).toLocaleDateString() : '';
  }
  
  return exportData;
}

/**
 * Generate facets (category counts) for search results
 * @private
 * @param {Object} searchParams - Search parameters
 * @param {Object} user - User performing the search
 * @returns {Promise<Object>} Facets for the search
 */
async function generateSearchFacets(searchParams, user) {
  try {
    // Deep clone and remove facet-specific parameters
    const baseQuery = buildSearchQuery({ ...searchParams }, user);
    
    // Create a facets query that excludes the parameter we're getting facets for
    const getFacetsForField = async (field, excludeParam) => {
      const facetQuery = { ...baseQuery };
      
      // Remove the field-specific filter to get counts across all values
      if (excludeParam && facetQuery[excludeParam]) {
        delete facetQuery[excludeParam];
      }
      
      // Build aggregation
      const pipeline = [
        { $match: facetQuery },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ];
      
      const results = await Patient.aggregate(pipeline);
      
      return results.map(r => ({
        value: r._id,
        count: r.count
      }));
    };
    
    // Run parallel aggregations for each facet
    const [
      genderFacets,
      statusFacets,
      bloodTypeFacets,
      insuranceFacets,
      ageFacets
    ] = await Promise.all([
      getFacetsForField('gender', 'gender'),
      getFacetsForField('registrationStatus', 'registrationStatus'),
      getFacetsForField('bloodType', 'bloodType'),
      getFacetsForField('insurance.provider', 'insurance.provider'),
      // Age ranges require special handling
      Patient.aggregate([
        { $match: baseQuery },
        {
          $addFields: {
            ageGroup: {
              $switch: {
                branches: [
                  { case: { $lt: ["$age", 18] }, then: "Under 18" },
                  { case: { $lt: ["$age", 35] }, then: "18-34" },
                  { case: { $lt: ["$age", 50] }, then: "35-49" },
                  { case: { $lt: ["$age", 65] }, then: "50-64" },
                  { case: { $lt: ["$age", 80] }, then: "65-79" }
                ],
                default: "80+"
              }
            }
          }
        },
        { $group: { _id: "$ageGroup", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);
    
    return {
      genders: genderFacets,
      registrationStatuses: statusFacets,
      bloodTypes: bloodTypeFacets,
      insuranceProviders: insuranceFacets,
      ageGroups: ageFacets.map(g => ({
        value: g._id,
        count: g.count
      }))
    };
  } catch (error) {
    logger.error('Error generating search facets', { error: error.message });
    return {};
  }
}

module.exports = patientSearchService;
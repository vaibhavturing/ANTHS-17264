// src/services/search.service.js

const Patient = require('../models/patient.model');
const MedicalRecord = require('../models/medicalRecord.model');
const ClinicalNote = require('../models/clinicalNote.model');
const Prescription = require('../models/prescription.model');
const mongoose = require('mongoose');

/**
 * Search service for healthcare application
 */
class SearchService {
  /**
   * Perform full-text search across patient records
   * @param {Object} filters - Search filters
   * @param {string} filters.query - Search text query
   * @param {string} filters.diagnosis - Filter by diagnosis
   * @param {Date} filters.fromDate - Filter from date
   * @param {Date} filters.toDate - Filter to date
   * @param {string} filters.doctorId - Filter by doctor
   * @param {string} filters.contentType - Type of content to search (notes, prescriptions, all)
   * @param {number} page - Page number
   * @param {number} limit - Results per page
   * @returns {Promise<Object>} Search results with pagination
   */
  async searchRecords(filters = {}, page = 1, limit = 20) {
    const {
      query,
      diagnosis,
      fromDate,
      toDate,
      doctorId,
      contentType = 'all'
    } = filters;

    // Build search criteria
    const searchCriteria = {};
    
    if (query) {
      // Add text search to criteria
      searchCriteria.$text = { $search: query };
    }
    
    if (diagnosis) {
      searchCriteria['diagnoses.code'] = diagnosis;
    }
    
    // Date range filtering
    if (fromDate || toDate) {
      searchCriteria.createdAt = {};
      if (fromDate) searchCriteria.createdAt.$gte = new Date(fromDate);
      if (toDate) searchCriteria.createdAt.$lte = new Date(toDate);
    }
    
    if (doctorId) {
      searchCriteria.doctorId = mongoose.Types.ObjectId(doctorId);
    }
    
    // Create query objects for different content types
    const queryOptions = {
      skip: (page - 1) * limit,
      limit: parseInt(limit),
      sort: { score: { $meta: 'textScore' } },
      projection: { score: { $meta: 'textScore' } }
    };
    
    let results = { totalCount: 0, data: [] };
    
    // Execute search based on content type
    if (contentType === 'all' || contentType === 'notes') {
      const notesResults = await ClinicalNote.find(
        searchCriteria, 
        { ...queryOptions.projection },
        queryOptions
      ).populate('patientId', 'firstName lastName dateOfBirth');
      
      results.data = [...results.data, ...notesResults.map(note => ({
        ...note.toObject(),
        contentType: 'note'
      }))];
      
      if (contentType === 'notes') {
        results.totalCount = await ClinicalNote.countDocuments(searchCriteria);
      }
    }
    
    if (contentType === 'all' || contentType === 'prescriptions') {
      const prescriptionResults = await Prescription.find(
        searchCriteria,
        { ...queryOptions.projection },
        queryOptions
      ).populate('patientId', 'firstName lastName dateOfBirth');
      
      results.data = [...results.data, ...prescriptionResults.map(prescription => ({
        ...prescription.toObject(),
        contentType: 'prescription'
      }))];
      
      if (contentType === 'prescriptions') {
        results.totalCount = await Prescription.countDocuments(searchCriteria);
      }
    }
    
    if (contentType === 'all') {
      // Count total for all content types
      const notesCount = await ClinicalNote.countDocuments(searchCriteria);
      const prescriptionsCount = await Prescription.countDocuments(searchCriteria);
      results.totalCount = notesCount + prescriptionsCount;
    }
    
    // Sort combined results by text score
    results.data.sort((a, b) => b.score - a.score);
    
    // Apply pagination to combined results
    if (contentType === 'all') {
      results.data = results.data.slice(queryOptions.skip, queryOptions.skip + queryOptions.limit);
    }
    
    return results;
  }
  
  /**
   * Search patients with filtering
   * @param {Object} filters - Search filters
   * @param {number} page - Page number
   * @param {number} limit - Results per page
   * @returns {Promise<Object>} Search results with pagination
   */
  async searchPatients(filters = {}, page = 1, limit = 20) {
    const { query, diagnosis, year } = filters;
    
    // Build search query
    const searchCriteria = {};
    
    if (query) {
      // Add text search for patient name, ID, etc.
      searchCriteria.$or = [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { phoneNumber: { $regex: query, $options: 'i' } }
      ];
    }
    
    // Handle diagnosis filter (e.g., "diabetes")
    if (diagnosis) {
      // Need to join with medical records to filter by diagnosis
      // Will use aggregation pipeline below
    }
    
    // Handle year filter (e.g., from 2023)
    let yearFilter;
    if (year) {
      yearFilter = {
        $expr: {
          $eq: [{ $year: '$createdAt' }, parseInt(year)]
        }
      };
    }
    
    let aggregationPipeline = [];
    
    // Start with matching patients by direct criteria
    aggregationPipeline.push({ $match: searchCriteria });
    
    // If filtering by diagnosis, lookup medical records
    if (diagnosis) {
      aggregationPipeline = [
        ...aggregationPipeline,
        // Lookup medical records for each patient
        {
          $lookup: {
            from: 'medicalrecords',
            localField: '_id',
            foreignField: 'patientId',
            as: 'medicalRecords'
          }
        },
        // Unwind the medical records array
        { $unwind: '$medicalRecords' },
        // Match records with the specified diagnosis
        {
          $match: {
            'medicalRecords.diagnoses': {
              $elemMatch: { 
                $or: [
                  { description: { $regex: diagnosis, $options: 'i' } },
                  { code: { $regex: diagnosis, $options: 'i' } }
                ]
              }
            }
          }
        },
        // Group by patient to eliminate duplicates
        {
          $group: {
            _id: '$_id',
            patient: { $first: '$$ROOT' }
          }
        },
        // Restore patient structure
        { $replaceRoot: { newRoot: '$patient' } }
      ];
    }
    
    // Apply year filter if specified
    if (yearFilter) {
      aggregationPipeline.push({ $match: yearFilter });
    }
    
    // Add pagination
    const countPipeline = [...aggregationPipeline];
    aggregationPipeline.push(
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    );
    
    // Execute the query
    const patients = await Patient.aggregate(aggregationPipeline);
    
    // Count total matching patients
    const countResult = await Patient.aggregate([
      ...countPipeline,
      { $count: 'totalCount' }
    ]);
    
    const totalCount = countResult.length > 0 ? countResult[0].totalCount : 0;
    
    return {
      data: patients,
      page,
      limit,
      totalCount
    };
  }
}

module.exports = new SearchService();
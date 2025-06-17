const ClinicalNote = require('../models/clinicalNote.model');
const NoteTemplate = require('../models/noteTemplate.model');
const Patient = require('../models/patient.model');
const User = require('../models/user.model');
const logger = require('../utils/logger');
const { NotFoundError, BadRequestError } = require('../utils/errors');

/**
 * Service for managing clinical notes
 */
const clinicalNoteService = {
  /**
   * Create a new clinical note
   * @param {Object} noteData - Data for the new note
   * @returns {Promise<Object>} Created note
   */
  createNote: async (noteData) => {
    try {
      // Verify the template exists
      const template = await NoteTemplate.findById(noteData.templateId);
      if (!template) {
        throw new NotFoundError('Note template not found');
      }
      
      // Verify the patient exists
      const patient = await Patient.findById(noteData.patient);
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Verify the doctor exists
      const doctor = await User.findById(noteData.doctor);
      if (!doctor) {
        throw new NotFoundError('Doctor not found');
      }
      
      // Add template type and name to note data
      noteData.templateType = template.type;
      noteData.templateName = template.name;
      
      // Validate that all required fields are present
      const requiredFields = template.fields.filter(field => field.required);
      const providedFields = new Set(noteData.fieldData.map(field => field.name));
      
      const missingFields = requiredFields.filter(field => 
        !providedFields.has(field.name)
      );
      
      if (missingFields.length > 0) {
        throw new BadRequestError(
          `Missing required fields: ${missingFields.map(f => f.name).join(', ')}`
        );
      }
      
      const note = new ClinicalNote(noteData);
      await note.save();
      
      logger.info(`Clinical note created: ${note._id}`, { 
        patient: noteData.patient,
        doctor: noteData.doctor
      });
      
      return note;
    } catch (error) {
      logger.error('Error creating clinical note', { error: error.message });
      throw error;
    }
  },
  
  /**
   * Get a note by ID
   * @param {string} noteId - ID of the note
   * @param {boolean} populateRefs - Whether to populate references
   * @returns {Promise<Object>} Note data
   */
  getNoteById: async (noteId, populateRefs = false) => {
    try {
      let query = ClinicalNote.findById(noteId);
      
      if (populateRefs) {
        query = query.populate('patient', 'firstName lastName dateOfBirth')
                     .populate('doctor', 'firstName lastName')
                     .populate('templateId');
      }
      
      const note = await query.exec();
      
      if (!note) {
        throw new NotFoundError('Clinical note not found');
      }
      
      return note;
    } catch (error) {
      logger.error('Error retrieving clinical note', { 
        error: error.message,
        noteId
      });
      
      throw error;
    }
  },
  
  /**
   * Get notes for a patient
   * @param {string} patientId - ID of the patient
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of notes
   */
  getPatientNotes: async (patientId, options = {}) => {
    try {
      const query = { patient: patientId };
      
      // Apply filters if provided
      if (options.status) query.status = options.status;
      if (options.templateType) query.templateType = options.templateType;
      if (options.doctor) query.doctor = options.doctor;
      
      // Set up pagination
      const limit = options.limit || 10;
      const skip = options.page ? (options.page - 1) * limit : 0;
      
      // Set up sorting
      const sort = options.sort || { visitDate: -1 };
      
      let queryBuilder = ClinicalNote.find(query)
                         .sort(sort)
                         .skip(skip)
                         .limit(limit);
      
      if (options.populate) {
        queryBuilder = queryBuilder.populate('doctor', 'firstName lastName')
                                   .populate('templateId', 'name type');
      }
      
      const notes = await queryBuilder.exec();
      const total = await ClinicalNote.countDocuments(query);
      
      return {
        data: notes,
        pagination: {
          total,
          page: options.page || 1,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error retrieving patient notes', { 
        error: error.message,
        patientId
      });
      
      throw error;
    }
  },
  
  /**
   * Update a clinical note
   * @param {string} noteId - ID of the note to update
   * @param {Object} updateData - New note data
   * @returns {Promise<Object>} Updated note
   */
  updateNote: async (noteId, updateData) => {
    try {
      const note = await ClinicalNote.findById(noteId);
      
      if (!note) {
        throw new NotFoundError('Clinical note not found');
      }
      
      // Prevent updating signed notes unless explicitly allowing edits
      if (note.status === 'signed' && !updateData.allowEditSigned) {
        throw new BadRequestError('Cannot modify signed notes');
      }
      
      // Remove allowEditSigned field before updating
      if (updateData.allowEditSigned) {
        delete updateData.allowEditSigned;
      }
      
      // If updating to 'signed' status, add signedAt timestamp
      if (updateData.status === 'signed' && note.status !== 'signed') {
        updateData.signedAt = new Date();
      }
      
      // Update the note with new data
      Object.assign(note, updateData);
      await note.save();
      
      logger.info(`Clinical note updated: ${noteId}`);
      return note;
    } catch (error) {
      logger.error('Error updating clinical note', { 
        error: error.message,
        noteId
      });
      
      throw error;
    }
  },
  
  /**
   * Search clinical notes
   * @param {Object} searchCriteria - Search parameters
   * @returns {Promise<Array>} Matching notes
   */
  searchNotes: async (searchCriteria) => {
    try {
      const query = {};
      
      // Apply filters from search criteria
      if (searchCriteria.patient) query.patient = searchCriteria.patient;
      if (searchCriteria.doctor) query.doctor = searchCriteria.doctor;
      if (searchCriteria.templateType) query.templateType = searchCriteria.templateType;
      if (searchCriteria.status) query.status = searchCriteria.status;
      if (searchCriteria.tags) query.tags = { $in: searchCriteria.tags };
      
      // Date range filter
      if (searchCriteria.dateFrom || searchCriteria.dateTo) {
        query.visitDate = {};
        if (searchCriteria.dateFrom) query.visitDate.$gte = new Date(searchCriteria.dateFrom);
        if (searchCriteria.dateTo) query.visitDate.$lte = new Date(searchCriteria.dateTo);
      }
      
      // Text search in fields
      if (searchCriteria.textSearch) {
        query.$or = [
          { 'fieldData.value': { $regex: searchCriteria.textSearch, $options: 'i' } },
          { tags: { $regex: searchCriteria.textSearch, $options: 'i' } }
        ];
      }
      
      // Set up pagination
      const limit = searchCriteria.limit || 10;
      const skip = searchCriteria.page ? (searchCriteria.page - 1) * limit : 0;
      
      // Set up sorting
      const sort = searchCriteria.sort || { visitDate: -1 };
      
      let queryBuilder = ClinicalNote.find(query)
                         .sort(sort)
                         .skip(skip)
                         .limit(limit);
      
      if (searchCriteria.populate) {
        queryBuilder = queryBuilder.populate('patient', 'firstName lastName')
                                   .populate('doctor', 'firstName lastName')
                                   .populate('templateId', 'name type');
      }
      
      const notes = await queryBuilder.exec();
      const total = await ClinicalNote.countDocuments(query);
      
      return {
        data: notes,
        pagination: {
          total,
          page: searchCriteria.page || 1,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error searching clinical notes', { 
        error: error.message
      });
      
      throw error;
    }
  }
};

module.exports = clinicalNoteService;
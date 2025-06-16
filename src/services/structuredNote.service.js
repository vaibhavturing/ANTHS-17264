const StructuredNote = require('../models/structuredNote.model');
const NoteTemplate = require('../models/noteTemplate.model');
const Patient = require('../models/patient.model');
const User = require('../models/user.model');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Service for managing structured notes
 */
const structuredNoteService = {
  /**
   * Create a new structured note
   * @param {Object} noteData - Note data
   * @returns {Promise<Object>} Created note
   */
  createNote: async (noteData) => {
    try {
      // Verify patient exists
      const patientExists = await Patient.findById(noteData.patient);
      if (!patientExists) {
        throw new NotFoundError('Patient not found');
      }
      
      // Verify provider exists
      const providerExists = await User.findById(noteData.provider);
      if (!providerExists) {
        throw new NotFoundError('Provider not found');
      }
      
      // Verify template exists
      const template = await NoteTemplate.findById(noteData.template);
      if (!template) {
        throw new NotFoundError('Template not found');
      }
      
      // Set template type from the template
      noteData.templateType = template.templateType;
      
      // Create the note
      const note = new StructuredNote(noteData);
      await note.save();
      
      return note;
    } catch (error) {
      logger.error('Error creating structured note', {
        error: error.message,
        patientId: noteData.patient,
        providerId: noteData.provider
      });
      throw error;
    }
  },

  /**
   * Get note by ID
   * @param {String} noteId - Note ID
   * @returns {Promise<Object>} Note data
   */
  getNoteById: async (noteId) => {
    try {
      const note = await StructuredNote.findById(noteId)
        .populate('patient', 'firstName lastName dateOfBirth gender')
        .populate('provider', 'firstName lastName')
        .populate('template', 'name templateType fields sections')
        .populate('signedBy', 'firstName lastName')
        .populate('prescriptions')
        .populate('labOrders');
      
      if (!note) {
        throw new NotFoundError('Note not found');
      }
      
      return note;
    } catch (error) {
      logger.error('Error fetching note', {
        error: error.message,
        noteId
      });
      throw error;
    }
  },

  /**
   * Get notes for a patient
   * @param {String} patientId - Patient ID
   * @param {Object} filters - Optional filters (templateType, status, date range)
   * @returns {Promise<Array>} Notes for the patient
   */
  getPatientNotes: async (patientId, filters = {}) => {
    try {
      const query = { patient: patientId };
      
      if (filters.templateType) {
        query.templateType = filters.templateType;
      }
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.startDate && filters.endDate) {
        query.noteDate = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }
      
      const notes = await StructuredNote.find(query)
        .populate('provider', 'firstName lastName')
        .populate('template', 'name templateType')
        .sort({ noteDate: -1 });
      
      return notes;
    } catch (error) {
      logger.error('Error fetching patient notes', {
        error: error.message,
        patientId,
        filters
      });
      throw error;
    }
  },

  /**
   * Get notes by provider
   * @param {String} providerId - Provider ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Notes by the provider
   */
  getProviderNotes: async (providerId, filters = {}) => {
    try {
      const query = { provider: providerId };
      
      if (filters.templateType) {
        query.templateType = filters.templateType;
      }
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.startDate && filters.endDate) {
        query.noteDate = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }
      
      const notes = await StructuredNote.find(query)
        .populate('patient', 'firstName lastName')
        .populate('template', 'name templateType')
        .sort({ noteDate: -1 });
      
      return notes;
    } catch (error) {
      logger.error('Error fetching provider notes', {
        error: error.message,
        providerId,
        filters
      });
      throw error;
    }
  },

  /**
   * Update structured note
   * @param {String} noteId - Note ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated note
   */
  updateNote: async (noteId, updateData) => {
    try {
      const note = await StructuredNote.findById(noteId);
      
      if (!note) {
        throw new NotFoundError('Note not found');
      }
      
      // Check if note is signed - signed notes can't be updated directly
      if (note.status === 'signed') {
        throw new ValidationError('Cannot update a signed note. Use the amend functionality instead.');
      }
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        note[key] = updateData[key];
      });
      
      await note.save();
      return note;
    } catch (error) {
      logger.error('Error updating note', {
        error: error.message,
        noteId
      });
      throw error;
    }
  },

  /**
   * Sign a note
   * @param {String} noteId - Note ID
   * @param {String} userId - User ID signing the note
   * @returns {Promise<Object>} Signed note
   */
  signNote: async (noteId, userId) => {
    try {
      const note = await StructuredNote.findById(noteId);
      
      if (!note) {
        throw new NotFoundError('Note not found');
      }
      
      // Sign the note using the method defined in the schema
      return await note.sign(userId);
    } catch (error) {
      logger.error('Error signing note', {
        error: error.message,
        noteId,
        userId
      });
      throw error;
    }
  },

  /**
   * Amend a signed note
   * @param {String} noteId - Note ID
   * @param {String} userId - User ID amending the note
   * @param {String} reason - Reason for amendment
   * @param {Object} newContent - Updated content
   * @returns {Promise<Object>} Amended note
   */
  amendNote: async (noteId, userId, reason, newContent) => {
    try {
      const note = await StructuredNote.findById(noteId);
      
      if (!note) {
        throw new NotFoundError('Note not found');
      }
      
      // Amend the note using the method defined in the schema
      return await note.amend(userId, reason, newContent);
    } catch (error) {
      logger.error('Error amending note', {
        error: error.message,
        noteId,
        userId
      });
      throw error;
    }
  },

  /**
   * Delete a note (only drafts can be deleted)
   * @param {String} noteId - Note ID
   * @returns {Promise<Object>} Result of the delete operation
   */
  deleteNote: async (noteId) => {
    try {
      const note = await StructuredNote.findById(noteId);
      
      if (!note) {
        throw new NotFoundError('Note not found');
      }
      
      if (note.status !== 'draft') {
        throw new ValidationError('Only draft notes can be deleted');
      }
      
      await note.remove();
      
      return { success: true, message: 'Note deleted successfully' };
    } catch (error) {
      logger.error('Error deleting note', {
        error: error.message,
        noteId
      });
      throw error;
    }
  }
};

module.exports = structuredNoteService;
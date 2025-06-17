const clinicalNoteService = require('../services/clinicalNote.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const { clinicalNoteSchemas } = require('../validators/noteTemplate.validator');
const validationMiddleware = require('../middleware/validate.middleware');
const logger = require('../utils/logger');

/**
 * Create a new clinical note
 * @route POST /api/clinical-notes
 * @access Private (Doctors, Nurses)
 */
const createNote = asyncHandler(async (req, res) => {
  // Add the logged-in user as the doctor if not specified
  const noteData = {
    ...req.body,
    doctor: req.body.doctor || req.user._id
  };
  
  const note = await clinicalNoteService.createNote(noteData);
  return ResponseUtil.success(res, { 
    message: 'Clinical note created successfully', 
    note 
  }, 201);
});

/**
 * Get a note by ID
 * @route GET /api/clinical-notes/:id
 * @access Private
 */
const getNoteById = asyncHandler(async (req, res) => {
  const populateRefs = req.query.populate === 'true';
  const note = await clinicalNoteService.getNoteById(req.params.id, populateRefs);
  return ResponseUtil.success(res, { note });
});

/**
 * Get notes for a patient
 * @route GET /api/clinical-notes/patient/:patientId
 * @access Private
 */
const getPatientNotes = asyncHandler(async (req, res) => {
  const options = {
    status: req.query.status,
    templateType: req.query.templateType,
    doctor: req.query.doctor,
    limit: req.query.limit ? parseInt(req.query.limit) : 10,
    page: req.query.page ? parseInt(req.query.page) : 1,
    sort: req.query.sort ? JSON.parse(req.query.sort) : { visitDate: -1 },
    populate: req.query.populate === 'true'
  };
  
  const result = await clinicalNoteService.getPatientNotes(req.params.patientId, options);
  return ResponseUtil.success(res, result);
});

/**
 * Update a clinical note
 * @route PUT /api/clinical-notes/:id
 * @access Private (Doctor who created it or Admin)
 */
const updateNote = asyncHandler(async (req, res) => {
  // Allow admin to edit signed notes
  if (req.user.role === 'admin') {
    req.body.allowEditSigned = true;
  }
  
  const note = await clinicalNoteService.updateNote(req.params.id, req.body);
  return ResponseUtil.success(res, { 
    message: 'Clinical note updated successfully', 
    note 
  });
});

/**
 * Search clinical notes
 * @route POST /api/clinical-notes/search
 * @access Private
 */
const searchNotes = asyncHandler(async (req, res) => {
  const result = await clinicalNoteService.searchNotes(req.body);
  return ResponseUtil.success(res, result);
});

module.exports = {
  createNote: [validationMiddleware?.(clinicalNoteSchemas.create), createNote],
  getNoteById,
  getPatientNotes: [validationMiddleware?.(clinicalNoteSchemas.getPatientNotes, 'query'), getPatientNotes],
  updateNote: [validationMiddleware?.(clinicalNoteSchemas.update), updateNote],
  searchNotes: [validationMiddleware?.(clinicalNoteSchemas.search), searchNotes]
};
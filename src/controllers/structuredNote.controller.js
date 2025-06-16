const structuredNoteService = require('../services/structuredNote.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const logger = require('../utils/logger');

/**
 * Controller for structured notes
 */
const structuredNoteController = {
  /**
   * Create a structured note
   * @route POST /api/structured-notes
   */
  createNote: asyncHandler(async (req, res) => {
    const noteData = req.body;
    
    // Default to the logged-in user as provider if not specified
    if (!noteData.provider) {
      noteData.provider = req.user.userId;
    }
    
    const note = await structuredNoteService.createNote(noteData);
    
    return ResponseUtil.success(res, {
      message: 'Note created successfully',
      note
    }, 201);
  }),

  /**
   * Get note by ID
   * @route GET /api/structured-notes/:noteId
   */
  getNoteById: asyncHandler(async (req, res) => {
    const { noteId } = req.params;
    const note = await structuredNoteService.getNoteById(noteId);
    
    return ResponseUtil.success(res, { note });
  }),

  /**
   * Get notes for a patient
   * @route GET /api/structured-notes/patient/:patientId
   */
  getPatientNotes: asyncHandler(async (req, res) => {
    const { patientId } = req.params;
    const { templateType, status, startDate, endDate } = req.query;
    
    const filters = {};
    if (templateType) filters.templateType = templateType;
    if (status) filters.status = status;
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    
    const notes = await structuredNoteService.getPatientNotes(patientId, filters);
    
    return ResponseUtil.success(res, { notes });
  }),

  /**
   * Get notes by provider
   * @route GET /api/structured-notes/provider/:providerId
   */
  getProviderNotes: asyncHandler(async (req, res) => {
    const providerId = req.params.providerId || req.user.userId;
    const { templateType, status, startDate, endDate } = req.query;
    
    const filters = {};
    if (templateType) filters.templateType = templateType;
    if (status) filters.status = status;
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    
    const notes = await structuredNoteService.getProviderNotes(providerId, filters);
    
    return ResponseUtil.success(res, { notes });
  }),

  /**
   * Get notes by logged in provider
   * @route GET /api/structured-notes/my-notes
   */
  getMyNotes: asyncHandler(async (req, res) => {
    const providerId = req.user.userId;
    const { templateType, status, startDate, endDate } = req.query;
    
    const filters = {};
    if (templateType) filters.templateType = templateType;
    if (status) filters.status = status;
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    
    const notes = await structuredNoteService.getProviderNotes(providerId, filters);
    
    return ResponseUtil.success(res, { notes });
  }),

  /**
   * Update a note
   * @route PUT /api/structured-notes/:noteId
   */
  updateNote: asyncHandler(async (req, res) => {
    const { noteId } = req.params;
    const updateData = req.body;
    
    const note = await structuredNoteService.updateNote(noteId, updateData);
    
    return ResponseUtil.success(res, {
      message: 'Note updated successfully',
      note
    });
  }),

  /**
   * Sign a note
   * @route PUT /api/structured-notes/:noteId/sign
   */
  signNote: asyncHandler(async (req, res) => {
    const { noteId } = req.params;
    const userId = req.user.userId;
    
    const note = await structuredNoteService.signNote(noteId, userId);
    
    return ResponseUtil.success(res, {
      message: 'Note signed successfully',
      note
    });
  }),

  /**
   * Amend a signed note
   * @route PUT /api/structured-notes/:noteId/amend
   */
  amendNote: asyncHandler(async (req, res) => {
    const { noteId } = req.params;
    const { reason, content } = req.body;
    const userId = req.user.userId;
    
    const note = await structuredNoteService.amendNote(noteId, userId, reason, content);
    
    return ResponseUtil.success(res, {
      message: 'Note amended successfully',
      note
    });
  }),

  /**
   * Delete a note
   * @route DELETE /api/structured-notes/:noteId
   */
  deleteNote: asyncHandler(async (req, res) => {
    const { noteId } = req.params;
    const result = await structuredNoteService.deleteNote(noteId);
    
    return ResponseUtil.success(res, result);
  })
};

module.exports = structuredNoteController;
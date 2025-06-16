const express = require('express');
const router = express.Router();
const structuredNoteController = require('../controllers/structuredNote.controller');
const authMiddleware = require('../middleware/auth.middleware');
const authorizationMiddleware = require('../middleware/authorization.middleware');
const noteValidator = require('../validators/structuredNote.validator');
const validate = require('../middleware/validation.middleware');

// Create a new note
router.post(
  '/',
  authMiddleware.authenticate,
  authorizationMiddleware.authorize(['admin', 'doctor', 'nurse']),
  validate(noteValidator.createNoteSchema),
  structuredNoteController.createNote
);

// Get note by ID
router.get(
  '/:noteId',
  authMiddleware.authenticate,
  structuredNoteController.getNoteById
);

// Get notes for a patient
router.get(
  '/patient/:patientId',
  authMiddleware.authenticate,
  structuredNoteController.getPatientNotes
);

// Get notes by provider
router.get(
  '/provider/:providerId',
  authMiddleware.authenticate,
  structuredNoteController.getProviderNotes
);

// Get notes by logged in provider
router.get(
  '/my-notes',
  authMiddleware.authenticate,
  structuredNoteController.getMyNotes
);

// Update a note
router.put(
  '/:noteId',
  authMiddleware.authenticate,
  authorizationMiddleware.authorize(['admin', 'doctor', 'nurse']),
  validate(noteValidator.updateNoteSchema),
  structuredNoteController.updateNote
);

// Sign a note
router.put(
  '/:noteId/sign',
  authMiddleware.authenticate,
  authorizationMiddleware.authorize(['doctor']),
  structuredNoteController.signNote
);

// Amend a signed note
router.put(
  '/:noteId/amend',
  authMiddleware.authenticate,
  authorizationMiddleware.authorize(['doctor']),
  validate(noteValidator.amendNoteSchema),
  structuredNoteController.amendNote
);

// Delete a note
router.delete(
  '/:noteId',
  authMiddleware.authenticate,
  authorizationMiddleware.authorize(['admin', 'doctor']),
  structuredNoteController.deleteNote
);

module.exports = router;
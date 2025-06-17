const express = require('express');
const router = express.Router();
const clinicalNoteController = require('../controllers/clinicalNote.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/authorization.middleware');

// Apply authentication to all routes
router.use(authMiddleware.authenticate);

// Create a new clinical note
router.post('/', 
  checkRole(['doctor', 'nurse']), 
  clinicalNoteController.createNote
);

// Get note by ID
router.get('/:id', clinicalNoteController.getNoteById);

// Get notes for a patient
router.get('/patient/:patientId', clinicalNoteController.getPatientNotes);

// Update a clinical note
router.put('/:id', 
  checkRole(['doctor', 'admin']), 
  clinicalNoteController.updateNote
);

// Search clinical notes
router.post('/search', clinicalNoteController.searchNotes);

module.exports = router;
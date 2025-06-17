const express = require('express');
const router = express.Router();
const clinicalNoteController = require('../controllers/clinicalNote.controller');
const authMiddleware = require('../middleware/auth.middleware');
const authorizationMiddleware = require('../middleware/authorization.middleware'); // Updated import

// Apply authentication to all routes
router.use(authMiddleware.authenticate);

// Create a new clinical note
router.post('/', 
  authorizationMiddleware.checkRole(['doctor', 'nurse']), // Updated to use proper import
  clinicalNoteController.createNote
);

// Get note by ID
router.get('/:id', clinicalNoteController.getNoteById);

// Get notes for a patient
router.get('/patient/:patientId', clinicalNoteController.getPatientNotes);

// Update a clinical note
router.put('/:id', 
  authorizationMiddleware.checkRole(['doctor', 'admin']), // Updated to use proper import
  clinicalNoteController.updateNote
);

// Search clinical notes
router.post('/search', clinicalNoteController.searchNotes);

module.exports = router;
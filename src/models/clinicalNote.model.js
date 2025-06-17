const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

// Schema for the actual field data captured
const noteFieldDataSchema = new mongoose.Schema({
  fieldId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
}, { _id: false });

const clinicalNoteSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NoteTemplate',
    required: true
  },
  templateType: {
    type: String,
    enum: ['SOAP', 'Progress', 'Consultation', 'Discharge', 'Admission', 'Surgical', 'Custom'],
    required: true
  },
  templateName: {
    type: String,
    required: true
  },
  fieldData: [noteFieldDataSchema],
  visitDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  relatedAppointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  tags: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['draft', 'completed', 'signed'],
    default: 'draft'
  },
  signedAt: {
    type: Date
  },
  isEncrypted: {
    type: Boolean,
    default: true
  }
}, baseSchema.baseOptions);

// Create indexes for improved query performance
clinicalNoteSchema.index({ patient: 1, visitDate: -1 });
clinicalNoteSchema.index({ doctor: 1, visitDate: -1 });
clinicalNoteSchema.index({ templateType: 1 });
clinicalNoteSchema.index({ status: 1 });
clinicalNoteSchema.index({ 'fieldData.name': 1 });
clinicalNoteSchema.index({ tags: 1 });

const ClinicalNote = mongoose.model('ClinicalNote', clinicalNoteSchema);

module.exports = ClinicalNote;
const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

const fieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['text', 'textarea', 'number', 'select', 'checkbox', 'radio', 'date'],
    required: true
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [{ // Only used for select, checkbox, and radio types
    label: String,
    value: String
  }],
  defaultValue: {
    type: mongoose.Schema.Types.Mixed
  },
  order: {
    type: Number,
    default: 0
  },
  section: {
    type: String,
    enum: ['subjective', 'objective', 'assessment', 'plan', 'other'],
    default: 'other'
  },
  hint: {
    type: String,
    trim: true
  }
}, { _id: true });

const noteTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['SOAP', 'Progress', 'Consultation', 'Discharge', 'Admission', 'Surgical', 'Custom'],
    required: true
  },
  fields: [fieldSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  isSystemTemplate: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  specialtyRelevance: [{
    type: String,
    trim: true
  }]
}, baseSchema.baseOptions);

// Add indexes for faster queries
noteTemplateSchema.index({ name: 1 });
noteTemplateSchema.index({ type: 1 });
noteTemplateSchema.index({ specialtyRelevance: 1 });
noteTemplateSchema.index({ createdBy: 1 });

const NoteTemplate = mongoose.model('NoteTemplate', noteTemplateSchema);

module.exports = NoteTemplate;
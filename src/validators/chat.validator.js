// src/validators/chat.validator.js

const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

// Validate ObjectId format
const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(value);
};

// Create chat room validators
const createChatRoomValidator = [
  body('name')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Chat room name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Chat room name must be between 3 and 100 characters'),
  
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('type')
    .optional()
    .isIn(['case_discussion', 'general', 'department'])
    .withMessage('Invalid chat room type'),
  
  body('patientId')
    .optional()
    .custom(isValidObjectId)
    .withMessage('Invalid patient ID'),
  
  body('participantIds')
    .optional()
    .isArray()
    .withMessage('Participant IDs must be an array')
    .custom(ids => ids.every(id => isValidObjectId(id)))
    .withMessage('All participant IDs must be valid')
];

// Send message validators
const sendMessageValidator = [
  param('chatRoomId')
    .custom(isValidObjectId)
    .withMessage('Invalid chat room ID'),
  
  body('content')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Message content is required'),
  
  body('messageType')
    .optional()
    .isIn(['text', 'image', 'file', 'system', 'record_reference'])
    .withMessage('Invalid message type'),
  
  body('recordReferences')
    .optional()
    .isArray()
    .withMessage('Record references must be an array')
    .custom(refs => 
      refs.every(ref => 
        isValidObjectId(ref.recordId) &&
        ['medical_record', 'prescription', 'lab_result', 'imaging', 'note', 'document'].includes(ref.recordType)
      )
    )
    .withMessage('Invalid record references'),
  
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array')
    .custom(attachments => 
      attachments.every(att => 
        isValidObjectId(att.fileId) &&
        typeof att.fileName === 'string' &&
        typeof att.fileType === 'string'
      )
    )
    .withMessage('Invalid attachments format'),
  
  body('parentMessageId')
    .optional()
    .custom(isValidObjectId)
    .withMessage('Invalid parent message ID')
];

// Add participant validators
const addParticipantValidator = [
  param('chatRoomId')
    .custom(isValidObjectId)
    .withMessage('Invalid chat room ID'),
  
  body('participantId')
    .custom(isValidObjectId)
    .withMessage('Invalid participant ID')
];

// Remove participant validators
const removeParticipantValidator = [
  param('chatRoomId')
    .custom(isValidObjectId)
    .withMessage('Invalid chat room ID'),
  
  param('participantId')
    .custom(isValidObjectId)
    .withMessage('Invalid participant ID')
];

// Record patient consent validators
const recordPatientConsentValidator = [
  param('chatRoomId')
    .custom(isValidObjectId)
    .withMessage('Invalid chat room ID'),
  
  body('obtained')
    .optional()
    .isBoolean()
    .withMessage('Obtained must be a boolean'),
  
  body('method')
    .optional()
    .isIn(['verbal', 'written', 'electronic', 'implied'])
    .withMessage('Invalid consent method'),
  
  body('consentDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format for consent date'),
  
  body('expirationDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format for expiration date'),
  
  body('scope')
    .optional()
    .isIn(['internal_discussion', 'external_limited', 'external_full'])
    .withMessage('Invalid consent scope'),
  
  body('externalSharing.allowed')
    .optional()
    .isBoolean()
    .withMessage('External sharing allowed must be a boolean'),
  
  body('externalSharing.requiresAdditionalConsent')
    .optional()
    .isBoolean()
    .withMessage('Requires additional consent must be a boolean')
];

// Update chat room validators
const updateChatRoomValidator = [
  param('chatRoomId')
    .custom(isValidObjectId)
    .withMessage('Invalid chat room ID'),
  
  body('name')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Chat room name cannot be empty')
    .isLength({ min: 3, max: 100 })
    .withMessage('Chat room name must be between 3 and 100 characters'),
  
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('isArchived')
    .optional()
    .isBoolean()
    .withMessage('isArchived must be a boolean'),
  
  body('isLocked')
    .optional()
    .isBoolean()
    .withMessage('isLocked must be a boolean'),
  
  body('externalSharing')
    .optional()
    .isObject()
    .withMessage('External sharing must be an object')
];

// Edit message validators
const editMessageValidator = [
  param('messageId')
    .custom(isValidObjectId)
    .withMessage('Invalid message ID'),
  
  body('content')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Message content is required')
];

// Get messages query validators
const getMessagesValidator = [
  param('chatRoomId')
    .custom(isValidObjectId)
    .withMessage('Invalid chat room ID'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('before')
    .optional()
    .isISO8601()
    .withMessage('Before must be a valid date'),
  
  query('parentMessageId')
    .optional()
    .custom(isValidObjectId)
    .withMessage('Invalid parent message ID')
];

module.exports = {
  createChatRoomValidator,
  sendMessageValidator,
  addParticipantValidator,
  removeParticipantValidator,
  recordPatientConsentValidator,
  updateChatRoomValidator,
  editMessageValidator,
  getMessagesValidator
};
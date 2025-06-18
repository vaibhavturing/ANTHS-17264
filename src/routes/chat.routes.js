// src/routes/chat.routes.js

const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chat.controller');
const { 
  createChatRoomValidator,
  sendMessageValidator,
  addParticipantValidator,
  removeParticipantValidator,
  recordPatientConsentValidator,
  updateChatRoomValidator,
  editMessageValidator,
  getMessagesValidator
} = require('../validators/chat.validator');
const authMiddleware = require('../middleware/auth.middleware');
const roleMiddleware = require('../middleware/role.middleware');

// All chat routes require authentication
router.use(authMiddleware);

// Doctor-only routes (all chat functionality is restricted to doctors)
router.use(roleMiddleware(['doctor', 'admin']));

// Chat rooms
router.post('/', createChatRoomValidator, ChatController.createChatRoom);
router.get('/', ChatController.getChatRooms);
router.get('/:chatRoomId', ChatController.getChatRoom);
router.patch('/:chatRoomId', updateChatRoomValidator, ChatController.updateChatRoom);

// Messages
router.get('/:chatRoomId/messages', getMessagesValidator, ChatController.getMessages);
router.post('/:chatRoomId/messages', sendMessageValidator, ChatController.sendMessage);
router.put('/messages/:messageId', editMessageValidator, ChatController.editMessage);
router.delete('/messages/:messageId', ChatController.deleteMessage);

// Participants
router.post('/:chatRoomId/participants', addParticipantValidator, ChatController.addParticipant);
router.delete('/:chatRoomId/participants/:participantId', removeParticipantValidator, ChatController.removeParticipant);

// Patient consent
router.post('/:chatRoomId/consent', recordPatientConsentValidator, ChatController.recordPatientConsent);
router.get('/:chatRoomId/consent/history', ChatController.getPatientConsentHistory);

module.exports = router;
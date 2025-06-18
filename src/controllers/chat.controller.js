// src/controllers/chat.controller.js

const ChatService = require('../services/chat.service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Controller for handling chat functionality
 */
class ChatController {
  /**
   * Create a new chat room
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @returns {Response} JSON response
   */
  async createChatRoom(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const chatRoomData = {
        ...req.body,
        creatorName: req.user.name
      };
      
      const chatRoom = await ChatService.createChatRoom(chatRoomData, req.user._id);
      
      return res.status(201).json({
        success: true,
        data: chatRoom
      });
    } catch (error) {
      logger.error(`Error in createChatRoom: ${error.message}`, { error });
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while creating chat room'
      });
    }
  }
  
  /**
   * Get chat rooms for the current user
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @returns {Response} JSON response
   */
  async getChatRooms(req, res) {
    try {
      const filters = {
        isArchived: req.query.isArchived === 'true',
        type: req.query.type,
        patientId: req.query.patientId,
        searchTerm: req.query.search,
        limit: parseInt(req.query.limit) || 20,
        skip: parseInt(req.query.skip) || 0
      };
      
      const chatRooms = await ChatService.getChatRoomsByUser(req.user._id, filters);
      
      return res.json({
        success: true,
        data: chatRooms
      });
    } catch (error) {
      logger.error(`Error in getChatRooms: ${error.message}`, { error });
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while getting chat rooms'
      });
    }
  }
  
  /**
   * Get a specific chat room
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @returns {Response} JSON response
   */
  async getChatRoom(req, res) {
    try {
      const { chatRoomId } = req.params;
      
      const chatRoom = await ChatService.getChatRoomById(chatRoomId, req.user._id);
      
      return res.json({
        success: true,
        data: chatRoom
      });
    } catch (error) {
      logger.error(`Error in getChatRoom: ${error.message}`, { error });
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while getting the chat room'
      });
    }
  }
  
  /**
   * Send a message in a chat room
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @returns {Response} JSON response
   */
  async sendMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { chatRoomId } = req.params;
      const messageData = {
        ...req.body,
        chatRoomId
      };
      
      const message = await ChatService.sendMessage(messageData, req.user._id);
      
      // Populate sender info for the response
      await message.populate('senderId', 'name email role profileImage');
      
      return res.status(201).json({
        success: true,
        data: message
      });
    } catch (error) {
      logger.error(`Error in sendMessage: ${error.message}`, { error });
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while sending the message'
      });
    }
  }
  
  /**
   * Get messages for a chat room
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @returns {Response} JSON response
   */
  async getMessages(req, res) {
    try {
      const { chatRoomId } = req.params;
      const options = {
        limit: parseInt(req.query.limit) || 50,
        before: req.query.before,
        parentMessageId: req.query.parentMessageId
      };
      
      const messages = await ChatService.getMessages(chatRoomId, req.user._id, options);
      
      return res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      logger.error(`Error in getMessages: ${error.message}`, { error });
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while getting messages'
      });
    }
  }
  
  /**
   * Add a participant to a chat room
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @returns {Response} JSON response
   */
  async addParticipant(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { chatRoomId } = req.params;
      const { participantId } = req.body;
      
      const chatRoom = await ChatService.addParticipant(
        chatRoomId, 
        participantId, 
        req.user._id
      );
      
      // Populate participant info for the response
      await chatRoom.populate('participants.userId', 'name email role profileImage');
      
      return res.json({
        success: true,
        data: chatRoom
      });
    } catch (error) {
      logger.error(`Error in addParticipant: ${error.message}`, { error });
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while adding the participant'
      });
    }
  }
  
  /**
   * Remove a participant from a chat room
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @returns {Response} JSON response
   */
  async removeParticipant(req, res) {
    try {
      const { chatRoomId, participantId } = req.params;
      
      const chatRoom = await ChatService.removeParticipant(
        chatRoomId, 
        participantId, 
        req.user._id
      );
      
      // Populate participant info for the response
      await chatRoom.populate('participants.userId', 'name email role profileImage');
      
      return res.json({
        success: true,
        data: chatRoom
      });
    } catch (error) {
      logger.error(`Error in removeParticipant: ${error.message}`, { error });
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while removing the participant'
      });
    }
  }
  
  /**
   * Record patient consent
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @returns {Response} JSON response
   */
  async recordPatientConsent(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { chatRoomId } = req.params;
      const consentData = req.body;
      
      const updatedConsent = await ChatService.recordPatientConsent(
        chatRoomId,
        consentData,
        req.user._id
      );
      
      return res.json({
        success: true,
        data: updatedConsent
      });
    } catch (error) {
      logger.error(`Error in recordPatientConsent: ${error.message}`, { error });
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while recording patient consent'
      });
    }
  }
  
  /**
   * Update chat room settings
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @returns {Response} JSON response
   */
  async updateChatRoom(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { chatRoomId } = req.params;
      const updateData = {
        ...req.body,
        userName: req.user.name
      };
      
      const chatRoom = await ChatService.updateChatRoom(
        chatRoomId,
        updateData,
        req.user._id
      );
      
      return res.json({
        success: true,
        data: chatRoom
      });
    } catch (error) {
      logger.error(`Error in updateChatRoom: ${error.message}`, { error });
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while updating the chat room'
      });
    }
  }
  
  /**
   * Delete a message
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @returns {Response} JSON response
   */
  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      
      await ChatService.deleteMessage(messageId, req.user._id);
      
      return res.json({
        success: true,
        message: 'Message deleted successfully'
      });
    } catch (error) {
      logger.error(`Error in deleteMessage: ${error.message}`, { error });
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while deleting the message'
      });
    }
  }
  
  /**
   * Edit a message
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @returns {Response} JSON response
   */
  async editMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { messageId } = req.params;
      const updateData = req.body;
      
      const message = await ChatService.editMessage(
        messageId,
        updateData,
        req.user._id
      );
      
      return res.json({
        success: true,
        data: message
      });
    } catch (error) {
      logger.error(`Error in editMessage: ${error.message}`, { error });
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while editing the message'
      });
    }
  }
  
  /**
   * Get patient consent history
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @returns {Response} JSON response
   */
  async getPatientConsentHistory(req, res) {
    try {
      const { chatRoomId } = req.params;
      
      const consentHistory = await ChatService.getPatientConsentHistory(
        chatRoomId,
        req.user._id
      );
      
      return res.json({
        success: true,
        data: consentHistory
      });
    } catch (error) {
      logger.error(`Error in getPatientConsentHistory: ${error.message}`, { error });
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while getting patient consent history'
      });
    }
  }
}

module.exports = new ChatController();
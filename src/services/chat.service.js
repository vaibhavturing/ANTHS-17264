// src/services/chat.service.js

const ChatRoom = require('../models/chatRoom.model');
const ChatMessage = require('../models/chatMessage.model');
const PatientConsentLog = require('../models/patientConsentLog.model');
const User = require('../models/user.model');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const encryptionService = require('./encryption.service');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../utils/errors');

/**
 * Service for managing secure doctor-to-doctor chats
 */
class ChatService {
  /**
   * Create a new chat room
   * @param {Object} chatRoomData - Chat room data
   * @param {string} userId - Creating user ID
   * @returns {Promise<ChatRoom>} - Created chat room
   */
  async createChatRoom(chatRoomData, userId) {
    try {
      // Get a new encryption key for this chat room
      const keyId = await encryptionService.generateNewKey();
      
      // Create the chat room with encryption details
      const chatRoomObj = {
        ...chatRoomData,
        createdBy: userId,
        encryption: {
          keyId,
          algorithm: 'aes-256-gcm'
        },
        participants: [{
          userId,
          role: 'owner',
          addedAt: new Date(),
          addedBy: userId
        }]
      };
      
      // Add participants if provided
      if (chatRoomData.participantIds && chatRoomData.participantIds.length > 0) {
        // Filter out duplicates and creator (who is already added as owner)
        const uniqueParticipants = [...new Set(chatRoomData.participantIds)]
          .filter(id => id.toString() !== userId.toString());
        
        // Add each participant
        uniqueParticipants.forEach(participantId => {
          chatRoomObj.participants.push({
            userId: participantId,
            role: 'member',
            addedAt: new Date(),
            addedBy: userId
          });
        });
      }
      
      const chatRoom = new ChatRoom(chatRoomObj);
      await chatRoom.save();
      
      // Create a system message indicating the room was created
      await this.createSystemMessage(
        chatRoom._id,
        `Dr. ${chatRoomData.creatorName || 'Unknown'} created this discussion room.`
      );
      
      return chatRoom;
    } catch (error) {
      logger.error(`Error creating chat room: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Get chat rooms where user is a participant
   * @param {string} userId - User ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} - Chat rooms
   */
  async getChatRoomsByUser(userId, filters = {}) {
    try {
      const { isArchived = false, type, patientId, searchTerm, limit = 20, skip = 0 } = filters;
      
      // Build query
      const query = {
        'participants.userId': mongoose.Types.ObjectId(userId),
        isArchived
      };
      
      if (type) {
        query.type = type;
      }
      
      if (patientId) {
        query.patientId = mongoose.Types.ObjectId(patientId);
      }
      
      // Get chat rooms
      const chatRooms = await ChatRoom.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('patientId', 'firstName lastName dateOfBirth mrn')
        .populate('participants.userId', 'name email role')
        .lean();
      
      // Decrypt chat room names and descriptions
      const decryptedRooms = chatRooms.map(room => {
        const decryptedRoom = { ...room };
        try {
          // Names were auto-decrypted by the getter, but we need to handle it manually for lean() results
          decryptedRoom.name = encryptionService.decryptData(room.name);
          if (room.description) {
            decryptedRoom.description = encryptionService.decryptData(room.description);
          }
        } catch (decryptError) {
          logger.error(`Failed to decrypt chat room data: ${decryptError.message}`);
          decryptedRoom.name = 'Encrypted Room';
          decryptedRoom.description = 'Encrypted description';
        }
        return decryptedRoom;
      });
      
      // If search term is provided, filter in memory (since we can only search decrypted names)
      let filteredRooms = decryptedRooms;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredRooms = decryptedRooms.filter(room => 
          room.name.toLowerCase().includes(term) || 
          (room.description && room.description.toLowerCase().includes(term))
        );
      }
      
      return filteredRooms;
    } catch (error) {
      logger.error(`Error getting chat rooms: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Get a single chat room by ID
   * @param {string} chatRoomId - Chat room ID
   * @param {string} userId - User ID (for access control)
   * @returns {Promise<ChatRoom>} - Chat room
   */
  async getChatRoomById(chatRoomId, userId) {
    try {
      const chatRoom = await ChatRoom.findById(chatRoomId)
        .populate('patientId', 'firstName lastName dateOfBirth mrn')
        .populate('participants.userId', 'name email role profileImage')
        .populate('patientConsent.obtainedBy', 'name');
      
      if (!chatRoom) {
        throw new NotFoundError('Chat room not found');
      }
      
      // Check if user is a participant
      if (!chatRoom.isParticipant(userId)) {
        throw new ForbiddenError('You do not have access to this chat room');
      }
      
      return chatRoom;
    } catch (error) {
      logger.error(`Error getting chat room: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Send a message in a chat room
   * @param {Object} messageData - Message data
   * @param {string} userId - Sender ID
   * @returns {Promise<ChatMessage>} - Created message
   */
  async sendMessage(messageData, userId) {
    try {
      const { chatRoomId, content, messageType = 'text', recordReferences, attachments, parentMessageId } = messageData;
      
      // Verify chat room exists and user is a participant
      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom) {
        throw new NotFoundError('Chat room not found');
      }
      
      if (!chatRoom.isParticipant(userId)) {
        throw new ForbiddenError('You are not a participant in this chat room');
      }
      
      if (chatRoom.isLocked) {
        throw new ForbiddenError('This chat room is locked and does not accept new messages');
      }
      
      // If this is a record reference message, verify patient consent
      if (messageType === 'record_reference' && recordReferences && recordReferences.length > 0) {
        if (!chatRoom.patientConsent.obtained) {
          throw new ForbiddenError('Patient consent must be obtained before sharing records');
        }
        
        // Check if consent has expired
        if (chatRoom.patientConsent.expirationDate && new Date(chatRoom.patientConsent.expirationDate) < new Date()) {
          throw new ForbiddenError('Patient consent has expired');
        }
      }
      
      // Create message
      const message = new ChatMessage({
        chatRoomId,
        senderId: userId,
        content,
        messageType,
        recordReferences: recordReferences || [],
        attachments: attachments || [],
        parentMessageId: parentMessageId || null,
        status: 'sent',
        readBy: [{ userId, readAt: new Date() }] // Sender has read the message
      });
      
      await message.save();
      
      // Update the chat room's updatedAt timestamp
      await ChatRoom.updateOne({ _id: chatRoomId }, { $set: { updatedAt: new Date() } });
      
      return message;
    } catch (error) {
      logger.error(`Error sending message: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Create a system message (internal use)
   * @param {string} chatRoomId - Chat room ID
   * @param {string} content - System message content
   * @returns {Promise<ChatMessage>} - Created system message
   */
  async createSystemMessage(chatRoomId, content) {
    try {
      const message = new ChatMessage({
        chatRoomId,
        // Use a special system user ID or null for system messages
        senderId: '000000000000000000000000', // This is a placeholder - you might want to create a system user
        content,
        messageType: 'system',
        status: 'sent'
      });
      
      await message.save();
      return message;
    } catch (error) {
      logger.error(`Error creating system message: ${error.message}`, { error });
      // Don't throw - system messages are non-critical
      return null;
    }
  }
  
  /**
   * Get messages for a chat room
   * @param {string} chatRoomId - Chat room ID
   * @param {string} userId - User ID (for access control)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Messages
   */
  async getMessages(chatRoomId, userId, options = {}) {
    try {
      const { limit = 50, before, parentMessageId } = options;
      
      // Verify chat room exists and user is a participant
      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom) {
        throw new NotFoundError('Chat room not found');
      }
      
      if (!chatRoom.isParticipant(userId)) {
        throw new ForbiddenError('You are not a participant in this chat room');
      }
      
      // Build query
      const query = {
        chatRoomId,
        isDeleted: { $ne: true }
      };
      
      // If parentMessageId is specified, get replies to that message
      if (parentMessageId) {
        query.parentMessageId = parentMessageId;
      } else {
        // Otherwise, get top-level messages (not replies)
        query.parentMessageId = null;
      }
      
      // If before parameter is provided, get messages before that timestamp
      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }
      
      const messages = await ChatMessage.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('senderId', 'name email role profileImage')
        .populate('readBy.userId', 'name')
        .lean();
      
      // Decrypt message content
      const decryptedMessages = messages.map(message => {
        const decryptedMessage = { ...message };
        try {
          decryptedMessage.content = encryptionService.decryptData(message.content);
        } catch (decryptError) {
          logger.error(`Failed to decrypt message: ${decryptError.message}`);
          decryptedMessage.content = 'Encrypted content';
        }
        return decryptedMessage;
      });
      

      // Update read receipts for these messages
      const messageIds = messages.map(m => m._id);
      await this.markMessagesAsRead(chatRoomId, messageIds, userId);
      
      return decryptedMessages.reverse(); // Return in chronological order
    } catch (error) {
      logger.error(`Error getting messages: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Mark messages as read
   * @param {string} chatRoomId - Chat room ID
   * @param {Array} messageIds - Message IDs to mark as read
   * @param {string} userId - User ID 
   * @returns {Promise<boolean>} - Success status
   */
  async markMessagesAsRead(chatRoomId, messageIds, userId) {
    try {
      // Update each message that hasn't been read by this user yet
      await ChatMessage.updateMany(
        {
          _id: { $in: messageIds },
          chatRoomId,
          'readBy.userId': { $ne: userId }
        },
        {
          $push: {
            readBy: {
              userId,
              readAt: new Date()
            }
          }
        }
      );
      
      return true;
    } catch (error) {
      logger.error(`Error marking messages as read: ${error.message}`, { error });
      // Don't throw - read receipts are non-critical
      return false;
    }
  }
  
  /**
   * Add a participant to a chat room
   * @param {string} chatRoomId - Chat room ID
   * @param {string} participantId - User ID to add
   * @param {string} addedBy - User ID performing the action
   * @returns {Promise<ChatRoom>} - Updated chat room
   */
  async addParticipant(chatRoomId, participantId, addedBy) {
    try {
      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom) {
        throw new NotFoundError('Chat room not found');
      }
      
      // Check if user adding has permission (must be owner)
      if (!chatRoom.isOwner(addedBy)) {
        throw new ForbiddenError('Only chat room owners can add participants');
      }
      
      // Check if user is already a participant
      if (chatRoom.isParticipant(participantId)) {
        throw new BadRequestError('User is already a participant in this chat room');
      }
      
      // Verify the participant is a valid user (and a doctor)
      const participant = await User.findById(participantId);
      if (!participant) {
        throw new NotFoundError('User not found');
      }
      
      if (participant.role !== 'doctor') {
        throw new ForbiddenError('Only doctors can be added to case discussions');
      }
      
      // Add the participant
      chatRoom.participants.push({
        userId: participantId,
        role: 'member',
        addedAt: new Date(),
        addedBy
      });
      
      await chatRoom.save();
      
      // Create a system message
      const adder = await User.findById(addedBy, 'name');
      const newParticipant = await User.findById(participantId, 'name');
      
      await this.createSystemMessage(
        chatRoomId,
        `Dr. ${adder.name} added Dr. ${newParticipant.name} to the discussion.`
      );
      
      return chatRoom;
    } catch (error) {
      logger.error(`Error adding participant: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Remove a participant from a chat room
   * @param {string} chatRoomId - Chat room ID
   * @param {string} participantId - User ID to remove
   * @param {string} removedBy - User ID performing the action
   * @returns {Promise<ChatRoom>} - Updated chat room
   */
  async removeParticipant(chatRoomId, participantId, removedBy) {
    try {
      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom) {
        throw new NotFoundError('Chat room not found');
      }
      
      // Check permissions (must be owner or self-removal)
      const isSelfRemoval = participantId.toString() === removedBy.toString();
      if (!isSelfRemoval && !chatRoom.isOwner(removedBy)) {
        throw new ForbiddenError('Only chat room owners can remove other participants');
      }
      
      // Check if user is a participant
      if (!chatRoom.isParticipant(participantId)) {
        throw new BadRequestError('User is not a participant in this chat room');
      }
      
      // Cannot remove the owner (unless there are multiple owners)
      const isTargetOwner = chatRoom.participants.some(p => 
        p.userId.toString() === participantId.toString() && p.role === 'owner'
      );
      
      const ownerCount = chatRoom.participants.filter(p => p.role === 'owner').length;
      
      if (isTargetOwner && ownerCount <= 1) {
        throw new ForbiddenError('Cannot remove the only owner of the chat room');
      }
      
      // Remove the participant
      chatRoom.participants = chatRoom.participants.filter(
        p => p.userId.toString() !== participantId.toString()
      );
      
      await chatRoom.save();
      
      // Create a system message
      let systemMessage;
      if (isSelfRemoval) {
        const user = await User.findById(participantId, 'name');
        systemMessage = `Dr. ${user.name} left the discussion.`;
      } else {
        const remover = await User.findById(removedBy, 'name');
        const removed = await User.findById(participantId, 'name');
        systemMessage = `Dr. ${remover.name} removed Dr. ${removed.name} from the discussion.`;
      }
      
      await this.createSystemMessage(chatRoomId, systemMessage);
      
      return chatRoom;
    } catch (error) {
      logger.error(`Error removing participant: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Record patient consent for a chat room
   * @param {string} chatRoomId - Chat room ID 
   * @param {Object} consentData - Consent information
   * @param {string} recordedBy - User ID recording consent
   * @returns {Promise<Object>} - Updated consent information
   */
  async recordPatientConsent(chatRoomId, consentData, recordedBy) {
    try {
      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom) {
        throw new NotFoundError('Chat room not found');
      }
      
      // Check if user has permission
      if (!chatRoom.isParticipant(recordedBy)) {
        throw new ForbiddenError('Only participants can record patient consent');
      }
      
      // Check if patient is associated with the chat room
      if (!chatRoom.patientId) {
        throw new BadRequestError('No patient is associated with this chat room');
      }
      
      const { 
        obtained = true, 
        method, 
        consentDate = new Date(),
        expirationDate,
        scope = 'internal_discussion',
        notes,
        consentDocumentId,
        externalSharing
      } = consentData;
      
      // Update consent status in chat room
      chatRoom.patientConsent = {
        obtained,
        consentDate,
        obtainedBy: recordedBy,
        expirationDate: expirationDate || null,
        notes: notes || '',
        consentDocumentId: consentDocumentId || null
      };
      
      // Update external sharing settings if provided
      if (externalSharing) {
        chatRoom.externalSharing = {
          ...chatRoom.externalSharing,
          ...externalSharing
        };
      }
      
      await chatRoom.save();
      
      // Log the consent action for audit trail
      const consentLog = new PatientConsentLog({
        patientId: chatRoom.patientId,
        recordedBy,
        chatRoomId,
        actionType: obtained ? 'granted' : 'revoked',
        consentDetails: {
          method: method || 'verbal',
          consentDate,
          expirationDate,
          scope,
          notes,
          consentDocumentId
        },
        externalSharing: externalSharing || null
      });
      
      await consentLog.save();
      
      // Create a system message
      const doctor = await User.findById(recordedBy, 'name');
      const actionText = obtained ? 'recorded' : 'revoked';
      const systemMessage = `Dr. ${doctor.name} ${actionText} patient consent for this discussion.`;
      await this.createSystemMessage(chatRoomId, systemMessage);
      
      return chatRoom.patientConsent;
    } catch (error) {
      logger.error(`Error recording patient consent: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Update chat room settings
   * @param {string} chatRoomId - Chat room ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - User making the update
   * @returns {Promise<ChatRoom>} - Updated chat room
   */
  async updateChatRoom(chatRoomId, updateData, userId) {
    try {
      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom) {
        throw new NotFoundError('Chat room not found');
      }
      
      // Check if user is owner
      if (!chatRoom.isOwner(userId)) {
        throw new ForbiddenError('Only chat room owners can update settings');
      }
      
      const allowedUpdates = [
        'name', 'description', 'isArchived', 'isLocked', 
        'externalSharing', 'autoExpire'
      ];
      
      // Apply allowed updates
      allowedUpdates.forEach(field => {
        if (updateData[field] !== undefined) {
          chatRoom[field] = updateData[field];
        }
      });
      
      await chatRoom.save();
      
      // Create a system message for significant changes
      if (updateData.isArchived !== undefined) {
        const action = updateData.isArchived ? 'archived' : 'unarchived';
        await this.createSystemMessage(
          chatRoomId,
          `Dr. ${updateData.userName || 'Unknown'} ${action} this discussion.`
        );
      }
      
      if (updateData.isLocked !== undefined) {
        const action = updateData.isLocked ? 'locked' : 'unlocked';
        await this.createSystemMessage(
          chatRoomId,
          `Dr. ${updateData.userName || 'Unknown'} ${action} this discussion.`
        );
      }
      
      return chatRoom;
    } catch (error) {
      logger.error(`Error updating chat room: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Delete a message (mark as deleted)
   * @param {string} messageId - Message ID to delete
   * @param {string} userId - User performing the deletion
   * @returns {Promise<boolean>} - Success status
   */
  async deleteMessage(messageId, userId) {
    try {
      const message = await ChatMessage.findById(messageId);
      if (!message) {
        throw new NotFoundError('Message not found');
      }
      
      // Only the sender can delete their messages
      if (message.senderId.toString() !== userId.toString()) {
        throw new ForbiddenError('You can only delete your own messages');
      }
      
      // Check if message is older than 24 hours (optional policy)
      const messageAge = Date.now() - message.createdAt.getTime();
      const MAX_DELETE_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      if (messageAge > MAX_DELETE_AGE) {
        throw new ForbiddenError('Messages older than 24 hours cannot be deleted');
      }
      
      // Mark as deleted (don't actually delete for audit trail)
      message.isDeleted = true;
      message.content = encryptionService.encryptData('This message has been deleted');
      await message.save();
      
      return true;
    } catch (error) {
      logger.error(`Error deleting message: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Edit a message
   * @param {string} messageId - Message ID
   * @param {Object} updateData - Update data
   * @param {string} userId - User performing the edit
   * @returns {Promise<ChatMessage>} - Updated message
   */
  async editMessage(messageId, updateData, userId) {
    try {
      const message = await ChatMessage.findById(messageId);
      if (!message) {
        throw new NotFoundError('Message not found');
      }
      
      // Only the sender can edit their messages
      if (message.senderId.toString() !== userId.toString()) {
        throw new ForbiddenError('You can only edit your own messages');
      }
      
      // Check if message is older than 24 hours (optional policy)
      const messageAge = Date.now() - message.createdAt.getTime();
      const MAX_EDIT_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      if (messageAge > MAX_EDIT_AGE) {
        throw new ForbiddenError('Messages older than 24 hours cannot be edited');
      }
      
      // Update content and edited status
      message.content = updateData.content;
      // isEdited flag and edit history are handled by the pre-save middleware
      
      await message.save();
      
      return message;
    } catch (error) {
      logger.error(`Error editing message: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Get patient consent history for a chat room
   * @param {string} chatRoomId - Chat room ID
   * @param {string} userId - User ID requesting history
   * @returns {Promise<Array>} - Consent history
   */
  async getPatientConsentHistory(chatRoomId, userId) {
    try {
      const chatRoom = await ChatRoom.findById(chatRoomId);
      if (!chatRoom) {
        throw new NotFoundError('Chat room not found');
      }
      
      // Check if user is a participant
      if (!chatRoom.isParticipant(userId)) {
        throw new ForbiddenError('You do not have access to this chat room');
      }
      
      // Check if patient is associated with the chat room
      if (!chatRoom.patientId) {
        throw new BadRequestError('No patient is associated with this chat room');
      }
      
      // Get consent history
      const consentLogs = await PatientConsentLog.find({
        chatRoomId
      })
        .sort({ createdAt: -1 })
        .populate('recordedBy', 'name role')
        .populate('witness.userId', 'name role')
        .lean();
      
      return consentLogs;
    } catch (error) {
      logger.error(`Error getting patient consent history: ${error.message}`, { error });
      throw error;
    }
  }
}

module.exports = new ChatService();
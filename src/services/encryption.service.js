// src/services/encryption.service.js

const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../utils/logger');

// A key management service would be better for production
// This is a simplified version for demonstration
const keyStore = new Map();

/**
 * Service for handling encryption operations
 * In a production environment, this would use a proper key management system (KMS)
 */
class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.masterKey = config.encryption.masterKey || crypto.randomBytes(32).toString('hex');
    this.initKeyStore();
  }
  
  /**
   * Initialize the key store with a default key
   */
  initKeyStore() {
    // Create a default key
    const defaultKey = crypto.randomBytes(32);
    const defaultKeyId = 'default-key-' + Date.now().toString();
    keyStore.set(defaultKeyId, defaultKey);
  }
  
  /**
   * Generate a new encryption key
   * @returns {string} The key ID
   */
  async generateNewKey() {
    const newKey = crypto.randomBytes(32);
    const keyId = 'key-' + Date.now().toString() + '-' + crypto.randomBytes(4).toString('hex');
    keyStore.set(keyId, newKey);
    return keyId;
  }
  
  /**
   * Get a key by its ID
   * @param {string} keyId 
   * @returns {Buffer} The encryption key
   */
  getKey(keyId) {
    if (!keyStore.has(keyId)) {
      // In production, you would fetch the key from a secure storage
      throw new Error(`Encryption key not found: ${keyId}`);
    }
    return keyStore.get(keyId);
  }
  
  /**
   * Encrypt data with a specific key
   * @param {string} text - Text to encrypt
   * @param {string} keyId - ID of the key to use
   * @returns {string} Encrypted text (base64)
   */
  encryptWithKey(text, keyId) {
    try {
      const key = this.getKey(keyId);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      const authTag = cipher.getAuthTag().toString('base64');
      
      // Return IV + auth tag + encrypted text
      return `${iv.toString('base64')}:${authTag}:${keyId}:${encrypted}`;
    } catch (error) {
      logger.error(`Encryption error: ${error.message}`, { error });
      throw new Error('Failed to encrypt data');
    }
  }
  
  /**
   * Decrypt data with the appropriate key
   * @param {string} encryptedText - Encrypted text
   * @returns {string} Decrypted text
   */
  decryptWithKey(encryptedText) {
    try {
      const [ivBase64, authTagBase64, keyId, encrypted] = encryptedText.split(':');
      
      const key = this.getKey(keyId);
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');
      
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error(`Decryption error: ${error.message}`, { error });
      throw new Error('Failed to decrypt data');
    }
  }
  
  /**
   * Encrypt data using the default key
   * @param {string} text - Text to encrypt
   * @returns {string} Encrypted text
   */
  encryptData(text) {
    // For simplicity, we just use the first key in the store
    const keyId = keyStore.keys().next().value;
    return this.encryptWithKey(text, keyId);
  }
  
  /**
   * Decrypt data
   * @param {string} encryptedText - Encrypted text
   * @returns {string} Decrypted text
   */
  decryptData(encryptedText) {
    return this.decryptWithKey(encryptedText);
  }
}

module.exports = new EncryptionService();
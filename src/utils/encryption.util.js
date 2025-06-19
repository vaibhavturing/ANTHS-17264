// src/utils/encryption.util.js
// HIPAA-Compliant Data Encryption System
// UPDATED: Complete overhaul for compliant PHI protection with key management

const crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../config/config');
const logger = require('./logger');
const hipaaAuditLogger = require('./audit-logger');
const fs = require('fs');
const path = require('path');

/**
 * HIPAA-Compliant Encryption System
 * Features:
 * - AES-256-GCM encryption (authenticated encryption with integrity verification)
 * - Key rotation and versioning
 * - Separate field-level encryption keys
 * - Encryption key access logging
 * - Transparent application-level encryption/decryption
 */
class EncryptionService {
  constructor() {
    this.initialized = false;
    this.keyNamespace = config.KEY_NAMESPACE || 'healthcare-app';
    
    // Master key (used to encrypt data encryption keys)  
    this.masterKey = null;
    
    // Data encryption keys by version (for field encryption)
    this.dataEncryptionKeys = {};
    
    // Current DEK version
    this.currentKeyVersion = 1;
    
    // Initialize the system
    this.initialize();
  }
  
  /**
   * Initialize the encryption system
   * In production, this would likely connect to a secure key management service
   * like AWS KMS, HashiCorp Vault, or Azure Key Vault
   */
  async initialize() {
    try {
      // In a production environment, replace with secure key storage
      if (config.NODE_ENV === 'production') {
        // Option 1: Integration with AWS KMS (production recommended)
        if (config.USE_AWS_KMS) {
          await this._initializeWithAwsKms();
        } 
        // Option 2: External key vault (backup option)
        else if (config.USE_KEY_VAULT) {
          await this._initializeWithKeyVault();
        }
        // Option 3: Fallback to local key store (less secure, not recommended for production)
        else {
          await this._initializeWithLocalKeyStore();
        }
      } else {
        // Development environment - use local keys
        await this._initializeWithLocalKeyStore();
      }
      
      this.initialized = true;
      logger.info('Encryption system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize encryption system', { error: error.message });
      // In production, we might want to exit the process here rather than continue insecurely
      if (config.NODE_ENV === 'production') {
        throw new Error('Encryption system initialization failed - application cannot run securely');
      }
    }
  }
  
  /**
   * Initialize with AWS Key Management Service
   * This would be the recommended approach for production
   */
  async _initializeWithAwsKms() {
    try {
      if (!config.AWS_KMS_KEY_ID) {
        throw new Error('AWS KMS key ID not configured');
      }
      
      logger.info('Initializing encryption with AWS KMS');
      
      // This would be implemented with AWS SDK integration
      // const AWS = require('aws-sdk');
      // const kms = new AWS.KMS({ region: config.AWS_REGION });
      
      // For each required data encryption key, use KMS to get or generate
      // This is a placeholder for actual AWS KMS implementation
      
      this.masterKey = 'aws-kms-managed'; // KMS manages the master key
      this.currentKeyVersion = 1;
      
      // For each field category, retrieve or generate data encryption key
      for (const category of ['phi', 'pii', 'financial']) {
        this.dataEncryptionKeys[category] = {
          1: { 
            key: `kms-dek-${category}-v1`, // In real implementation, this would be an encrypted key from KMS
            algorithm: 'aes-256-gcm',
            createdAt: new Date()
          }
        };
      }
      
      // Log key access (without exposing key material)
      await hipaaAuditLogger.logSystemEvent('ENCRYPTION_KEYS_ACCESSED', {
        source: 'AWS KMS',
        keyTypes: Object.keys(this.dataEncryptionKeys),
        timestamp: new Date()
      });
      
    } catch (error) {
      logger.error('AWS KMS initialization failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Initialize with external key vault like HashiCorp Vault
   * Alternative for organizations that use vault systems
   */
  async _initializeWithKeyVault() {
    try {
      logger.info('Initializing encryption with Key Vault');
      
      // This would be implemented with Vault client
      // const vault = require('node-vault')({
      //   apiVersion: 'v1',
      //   endpoint: config.VAULT_ENDPOINT
      // });
      
      // Example placeholder for key vault integration
      this.masterKey = 'vault-managed';
      this.currentKeyVersion = 1;
      
      // For each field category, retrieve data encryption key
      for (const category of ['phi', 'pii', 'financial']) {
        this.dataEncryptionKeys[category] = {
          1: { 
            key: `vault-dek-${category}-v1`, // In real implementation, this would come from Vault
            algorithm: 'aes-256-gcm',
            createdAt: new Date()
          }
        };
      }
      
      // Log key access
      await hipaaAuditLogger.logSystemEvent('ENCRYPTION_KEYS_ACCESSED', {
        source: 'Key Vault',
        keyTypes: Object.keys(this.dataEncryptionKeys),
        timestamp: new Date()
      });
      
    } catch (error) {
      logger.error('Key Vault initialization failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Initialize with local key store (development or testing)
   * Not recommended for production use
   */
  async _initializeWithLocalKeyStore() {
    try {
      logger.info('Initializing encryption with local key store');
      
      // Local key directory (in a real system, these would be stored securely)
      const keyDir = path.join(config.DATA_DIR || __dirname, 'keys');
      
      // Ensure key directory exists
      if (!fs.existsSync(keyDir)) {
        fs.mkdirSync(keyDir, { recursive: true });
      }
      
      // Load or create master key
      const masterKeyPath = path.join(keyDir, 'master-key.bin');
      if (fs.existsSync(masterKeyPath)) {
        const encryptedKey = fs.readFileSync(masterKeyPath);
        // In a real system, this would be decrypted with a KMS or hardware security module
        this.masterKey = encryptedKey.toString('hex');
      } else {
        this.masterKey = crypto.randomBytes(32).toString('hex');
        // In a real system, this would be encrypted before storage
        fs.writeFileSync(masterKeyPath, Buffer.from(this.masterKey));
        logger.info('Generated new master key');
      }
      
      // Load or create data encryption keys for each category
      for (const category of ['phi', 'pii', 'financial']) {
        this.dataEncryptionKeys[category] = {};
        
        // Key path for this category
        const categoryKeyPath = path.join(keyDir, `${category}-keys.json`);
        
        if (fs.existsSync(categoryKeyPath)) {
          // Load existing keys
          const encryptedKeys = JSON.parse(fs.readFileSync(categoryKeyPath, 'utf8'));
          
          // In a real system, these would be decrypted with the master key
          // For this example, we'll use them as-is
          this.dataEncryptionKeys[category] = encryptedKeys;
          this.currentKeyVersion = Math.max(...Object.keys(encryptedKeys).map(Number));
        } else {
          // Generate new key
          const newKey = crypto.randomBytes(32).toString('hex');
          
          this.dataEncryptionKeys[category][1] = {
            key: newKey,
            algorithm: 'aes-256-gcm',
            createdAt: new Date()
          };
          
          // In a real system, these would be encrypted with the master key before storage
          fs.writeFileSync(categoryKeyPath, JSON.stringify(this.dataEncryptionKeys[category]));
        }
      }
      
      // Log key access (for audit purposes)
      await hipaaAuditLogger.logSystemEvent('ENCRYPTION_KEYS_ACCESSED', {
        source: 'Local Key Store',
        keyTypes: Object.keys(this.dataEncryptionKeys),
        timestamp: new Date()
      });
      
    } catch (error) {
      logger.error('Local key store initialization failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Rotate encryption keys for a specific category
   * Key rotation is important for HIPAA compliance
   * @param {string} category - Key category (phi, pii, financial)
   */
  async rotateKey(category) {
    try {
      if (!this.dataEncryptionKeys[category]) {
        throw new Error(`Unknown key category: ${category}`);
      }
      
      // Increment version
      const newVersion = this.currentKeyVersion + 1;
      
      // Generate new key
      const newKey = crypto.randomBytes(32).toString('hex');
      
      // Add to key store
      this.dataEncryptionKeys[category][newVersion] = {
        key: newKey,
        algorithm: 'aes-256-gcm',
        createdAt: new Date()
      };
      
      // Update current version
      this.currentKeyVersion = newVersion;
      
      // Persist keys (in a real system, this would be done securely)
      if (config.NODE_ENV !== 'production') {
        const keyDir = path.join(config.DATA_DIR || __dirname, 'keys');
        const categoryKeyPath = path.join(keyDir, `${category}-keys.json`);
        
        // In a real system, these would be encrypted with the master key before storage
        fs.writeFileSync(categoryKeyPath, JSON.stringify(this.dataEncryptionKeys[category]));
      } else {
        // In production, this would update KMS or key vault
      }
      
      // Log key rotation
      await hipaaAuditLogger.logSystemEvent('ENCRYPTION_KEY_ROTATED', {
        category,
        newVersion,
        timestamp: new Date()
      });
      
      logger.info(`Rotated ${category} encryption key to version ${newVersion}`);
      return newVersion;
      
    } catch (error) {
      logger.error(`Key rotation failed for ${category}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Encrypt PHI (Protected Health Information)
   * @param {string} text - The text to encrypt
   * @param {Object} options - Encryption options
   * @returns {string} Encrypted text with metadata
   */
  encryptPhi(text, options = {}) {
    return this._encrypt(text, 'phi', options);
  }
  
  /**
   * Decrypt PHI (Protected Health Information)
   * @param {string} encryptedData - The data to decrypt
   * @returns {string} Decrypted text
   */
  decryptPhi(encryptedData) {
    return this._decrypt(encryptedData, 'phi');
  }
  
  /**
   * Encrypt PII (Personally Identifiable Information)
   * @param {string} text - The text to encrypt
   * @param {Object} options - Encryption options
   * @returns {string} Encrypted text with metadata
   */
  encryptPii(text, options = {}) {
    return this._encrypt(text, 'pii', options);
  }
  
  /**
   * Decrypt PII (Personally Identifiable Information)
   * @param {string} encryptedData - The data to decrypt
   * @returns {string} Decrypted text
   */
  decryptPii(encryptedData) {
    return this._decrypt(encryptedData, 'pii');
  }
  
  /**
   * Encrypt financial information
   * @param {string} text - The text to encrypt
   * @param {Object} options - Encryption options
   * @returns {string} Encrypted text with metadata
   */
  encryptFinancial(text, options = {}) {
    return this._encrypt(text, 'financial', options);
  }
  
  /**
   * Decrypt financial information
   * @param {string} encryptedData - The data to decrypt
   * @returns {string} Decrypted text
   */
  decryptFinancial(encryptedData) {
    return this._decrypt(encryptedData, 'financial');
  }
  
  /**
   * Core encryption function
   * @private
   */
  _encrypt(text, category, options = {}) {
    // Wait until initialized
    if (!this.initialized) {
      throw new Error('Encryption system not initialized');
    }
    
    // Skip encryption for null or undefined
    if (text === null || text === undefined) {
      return text;
    }
    
    // Ensure text is a string
    const data = typeof text !== 'string' ? JSON.stringify(text) : text;
    
    try {
      // Get the current key for this category
      const keyVersion = options.keyVersion || this.currentKeyVersion;
      const keyData = this.dataEncryptionKeys[category][keyVersion];
      
      if (!keyData) {
        throw new Error(`Key not found for ${category} version ${keyVersion}`);
      }
      
      // Generate initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create cipher with key, IV, and auth tag
      const cipher = crypto.createCipheriv(
        keyData.algorithm, 
        Buffer.from(keyData.key, 'hex'), 
        iv
      );
      
      // Encrypt the data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag for GCM mode
      const authTag = cipher.getAuthTag().toString('hex');
      
      // Format: version:iv:authTag:encrypted
      const result = `${keyVersion}:${iv.toString('hex')}:${authTag}:${encrypted}`;
      
      return result;
    } catch (error) {
      logger.error(`Encryption error for ${category}`, { error: error.message });
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }
  
  /**
   * Core decryption function
   * @private
   */
  _decrypt(encryptedData, category) {
    // Wait until initialized
    if (!this.initialized) {
      throw new Error('Encryption system not initialized');
    }
    
    // Skip decryption for null or undefined
    if (encryptedData === null || encryptedData === undefined) {
      return encryptedData;
    }
    
    // Handle non-encrypted data gracefully (for migration)
    if (typeof encryptedData === 'string' && !encryptedData.includes(':')) {
      logger.warn(`Attempted to decrypt non-encrypted data: ${category}`);
      return encryptedData;
    }
    
    try {
      // Parse the encrypted data
      const parts = encryptedData.split(':');
      if (parts.length !== 4) {
        throw new Error('Invalid encrypted data format');
      }
      
      const [keyVersion, ivHex, authTagHex, encryptedHex] = parts;
      
      // Get the key for this version
      const keyData = this.dataEncryptionKeys[category][keyVersion];
      if (!keyData) {
        throw new Error(`Key not found for ${category} version ${keyVersion}`);
      }
      
      // Create decipher
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(
        keyData.algorithm, 
        Buffer.from(keyData.key, 'hex'), 
        iv
      );
      
      // Set auth tag for GCM mode
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      
      // Decrypt the data
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error(`Decryption error for ${category}`, { 
        error: error.message,
        keyAvailable: !!this.dataEncryptionKeys[category]
      });
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
  
  /**
   * Create a MongoDB schema plugin for automatic field-level encryption
   * For seamless integration with Mongoose schemas
   * @param {Object} options - Configuration options for the plugin
   */
  createMongooseEncryptionPlugin(options = {}) {
    const encryptionService = this;
    
    return function encryptionPlugin(schema) {
      // Get fields to encrypt from options or schema
      const phiFields = options.phiFields || schema.options.phiFields || [];
      const piiFields = options.piiFields || schema.options.piiFields || [];
      const financialFields = options.financialFields || schema.options.financialFields || [];
      
      /**
       * Helper to determine if a path should be encrypted
       */
      const shouldEncrypt = (path, schemaType) => {
        // Skip if already handled by MongoDB client encryption
        if (schemaType.options && schemaType.options.encryptMetadata) {
          return false;
        }
        
        return (
          phiFields.includes(path) || 
          piiFields.includes(path) || 
          financialFields.includes(path)
        );
      };
      
      /**
       * Get encryption category for a path
       */
      const getCategory = (path) => {
        if (phiFields.includes(path)) return 'phi';
        if (piiFields.includes(path)) return 'pii';
        if (financialFields.includes(path)) return 'financial';
        return 'phi'; // Default to PHI for extra safety
      };
      
      // Process schema paths for encryption
      schema.eachPath((path, schemaType) => {
        // Only encrypt string fields
        if (schemaType.instance === 'String' && shouldEncrypt(path, schemaType)) {
          const category = getCategory(path);
          
          // Add pre-save hook for encryption
          schema.pre('save', function(next) {
            try {
              if (this.isModified(path) && this[path]) {
                // Encrypt the field
                if (category === 'phi') {
                  this[path] = encryptionService.encryptPhi(this[path]);
                } else if (category === 'pii') {
                  this[path] = encryptionService.encryptPii(this[path]);
                } else if (category === 'financial') {
                  this[path] = encryptionService.encryptFinancial(this[path]);
                }
              }
              next();
            } catch (error) {
              next(error);
            }
          });
          
          // Add getter for automatic decryption
          schema.path(path).get(function(value) {
            if (!value) return value;
            
            try {
              if (category === 'phi') {
                return encryptionService.decryptPhi(value);
              } else if (category === 'pii') {
                return encryptionService.decryptPii(value);
              } else if (category === 'financial') {
                return encryptionService.decryptFinancial(value);
              }
              return value;
            } catch (error) {
              logger.warn(`Decryption failed for ${path}`, { error: error.message });
              return value; // Return encrypted value if decryption fails
            }
          });
        }
      });
      
      // Add virtual to track which fields are encrypted
      schema.virtual('_encryptedFields').get(function() {
        return {
          phi: phiFields,
          pii: piiFields,
          financial: financialFields
        };
      });
    };
  }
}

// Create singleton instance
const encryptionService = new EncryptionService();

// Export the service
module.exports = encryptionService;
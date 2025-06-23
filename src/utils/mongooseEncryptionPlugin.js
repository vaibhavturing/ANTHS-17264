/**
 * Mongoose Field Encryption Plugin
 * File: src/utils/mongooseEncryptionPlugin.js
 * 
 * This plugin provides automatic encryption/decryption of sensitive fields in MongoDB documents.
 */

const { encrypt, decrypt, isEncrypted } = require('./encryption');
const config = require('../config/config');

/**
 * Mongoose plugin to automatically encrypt/decrypt specified fields
 * @param {Object} schema - Mongoose schema to apply encryption to
 * @param {Object} options - Plugin options
 */
function encryptionPlugin(schema, options = {}) {
  // No action if encryption is disabled in config
  if (!config.encryption.fieldEncryption.enabled) {
    return;
  }
  
  // Get fields to encrypt from options or use defaults from config
  const fieldsToEncrypt = options.fields || config.encryption.sensitiveFields;
  
  // Track which fields are encrypted
  const encryptedFields = [];
  
  // Check each field in schema to see if it should be encrypted
  schema.eachPath((path, schemaType) => {
    if (
      schemaType.instance === 'String' && // Only encrypt string fields
      !path.startsWith('_') && // Skip internal fields
      !path.includes('.') && // Skip nested fields (handled via document middleware)
      fieldsToEncrypt.some(field => {
        // Check if path is in or contains a sensitive field name
        return path === field || path.includes(field);
      })
    ) {
      encryptedFields.push(path);
    }
  });
  
  // Add middleware to encrypt fields before saving
  schema.pre('save', function(next) {
    // Skip encryption if document is not modified
    if (!this.isModified()) {
      return next();
    }
    
    for (const field of encryptedFields) {
      if (this.isModified(field) && this[field] && !isEncrypted(this[field])) {
        const encryptedValue = encrypt(this[field].toString());
        if (encryptedValue) {
          this[field] = encryptedValue;
        }
      }
    }
    
    next();
  });
  
  // Add middleware to decrypt fields after retrieving from database
  schema.post('init', function() {
    for (const field of encryptedFields) {
      if (this[field] && isEncrypted(this[field])) {
        const decryptedValue = decrypt(this[field]);
        if (decryptedValue !== null) {
          this[field] = decryptedValue;
        }
      }
    }
  });
  
  // Add middleware for findOneAndUpdate to encrypt fields
  schema.pre('findOneAndUpdate', function() {
    const update = this.getUpdate();
    if (!update || typeof update !== 'object') {
      return;
    }
    
    // Handle $set operator
    if (update.$set) {
      for (const field of encryptedFields) {
        if (update.$set[field] && !isEncrypted(update.$set[field])) {
          update.$set[field] = encrypt(update.$set[field].toString());
        }
      }
    }
    
    // Handle direct field updates
    for (const field of encryptedFields) {
      if (update[field] && !isEncrypted(update[field])) {
        update[field] = encrypt(update[field].toString());
      }
    }
  });
  
  // Add static method to the schema to encrypt a specific field
  schema.statics.encryptField = function(field, value) {
    if (!value) return value;
    return encrypt(value.toString());
  };
  
  // Add static method to the schema to decrypt a specific field
  schema.statics.decryptField = function(field, value) {
    if (!value) return value;
    return decrypt(value);
  };
  
  // Add method to get a list of encrypted fields
  schema.statics.getEncryptedFields = function() {
    return [...encryptedFields];
  };
}

module.exports = encryptionPlugin;
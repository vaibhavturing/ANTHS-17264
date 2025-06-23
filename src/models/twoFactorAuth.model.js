/**
 * Two-Factor Authentication Model
 * File: src/models/twoFactorAuth.model.js
 * 
 * This model stores Two-Factor Authentication settings and temporary verification codes
 * for users in the Healthcare Management Application.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');

const twoFactorAuthSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // Whether 2FA is enabled for this user
  isEnabled: {
    type: Boolean,
    default: false
  },
  // Type of 2FA method
  method: {
    type: String,
    enum: ['authenticator', 'sms', 'email'],
    default: 'authenticator'
  },
  // Secret key for authenticator apps (will be encrypted at application level)
  secret: {
    type: String
  },
  // Backup codes for emergency access (hashed)
  backupCodes: [{
    code: {
      type: String // Hashed backup codes
    },
    isUsed: {
      type: Boolean,
      default: false
    },
    usedAt: {
      type: Date
    }
  }],
  // Phone number for SMS authentication
  phoneNumber: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^\+?[1-9]\d{9,14}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  // Temporary verification tokens for SMS/Email
  temporaryTokens: [{
    token: {
      type: String
    },
    expiresAt: {
      type: Date
    },
    purpose: {
      type: String,
      enum: ['verification', 'login', 'recovery'],
      default: 'login'
    }
  }],
  // Last verification details
  lastVerification: {
    date: {
      type: Date
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    },
    method: {
      type: String,
      enum: ['authenticator', 'sms', 'email', 'backup_code']
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
twoFactorAuthSchema.index({ userId: 1 });
twoFactorAuthSchema.index({ 'temporaryTokens.token': 1 });

/**
 * Generate backup codes
 * @param {number} count - Number of backup codes to generate
 * @returns {Array} - Array of backup code objects
 */
twoFactorAuthSchema.methods.generateBackupCodes = async function(count = 10) {
  const backupCodes = [];
  const plainCodes = [];
  
  // Generate random backup codes
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(5).toString('hex').toUpperCase();
    const hashedCode = await this.hashCode(code);
    backupCodes.push({
      code: hashedCode,
      isUsed: false
    });
    plainCodes.push(code);
  }
  
  this.backupCodes = backupCodes;
  
  return plainCodes;
};

/**
 * Generate temporary token
 * @param {string} purpose - Purpose of token (verification, login, recovery)
 * @param {number} expiresInMinutes - Token expiration time in minutes
 * @returns {string} - Generated token
 */
twoFactorAuthSchema.methods.generateTemporaryToken = function(purpose = 'login', expiresInMinutes = 10) {
  // Generate random 6-digit token
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Set expiration time
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);
  
  // Add token to temporaryTokens array
  this.temporaryTokens.push({
    token,
    expiresAt,
    purpose
  });
  
  // Remove expired tokens
  this.temporaryTokens = this.temporaryTokens.filter(t => t.expiresAt > new Date());
  
  return token;
};

/**
 * Verify temporary token
 * @param {string} token - Token to verify
 * @param {string} purpose - Purpose of token
 * @returns {boolean} - Whether token is valid
 */
twoFactorAuthSchema.methods.verifyTemporaryToken = function(token, purpose = 'login') {
  const now = new Date();
  const tokenObj = this.temporaryTokens.find(t => 
    t.token === token && 
    t.purpose === purpose && 
    t.expiresAt > now
  );
  
  if (tokenObj) {
    // Remove the used token
    this.temporaryTokens = this.temporaryTokens.filter(t => t.token !== token);
    return true;
  }
  
  return false;
};

/**
 * Validate backup code
 * @param {string} code - Backup code to validate
 * @returns {boolean} - Whether backup code is valid
 */
twoFactorAuthSchema.methods.validateBackupCode = async function(code) {
  // Find matching code
  for (let i = 0; i < this.backupCodes.length; i++) {
    const backupCode = this.backupCodes[i];
    
    // Skip used codes
    if (backupCode.isUsed) continue;
    
    // Check if code matches
    const isMatch = await this.compareCode(code, backupCode.code);
    if (isMatch) {
      // Mark code as used
      this.backupCodes[i].isUsed = true;
      this.backupCodes[i].usedAt = new Date();
      return true;
    }
  }
  
  return false;
};

/**
 * Hash backup code
 * @param {string} code - Code to hash
 * @returns {string} - Hashed code
 */
twoFactorAuthSchema.methods.hashCode = async function(code) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(code, process.env.BACKUP_CODE_SALT || 'default_salt', 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString('hex'));
    });
  });
};

/**
 * Compare provided code with hashed code
 * @param {string} providedCode - Code to compare
 * @param {string} hashedCode - Hashed code from database
 * @returns {boolean} - Whether codes match
 */
twoFactorAuthSchema.methods.compareCode = async function(providedCode, hashedCode) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(providedCode, process.env.BACKUP_CODE_SALT || 'default_salt', 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString('hex') === hashedCode);
    });
  });
};

/**
 * Record verification attempt
 * @param {string} method - Verification method used
 * @param {string} ipAddress - IP address of the request
 * @param {string} userAgent - User agent of the request
 */
twoFactorAuthSchema.methods.recordVerification = function(method, ipAddress, userAgent) {
  this.lastVerification = {
    date: new Date(),
    ipAddress,
    userAgent,
    method
  };
};

module.exports = mongoose.model('TwoFactorAuth', twoFactorAuthSchema);
// src/services/secrets.service.js

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const secretsConfig = require('../config/secrets.config');

/**
 * Secrets Service
 * Handles secure retrieval and management of API keys and secrets
 * using AWS Secrets Manager or local development vault
 */
class SecretsService {
  constructor() {
    // Initialize AWS SDK if not in local development mode
    if (!this.isLocalDevelopment()) {
      this.secretsManager = new AWS.SecretsManager({
        region: secretsConfig.aws.region
      });
    }
    
    // Initialize cache for secrets
    this.secretsCache = new Map();
    this.cacheTimestamps = new Map();
    
    // Track initialization state
    this.initialized = false;
  }
  
  /**
   * Initialize the secrets service
   * @returns {Promise<void>}
   */
  async initialize() {
    logger.info('Initializing Secrets Service');
    
    if (this.initialized) {
      logger.info('Secrets Service already initialized');
      return;
    }
    
    try {
      // If in local development, ensure vault exists
      if (this.isLocalDevelopment()) {
        await this.ensureLocalVault();
      }
      
      // Load required secrets
      await this.preloadRequiredSecrets();
      
      this.initialized = true;
      logger.info('Secrets Service initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize Secrets Service: ${error.message}`, { error });
      throw new Error(`Secrets Service initialization failed: ${error.message}`);
    }
  }
  
  /**
   * Check if running in local development mode
   * @returns {boolean} Whether in local development
   * @private
   */
  isLocalDevelopment() {
    return secretsConfig.localDevelopment.enabled;
  }
  
  /**
   * Ensure local vault exists for development
   * @returns {Promise<void>}
   * @private
   */
  async ensureLocalVault() {
    const vaultPath = secretsConfig.localDevelopment.vaultPath;
    const vaultDir = path.dirname(vaultPath);
    
    // Ensure vault directory exists
    if (!fs.existsSync(vaultDir)) {
      logger.debug(`Creating local vault directory: ${vaultDir}`);
      fs.mkdirSync(vaultDir, { recursive: true });
    }
    
    // Ensure vault file exists
    if (!fs.existsSync(vaultPath)) {
      if (secretsConfig.localDevelopment.allowCreate) {
        logger.debug(`Creating empty local vault: ${vaultPath}`);
        fs.writeFileSync(vaultPath, JSON.stringify({}, null, 2));
      } else {
        throw new Error(`Local vault not found: ${vaultPath}`);
      }
    }
    
    // Ensure vault file permissions are secure
    try {
      fs.chmodSync(vaultPath, 0o600); // Only owner can read/write
    } catch (error) {
      logger.warn(`Unable to set secure permissions on vault: ${error.message}`);
    }
  }
  
  /**
   * Preload required secrets
   * @returns {Promise<void>}
   * @private
   */
  async preloadRequiredSecrets() {
    logger.debug('Preloading required secrets');
    
    const requiredSecrets = secretsConfig.requiredSecrets || [];
    
    // Load each required secret
    for (const secretKey of requiredSecrets) {
      try {
        await this.getSecret(secretKey);
        logger.debug(`Preloaded secret: ${secretKey}`);
      } catch (error) {
        logger.error(`Failed to preload required secret ${secretKey}: ${error.message}`);
        throw new Error(`Required secret ${secretKey} not available`);
      }
    }
  }
  
  /**
   * Get a secret value
   * @param {string} key - Internal key name
   * @param {boolean} [bypassCache=false] - Whether to bypass cache
   * @returns {Promise<string>} Secret value
   */
  async getSecret(key, bypassCache = false) {
    // Validate key
    if (!key) {
      throw new Error('Secret key is required');
    }
    
    // Check if key is defined in mapping
    const secretPath = this.getSecretPath(key);
    if (!secretPath) {
      throw new Error(`Secret key "${key}" not found in mapping`);
    }
    
    // Check cache if enabled
    if (secretsConfig.aws.cache.enabled && !bypassCache) {
      const cachedValue = this.getCachedSecret(key);
      if (cachedValue !== undefined) {
        return cachedValue;
      }
    }
    
    // Fetch the secret
    const secretValue = await this.fetchSecret(key, secretPath);
    
    // Cache the result if caching is enabled
    if (secretsConfig.aws.cache.enabled) {
      this.cacheSecret(key, secretValue);
    }
    
    return secretValue;
  }
  
  /**
   * Get path for a secret key
   * @param {string} key - Internal key name
   * @returns {string|null} Secret path or null if not found
   * @private
   */
  getSecretPath(key) {
    return secretsConfig.secretMapping[key] || null;
  }
  
  /**
   * Get cached secret if not expired
   * @param {string} key - Internal key name
   * @returns {string|undefined} Cached secret or undefined if not cached or expired
   * @private
   */
  getCachedSecret(key) {
    const timestamp = this.cacheTimestamps.get(key);
    
    // Check if secret is cached
    if (timestamp === undefined) {
      return undefined;
    }
    
    // Check if cache is expired
    const now = Date.now();
    const ttlMs = secretsConfig.aws.cache.ttlSeconds * 1000;
    
    if (now - timestamp > ttlMs) {
      // Cache expired
      this.secretsCache.delete(key);
      this.cacheTimestamps.delete(key);
      return undefined;
    }
    
    return this.secretsCache.get(key);
  }
  
  /**
   * Cache a secret value
   * @param {string} key - Internal key name
   * @param {string} value - Secret value
   * @private
   */
  cacheSecret(key, value) {
    this.secretsCache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }
  
  /**
   * Fetch a secret from the secrets store
   * @param {string} key - Internal key name
   * @param {string} secretPath - Secret path in secrets store
   * @returns {Promise<string>} Secret value
   * @private
   */
  async fetchSecret(key, secretPath) {
    if (this.isLocalDevelopment()) {
      return this.fetchLocalSecret(key);
    } else {
      return this.fetchAWSSecret(secretPath);
    }
  }
  
  /**
   * Fetch a secret from AWS Secrets Manager
   * @param {string} secretPath - Secret path
   * @returns {Promise<string>} Secret value
   * @private
   */
  async fetchAWSSecret(secretPath) {
    logger.debug(`Fetching secret from AWS Secrets Manager: ${secretPath}`);
    
    // Construct full secret name with prefix
    const secretName = `${secretsConfig.aws.secretPrefix}${secretPath}`;
    
    // Set up retries
    let retries = 0;
    const maxRetries = secretsConfig.aws.retry.maxRetries;
    const retryDelay = secretsConfig.aws.retry.retryDelayMs;
    
    while (true) {
      try {
        const data = await this.secretsManager.getSecretValue({
          SecretId: secretName
        }).promise();
        
        // Return the secret string
        if (data.SecretString) {
          return data.SecretString;
        } else if (data.SecretBinary) {
          // For binary, decode from base64
          return Buffer.from(data.SecretBinary, 'base64').toString('utf-8');
        } else {
          throw new Error('Secret value is empty');
        }
      } catch (error) {
        if (retries < maxRetries) {
          retries++;
          logger.warn(`Failed to fetch AWS secret, retrying (${retries}/${maxRetries}): ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          logger.error(`Failed to fetch secret ${secretName} after ${maxRetries} retries: ${error.message}`);
          throw new Error(`Failed to fetch secret: ${error.message}`);
        }
      }
    }
  }
  
  /**
   * Fetch a secret from local development vault
   * @param {string} key - Internal key name
   * @returns {Promise<string>} Secret value
   * @private
   */
  async fetchLocalSecret(key) {
    logger.debug(`Fetching secret from local vault: ${key}`);
    
    const vaultPath = secretsConfig.localDevelopment.vaultPath;
    
    try {
      // Read vault file
      const vaultContent = fs.readFileSync(vaultPath, 'utf-8');
      const vault = JSON.parse(vaultContent);
      
      // Check if secret exists
      if (!(key in vault)) {
        if (secretsConfig.localDevelopment.allowCreate) {
          // Generate a random secret for development
          logger.warn(`Secret ${key} not found in local vault, generating a random value`);
          
          const randomValue = crypto.randomBytes(32).toString('hex');
          vault[key] = randomValue;
          
          // Save updated vault
          fs.writeFileSync(vaultPath, JSON.stringify(vault, null, 2));
          
          return randomValue;
        } else {
          throw new Error(`Secret ${key} not found in local vault`);
        }
      }
      
      return vault[key];
    } catch (error) {
      logger.error(`Error reading from local vault: ${error.message}`);
      throw new Error(`Failed to fetch local secret: ${error.message}`);
    }
  }
  
  /**
   * Update a secret in the secrets store
   * @param {string} key - Internal key name
   * @param {string} value - New secret value
   * @returns {Promise<void>}
   */
  async updateSecret(key, value) {
    // This method should only be available in development
    if (!this.isLocalDevelopment()) {
      throw new Error('Secret updates are only allowed in local development');
    }
    
    logger.debug(`Updating secret in local vault: ${key}`);
    
    const vaultPath = secretsConfig.localDevelopment.vaultPath;
    
    try {
      // Read vault file
      const vaultContent = fs.readFileSync(vaultPath, 'utf-8');
      const vault = JSON.parse(vaultContent);
      
      // Update secret
      vault[key] = value;
      
      // Save updated vault
      fs.writeFileSync(vaultPath, JSON.stringify(vault, null, 2));
      
      // Update cache if enabled
      if (secretsConfig.aws.cache.enabled) {
        this.cacheSecret(key, value);
      }
    } catch (error) {
      logger.error(`Error updating local vault: ${error.message}`);
      throw new Error(`Failed to update local secret: ${error.message}`);
    }
  }
  
  /**
   * Clears the secrets cache
   * @returns {void}
   */
  clearCache() {
    logger.debug('Clearing secrets cache');
    
    this.secretsCache.clear();
    this.cacheTimestamps.clear();
  }
  
  /**
   * Checks for secret rotation by comparing cached and stored values
   * @returns {Promise<void>}
   */
  async checkForRotation() {
    logger.debug('Checking for secret rotation');
    
    // Only check rotatable secrets that are currently cached
    const rotatableSecrets = secretsConfig.rotation.rotatable || [];
    
    for (const key of rotatableSecrets) {
      // Skip if not in cache
      if (!this.secretsCache.has(key)) {
        continue;
      }
      
      try {
        // Fetch fresh value, bypassing cache
        const freshValue = await this.getSecret(key, true);
        const cachedValue = this.secretsCache.get(key);
        
        // Check if value has changed
        if (freshValue !== cachedValue) {
          logger.info(`Detected rotation for secret: ${key}`);
          
          // Update cache
          this.cacheSecret(key, freshValue);
          
          // Check if restart is required
          if (secretsConfig.rotation.requireRestart.includes(key)) {
            logger.warn(`Secret rotation for ${key} requires application restart`);
            // In a real implementation, signal for graceful restart
          }
        }
      } catch (error) {
        logger.warn(`Error checking rotation for secret ${key}: ${error.message}`);
      }
    }
  }
}

// Create singleton instance
const secretsService = new SecretsService();

// Export singleton
module.exports = secretsService;
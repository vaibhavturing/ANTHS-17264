/**
 * Redis Configuration for Healthcare Management Application
 * Provides centralized configuration for Redis connections
 * Used for session management, caching, and shared state in stateless architecture
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');

// Environment-specific configurations
const REDIS_CONFIG = {
  development: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: 0,
    keyPrefix: 'healthcare:dev:'
  },
  test: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: 1,
    keyPrefix: 'healthcare:test:'
  },
  production: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true', 
    db: 0,
    keyPrefix: 'healthcare:',
    retryStrategy: (times) => {
      // Exponential backoff with max 30 second delay
      const delay = Math.min(times * 100, 30000);
      return delay;
    },
    maxRetriesPerRequest: 3
  }
};

/**
 * Redis client factory
 */
const createRedisClient = (purpose = 'general') => {
  const env = process.env.NODE_ENV || 'development';
  const config = { ...REDIS_CONFIG[env] };
  
  // Set purpose-specific key prefix
  config.keyPrefix = `${config.keyPrefix}${purpose}:`;
  
  // Create Redis client instance
  const client = new Redis(config);
  
  // Setup event handlers
  client.on('connect', () => {
    logger.info(`Redis client connected (${purpose})`);
  });
  
  client.on('error', (err) => {
    logger.error(`Redis client error (${purpose}):`, err);
  });
  
  client.on('reconnecting', (ms) => {
    logger.warn(`Redis client reconnecting in ${ms}ms (${purpose})`);
  });
  
  return client;
};

/**
 * Redis connection types
 */
const redisClients = {
  // Primary Redis client for general operations
  client: null,
  // Dedicated client for session management
  sessionClient: null,
  // Dedicated client for caching
  cacheClient: null,
  // Dedicated client for pub/sub operations
  pubSubClient: null,
  
  /**
   * Initialize Redis clients
   * @returns {Object} Redis clients
   */
  initialize() {
    if (!this.client) {
      this.client = createRedisClient('general');
    }
    
    if (!this.sessionClient) {
      this.sessionClient = createRedisClient('session');
    }
    
    if (!this.cacheClient) {
      this.cacheClient = createRedisClient('cache');
    }
    
    if (!this.pubSubClient) {
      this.pubSubClient = createRedisClient('pubsub');
    }
    
    return {
      client: this.client,
      sessionClient: this.sessionClient,
      cacheClient: this.cacheClient,
      pubSubClient: this.pubSubClient
    };
  },
  
  /**
   * Get Redis client for general operations
   * @returns {Redis} Redis client
   */
  getClient() {
    if (!this.client) {
      this.client = createRedisClient('general');
    }
    return this.client;
  },
  
  /**
   * Get Redis client for session management
   * @returns {Redis} Session Redis client
   */
  getSessionClient() {
    if (!this.sessionClient) {
      this.sessionClient = createRedisClient('session');
    }
    return this.sessionClient;
  },
  
  /**
   * Get Redis client for caching
   * @returns {Redis} Cache Redis client
   */
  getCacheClient() {
    if (!this.cacheClient) {
      this.cacheClient = createRedisClient('cache');
    }
    return this.cacheClient;
  },
  
  /**
   * Get Redis client for pub/sub operations
   * @returns {Redis} PubSub Redis client
   */
  getPubSubClient() {
    if (!this.pubSubClient) {
      this.pubSubClient = createRedisClient('pubsub');
    }
    return this.pubSubClient;
  },
  
  /**
   * Close all Redis connections
   */
  closeAll() {
    if (this.client) {
      this.client.quit();
      this.client = null;
    }
    
    if (this.sessionClient) {
      this.sessionClient.quit();
      this.sessionClient = null;
    }
    
    if (this.cacheClient) {
      this.cacheClient.quit();
      this.cacheClient = null;
    }
    
    if (this.pubSubClient) {
      this.pubSubClient.quit();
      this.pubSubClient = null;
    }
  }
};

module.exports = redisClients;
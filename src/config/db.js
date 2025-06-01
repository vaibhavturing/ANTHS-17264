// src/config/database.js

const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const config = require('./config');
const logger = require('../utils/logger');

/**
 * MongoDB connection class with advanced features:
 * - Connection pooling
 * - Retry logic
 * - Health checks
 * - Event monitoring
 * - Graceful shutdown
 */
class DatabaseConnection {
  constructor() {
    this.mongoose = mongoose;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = config.db.maxRetries || 5;
    this.retryInterval = config.db.retryInterval || 5000; // 5 seconds
    this.healthCheckInterval = null;
    
    // Configure mongoose
    mongoose.set('strictQuery', false);
    
    // Connection options
    this.connectionOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: config.db.poolSize || 10,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 30000,
      keepAlive: true,
      keepAliveInitialDelay: 300000, // 5 minutes
    };
    
    // Setup event listeners
    this._setupEventListeners();
  }

  /**
   * Establish connection to MongoDB
   * @returns {Promise<mongoose.Connection>} Mongoose connection object
   */
  async connect() {
    try {
      if (this.isConnected) {
        logger.info('Database: Already connected to MongoDB');
        return this.mongoose.connection;
      }
      
      logger.info('Database: Connecting to MongoDB...');
      
      await this.mongoose.connect(config.db.uri, this.connectionOptions);
      
      this.isConnected = true;
      this.connectionRetries = 0;
      
      logger.info(`Database: Connected to MongoDB at ${config.db.uri.split('@').pop()}`);
      
      // Start health check monitoring
      this._startHealthCheck();
      
      return this.mongoose.connection;
    } catch (error) {
      return this._handleConnectionError(error);
    }
  }

  /**
   * Retry connection with exponential backoff
   * @private
   * @param {Error} error - Connection error
   * @returns {Promise<mongoose.Connection>} Mongoose connection object
   */
  async _handleConnectionError(error) {
    this.isConnected = false;
    
    logger.error(`Database: Connection error: ${error.message}`);
    
    if (this.connectionRetries < this.maxRetries) {
      this.connectionRetries++;
      
      const delay = this.retryInterval * Math.pow(2, this.connectionRetries - 1);
      const maxDelay = 60000; // Maximum 1 minute delay
      const retryDelay = Math.min(delay, maxDelay);
      
      logger.info(`Database: Retry attempt ${this.connectionRetries}/${this.maxRetries} in ${retryDelay}ms`);
      
      return new Promise((resolve) => {
        setTimeout(async () => {
          try {
            const connection = await this.connect();
            resolve(connection);
          } catch (err) {
            logger.error(`Database: Retry failed: ${err.message}`);
            resolve(null);
          }
        }, retryDelay);
      });
    } else {
      logger.error(`Database: Maximum retry attempts (${this.maxRetries}) exceeded. Giving up.`);
      throw new Error(`Failed to connect to database after ${this.maxRetries} attempts`);
    }
  }

  /**
   * Run database health check
   * @returns {Promise<boolean>} Health check result
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return false;
      }
      
      // Check using admin command
      const healthStatus = await this.mongoose.connection.db.admin().ping();
      return healthStatus.ok === 1;
    } catch (error) {
      logger.error(`Database: Health check failed: ${error.message}`);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Start periodic health check
   * @private
   */
  _startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    const interval = config.db.healthCheckInterval || 30000; // 30 seconds by default
    
    this.healthCheckInterval = setInterval(async () => {
      const isHealthy = await this.healthCheck();
      
      if (!isHealthy && this.isConnected) {
        logger.warn('Database: Connection unhealthy, attempting to reconnect');
        this.isConnected = false;
        this.connectionRetries = 0;
        this.connect().catch(err => {
          logger.error(`Database: Failed to reconnect: ${err.message}`);
        });
      }
    }, interval);
    
    // Ensure interval doesn't keep process running
    this.healthCheckInterval.unref();
  }

  /**
   * Setup mongoose connection event listeners
   * @private
   */
  _setupEventListeners() {
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      logger.info('Database: Mongoose connected');
    });
    
    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      logger.warn('Database: Mongoose disconnected');
    });
    
    mongoose.connection.on('error', (err) => {
      logger.error(`Database: Mongoose connection error: ${err.message}`);
      this.isConnected = false;
    });
    
    // Handle process termination and cleanup
    process.on('SIGINT', this.disconnect.bind(this, 'SIGINT'));
    process.on('SIGTERM', this.disconnect.bind(this, 'SIGTERM'));
    process.on('uncaughtException', (error) => {
      logger.error(`Database: Uncaught exception: ${error.message}`);
      this.disconnect('uncaughtException').catch((err) => {
        logger.error(`Database: Error during disconnect: ${err.message}`);
      });
    });
  }

  /**
   * Gracefully disconnect from MongoDB
   * @param {string} [source='Manual'] - Source of disconnect request
   * @returns {Promise<void>}
   */
  async disconnect(source = 'Manual') {
    if (!this.isConnected) {
      logger.info(`Database: Already disconnected (triggered by: ${source})`);
      return;
    }
    
    logger.info(`Database: Disconnecting from MongoDB (triggered by: ${source})...`);
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info(`Database: Disconnected from MongoDB (triggered by: ${source})`);
      
      if (source !== 'Manual') {
        // Give time for logs to be flushed before exiting
        setTimeout(() => process.exit(0), 500);
      }
    } catch (error) {
      logger.error(`Database: Error disconnecting from MongoDB: ${error.message}`);
      if (source !== 'Manual') {
        // Force exit after a timeout even if there's an error
        setTimeout(() => process.exit(1), 500);
      }
    }
  }

  /**
   * Get current connection status
   * @returns {Object} Connection status object
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      connectionRetries: this.connectionRetries,
      maxRetries: this.maxRetries,
      readyState: mongoose.connection.readyState
    };
  }
}

// Create and export singleton instance
const dbConnection = new DatabaseConnection();
module.exports = dbConnection;
/**
 * Healthcare Management Application
 * Database Configuration
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const config = require('./config');

/**
 * Connect to MongoDB database
 */
const connectDB = async () => {
  try {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    // Add any additional options from the config
    if (config.database.options) {
      const additionalOptions = config.database.options
        .split('&')
        .reduce((acc, option) => {
          const [key, value] = option.split('=');
          if (key && value) {
            // Convert 'true' and 'false' strings to booleans
            acc[key] = value === 'true' ? true : 
                       value === 'false' ? false : 
                       !isNaN(Number(value)) ? Number(value) : value;
          }
          return acc;
        }, {});
      
      Object.assign(options, additionalOptions);
    }

    const conn = await mongoose.connect(config.database.uri, options);

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Add event listeners for connection issues
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected, attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
    
  } catch (error) {
    logger.error(`Error connecting to database: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Close MongoDB connection (useful for testing)
 */
const closeDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error(`Error closing database connection: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { connectDB, closeDB };
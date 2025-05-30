/**
 * Healthcare Management Application
 * Server Entry Point
 * 
 * Initializes and starts the Express server with proper error handling
 * and graceful shutdown
 */

const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const logger = require('./utils/logger');
const config = require('./config/config');

/**
 * Normalize port into a number, string, or false
 */
const normalizePort = (val) => {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    return val; // Named pipe
  }

  if (port >= 0) {
    return port; // Port number
  }

  return false;
};

// Get port from config and normalize
const port = normalizePort(config.port);

// Create HTTP server
const server = http.createServer(app);

/**
 * Event listener for HTTP server "error" event
 */
const onError = (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;

  // Handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
};

/**
 * Event listener for HTTP server "listening" event
 */
const onListening = () => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
  logger.info(`Server listening on ${bind} in ${config.env} mode`);
};

/**
 * Start the server
 */
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Listen on provided port, on all network interfaces
    server.listen(port);
    server.on('error', onError);
    server.on('listening', onListening);

    // Handle graceful shutdown
    setupGracefulShutdown();

  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
};

/**
 * Setup graceful shutdown handlers
 */
const setupGracefulShutdown = () => {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥');
    logger.error(err);
    
    // Gracefully shutdown instead of abrupt termination
    gracefulShutdown('unhandled rejection');
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! 💥');
    logger.error(err);
    
    // Uncaught exceptions are severe - terminate after cleanup
    gracefulShutdown('uncaught exception');
  });

  // Handle SIGTERM signal (e.g., Heroku shutdown)
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully');
    gracefulShutdown('SIGTERM');
  });

  // Handle SIGINT signal (e.g., Ctrl+C)
  process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down gracefully');
    gracefulShutdown('SIGINT');
  });
};

/**
 * Perform graceful shutdown
 * @param {string} source - The source of the shutdown signal
 */
const gracefulShutdown = async (source) => {
  logger.info(`Initiating graceful shutdown (${source})...`);
  
  try {
    // Close the HTTP server (stop accepting new connections)
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Close database connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('Database connection closed');
    }

    // Additional cleanup can be added here (e.g., close Redis connections)

    logger.info('Graceful shutdown completed');

    // Exit with different code based on source
    if (['uncaught exception', 'unhandled rejection'].includes(source)) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    logger.error(`Error during graceful shutdown: ${err.message}`);
    process.exit(1);
  }
};

// Start the server if this is the main file
if (require.main === module) {
  startServer();
} else {
  // Export for testing
  module.exports = { app, server, startServer };
}
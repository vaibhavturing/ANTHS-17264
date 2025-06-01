// src/server.js

const http = require('http');
const app = require('./app');
const config = require('./config/config');
const logger = require('./utils/logger');
const dbConnection = require('./config/db');

let server;

/**
 * Normalize port into a number, string, or false
 */
function normalizePort(val) {
  const port = parseInt(val, 10);
  
  if (isNaN(port)) {
    return val; // Named pipe
  }
  
  if (port >= 0) {
    return port; // Port number
  }
  
  return false;
}

/**
 * Event listener for HTTP server "error" event
 */
function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }
  
  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;
    
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
}

/**
 * Event listener for HTTP server "listening" event
 */
function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
    
  logger.info(`Server: Listening on ${bind} in ${config.env} mode`);
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  logger.info(`Server: Received ${signal}. Shutting down gracefully...`);
  
  // Close the HTTP server first
  if (server) {
    server.close(() => {
      logger.info('Server: HTTP server closed');
    });
  }
  
  // Disconnect from database
  try {
    await dbConnection.disconnect(signal);
  } catch (error) {
    logger.error(`Server: Error during database disconnection: ${error.message}`);
  }
  
  // Force exit after timeout
  setTimeout(() => {
    logger.error('Server: Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

/**
 * Handle process-level errors
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Server: Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Server: Uncaught Exception: ${error.message}`);
  gracefulShutdown('uncaughtException');
});

// Set up process signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Initialize server
 */
async function startServer() {
  try {
    // Connect to the database
    await dbConnection.connect();
    
    // Get port from environment
    const port = normalizePort(config.port);
    app.set('port', port);
    
    // Create HTTP server
    server = http.createServer(app);
    
    // Listen on provided port, on all network interfaces
    server.listen(port);
    server.on('error', onError);
    server.on('listening', onListening);
    
    logger.info(`Server: Started in ${config.env} mode`);
  } catch (error) {
    logger.error(`Server: Failed to start: ${error.message}`);
    process.exit(1);
  }
}

// Start the server
startServer();
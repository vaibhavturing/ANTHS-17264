// src/utils/bull-board.js
const { createBullBoard } = require('bull-board');
const { BullAdapter } = require('bull-board/bullAdapter');
const queueService = require('../services/queue.service');
const logger = require('./logger');

/**
 * Set up Bull Board UI for queue monitoring
 * @param {Express} app - Express application
 */
function setupBullBoard(app) {
  try {
    // Get all the queues
    const queues = queueService.getQueues();
    
    // Create adapters for each queue
    const adapters = queues.map(queue => new BullAdapter(queue));
    
    // Create Bull Board
    const { router } = createBullBoard(adapters);
    
    // Mount the Bull Board UI
    app.use('/admin/queues', (req, res, next) => {
      // Basic auth middleware for the Bull Board UI
      const auth = req.headers.authorization;
      if (!auth || !checkAuth(auth)) {
        res.set('WWW-Authenticate', 'Basic realm="Queue Admin"');
        return res.status(401).send('Unauthorized');
      }
      next();
    }, router);
    
    logger.info('Bull Board UI set up at /admin/queues');
  } catch (error) {
    logger.error('Error setting up Bull Board:', error);
  }
}

/**
 * Check authentication for Bull Board UI
 * This is a simple example - consider using a more secure approach
 * @param {string} authHeader - Authorization header
 * @returns {boolean} Whether authentication is valid
 */
function checkAuth(authHeader) {
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  // Replace with a more secure authentication method
  const validUsername = process.env.QUEUE_ADMIN_USERNAME || 'admin';
  const validPassword = process.env.QUEUE_ADMIN_PASSWORD || 'admin';
  
  return username === validUsername && password === validPassword;
}

module.exports = setupBullBoard;
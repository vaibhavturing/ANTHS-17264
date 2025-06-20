// src/config/redis.config.js
const redis = require('redis');
const { promisify } = require('util');
const logger = require('../utils/logger');
const config = require('./config');

// Create Redis client
const client = redis.createClient({
  host: config.REDIS_HOST || 'localhost',
  port: config.REDIS_PORT || 6379,
  password: config.REDIS_PASSWORD || '',
  db: config.REDIS_DB || 0
});

// Promisify Redis methods
const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);
const delAsync = promisify(client.del).bind(client);
const expireAsync = promisify(client.expire).bind(client);
const scanAsync = promisify(client.scan).bind(client);

// Handle connection events
client.on('connect', () => {
  logger.info('Redis client connected');
});

client.on('error', (err) => {
  logger.error('Redis client error:', err);
});

module.exports = {
  client,
  getAsync,
  setAsync,
  delAsync,
  expireAsync,
  scanAsync
};
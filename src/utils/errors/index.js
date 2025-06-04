// src/utils/errors/index.js

const BaseError = require('./BaseError');
const ValidationError = require('./ValidationError');
const AuthenticationError = require('./AuthenticationError');
const AuthorizationError = require('./AuthorizationError');
const DatabaseError = require('./DatabaseError');
const NotFoundError = require('./NotFoundError');
const BusinessLogicError = require('./BusinessLogicError');
const ApiError = require('./ApiError');
const TooManyRequestsError = require('./TooManyRequestsError'); // ADDITION: Import the new error class

module.exports = {
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  NotFoundError,
  BusinessLogicError,
  ApiError,
  TooManyRequestsError // ADDITION: Export the new error class
};
/**
 * Custom error classes for better error handling
 */

class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR') {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, code = 'VALIDATION_ERROR', details = null) {
    super(message, code);
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message, code = 'AUTHENTICATION_ERROR') {
    super(message, code);
  }
}

class AuthorizationError extends AppError {
  constructor(message, code = 'AUTHORIZATION_ERROR') {
    super(message, code);
  }
}

class ResourceNotFoundError extends AppError {
  constructor(message, code = 'RESOURCE_NOT_FOUND') {
    super(message, code);
  }
}

class DatabaseError extends AppError {
  constructor(message, code = 'DATABASE_ERROR') {
    super(message, code);
  }
}

class AppointmentError extends AppError {
  constructor(message, code = 'APPOINTMENT_ERROR') {
    super(message, code);
  }
}

class ScheduleError extends AppError {
  constructor(message, code = 'SCHEDULE_ERROR') {
    super(message, code);
  }
}

class InsuranceError extends AppError {
  constructor(message, code = 'INSURANCE_ERROR') {
    super(message, code);
  }
}

class BillingError extends AppError {
  constructor(message, code = 'BILLING_ERROR') {
    super(message, code);
  }
}

class AnalyticsError extends AppError {
  constructor(message, code = 'ANALYTICS_ERROR') {
    super(message, code);
  }
}

class PrivacyError extends AppError {
  constructor(message, code = 'PRIVACY_ERROR') {
    super(message, code);
  }
}

// NEW: Waitlist error class
class WaitlistError extends AppError {
  constructor(message, code = 'WAITLIST_ERROR') {
    super(message, code);
  }
}

// NEW: Notification error class
class NotificationError extends AppError {
  constructor(message, code = 'NOTIFICATION_ERROR') {
    super(message, code);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ResourceNotFoundError,
  DatabaseError,
  AppointmentError,
  ScheduleError,
  InsuranceError,
  BillingError,
  AnalyticsError,
  PrivacyError,
  WaitlistError,
  NotificationError
};
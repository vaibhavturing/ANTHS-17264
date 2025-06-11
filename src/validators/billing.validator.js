const Joi = require('joi');

// Validators for billing-related operations
const billingValidators = {
  // Validate billing record
  validateBilling: Joi.object({
    patientId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Patient ID must be a valid MongoDB ObjectId',
        'any.required': 'Patient ID is required'
      }),
    appointmentId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).allow(null).optional(),
    serviceId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).allow(null).optional(),
    description: Joi.string().trim().min(3).max(200).required()
      .messages({
        'string.base': 'Description must be a string',
        'string.empty': 'Description is required',
        'string.min': 'Description must be at least {#limit} characters',
        'string.max': 'Description cannot exceed {#limit} characters',
        'any.required': 'Description is required'
      }),
    totalAmount: Joi.number().min(0).required()
      .messages({
        'number.base': 'Total amount must be a number',
        'number.min': 'Total amount cannot be negative',
        'any.required': 'Total amount is required'
      }),
    insuranceId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).allow(null).optional(),
    insuranceCoverage: Joi.number().min(0).default(0),
    patientResponsibility: Joi.number().min(0).required()
      .messages({
        'number.base': 'Patient responsibility must be a number',
        'number.min': 'Patient responsibility cannot be negative',
        'any.required': 'Patient responsibility is required'
      }),
    coPayAmount: Joi.number().min(0).default(0),
    billStatus: Joi.string()
      .valid('draft', 'pending', 'submitted', 'paid', 'partially_paid', 'overdue', 'declined')
      .default('draft'),
    dueDate: Joi.date().iso().required()
      .messages({
        'date.base': 'Due date must be a valid date',
        'any.required': 'Due date is required'
      }),
    billingDate: Joi.date().iso().default(Date.now),
    notes: Joi.string().allow('').optional(),
    billingCode: Joi.string().trim().required()
      .messages({
        'string.base': 'Billing code must be a string',
        'string.empty': 'Billing code is required',
        'any.required': 'Billing code is required'
      }),
    diagnosisCodes: Joi.array().items(Joi.string()).default([]),
    procedureCodes: Joi.array().items(Joi.string()).default([])
  }),

  // Validate insurance claim
  validateInsuranceClaim: Joi.object({
    billingId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Billing ID must be a valid MongoDB ObjectId',
        'any.required': 'Billing ID is required'
      }),
    patientId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Patient ID must be a valid MongoDB ObjectId',
        'any.required': 'Patient ID is required'
      }),
    patientInsuranceId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Patient insurance ID must be a valid MongoDB ObjectId',
        'any.required': 'Patient insurance ID is required'
      }),
    providerId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Provider ID must be a valid MongoDB ObjectId',
        'any.required': 'Provider ID is required'
      }),
    claimNumber: Joi.string().allow('').optional(),
    claimDate: Joi.date().iso().default(Date.now),
    claimStatus: Joi.string()
      .valid('pending', 'submitted', 'in_review', 'approved', 'partially_approved', 'denied', 'appealed')
      .default('pending'),
    claimAmount: Joi.number().min(0).required()
      .messages({
        'number.base': 'Claim amount must be a number',
        'number.min': 'Claim amount cannot be negative',
        'any.required': 'Claim amount is required'
      }),
    approvedAmount: Joi.number().min(0).default(0),
    denialReason: Joi.string().allow('').optional(),
    submissionDate: Joi.date().iso().allow(null).optional(),
    responseDate: Joi.date().iso().allow(null).optional(),
    notes: Joi.string().allow('').optional(),
    attachments: Joi.array().items(
      Joi.object({
        filename: Joi.string().required(),
        path: Joi.string().required(),
        uploadDate: Joi.date().default(Date.now)
      })
    ).default([])
  }),

  // Validate payment
  validatePayment: Joi.object({
    billingId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Billing ID must be a valid MongoDB ObjectId',
        'any.required': 'Billing ID is required'
      }),
    amount: Joi.number().min(0.01).required()
      .messages({
        'number.base': 'Amount must be a number',
        'number.min': 'Amount must be greater than zero',
        'any.required': 'Amount is required'
      }),
    paymentMethod: Joi.string()
      .valid('cash', 'credit_card', 'debit_card', 'insurance', 'electronic_transfer', 'check', 'other')
      .required()
      .messages({
        'any.only': 'Payment method must be one of the allowed values',
        'any.required': 'Payment method is required'
      }),
    paymentDate: Joi.date().iso().default(Date.now),
    transactionId: Joi.string().allow('').optional(),
    receiptNumber: Joi.string().allow('').optional(),
    notes: Joi.string().allow('').optional(),
    paymentSource: Joi.string().valid('patient', 'insurance', 'other').default('patient'),
    paymentStatus: Joi.string().valid('pending', 'completed', 'failed', 'refunded').default('completed'),
    refundAmount: Joi.number().min(0).default(0),
    refundDate: Joi.date().iso().allow(null).optional().when('refundAmount', {
      is: Joi.number().greater(0),
      then: Joi.date().iso().required()
        .messages({
          'any.required': 'Refund date is required when refund amount is specified'
        })
    }),
    refundReason: Joi.string().allow('').optional().when('refundAmount', {
      is: Joi.number().greater(0),
      then: Joi.string().required()
        .messages({
          'any.required': 'Refund reason is required when refund amount is specified'
        })
    })
  }),

  // Validate payment plan
  validatePaymentPlan: Joi.object({
    patientId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Patient ID must be a valid MongoDB ObjectId',
        'any.required': 'Patient ID is required'
      }),
    billingIds: Joi.array().items(
      Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
        .messages({
          'string.pattern.base': 'Billing ID must be a valid MongoDB ObjectId'
        })
    ).min(1).required()
      .messages({
        'array.min': 'At least one billing ID is required',
        'any.required': 'Billing IDs are required'
      }),
    totalAmount: Joi.number().min(0).required()
      .messages({
        'number.base': 'Total amount must be a number',
        'number.min': 'Total amount cannot be negative',
        'any.required': 'Total amount is required'
      }),
    remainingBalance: Joi.number().min(0).required()
      .messages({
        'number.base': 'Remaining balance must be a number',
        'number.min': 'Remaining balance cannot be negative',
        'any.required': 'Remaining balance is required'
      }),
    installmentAmount: Joi.number().min(0).required()
      .messages({
        'number.base': 'Installment amount must be a number',
        'number.min': 'Installment amount cannot be negative',
        'any.required': 'Installment amount is required'
      }),
    frequency: Joi.string().valid('weekly', 'biweekly', 'monthly').default('monthly'),
    startDate: Joi.date().iso().required()
      .messages({
        'date.base': 'Start date must be a valid date',
        'any.required': 'Start date is required'
      }),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
      .messages({
        'date.base': 'End date must be a valid date',
        'date.min': 'End date must be after the start date',
        'any.required': 'End date is required'
      }),
    nextPaymentDate: Joi.date().iso().min(Joi.ref('startDate')).required()
      .messages({
        'date.base': 'Next payment date must be a valid date',
        'date.min': 'Next payment date must be after the start date',
        'any.required': 'Next payment date is required'
      }),
    status: Joi.string().valid('active', 'completed', 'defaulted', 'cancelled').default('active'),
    paymentMethod: Joi.string().valid('credit_card', 'debit_card', 'electronic_transfer', 'manual').required()
      .messages({
        'any.only': 'Payment method must be one of the allowed values',
        'any.required': 'Payment method is required'
      }),
    autoCharge: Joi.boolean().default(false),
    notes: Joi.string().allow('').optional(),
    numberOfInstallments: Joi.number().integer().min(1).required()
      .messages({
        'number.base': 'Number of installments must be a number',
        'number.integer': 'Number of installments must be an integer',
        'number.min': 'Number of installments must be at least 1',
        'any.required': 'Number of installments is required'
      }),
    installmentsPaid: Joi.number().integer().min(0).default(0)
      .messages({
        'number.base': 'Installments paid must be a number',
        'number.integer': 'Installments paid must be an integer',
        'number.min': 'Installments paid cannot be negative'
      })
  })
};

module.exports = billingValidators;
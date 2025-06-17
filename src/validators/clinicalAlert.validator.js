const Joi = require('joi');
const { objectId } = require('./custom.validator');

const getPatientAlerts = {
  params: Joi.object().keys({
    patientId: Joi.string().custom(objectId).required()
  }),
  body: Joi.object().keys({
    medications: Joi.array().items(Joi.string().custom(objectId)),
    diagnoses: Joi.array().items(
      Joi.object().keys({
        code: Joi.string().required()
      })
    ),
    labResults: Joi.array().items(
      Joi.object().keys({
        testCode: Joi.string().required(),
        value: Joi.string().required()
      })
    ),
    appointment: Joi.object().keys({
      type: Joi.string()
    })
  })
};

const updateUserPreferences = {
  body: Joi.object().keys({
    globalAlertStatus: Joi.string().valid('enabled', 'critical-only', 'disabled'),
    categoryPreferences: Joi.array().items(
      Joi.object().keys({
        category: Joi.string().valid(
          'drug-interaction', 
          'preventive-care', 
          'diagnosis-alert', 
          'lab-alert', 
          'best-practice',
          'administrative'
        ).required(),
        status: Joi.string().valid('enabled', 'muted', 'disabled').required(),
        reasonForMuting: Joi.string()
      })
    ),
    alertPreferences: Joi.array().items(
      Joi.object().keys({
        alert: Joi.string().custom(objectId).required(),
        status: Joi.string().valid('enabled', 'muted', 'disabled').required(),
        customSeverity: Joi.string().valid('info', 'warning', 'critical'),
        customText: Joi.object().keys({
          title: Joi.string(),
          description: Joi.string()
        }),
        muteUntil: Joi.date(),
        reasonForMuting: Joi.string()
      })
    )
  }).min(1)
};

const createAlert = {
  body: Joi.object().keys({
    title: Joi.string().required(),
    description: Joi.string().required(),
    category: Joi.string().valid(
      'drug-interaction', 
      'preventive-care', 
      'diagnosis-alert', 
      'lab-alert', 
      'best-practice',
      'administrative'
    ).required(),
    severity: Joi.string().valid('info', 'warning', 'critical').required(),
    triggerConditions: Joi.array().items(
      Joi.object().keys({
        type: Joi.string().valid(
          'diagnosis', 
          'medication', 
          'lab-result', 
          'patient-demographic', 
          'seasonal',
          'appointment-type',
          'custom'
        ).required(),
        codes: Joi.array().items(Joi.string()).required(),
        valueRange: Joi.object().keys({
          min: Joi.number(),
          max: Joi.number(),
          unit: Joi.string()
        }),
        additionalCriteria: Joi.object()
      })
    ).min(1).required(),
    source: Joi.object().keys({
      name: Joi.string().required(),
      url: Joi.string().uri(),
      lastUpdated: Joi.date()
    }).required(),
    evidenceLevel: Joi.string().valid(
      'I', 'II', 'III', 'IV', 'V', 'expert-opinion', 'not-applicable'
    ),
    recommendedAction: Joi.object().keys({
      text: Joi.string(),
      actionType: Joi.string().valid(
        'order-test', 'prescribe-medication', 'referral', 
        'vaccination', 'follow-up', 'education', 'other'
      ),
      actionDetails: Joi.object()
    }),
    autoDismiss: Joi.boolean(),
    dismissTimeout: Joi.number().min(0),
    isSystemDefined: Joi.boolean(),
    isActive: Joi.boolean(),
    expirationDate: Joi.date(),
    applicableDepartments: Joi.array().items(Joi.string()),
    customizationOptions: Joi.object().keys({
      canMute: Joi.boolean(),
      canAdjustSeverity: Joi.boolean(),
      canCustomizeText: Joi.boolean()
    })
  })
};

const updateAlert = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required()
  }),
  body: Joi.object().keys({
    title: Joi.string(),
    description: Joi.string(),
    category: Joi.string().valid(
      'drug-interaction', 
      'preventive-care', 
      'diagnosis-alert', 
      'lab-alert', 
      'best-practice',
      'administrative'
    ),
    severity: Joi.string().valid('info', 'warning', 'critical'),
    triggerConditions: Joi.array().items(
      Joi.object().keys({
        type: Joi.string().valid(
          'diagnosis', 
          'medication', 
          'lab-result', 
          'patient-demographic', 
          'seasonal',
          'appointment-type',
          'custom'
        ).required(),
        codes: Joi.array().items(Joi.string()).required(),
        valueRange: Joi.object().keys({
          min: Joi.number(),
          max: Joi.number(),
          unit: Joi.string()
        }),
        additionalCriteria: Joi.object()
      })
    ),
    source: Joi.object().keys({
      name: Joi.string().required(),
      url: Joi.string().uri(),
      lastUpdated: Joi.date()
    }),
    evidenceLevel: Joi.string().valid(
      'I', 'II', 'III', 'IV', 'V', 'expert-opinion', 'not-applicable'
    ),
    recommendedAction: Joi.object().keys({
      text: Joi.string(),
      actionType: Joi.string().valid(
        'order-test', 'prescribe-medication', 'referral', 
        'vaccination', 'follow-up', 'education', 'other'
      ),
      actionDetails: Joi.object()
    }),
    autoDismiss: Joi.boolean(),
    dismissTimeout: Joi.number().min(0),
    isActive: Joi.boolean(),
    expirationDate: Joi.date(),
    applicableDepartments: Joi.array().items(Joi.string()),
    customizationOptions: Joi.object().keys({
      canMute: Joi.boolean(),
      canAdjustSeverity: Joi.boolean(),
      canCustomizeText: Joi.boolean()
    })
  }).min(1)
};

module.exports = {
  getPatientAlerts,
  updateUserPreferences,
  createAlert,
  updateAlert
};
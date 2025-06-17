const Joi = require('joi');
const { objectId } = require('./custom.validator');

const createPrescription = {
  body: Joi.object().keys({
    patient: Joi.string().custom(objectId).required(),
    prescribedBy: Joi.string().custom(objectId).required(),
    visitId: Joi.string().custom(objectId),
    pharmacy: Joi.string().custom(objectId).required(),
    medications: Joi.array().items(
      Joi.object().keys({
        medication: Joi.string().custom(objectId).required(),
        dosage: Joi.object().keys({
          amount: Joi.number().required(),
          unit: Joi.string().required()
        }).required(),
        route: Joi.string().valid('oral', 'topical', 'injection', 'inhaled', 'rectal', 'vaginal', 'ophthalmic', 'otic', 'nasal', 'other').required(),
        frequency: Joi.string().required(),
        duration: Joi.object().keys({
          value: Joi.number().required(),
          unit: Joi.string().valid('days', 'weeks', 'months', 'as needed').required()
        }).required(),
        quantity: Joi.number().required(),
        refills: Joi.number().min(0).default(0),
        dispenseAsWritten: Joi.boolean().default(false),
        instructions: Joi.string().required(),
        reasonForPrescribing: Joi.string()
      })
    ).min(1).required(),
    notes: Joi.string()
  })
};

const updateStatus = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required()
  }),
  body: Joi.object().keys({
    status: Joi.string().valid('draft', 'pending', 'active', 'completed', 'cancelled', 'rejected').required(),
    notes: Joi.string()
  })
};

const signPrescription = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required()
  }),
  body: Joi.object().keys({
    signature: Joi.string().required()
  })
};

const transmitPrescription = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required()
  }),
  body: Joi.object().keys({
    method: Joi.string().valid('electronic', 'fax', 'print', 'phone').required()
  })
};

const checkInteractions = {
  body: Joi.object().keys({
    patientId: Joi.string().custom(objectId).required(),
    medicationIds: Joi.array().items(Joi.string().custom(objectId)).min(1).required()
  })
};

const overrideWarning = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required()
  }),
  body: Joi.object().keys({
    warningType: Joi.string().valid('interaction', 'allergy').required(),
    warningId: Joi.string().custom(objectId).required(),
    overrideReason: Joi.string().required()
  })
};

module.exports = {
  createPrescription,
  updateStatus,
  signPrescription,
  transmitPrescription,
  checkInteractions,
  overrideWarning
};
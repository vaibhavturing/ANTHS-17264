const prescriptionService = require('../services/prescription.service');
const drugInteractionService = require('../services/drugInteraction.service');
const ApiError = require('../utils/api-error');
const catchAsync = require('../utils/catch-async');

exports.createPrescription = catchAsync(async (req, res) => {
  const prescription = await prescriptionService.createPrescription(req.body);
  res.status(201).json({
    success: true,
    data: prescription
  });
});

exports.getPrescriptionById = catchAsync(async (req, res) => {
  const prescription = await prescriptionService.getPrescriptionById(req.params.id);
  res.status(200).json({
    success: true,
    data: prescription
  });
});

exports.getPrescriptionsByDoctor = catchAsync(async (req, res) => {
  const result = await prescriptionService.getPrescriptionsByDoctor(
    req.params.doctorId,
    req.query
  );
  res.status(200).json({
    success: true,
    ...result
  });
});

exports.getPrescriptionsByPatient = catchAsync(async (req, res) => {
  const result = await prescriptionService.getPrescriptionsByPatient(
    req.params.patientId,
    req.query
  );
  res.status(200).json({
    success: true,
    ...result
  });
});

exports.updatePrescriptionStatus = catchAsync(async (req, res) => {
  const { status, notes } = req.body;
  const prescription = await prescriptionService.updatePrescriptionStatus(
    req.params.id,
    status,
    req.user.id,
    notes
  );
  res.status(200).json({
    success: true,
    data: prescription
  });
});

exports.signPrescription = catchAsync(async (req, res) => {
  const { signature } = req.body;
  const prescription = await prescriptionService.signPrescription(
    req.params.id,
    signature,
    req.user.id
  );
  res.status(200).json({
    success: true,
    data: prescription
  });
});

exports.transmitPrescription = catchAsync(async (req, res) => {
  const { method } = req.body;
  const prescription = await prescriptionService.transmitPrescription(
    req.params.id,
    method,
    req.user.id
  );
  res.status(200).json({
    success: true,
    data: prescription
  });
});

exports.checkInteractions = catchAsync(async (req, res) => {
  const { patientId, medicationIds } = req.body;
  
  if (!patientId || !medicationIds || !Array.isArray(medicationIds)) {
    throw new ApiError(400, 'Patient ID and array of medication IDs are required');
  }
  
  const interactions = await drugInteractionService.checkAllInteractions(
    patientId,
    medicationIds
  );
  
  res.status(200).json({
    success: true,
    data: interactions
  });
});

exports.overrideWarning = catchAsync(async (req, res) => {
  const { warningType, warningId, overrideReason } = req.body;
  
  if (!warningType || !warningId || !overrideReason) {
    throw new ApiError(400, 'Warning type, warning ID, and override reason are required');
  }
  
  const prescription = await prescriptionService.overrideWarning(
    req.params.id,
    warningType,
    warningId,
    overrideReason,
    req.user.id
  );
  
  res.status(200).json({
    success: true,
    data: prescription
  });
});
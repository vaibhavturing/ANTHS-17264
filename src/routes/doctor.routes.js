const express = require('express');
const doctorController = require('../controllers/doctor.controller');
const auth = require('../middleware/auth.middleware');

const router = express.Router();

// Helper function to safely check if a function exists
const safeMiddleware = (fn, name) => {
  if (typeof fn !== 'function') {
    console.error(`❌ ${name} is not a function. Type: ${typeof fn}`);
    return (req, res, next) => {
      res.status(500).json({ error: `Middleware ${name} is not properly configured` });
    };
  }
  return fn;
};

// Helper function to safely check controller functions
const safeController = (fn, name) => {
  if (typeof fn !== 'function') {
    console.error(`❌ ${name} is not a function. Type: ${typeof fn}`);
    return (req, res) => {
      res.status(500).json({ error: `Controller ${name} is not properly configured` });
    };
  }
  return fn;
};

// Routes

router.get('/specialties', safeController(doctorController.getSpecialties, 'getSpecialties'));

router.get('/', safeController(doctorController.getDoctors, 'getDoctors'));

router.get('/:id', safeController(doctorController.getDoctorById, 'getDoctorById'));

router.post('/',
  safeMiddleware(auth.requireRole, 'requireRole') ? auth.requireRole('admin') : (req, res, next) => next(),
  safeController(doctorController.createDoctor, 'createDoctor')
);

router.put('/:id',
  safeMiddleware(auth.requireSelfOrRole, 'requireSelfOrRole') ? auth.requireSelfOrRole('admin', 'id') : (req, res, next) => next(),
  safeController(doctorController.updateDoctor, 'updateDoctor')
);

router.patch('/:id',
  safeMiddleware(auth.requireSelfOrRole, 'requireSelfOrRole') ? auth.requireSelfOrRole('admin', 'id') : (req, res, next) => next(),
  safeController(doctorController.partialUpdateDoctor, 'partialUpdateDoctor')
);

router.delete('/:id',
  safeMiddleware(auth.requireRole, 'requireRole') ? auth.requireRole('admin') : (req, res, next) => next(),
  safeController(doctorController.deleteDoctor, 'deleteDoctor')
);

router.put('/:id/credentials',
  safeMiddleware(auth.requireSelfOrRole, 'requireSelfOrRole') ? auth.requireSelfOrRole('admin', 'id') : (req, res, next) => next(),
  safeController(doctorController.updateDoctorCredentials, 'updateDoctorCredentials')
);

// ✅ FIXED: Replace auth.authenticate with auth.protect
router.get('/:id/schedule',
  safeMiddleware(auth.protect, 'protect'),
  safeController(doctorController.getDoctorSchedule, 'getDoctorSchedule')
);

router.put('/:id/schedule',
  safeMiddleware(auth.requireSelfOrRole, 'requireSelfOrRole') ? auth.requireSelfOrRole('admin', 'id') : (req, res, next) => next(),
  safeController(doctorController.updateDoctorSchedule, 'updateDoctorSchedule')
);

router.get('/:id/patients',
  safeMiddleware(auth.requireSelfOrRole, 'requireSelfOrRole') ? auth.requireSelfOrRole('admin', 'id') : (req, res, next) => next(),
  safeController(doctorController.getDoctorPatients, 'getDoctorPatients')
);

module.exports = router;

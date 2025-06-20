// src/routes/location.routes.js
const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');
const locationValidator = require('../validators/location.validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Get all locations (public endpoint - no authentication required)
router.get('/', locationController.getAllLocations);

// Get location by ID (public endpoint - no authentication required)
router.get('/:id', locationValidator.validateGetLocation, locationController.getLocationById);

// Get locations by service (public endpoint - no authentication required)
router.get('/services/:service', locationValidator.validateServiceParam, locationController.getLocationsByService);

// Get locations by region (public endpoint - no authentication required)
router.get('/region', locationValidator.validateRegionQuery, locationController.getLocationsByRegion);

// Get all services (public endpoint - no authentication required)
router.get('/services', locationController.getAllServices);

// The following routes require authentication
router.use(authenticate);

// Create location (admin only)
router.post(
  '/',
  authorize(['admin']),
  locationValidator.validateCreateLocation,
  locationController.createLocation
);

// Update location (admin only)
router.put(
  '/:id',
  authorize(['admin']),
  locationValidator.validateUpdateLocation,
  locationController.updateLocation
);

// Delete location (admin only)
router.delete(
  '/:id',
  authorize(['admin']),
  locationController.deleteLocation
);

module.exports = router;
// src/models/location.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const locationSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'USA'
    }
  },
  contactInfo: {
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String
    },
    fax: {
      type: String
    }
  },
  operatingHours: [{
    day: {
      type: String,
      required: true,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    open: {
      type: String,
      required: true
    },
    close: {
      type: String,
      required: true
    },
    isClosed: {
      type: Boolean,
      default: false
    }
  }],
  services: [{
    type: String
  }],
  facilities: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  imageUrl: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for searching locations by name
locationSchema.index({ name: 1 });

// Index for searching by city or state
locationSchema.index({ 'address.city': 1, 'address.state': 1 });

// Index for searching by services
locationSchema.index({ services: 1 });

// Geospatial index for location-based queries
locationSchema.index({ coordinates: '2dsphere' });

// Text index for full text search
locationSchema.index({
  name: 'text',
  'address.street': 'text',
  'address.city': 'text',
  'address.state': 'text',
  services: 'text'
});

// Pre-save middleware to update timestamps
locationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Location = mongoose.model('Location', locationSchema);

module.exports = Location;
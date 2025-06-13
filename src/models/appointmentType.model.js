const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const logger = require('../utils/logger');

/**
 * Appointment Type Schema
 * Defines different types of appointments with customizable durations and buffer times
 */
const appointmentTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    default: '#3498db', // Default blue color for appointment type
    validate: {
      validator: function(v) {
        return /^#[0-9A-Fa-f]{6}$/.test(v); // Validate hex color
      },
      message: props => `${props.value} is not a valid hex color!`
    }
  },
  // Duration in minutes
  duration: {
    type: Number,
    required: true,
    min: 5,
    max: 240, // Max 4 hours
    default: 30
  },
  // Optional buffer time after appointment in minutes
  bufferTime: {
    type: Number,
    min: 0,
    max: 60, // Max 1 hour buffer
    default: 0
  },
  // Whether this appointment type requires a physical visit
  isVirtual: {
    type: Boolean,
    default: false
  },
  // Whether this appointment type is active and can be booked
  isActive: {
    type: Boolean,
    default: true
  },
  // Default preparation instructions for this appointment type
  preparationInstructions: {
    type: String
  },
  // Specialties this appointment type applies to
  specialties: [{
    type: String,
    trim: true
  }],
  // Doctor-specific appointment type settings
  doctorSettings: [{
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true
    },
    // Doctor-specific duration override (in minutes)
    duration: {
      type: Number,
      min: 5,
      max: 240
    },
    // Doctor-specific buffer time override (in minutes)
    bufferTime: {
      type: Number,
      min: 0,
      max: 60
    },
    // Whether this appointment type is active for this doctor
    isActive: {
      type: Boolean,
      default: true
    },
    // Doctor-specific preparation instructions
    preparationInstructions: {
      type: String
    }
  }]
}, baseSchema.baseOptions);

// Method to get the effective settings for a specific doctor
appointmentTypeSchema.methods.getSettingsForDoctor = function(doctorId) {
  try {
    // Default settings for this appointment type
    const defaultSettings = {
      duration: this.duration,
      bufferTime: this.bufferTime,
      isActive: this.isActive,
      preparationInstructions: this.preparationInstructions
    };

    // Find doctor-specific settings if they exist
    const doctorSetting = this.doctorSettings.find(
      setting => setting.doctorId.toString() === doctorId.toString()
    );

    if (!doctorSetting) {
      return defaultSettings;
    }

    // Return merged settings, with doctor-specific overrides
    return {
      duration: doctorSetting.duration || defaultSettings.duration,
      bufferTime: doctorSetting.bufferTime || defaultSettings.bufferTime,
      isActive: typeof doctorSetting.isActive === 'boolean' ? doctorSetting.isActive : defaultSettings.isActive,
      preparationInstructions: doctorSetting.preparationInstructions || defaultSettings.preparationInstructions
    };
  } catch (error) {
    logger.error('Error in getSettingsForDoctor', { 
      error: error.message,
      appointmentTypeId: this._id,
      doctorId 
    });
    throw error;
  }
};

// Static method to find active appointment types for a doctor
appointmentTypeSchema.statics.findActiveForDoctor = async function(doctorId) {
  try {
    // Get all appointment types
    const allTypes = await this.find();
    
    // Filter to those that are active for this doctor
    const activeTypes = [];
    
    for (const type of allTypes) {
      // Get settings for this doctor
      const settings = type.getSettingsForDoctor(doctorId);
      
      if (settings.isActive) {
        // Create a new object with just the necessary information
        activeTypes.push({
          _id: type._id,
          name: type.name,
          description: type.description,
          color: type.color,
          duration: settings.duration,
          bufferTime: settings.bufferTime,
          isVirtual: type.isVirtual,
          preparationInstructions: settings.preparationInstructions
        });
      }
    }
    
    return activeTypes;
  } catch (error) {
    logger.error('Error in findActiveForDoctor', { 
      error: error.message,
      doctorId 
    });
    throw error;
  }
};

// Calculate total time including buffer
appointmentTypeSchema.virtual('totalDuration').get(function() {
  return this.duration + this.bufferTime;
});

// Ensure the model includes virtual properties when converted to JSON
appointmentTypeSchema.set('toJSON', { virtuals: true });
appointmentTypeSchema.set('toObject', { virtuals: true });

const AppointmentType = mongoose.model('AppointmentType', appointmentTypeSchema);

module.exports = AppointmentType;
/**
 * Role Model
 * File: src/models/role.model.js
 * 
 * This model defines roles and their associated permissions.
 * UPDATED: Added default roles and enhanced role structure.
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roleSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  permissions: [{
    type: Schema.Types.ObjectId,
    ref: 'Permission'
  }],
  // NEW: Added priority field to determine role hierarchy
  priority: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // NEW: Added system flag to protect built-in roles
  isSystem: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
roleSchema.index({ name: 1 });
roleSchema.index({ priority: 1 });

// NEW: Static method to get default roles
roleSchema.statics.getDefaultRoles = function() {
  return [
    {
      name: 'admin',
      description: 'System Administrator with full access',
      priority: 100,
      isSystem: true
    },
    {
      name: 'doctor',
      description: 'Medical Doctor with clinical access',
      priority: 50,
      isSystem: true
    },
    {
      name: 'nurse',
      description: 'Nurse with patient care access',
      priority: 40,
      isSystem: true
    },
    {
      name: 'receptionist',
      description: 'Front-desk staff managing appointments',
      priority: 30,
      isSystem: true
    },
    {
      name: 'patient',
      description: 'Patient with access to own records',
      priority: 10,
      isSystem: true
    },
    {
      name: 'security_analyst',
      description: 'Security team member managing security operations',
      priority: 80,
      isSystem: true
    }
  ];
};

// NEW: Get permission map for default roles
roleSchema.statics.getDefaultRolePermissions = function() {
  return {
    'admin': [
      'users:admin',
      'patients:admin',
      'medical_records:admin',
      'appointments:admin',
      'medications:admin',
      'prescriptions:admin',
      'pharmacies:admin',
      'reports:admin',
      'security:admin',
      'system:admin',
      'settings:admin'
    ],
    'doctor': [
      'patients:read',
      'patients:read_all',
      'patients:update',
      'medical_records:read',
      'medical_records:create',
      'medical_records:update',
      'appointments:read',
      'appointments:create',
      'appointments:update',
      'medications:read',
      'medications:create',
      'prescriptions:read',
      'prescriptions:create',
      'prescriptions:update',
      'prescriptions:approve'
    ],
    'nurse': [
      'patients:read',
      'patients:update',
      'medical_records:read',
      'medical_records:create',
      'medical_records:update',
      'appointments:read',
      'appointments:update',
      'medications:read'
    ],
    'receptionist': [
      'patients:read',
      'patients:create',
      'patients:update',
      'appointments:read',
      'appointments:create',
      'appointments:update',
      'appointments:delete'
    ],
    'patient': [
      'users:read',
      'patients:read'
    ],
    'security_analyst': [
      'security:read',
      'security:update',
      'reports:read'
    ]
  };
};

module.exports = mongoose.model('Role', roleSchema);
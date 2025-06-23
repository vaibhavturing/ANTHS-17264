/**
 * Permission Model
 * File: src/models/permission.model.js
 * 
 * This model defines the permissions available in the application.
 * UPDATED: Added more granular permissions for RBAC enhancement.
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const permissionSchema = new Schema({
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
  // NEW: Added resource and action fields for more granular permissions
  resource: {
    type: String,
    required: true,
    enum: [
      'users',
      'patients',
      'doctors',
      'appointments',
      'medical_records',
      'medications',
      'prescriptions',
      'pharmacies',
      'reports',
      'security',
      'system',
      'settings'
    ],
    trim: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'create',
      'read',
      'update',
      'delete',
      'read_all', // Can read all records, not just assigned
      'read_sensitive', // Can view sensitive fields
      'approve',
      'reject',
      'assign',
      'export',
      'admin' // Full access to this resource
    ],
    trim: true
  },
  // NEW: Added conditions field for conditional permissions
  conditions: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// NEW: Helper method to generate permission name from resource and action
permissionSchema.pre('save', function(next) {
  if (!this.name) {
    this.name = `${this.resource}:${this.action}`;
  }
  next();
});

// NEW: Static method to get default permissions
permissionSchema.statics.getDefaultPermissions = function() {
  return [
    // User permissions
    { resource: 'users', action: 'read', description: 'Can view user details' },
    { resource: 'users', action: 'create', description: 'Can create users' },
    { resource: 'users', action: 'update', description: 'Can update user details' },
    { resource: 'users', action: 'delete', description: 'Can delete users' },
    { resource: 'users', action: 'read_all', description: 'Can view all users' },
    
    // Patient permissions
    { resource: 'patients', action: 'read', description: 'Can view patient details' },
    { resource: 'patients', action: 'create', description: 'Can create patients' },
    { resource: 'patients', action: 'update', description: 'Can update patient details' },
    { resource: 'patients', action: 'delete', description: 'Can delete patients' },
    { resource: 'patients', action: 'read_sensitive', description: 'Can view sensitive patient information' },
    
    // Medical record permissions
    { resource: 'medical_records', action: 'read', description: 'Can view medical records' },
    { resource: 'medical_records', action: 'create', description: 'Can create medical records' },
    { resource: 'medical_records', action: 'update', description: 'Can update medical records' },
    { resource: 'medical_records', action: 'delete', description: 'Can delete medical records' },
    
    // Prescription permissions
    { resource: 'prescriptions', action: 'read', description: 'Can view prescriptions' },
    { resource: 'prescriptions', action: 'create', description: 'Can create prescriptions' },
    { resource: 'prescriptions', action: 'update', description: 'Can update prescriptions' },
    { resource: 'prescriptions', action: 'approve', description: 'Can approve prescriptions' },
    
    // System permissions
    { resource: 'system', action: 'admin', description: 'Full administrative access' },
    { resource: 'security', action: 'admin', description: 'Security administration' },
    { resource: 'settings', action: 'admin', description: 'System settings administration' }
  ];
};

// Indexes for efficient queries
permissionSchema.index({ name: 1 });
permissionSchema.index({ resource: 1, action: 1 }, { unique: true });

module.exports = mongoose.model('Permission', permissionSchema);
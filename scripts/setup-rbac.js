/**
 * Setup RBAC System
 * File: scripts/setup-rbac.js
 * 
 * This script initializes the Role-Based Access Control system with default
 * permissions and roles.
 * 
 * Usage: node scripts/setup-rbac.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { connectDB } = require('../src/config/database');
const Permission = require('../src/models/permission.model');
const Role = require('../src/models/role.model');
const User = require('../src/models/user.model');
const logger = require('../src/utils/logger');

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database');
    
    // Create default permissions
    console.log('Creating default permissions...');
    const defaultPermissions = Permission.getDefaultPermissions();
    
    // Clear existing permissions if running a clean setup
    if (process.argv.includes('--clean')) {
      console.log('Cleaning existing permissions...');
      await Permission.deleteMany({});
    }
    
    // Create permissions
    const permissionPromises = defaultPermissions.map(async (permData) => {
      const existingPerm = await Permission.findOne({ 
        resource: permData.resource, 
        action: permData.action 
      });
      
      if (existingPerm) {
        console.log(`Permission ${permData.resource}:${permData.action} already exists`);
        return existingPerm;
      }
      
      const perm = new Permission({
        name: `${permData.resource}:${permData.action}`,
        description: permData.description,
        resource: permData.resource,
        action: permData.action,
        isActive: true
      });
      
      await perm.save();
      console.log(`Created permission: ${perm.name}`);
      return perm;
    });
    
    const permissions = await Promise.all(permissionPromises);
    
    // Create default roles
    console.log('\nCreating default roles...');
    const defaultRoles = Role.getDefaultRoles();
    const defaultRolePermissions = Role.getDefaultRolePermissions();
    
    // Clear existing roles if running a clean setup
    if (process.argv.includes('--clean')) {
      console.log('Cleaning existing roles...');
      await Role.deleteMany({});
    }
    
    // Create roles
    const rolePromises = defaultRoles.map(async (roleData) => {
      const existingRole = await Role.findOne({ name: roleData.name });
      
      if (existingRole) {
        console.log(`Role ${roleData.name} already exists`);
        return existingRole;
      }
      
      const role = new Role({
        name: roleData.name,
        description: roleData.description,
        priority: roleData.priority,
        isSystem: roleData.isSystem,
        isActive: true
      });
      
      // Assign permissions to role
      if (defaultRolePermissions[roleData.name]) {
        const permissionNames = defaultRolePermissions[roleData.name];
        const rolePermissions = await Permission.find({ 
          name: { $in: permissionNames } 
        });
        
        role.permissions = rolePermissions.map(p => p._id);
      }
      
      await role.save();
      console.log(`Created role: ${role.name} with ${role.permissions.length} permissions`);
      return role;
    });
    
    const roles = await Promise.all(rolePromises);
    
    // Create admin user if it doesn't exist
    console.log('\nChecking for admin user...');
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@healthcare-app.com';
    const adminExists = await User.findOne({ email: adminEmail });
    
    if (adminExists) {
      console.log(`Admin user ${adminEmail} already exists`);
    } else {
      // Find admin role
      const adminRole = await Role.findOne({ name: 'admin' });
      
      if (!adminRole) {
        throw new Error('Admin role not found. Setup failed.');
      }
      
      // Create admin user
      const adminUser = new User({
        username: 'admin',
        email: adminEmail,
        password: process.env.ADMIN_PASSWORD || 'Admin123!@#',
        firstName: 'System',
        lastName: 'Administrator',
        roles: [adminRole._id],
        primaryRole: adminRole._id,
        isActive: true,
        isVerified: true
      });
      
      await adminUser.save();
      console.log(`Created admin user: ${adminUser.email}`);
    }
    
    console.log('\nRBAC setup completed successfully!');
    
    // Disconnect from database
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`Error in RBAC setup: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    
    // Disconnect from database
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error(`Error disconnecting from database: ${disconnectError.message}`);
    }
    
    process.exit(1);
  }
}

// Run the main function
main();
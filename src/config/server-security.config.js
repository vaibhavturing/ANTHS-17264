// src/config/server-security.config.js

/**
 * Server Security Configuration
 * This file contains configurations for server-level security settings
 * including SSH, firewall rules, and update management.
 */

module.exports = {
  // Firewall configuration 
  firewall: {
    // Only allow necessary ports
    allowedPorts: [
      22,    // SSH
      80,    // HTTP (redirect to HTTPS)
      443,   // HTTPS
      3000,  // Application server (if needed)
      5432,  // PostgreSQL (only from application servers)
      27017  // MongoDB (only from application servers)
    ],
    // Deny all other ports by default
    defaultPolicy: 'deny'
  },
  
  // SSH configuration
  ssh: {
    // Disable password authentication
    passwordAuthentication: false,
    // Only use SSH key-based authentication
    pubkeyAuthentication: true,
    // Restrict to SSH protocol 2
    protocol: 2,
    // Maximum authentication attempts
    maxAuthTries: 3,
    // Login grace time (seconds)
    loginGraceTime: 60,
    // Restrict SSH to specific system users
    allowUsers: ['app-user', 'admin-user'],
    // Root login disabled
    permitRootLogin: false,
    // Disable empty passwords
    permitEmptyPasswords: false
  },
  
  // System update and patch management
  updates: {
    // Auto-update security patches
    securityUpdatesAuto: true,
    // Schedule for security updates
    securityUpdateSchedule: '0 2 * * *', // Daily at 2:00 AM
    // Full system update schedule
    systemUpdateSchedule: '0 3 * * 0',  // Weekly on Sunday at 3:00 AM
    // Package blacklist (never auto-update these)
    updateBlacklist: ['custom-app', 'legacy-dependency'],
    // Notification email for update reports
    notificationEmail: 'admin@healthcare-app.com'
  }
};
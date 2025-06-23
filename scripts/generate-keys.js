/**
 * Generate Encryption Keys and Certificates
 * File: scripts/generate-keys.js
 * 
 * This script generates encryption keys and self-signed certificates for development.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create directories if they don't exist
const certsDir = path.resolve(__dirname, '../certs');
const mongoDir = path.resolve(certsDir, 'mongo');
const postgresDir = path.resolve(certsDir, 'postgres');
const redisDir = path.resolve(certsDir, 'redis');

// Ensure directories exist
const dirs = [certsDir, mongoDir, postgresDir, redisDir];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Generate encryption keys for field-level encryption
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Generate self-signed certificates
function generateSelfSignedCert(name, dir) {
  console.log(`Generating self-signed certificate for ${name}...`);
  
  // Generate CA key and certificate
  execSync(`openssl genrsa -out ${path.join(dir, 'ca.key')} 2048`);
  execSync(`openssl req -new -x509 -key ${path.join(dir, 'ca.key')} -out ${path.join(dir, 'ca.crt')} -days 365 -subj "/CN=Healthcare-${name}-CA"`);
  
  // Generate server key and CSR
  execSync(`openssl genrsa -out ${path.join(dir, 'server.key')} 2048`);
  execSync(`openssl req -new -key ${path.join(dir, 'server.key')} -out ${path.join(dir, 'server.csr')} -subj "/CN=healthcare-${name}"`);
  
  // Create a configuration file for SAN
  const sanConfig = `
[req]
req_extensions = v3_req
distinguished_name = req_distinguished_name

[req_distinguished_name]

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = healthcare-${name}
DNS.3 = *.healthcare-app.com
IP.1 = 127.0.0.1
`;
  
  fs.writeFileSync(path.join(dir, 'san.cnf'), sanConfig);
  
  // Sign the server certificate with our CA
  execSync(`openssl x509 -req -in ${path.join(dir, 'server.csr')} -CA ${path.join(dir, 'ca.crt')} -CAkey ${path.join(dir, 'ca.key')} -CAcreateserial -out ${path.join(dir, 'server.crt')} -days 365 -extensions v3_req -extfile ${path.join(dir, 'san.cnf')}`);
  
  // Create PEM files that combine key and cert
  fs.writeFileSync(
    path.join(dir, `${name}.pem`),
    fs.readFileSync(path.join(dir, 'server.key')) + '\n' + fs.readFileSync(path.join(dir, 'server.crt'))
  );
  
  // Copy CA certificate to a pem file
  fs.copyFileSync(path.join(dir, 'ca.crt'), path.join(dir, 'ca.pem'));
  
  console.log(`Generated certificates for ${name} in ${dir}`);
}

// Generate all certificates
generateSelfSignedCert('app', certsDir);
generateSelfSignedCert('mongodb', mongoDir);
generateSelfSignedCert('postgres', postgresDir);
generateSelfSignedCert('redis', redisDir);

// Generate encryption keys
const primaryKey = generateEncryptionKey();
const secondaryKey = generateEncryptionKey();
const postgresTdeKey = generateEncryptionKey();

// Output the keys
console.log('\n==== ENCRYPTION KEYS ====');
console.log(`Field Encryption Primary Key: ${primaryKey}`);
console.log(`Field Encryption Secondary Key: ${secondaryKey}`);
console.log(`PostgreSQL TDE Key: ${postgresTdeKey}`);

// Save keys to a local .env.keys file (for development only - in production these should be managed securely)
const envContent = `
# WARNING: This file contains sensitive encryption keys.
# In production, these keys should be stored in a secure key management system.
# This file is for development purposes only and should never be committed to version control.

FIELD_ENCRYPTION_PRIMARY_KEY=${primaryKey}
FIELD_ENCRYPTION_SECONDARY_KEY=${secondaryKey}
POSTGRES_TDE_KEY=${postgresTdeKey}
`;

fs.writeFileSync(path.resolve(__dirname, '../.env.keys'), envContent);
console.log('\nKeys saved to .env.keys file. DO NOT commit this file to version control!');
console.log('In production, use a secure key management system instead.');

console.log('\nDone! You can now use these certificates and keys for encrypted development.');
// scripts/aws-secrets-bootstrap.js

/**
 * AWS Secrets Bootstrap Script
 * This script initializes required secrets in AWS Secrets Manager
 * for a new environment.
 * 
 * IMPORTANT: This should only be run once during initial setup
 * and requires AWS credentials with SecretsManager permissions.
 */

const AWS = require('aws-sdk');
const crypto = require('crypto');
const readline = require('readline');
const secretsConfig = require('../src/config/secrets.config');

// Configure AWS SDK
AWS.config.update({ region: secretsConfig.aws.region });
const secretsManager = new AWS.SecretsManager();

// Create interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Main function
 */
async function main() {
  console.log('AWS Secrets Manager Bootstrap\n');
  
  // Get environment
  const environment = await promptForInput('Enter environment (development, staging, production): ');
  
  // Validate environment
  if (!['development', 'staging', 'production'].includes(environment)) {
    console.error('Invalid environment. Must be development, staging, or production.');
    process.exit(1);
  }
  
  // Confirm before proceeding
  const secretPrefix = `healthcare-app-${environment}`;
  
  console.log(`\nThis will create secrets in AWS with prefix: ${secretPrefix}`);
  console.log('WARNING: This should only be run during initial environment setup.');
  
  const confirm = await promptForInput('\nProceed? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Operation canceled.');
    process.exit(0);
  }
  
  // Generate and store secrets
  console.log('\nCreating secrets in AWS Secrets Manager...');
  
  // Get the secret mapping from config
  const secretMapping = secretsConfig.secretMapping;
  
  // Create each secret
  for (const [key, path] of Object.entries(secretMapping)) {
    await createSecret(`${secretPrefix}${path}`, key);
  }
  
  console.log('\nSecrets creation complete!');
  console.log(`Created secrets with prefix: ${secretPrefix}`);
  process.exit(0);
}

/**
 * Prompt for user input
 * @param {string} question - Question to ask
 * @returns {Promise<string>} User input
 */
function promptForInput(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Create a secret in AWS Secrets Manager
 * @param {string} secretName - Full secret name
 * @param {string} internalKey - Internal key name
 * @returns {Promise<void>}
 */
async function createSecret(secretName, internalKey) {
  try {
    // Check if secret already exists
    try {
      await secretsManager.describeSecret({ SecretId: secretName }).promise();
      console.log(`Secret ${secretName} already exists, skipping...`);
      return;
    } catch (error) {
      // Secret doesn't exist, continue with creation
      if (error.code !== 'ResourceNotFoundException') {
        throw error;
      }
    }
    
    // For sensitive secrets, ask user for input
    let secretValue;
    
    if (internalKey.includes('password') || 
        internalKey.includes('secret') || 
        internalKey.includes('key') || 
        internalKey.includes('token')) {
      // Ask if user wants to provide a value or generate one
      const generateOption = await promptForInput(`Generate a random value for ${internalKey}? (yes/no): `);
      
      if (generateOption.toLowerCase() === 'yes') {
        // Generate a random value
        secretValue = crypto.randomBytes(32).toString('hex');
        console.log(`Generated random value for ${internalKey}`);
      } else {
        // Prompt for value
        secretValue = await promptForInput(`Enter value for ${internalKey}: `);
      }
    } else {
      // For non-sensitive secrets, just generate a placeholder
      secretValue = `placeholder-for-${internalKey}`;
      console.log(`Created placeholder value for ${internalKey}`);
    }
    
    // Create the secret
    await secretsManager.createSecret({
      Name: secretName,
      SecretString: secretValue,
      Description: `${internalKey} for Healthcare Management Application`
    }).promise();
    
    console.log(`Created secret: ${secretName}`);
  } catch (error) {
    console.error(`Error creating secret ${secretName}: ${error.message}`);
    throw error;
  }
}

// Run the script
main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
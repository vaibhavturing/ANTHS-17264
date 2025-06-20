/**
 * Test Data Population Script
 * 
 * This script populates the test database with fake patient data for testing purposes.
 * WARNING: This script should only be run in testing/development environments!
 */

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../src/utils/logger');
const dataGenerator = require('../src/utils/testDataGenerator');
const { Patient, MedicalRecord, User, Prescription } = require('../src/models');
const config = require('../src/config/config');

// Ensure we're not running in production
if (process.env.NODE_ENV === 'production') {
  logger.error('This script cannot be run in production environment');
  process.exit(1);
}

// Connect to database with test prefix
const connectToTestDB = async () => {
  try {
    // Make sure we're connecting to a test database
    const dbName = config.database.name.startsWith('test_') ? 
      config.database.name : 
      `test_${config.database.name}`;
    
    const connectionString = `${config.database.uri}/${dbName}`;
    
    await mongoose.connect(connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true
    });
    
    logger.info(`Connected to test database: ${dbName}`);
    
    return mongoose;
  } catch (error) {
    logger.error('Database connection failed', error);
    process.exit(1);
  }
};

/**
 * Populate test database with fake data
 */
const populateTestData = async () => {
  try {
    const db = await connectToTestDB();
    
    // First, clear any existing test data
    await dataGenerator.clearTestData(db);
    
    // Generate fake patients, medical records, and prescriptions
    const testData = dataGenerator.generateFakePatientBatch(50, true, true);
    
    // Generate test users
    const users = await dataGenerator.generateTestUsers();
    
    // Insert test data
    if (testData.patients.length > 0) {
      await Patient.insertMany(testData.patients);
      logger.info(`Inserted ${testData.patients.length} test patients`);
    }
    
    if (testData.medicalRecords.length > 0) {
      await MedicalRecord.insertMany(testData.medicalRecords);
      logger.info(`Inserted ${testData.medicalRecords.length} test medical records`);
    }
    
    if (testData.prescriptions.length > 0) {
      await Prescription.insertMany(testData.prescriptions);
      logger.info(`Inserted ${testData.prescriptions.length} test prescriptions`);
    }
    
    if (users.length > 0) {
      await User.insertMany(users);
      logger.info(`Inserted ${users.length} test users`);
    }
    
    // Log example test data
    logger.info('Example test patient:');
    logger.info(JSON.stringify(testData.patients[0], null, 2));
    
    logger.info('Example test prescription:');
    logger.info(JSON.stringify(testData.prescriptions[0], null, 2));
    
    // Close database connection
    await mongoose.connection.close();
    logger.info('Test data population complete');
    
    // Output test user credentials
    console.log('\nTest Users:');
    users.forEach(user => {
      console.log(`${user.role}: ${user.email} (password: Test123!)`);
    });
    
  } catch (error) {
    logger.error('Error populating test data', error);
    process.exit(1);
  }
};

// Run the script
populateTestData();
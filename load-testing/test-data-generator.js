// load-testing/test-data-generator.js
// Data generation functions for appointment booking load test

const faker = require('faker');
const moment = require('moment');

// Generate random login credentials
function generateUserCredentials(userContext, events, done) {
  // For testing we'll use test accounts with predictable credentials
  // Normally you'd use a pool of test users
  const userIndex = Math.floor(Math.random() * 100) + 1;
  userContext.vars.email = `testpatient${userIndex}@example.com`;
  userContext.vars.password = 'TestPassword123!';
  return done();
}

// Generate a valid appointment date (weekday during business hours)
function generateAppointmentDate(userContext, events, done) {
  const futureDate = moment().add(Math.floor(Math.random() * 30) + 1, 'days');
  // Ensure it's a weekday
  if (futureDate.day() === 0) futureDate.add(1, 'day'); // Sunday to Monday
  if (futureDate.day() === 6) futureDate.add(2, 'days'); // Saturday to Monday
  
  userContext.vars.appointmentDate = futureDate.format('YYYY-MM-DD');
  return done();
}

// Generate appointment data
function generateAppointmentData(userContext, events, done) {
  const startTime = new Date(userContext.vars.startTime);
  const endTime = new moment(startTime).add(30, 'minutes').toISOString();
  
  userContext.vars.endTime = endTime;
  userContext.vars.reason = faker.random.arrayElement([
    'Annual checkup', 
    'Follow-up visit', 
    'Consultation', 
    'Medication review', 
    'New patient visit'
  ]);
  userContext.vars.appointmentType = faker.random.arrayElement([
    'regular', 
    'urgent', 
    'follow-up', 
    'telehealth'
  ]);
  userContext.vars.notes = faker.lorem.sentence();
  
  return done();
}

module.exports = {
  generateUserCredentials,
  generateAppointmentDate,
  generateAppointmentData
};
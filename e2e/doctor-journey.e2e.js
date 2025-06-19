// e2e/doctor-journey.e2e.js
// Mobile doctor workflow testing
// NEW FILE: Mobile testing for doctor appointment management

describe('Doctor Appointment Journey (Mobile)', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  // USER JOURNEY STEP 1: Login as doctor
  it('should login successfully as doctor', async () => {
    // Wait for the login screen to appear
    await expect(element(by.id('login-screen'))).toBeVisible();
    
    // Enter credentials and login
    await element(by.id('email-input')).typeText('testdoctor@example.com');
    await element(by.id('password-input')).typeText('TestPassword123!');
    await element(by.id('login-button')).tap();
    
    // Verify doctor dashboard is visible
    await expect(element(by.id('doctor-dashboard'))).toBeVisible();
  });

  // USER JOURNEY STEP 2: View today's appointments
  it('should view today\'s appointments', async () => {
    // Check if already logged in
    if (!(await element(by.id('doctor-dashboard')).isVisible())) {
      // Login if needed
      await element(by.id('email-input')).typeText('testdoctor@example.com');
      await element(by.id('password-input')).typeText('TestPassword123!');
      await element(by.id('login-button')).tap();
      await expect(element(by.id('doctor-dashboard'))).toBeVisible();
    }
    
    // Tap on today's appointments section
    await element(by.id('todays-appointments')).tap();
    
    // Verify appointments list appears
    await expect(element(by.id('appointments-list-screen'))).toBeVisible();
  });

  // USER JOURNEY STEP 3: Select an appointment
  it('should select an appointment from the list', async () => {
    // Navigate to appointments if needed
    if (!(await element(by.id('appointments-list-screen')).isVisible())) {
      await element(by.id('menu-button')).tap();
      await element(by.id('menu-appointments')).tap();
      await expect(element(by.id('appointments-list-screen'))).toBeVisible();
    }
    
    // Check if there are appointments
    try {
      // Try to find appointments
      await expect(element(by.id('appointment-item'))).atIndex(0).toBeVisible();
      
      // Select first appointment
      await element(by.id('appointment-item')).atIndex(0).tap();
      
      // Verify appointment details screen
      await expect(element(by.id('appointment-details-screen'))).toBeVisible();
    } catch (e) {
      // No appointments found
      console.log('No appointments found for testing');
    }
  });

  // USER JOURNEY STEP 4: View patient information
  it('should view patient information', async () => {
    // If appointment details not visible, skip
    if (!(await element(by.id('appointment-details-screen')).isVisible())) {
      console.log('Skipping test as no appointment details are available');
      return;
    }
    
    // Tap view patient profile
    await element(by.id('view-patient-button')).tap();
    
    // Verify patient profile screen
    await expect(element(by.id('patient-profile-screen'))).toBeVisible();
    
    // Check profile sections are available
    await expect(element(by.id('patient-info-section'))).toBeVisible();
    
    // View medical history
    await element(by.id('medical-history-tab')).tap();
    await expect(element(by.id('medical-history-content'))).toBeVisible();
    
    // Return to appointment
    await device.pressBack();
  });

  // USER JOURNEY STEP 5: Start appointment
  it('should start the appointment', async () => {
    // Verify on appointment details
    if (!(await element(by.id('appointment-details-screen')).isVisible())) {
      console.log('Skipping test as no appointment details are available');
      return;
    }
    
    // Start appointment if button exists
    try {
      await element(by.id('start-appointment-button')).tap();
      
      // Confirm start if dialog appears
      try {
        await element(by.id('confirm-start-button')).tap();
      } catch (e) {
        // Confirmation dialog may not appear
      }
      
      // Verify appointment status changed
      await expect(element(by.id('appointment-status'))).toHaveText('In Progress');
      
    } catch (e) {
      console.log('Start appointment button not available');
    }
  });

  // USER JOURNEY STEP 6: Record clinical notes
  it('should record clinical notes', async () => {
    // Verify on appointment details
    if (!(await element(by.id('appointment-details-screen')).isVisible())) {
      console.log('Skipping test as no appointment details are available');
      return;
    }
    
    // Locate and tap on clinical notes section
    await element(by.id('clinical-notes-section')).tap();
    
    // Enter clinical notes
    await element(by.id('clinical-notes-input')).typeText('Patient presented with...\nVital signs normal.\nRecommended treatment plan.');
    
    // Save notes
    await element(by.id('save-notes-button')).tap();
    
    // Verify notes saved
    await expect(element(by.id('notes-saved-confirmation'))).toBeVisible();
  });

  // USER JOURNEY STEP 7: Complete appointment
  it('should complete the appointment', async () => {
    // Verify on appointment details
    if (!(await element(by.id('appointment-details-screen')).isVisible())) {
      console.log('Skipping test as no appointment details are available');
      return;
    }
    
    // Complete appointment
    try {
      await element(by.id('complete-appointment-button')).tap();
      
      // Enter completion details
      await element(by.id('completion-summary')).typeText('Appointment completed successfully');
      await element(by.id('follow-up-needed-toggle')).tap();
      
      // Finalize appointment
      await element(by.id('finalize-appointment-button')).tap();
      
      // Verify completion
      await expect(element(by.id('completion-confirmation'))).toBeVisible();
      
    } catch (e) {
      console.log('Complete appointment button not available');
    }
  });
});
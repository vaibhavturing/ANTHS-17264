// e2e/patient-journey.e2e.js
// Mobile E2E test for patient appointment flow
// NEW FILE: Mobile device testing for patient journey

describe('Patient Appointment Journey (Mobile)', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  // USER JOURNEY STEP 1: Login to the app
  it('should login successfully as patient', async () => {
    // Wait for the login screen to appear
    await expect(element(by.id('login-screen'))).toBeVisible();
    
    // Enter credentials and login
    await element(by.id('email-input')).typeText('testpatient@example.com');
    await element(by.id('password-input')).typeText('TestPassword123!');
    await element(by.id('login-button')).tap();
    
    // Verify dashboard is visible
    await expect(element(by.id('patient-dashboard'))).toBeVisible();
  });

  // USER JOURNEY STEP 2: Navigate to appointment booking
  it('should navigate to appointment booking', async () => {
    // Check if already logged in
    if (!(await element(by.id('patient-dashboard')).isVisible())) {
      // Login if needed
      await element(by.id('email-input')).typeText('testpatient@example.com');
      await element(by.id('password-input')).typeText('TestPassword123!');
      await element(by.id('login-button')).tap();
      await expect(element(by.id('patient-dashboard'))).toBeVisible();
    }
    
    // Tap the book appointment button
    await element(by.id('book-appointment-button')).tap();
    
    // Verify booking screen appears
    await expect(element(by.id('booking-screen'))).toBeVisible();
  });

  // USER JOURNEY STEP 3: Search for doctor and select
  it('should search for a doctor and select from results', async () => {
    // Navigate to booking if needed
    if (!(await element(by.id('booking-screen')).isVisible())) {
      await element(by.id('menu-button')).tap();
      await element(by.id('menu-appointments')).tap();
      await element(by.id('book-appointment-button')).tap();
      await expect(element(by.id('booking-screen'))).toBeVisible();
    }
    
    // Search for a doctor
    await element(by.id('doctor-search-input')).typeText('Smith');
    await element(by.id('search-button')).tap();
    
    // Verify search results
    await expect(element(by.id('search-results'))).toBeVisible();
    
    // Select first doctor
    await element(by.id('doctor-card')).atIndex(0).tap();
    
    // Verify doctor detail screen appears
    await expect(element(by.id('doctor-details'))).toBeVisible();
  });

  // USER JOURNEY STEP 4: Select appointment date and time
  it('should select appointment date and time', async () => {
    // Verify on correct screen
    await expect(element(by.id('doctor-details'))).toBeVisible();
    
    // Tap on date selector
    await element(by.id('date-selector')).tap();
    
    // Select a date (assuming date picker is visible)
    // For mobile testing, often need special handling of date pickers which are native controls
    // This can vary between iOS and Android
    if (device.getPlatform() === 'ios') {
      // iOS date picker
      await element(by.type('UIPickerView')).setColumnToValue(0, 'Tomorrow');
      await element(by.id('date-picker-done')).tap();
    } else {
      // Android date picker
      // Often need to select using coordinates or next day button
      await element(by.text('OK')).tap();
    }
    
    // Verify time slots appear
    await expect(element(by.id('time-slots'))).toBeVisible();
    
    // Select first available time slot
    await element(by.id('time-slot-item')).atIndex(0).tap();
    
    // Verify selection
    await expect(element(by.id('selected-slot-indicator'))).toBeVisible();
  });

  // USER JOURNEY STEP 5: Enter appointment details and confirm
  it('should enter appointment details and confirm booking', async () => {
    // Enter appointment reason
    await element(by.id('appointment-reason')).typeText('Annual checkup');
    
    // Select appointment type
    await element(by.id('appointment-type-selector')).tap();
    await element(by.id('appointment-type-regular')).tap();
    
    // Additional health info
    await element(by.id('health-info-toggle')).tap();
    await element(by.id('health-info-input')).typeText('No current health issues');
    
    // Scroll to see the submit button if needed
    await element(by.id('booking-form')).scrollTo('bottom');
    
    // Submit booking
    await element(by.id('confirm-booking-button')).tap();
    
    // Verify booking confirmation
    await expect(element(by.id('booking-confirmation'))).toBeVisible();
    
    // Save appointment ID for future reference
    const appointmentId = await element(by.id('appointment-id')).getText();
    console.log(`Booked appointment ID: ${appointmentId}`);
  });

  // USER JOURNEY STEP 6: View appointment details
  it('should view appointment details', async () => {
    // Tap on view details button
    await element(by.id('view-details-button')).tap();
    
    // Verify appointment details screen
    await expect(element(by.id('appointment-details-screen'))).toBeVisible();
    
    // Check appointment information is displayed correctly
    await expect(element(by.id('appointment-doctor-name'))).toBeVisible();
    await expect(element(by.id('appointment-date'))).toBeVisible();
    await expect(element(by.id('appointment-time'))).toBeVisible();
    await expect(element(by.id('appointment-status'))).toBeVisible();
  });

  // USER JOURNEY STEP 7: Navigate to upcoming appointments
  it('should navigate to upcoming appointments list', async () => {
    // Go back to dashboard
    if (device.getPlatform() === 'ios') {
      await element(by.id('back-button')).tap();
      await element(by.id('back-button')).tap();
    } else {
      // Android back button
      await device.pressBack();
      await device.pressBack();
    }
    
    // Navigate to appointments list
    await element(by.id('all-appointments-button')).tap();
    
    // Verify appointments list screen
    await expect(element(by.id('appointments-list-screen'))).toBeVisible();
    
    // Check that we see at least one appointment
    await expect(element(by.id('appointment-item'))).atIndex(0).toBeVisible();
  });
});
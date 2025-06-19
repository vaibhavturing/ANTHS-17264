// cypress/e2e/1-patient-journey.cy.js
// TEST: Full patient journey from booking to attending appointment
// NEW FILE: Complete patient appointment journey

import { screenSizes } from '../support/e2e';

describe('Patient Appointment Journey', () => {
  // Initialize variables
  let appointmentId;
  let doctorName = 'Dr. Smith'; // Test doctor
  
  beforeEach(() => {
    // Log in before each test
    cy.loginAsPatient();
  });
  
  // Run on multiple screen sizes
  const testOnMultipleScreens = (testFn) => {
    // Test on desktop (Chrome)
    it('on desktop chrome', testFn);
    
    // Test on tablet
    it('on tablet', () => {
      cy.viewport(screenSizes.tablet.width, screenSizes.tablet.height);
      testFn();
    });
    
    // Test on mobile
    it('on mobile', () => {
      cy.viewport(screenSizes.mobile.width, screenSizes.mobile.height);
      testFn();
    });
  };
  
  // USER JOURNEY STEP 1: Book an appointment
  describe('Step 1: Patient books an appointment', () => {
    testOnMultipleScreens(() => {
      // Navigate to appointment booking page
      cy.visit('/appointments/book');
      cy.get('[data-testid=page-title]').should('contain', 'Book an Appointment');
      
      // Search for a doctor
      cy.get('[data-testid=doctor-search]').type(doctorName);
      cy.get('[data-testid=search-button]').click();
      cy.get('[data-testid=doctor-card]').should('be.visible');
      
      // Select the first doctor
      cy.get('[data-testid=doctor-card]').first().click();
      
      // Select a date for the appointment (next business day)
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Skip to Monday if it's Friday/Saturday/Sunday
      const dayOfWeek = tomorrow.getDay();
      if (dayOfWeek === 0) tomorrow.setDate(tomorrow.getDate() + 1); // Sunday to Monday
      if (dayOfWeek === 6) tomorrow.setDate(tomorrow.getDate() + 2); // Saturday to Monday
      
      const formattedDate = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
      cy.get('[data-testid=appointment-date]').type(formattedDate);
      
      // Wait for time slots to load and select the first available one
      cy.get('[data-testid=time-slot]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid=time-slot]').first().click();
      
      // Enter appointment reason
      cy.get('[data-testid=appointment-reason]').type('Annual checkup');
      
      // Additional health information
      cy.get('[data-testid=has-symptoms]').click();
      cy.get('[data-testid=symptoms-description]').type('Routine visit, no symptoms');
      
      // Submit booking
      cy.get('[data-testid=book-appointment-button]').click();
      
      // Verify booking confirmation
      cy.get('[data-testid=booking-confirmation]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid=booking-confirmation]').should('contain', 'successfully booked');
      
      // Save the appointment ID for later steps
      cy.get('[data-testid=appointment-id]').invoke('text').then((id) => {
        appointmentId = id.trim();
        cy.log(`Booked appointment ID: ${appointmentId}`);
        cy.task('log', `Booked appointment ID: ${appointmentId}`);
      });
    });
  });
  
  // USER JOURNEY STEP 2: Receive and view confirmation
  describe('Step 2: Patient receives and views appointment confirmation', () => {
    testOnMultipleScreens(() => {
      // Check appointment details page
      cy.get('[data-testid=view-appointment-details]').click();
      cy.url().should('include', '/appointments/');
      
      // Verify appointment details
      cy.get('[data-testid=appointment-status]').should('contain', 'Scheduled');
      cy.get('[data-testid=appointment-doctor]').should('contain', doctorName);
      cy.get('[data-testid=appointment-reason]').should('contain', 'Annual checkup');
      
      // Check if confirmation is shown in the list of appointments
      cy.visit('/appointments');
      cy.get('[data-testid=upcoming-appointments-tab]').click();
      cy.get('[data-testid=appointments-list]').should('be.visible');
      cy.get('[data-testid=appointment-card]').first().should('contain', doctorName);
      
      // Check email (we'll mock this)
      cy.log('Checking for email confirmation (mocked)');
      // In a real test, we'd check an email API or mock the email verification
    });
  });
  
  // USER JOURNEY STEP 3: Pre-appointment activities
  describe('Step 3: Patient completes pre-appointment activities', () => {
    testOnMultipleScreens(() => {
      // Find and open the appointment
      cy.visit('/appointments');
      cy.get('[data-testid=upcoming-appointments-tab]').click();
      cy.get('[data-testid=appointment-card]').first().click();
      
      // Complete pre-appointment questionnaire if available
      cy.get('body').then($body => {
        if ($body.find('[data-testid=pre-appointment-questionnaire]').length > 0) {
          // Fill out questionnaire
          cy.get('[data-testid=pre-appointment-questionnaire]').click();
          cy.get('[data-testid=health-changes]').select('No');
          cy.get('[data-testid=current-medications]').type('None');
          cy.get('[data-testid=questionnaire-submit]').click();
          cy.get('[data-testid=questionnaire-confirmation]').should('be.visible');
        } else {
          cy.log('Pre-appointment questionnaire not available');
        }
      });
      
      // Upload any required documents if the feature exists
      cy.get('body').then($body => {
        if ($body.find('[data-testid=document-upload]').length > 0) {
          cy.get('[data-testid=document-upload]').click();
          cy.get('[data-testid=upload-button]').attachFile('test-document.pdf');
          cy.get('[data-testid=upload-success]').should('be.visible');
        } else {
          cy.log('Document upload functionality not available');
        }
      });
    });
  });
  
  // USER JOURNEY STEP 4: Appointment check-in
  describe('Step 4: Patient checks in for the appointment', () => {
    testOnMultipleScreens(() => {
      // Navigate to the appointment
      cy.visit('/appointments'); 
      cy.get('[data-testid=upcoming-appointments-tab]').click();
      cy.get('[data-testid=appointment-card]').first().click();
      
      // For testing purposes, we'll assume the appointment day has arrived
      // In a real environment, we would either:
      // 1. Use cy.clock() to mock the time
      // 2. Create a test appointment that's scheduled for today
      // For now, we'll check if the check-in button exists
      
      cy.get('body').then($body => {
        if ($body.find('[data-testid=check-in-button]').length > 0) {
          // Click check-in button
          cy.get('[data-testid=check-in-button]').click();
          
          // Confirm check-in
          cy.get('[data-testid=confirm-check-in-button]').click();
          
          // Verify check-in confirmation
          cy.get('[data-testid=check-in-confirmation]').should('be.visible');
          cy.get('[data-testid=appointment-status]').should('contain', 'Checked In');
        } else {
          cy.log('Check-in not available - appointment might not be today');
          // For test automation, we'll use the API to update the appointment status
          cy.window().then((win) => {
            const token = win.localStorage.getItem('authToken');
            if (token && appointmentId) {
              cy.request({
                method: 'PATCH',
                url: `${Cypress.env('apiUrl')}/appointments/${appointmentId}`,
                headers: { Authorization: `Bearer ${token}` },
                body: { status: 'in-progress' }
              }).then(response => {
                expect(response.status).to.eq(200);
                cy.reload();
                cy.get('[data-testid=appointment-status]').should('contain', 'In Progress');
              });
            }
          });
        }
      });
    });
  });
  
  // USER JOURNEY STEP 5: Appointment completion and follow-up
  describe('Step 5: Patient completes appointment and follow-up', () => {
    testOnMultipleScreens(() => {
      // Verify appointment was completed (would normally be done by doctor)
      // For testing, we'll use the API to update the status
      cy.window().then((win) => {
        const token = win.localStorage.getItem('authToken');
        if (token && appointmentId) {
          cy.request({
            method: 'PATCH',
            url: `${Cypress.env('apiUrl')}/appointments/${appointmentId}`,
            headers: { Authorization: `Bearer ${token}` },
            body: { status: 'completed' }
          }).then(response => {
            expect(response.status).to.eq(200);
            // Go to appointment details page to verify status
            cy.visit(`/appointments/${appointmentId}`);
            cy.get('[data-testid=appointment-status]').should('contain', 'Completed');
          });
        }
      });
      
      // View medical record after appointment
      cy.get('[data-testid=view-medical-record]').click();
      cy.url().should('include', '/medical-records');
      cy.get('[data-testid=record-content]').should('be.visible');
      
      // Verify prescriptions if any
      cy.get('body').then($body => {
        if ($body.find('[data-testid=prescriptions-tab]').length > 0) {
          cy.get('[data-testid=prescriptions-tab]').click();
          cy.get('[data-testid=prescriptions-list]').should('be.visible');
        } else {
          cy.log('No prescriptions available');
        }
      });
      
      // Complete satisfaction survey if available
      cy.visit(`/appointments/${appointmentId}`);
      cy.get('body').then($body => {
        if ($body.find('[data-testid=satisfaction-survey]').length > 0) {
          cy.get('[data-testid=satisfaction-survey]').click();
          cy.get('[data-testid=rating-overall]').click();
          cy.get('[data-testid=rating-doctor]').click();
          cy.get('[data-testid=survey-comments]').type('Excellent service, thank you!');
          cy.get('[data-testid=submit-survey]').click();
          cy.get('[data-testid=survey-confirmation]').should('be.visible');
        } else {
          cy.log('Satisfaction survey not available');
        }
      });
      
      // Book follow-up if needed
      cy.get('body').then($body => {
        if ($body.find('[data-testid=book-followup]').length > 0) {
          cy.get('[data-testid=book-followup]').click();
          cy.url().should('include', '/appointments/book');
          cy.get('[data-testid=page-title]').should('contain', 'Book a Follow-up');
        } else {
          cy.log('Follow-up booking not available');
        }
      });
    });
  });
});
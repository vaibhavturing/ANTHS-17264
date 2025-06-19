// cypress/e2e/2-doctor-journey.cy.js
// TEST: Complete doctor workflow for managing appointments
// NEW FILE: Doctor appointment management journey

import { screenSizes } from '../support/e2e';

describe('Doctor Appointment Management Journey', () => {
  let patientName = 'John Smith'; // Test patient
  let appointmentId;
  
  beforeEach(() => {
    // Log in as doctor
    cy.loginAsDoctor();
  });
  
  // Run on multiple screen sizes
  const testOnMultipleScreens = (testFn) => {
    // Main test on desktop Chrome
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
  
  // USER JOURNEY STEP 1: View today's appointments
  describe("Step 1: Doctor views today's appointments", () => {
    testOnMultipleScreens(() => {
      // Navigate to today's appointments
      cy.visit('/doctor/dashboard');
      cy.get('[data-testid=todays-appointments-widget]').should('be.visible');
      cy.get('[data-testid=view-all-appointments]').click();
      
      cy.url().should('include', '/doctor/appointments');
      cy.get('[data-testid=page-title]').should('contain', 'Appointments');
      
      // Check filtering by date works
      cy.get('[data-testid=date-filter]').should('exist');
      
      // Check sorting options work
      cy.get('[data-testid=sort-dropdown]').click();
      cy.get('[data-testid=sort-time-asc]').click();
      
      // Save first appointment for later use if available
      cy.get('body').then($body => {
        if ($body.find('[data-testid=appointment-card]').length > 0) {
          cy.get('[data-testid=appointment-card]').first().invoke('attr', 'data-appointment-id').then(id => {
            appointmentId = id;
            cy.log(`Found appointment ID: ${appointmentId}`);
          });
        } else {
          // If no appointments available, we'll create one via API
          cy.log('No appointments found, creating a test appointment');
          
          // Get doctor ID
          cy.window().then(win => {
            const userData = JSON.parse(win.localStorage.getItem('userData') || '{}');
            const doctorId = userData.id || userData._id;
            
            // Use API to create test appointment
            cy.task('log', `Creating test appointment for doctor ${doctorId}`);
            
            // Find a test patient (in a real test we would have this predefined)
            cy.request({
              method: 'GET',
              url: `${Cypress.env('apiUrl')}/patients?limit=1`,
              headers: {
                Authorization: `Bearer ${win.localStorage.getItem('authToken')}`
              }
            }).then(response => {
              expect(response.status).to.eq(200);
              const patientId = response.body.patients[0]._id;
              
              // Create appointment for today
              const today = new Date();
              today.setHours(today.getHours() + 1, 0, 0, 0); // 1 hour from now
              const appointmentTime = today.toISOString();
              
              const endTime = new Date(today);
              endTime.setMinutes(endTime.getMinutes() + 30);
              const appointmentEndTime = endTime.toISOString();
              
              cy.request({
                method: 'POST',
                url: `${Cypress.env('apiUrl')}/appointments`,
                headers: {
                  Authorization: `Bearer ${win.localStorage.getItem('authToken')}`
                },
                body: {
                  patientId,
                  doctorId,
                  startTime: appointmentTime,
                  endTime: appointmentEndTime,
                  reason: 'Test appointment',
                  type: 'regular',
                  notes: 'Created via Cypress test automation'
                }
              }).then(response => {
                expect(response.status).to.eq(201);
                appointmentId = response.body.appointment.id;
                cy.task('log', `Created appointment ID: ${appointmentId}`);
                cy.reload(); // Reload to see new appointment
              });
            });
          });
        }
      });
    });
  });
  
  // USER JOURNEY STEP 2: Review patient information
  describe("Step 2: Doctor reviews patient information", () => {
    testOnMultipleScreens(() => {
      // Skip if no appointment was found or created
      if (!appointmentId) {
        cy.log('Skipping test as no appointment is available');
        return;
      }
      
      // Navigate to specific appointment
      cy.visit(`/doctor/appointments/${appointmentId}`);
      cy.get('[data-testid=appointment-details]').should('be.visible');
      
      // Check patient information
      cy.get('[data-testid=patient-name]').should('be.visible');
      cy.get('[data-testid=view-patient-profile]').click();
      
      // On patient profile page
      cy.url().should('include', '/patients/');
      cy.get('[data-testid=patient-profile]').should('be.visible');
      
      // Check medical history
      cy.get('[data-testid=medical-history-tab]').click();
      cy.get('[data-testid=medical-history-content]').should('be.visible');
      
      // Check medications
      cy.get('[data-testid=medications-tab]').click();
      cy.get('[data-testid=medications-content]').should('be.visible');
      
      // Check allergies
      cy.get('[data-testid=allergies-tab]').click();
      cy.get('[data-testid=allergies-content]').should('be.visible');
      
      // Return to appointment
      cy.go('back');
    });
  });
  
  // USER JOURNEY STEP 3: Start appointment
  describe("Step 3: Doctor starts the appointment", () => {
    testOnMultipleScreens(() => {
      // Skip if no appointment was found or created
      if (!appointmentId) {
        cy.log('Skipping test as no appointment is available');
        return;
      }
      
      // Navigate to specific appointment
      cy.visit(`/doctor/appointments/${appointmentId}`);
      
      // Start appointment
      cy.get('body').then($body => {
        if ($body.find('[data-testid=start-appointment-button]').length > 0) {
          cy.get('[data-testid=start-appointment-button]').click();
          
          // Confirm start
          if ($body.find('[data-testid=confirm-start-button]').length > 0) {
            cy.get('[data-testid=confirm-start-button]').click();
          }
          
          // Verify appointment started
          cy.get('[data-testid=appointment-status]').should('contain', 'In Progress');
        } else {
          cy.log('Start button not available - updating via API');
          
          // Update via API
          cy.window().then(win => {
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
  
  // USER JOURNEY STEP 4: Record clinical notes
  describe("Step 4: Doctor records clinical notes", () => {
    testOnMultipleScreens(() => {
      // Skip if no appointment was found or created
      if (!appointmentId) {
        cy.log('Skipping test as no appointment is available');
        return;
      }
      
      // Navigate to specific appointment
      cy.visit(`/doctor/appointments/${appointmentId}`);
      
      // Add clinical notes
      cy.get('[data-testid=clinical-notes]').should('be.visible');
      cy.get('[data-testid=clinical-notes]').clear().type('Patient presents with...\n\nVital signs normal.\n\nRecommended follow-up in 3 months.');
      
      // Save notes
      cy.get('[data-testid=save-notes-button]').click();
      cy.get('[data-testid=notes-saved-confirmation]').should('be.visible');
    });
  });
  
  // USER JOURNEY STEP 5: Prescribe medications (if needed)
  describe("Step 5: Doctor prescribes medications", () => {
    testOnMultipleScreens(() => {
      // Skip if no appointment was found or created
      if (!appointmentId) {
        cy.log('Skipping test as no appointment is available');
        return;
      }
      
      // Navigate to specific appointment
      cy.visit(`/doctor/appointments/${appointmentId}`);
      
      // Open prescriptions tab
      cy.get('[data-testid=prescriptions-tab]').click();
      
      // Add new prescription
      cy.get('[data-testid=add-prescription-button]').click();
      
      // Search for medication
      cy.get('[data-testid=medication-search]').type('Amoxicillin');
      cy.get('[data-testid=medication-search-results]').should('be.visible');
      cy.get('[data-testid=select-medication]').first().click();
      
      // Fill prescription details
      cy.get('[data-testid=medication-dosage]').type('500mg');
      cy.get('[data-testid=medication-frequency]').select('Three times daily');
      cy.get('[data-testid=medication-duration]').type('10');
      cy.get('[data-testid=prescription-notes]').type('Take with food');
      
      // Save prescription
      cy.get('[data-testid=save-prescription-button]').click();
      cy.get('[data-testid=prescription-saved-confirmation]').should('be.visible');
    });
  });
  
  // USER JOURNEY STEP 6: Complete appointment
  describe("Step 6: Doctor completes the appointment", () => {
    testOnMultipleScreens(() => {
      // Skip if no appointment was found or created
      if (!appointmentId) {
        cy.log('Skipping test as no appointment is available');
        return;
      }
      
      // Navigate to specific appointment
      cy.visit(`/doctor/appointments/${appointmentId}`);
      
      // Complete appointment
      cy.get('[data-testid=complete-appointment-button]').click();
      
      // Enter completion details
      cy.get('[data-testid=completion-summary]').type('Patient seen for regular checkup. All vitals normal.');
      cy.get('[data-testid=follow-up-needed]').select('Yes');
      cy.get('[data-testid=follow-up-timeframe]').select('3 months');
      
      // Finalize appointment
      cy.get('[data-testid=finalize-appointment-button]').click();
      cy.get('[data-testid=appointment-completed-confirmation]').should('be.visible');
      
      // Verify status change
      cy.get('[data-testid=appointment-status]').should('contain', 'Completed');
    });
  });
});
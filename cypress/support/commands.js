// cypress/support/commands.js
// Custom commands for Cypress E2E testing
// NEW FILE: Custom commands for healthcare application user flows

// Import utilities
import 'cypress-wait-until';
import 'cypress-localstorage-commands';

// Authentication commands
Cypress.Commands.add('login', (email, password) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-testid=email-input]').type(email);
    cy.get('[data-testid=password-input]').type(password, { log: false });
    cy.get('[data-testid=login-button]').click();
    
    // Verify successful login - looking for the dashboard
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid=user-greeting]').should('be.visible');
    
    // Save token in localStorage for future requests
    cy.getAllLocalStorage().then(localStorage => {
      const authToken = localStorage['http://localhost:3000'].authToken;
      expect(authToken).to.exist;
    });
  }, {
    validate: () => {
      // Validate the session is still active
      cy.getAllLocalStorage().then(localStorage => {
        const authToken = localStorage['http://localhost:3000']?.authToken;
        expect(authToken).to.exist;
      });
    },
    cacheAcrossSpecs: true
  });
});

// Patient-specific commands
Cypress.Commands.add('loginAsPatient', () => {
  const { email, password } = Cypress.env('patient');
  cy.login(email, password);
});

// Doctor-specific commands
Cypress.Commands.add('loginAsDoctor', () => {
  const { email, password } = Cypress.env('doctor');
  cy.login(email, password);
});

// Book appointment command
Cypress.Commands.add('bookAppointment', (doctorName, reason, date) => {
  // Navigate to appointment booking
  cy.visit('/appointments/book');
  cy.get('[data-testid=doctor-search]').type(doctorName);
  cy.get('[data-testid=search-button]').click();
  
  // Select the first doctor from search results
  cy.get('[data-testid=doctor-card]').first().click();
  
  // Select appointment date
  if (date) {
    // Format and set date
    cy.get('[data-testid=appointment-date]').type(date);
  } else {
    // Use tomorrow's date by default
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const formattedDate = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
    cy.get('[data-testid=appointment-date]').type(formattedDate);
  }
  
  // Select first available time slot
  cy.get('[data-testid=time-slot]').first().click();
  
  // Enter appointment reason
  cy.get('[data-testid=appointment-reason]').type(reason || 'Routine checkup');
  
  // Submit booking
  cy.get('[data-testid=book-appointment-button]').click();
  
  // Verify booking confirmation
  cy.get('[data-testid=booking-confirmation]').should('be.visible');
  cy.get('[data-testid=booking-confirmation]').should('contain', 'successfully booked');
  
  // Get the appointment ID from the confirmation page
  cy.get('[data-testid=appointment-id]').invoke('text').as('appointmentId');
});

// View upcoming appointments
Cypress.Commands.add('viewUpcomingAppointments', () => {
  cy.visit('/appointments');
  cy.get('[data-testid=upcoming-appointments-tab]').click();
  cy.get('[data-testid=appointments-list]').should('be.visible');
});

// Cancel an appointment
Cypress.Commands.add('cancelAppointment', (appointmentId) => {
  // If specific appointment ID is provided, navigate to it
  if (appointmentId) {
    cy.visit(`/appointments/${appointmentId}`);
  } else {
    // Otherwise, use the first appointment in the list
    cy.viewUpcomingAppointments();
    cy.get('[data-testid=appointment-card]').first().click();
  }
  
  // Cancel the appointment
  cy.get('[data-testid=cancel-appointment-button]').click();
  cy.get('[data-testid=cancel-reason]').type('Changed my mind');
  cy.get('[data-testid=confirm-cancel-button]').click();
  
  // Verify cancellation
  cy.get('[data-testid=cancellation-confirmation]').should('be.visible');
});

// Check in for an appointment
Cypress.Commands.add('checkInForAppointment', (appointmentId) => {
  // Navigate to appointment
  if (appointmentId) {
    cy.visit(`/appointments/${appointmentId}`);
  } else {
    cy.viewUpcomingAppointments();
    cy.get('[data-testid=appointment-card]').first().click();
  }
  
  // Click check-in button
  cy.get('[data-testid=check-in-button]').click();
  
  // Confirm check-in
  cy.get('[data-testid=confirm-check-in-button]').click();
  
  // Verify check-in confirmation
  cy.get('[data-testid=check-in-confirmation]').should('be.visible');
});

// Complete an appointment (Doctor only)
Cypress.Commands.add('completeAppointment', (appointmentId) => {
  // Navigate to appointment
  if (appointmentId) {
    cy.visit(`/appointments/${appointmentId}`);
  } else {
    cy.visit('/doctor/appointments/today');
    cy.get('[data-testid=appointment-card]').first().click();
  }
  
  // Add notes
  cy.get('[data-testid=appointment-notes]').type('Patient was seen, treatment provided.');
  
  // Complete the appointment
  cy.get('[data-testid=complete-appointment-button]').click();
  
  // Confirm completion
  cy.get('[data-testid=confirm-complete-button]').click();
  
  // Verify completion
  cy.get('[data-testid=completion-confirmation]').should('be.visible');
});

// API Commands
Cypress.Commands.add('apiLogin', (email, password) => {
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/auth/login`,
    body: {
      email,
      password
    }
  }).then(response => {
    expect(response.status).to.eq(200);
    expect(response.body.token).to.exist;
    
    // Set the token for future API requests
    Cypress.env('token', response.body.token);
    
    return response.body;
  });
});

// Create a test appointment via API
Cypress.Commands.add('apiCreateAppointment', (doctorId, patientId, startTime) => {
  const token = Cypress.env('token');
  expect(token).to.exist;
  
  // Prepare appointment data
  const appointmentTime = startTime || (() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(10, 0, 0, 0);
    return date.toISOString();
  })();
  
  const endTime = (() => {
    const date = new Date(appointmentTime);
    date.setMinutes(date.getMinutes() + 30);
    return date.toISOString();
  })();
  
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/appointments`,
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: {
      patientId,
      doctorId,
      startTime: appointmentTime,
      endTime,
      reason: 'API created test appointment',
      type: 'regular',
      notes: 'Created via Cypress test automation'
    }
  }).then(response => {
    expect(response.status).to.eq(201);
    expect(response.body.appointment).to.exist;
    
    return response.body.appointment;
  });
});
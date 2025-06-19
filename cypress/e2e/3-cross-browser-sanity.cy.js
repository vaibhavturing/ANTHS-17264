// cypress/e2e/3-cross-browser-sanity.cy.js  
// TEST: Critical user flows across browsers (Chrome & Safari)
// NEW FILE: Cross-browser compatibility testing of key user journeys

import { screenSizes } from '../support/e2e';

describe('Cross-Browser Sanity Tests', () => {
  // Run each test on all browser configurations
  // Specific browser testing (handled by Cypress run configuration)
  
  context('Authentication', () => {
    it('should successfully login as patient', () => {
      const { email, password } = Cypress.env('patient');
      
      cy.visit('/login');
      cy.get('[data-testid=email-input]').type(email);
      cy.get('[data-testid=password-input]').type(password);
      cy.get('[data-testid=login-button]').click();
      
      // Verify successful login
      cy.url().should('include', '/dashboard');
      cy.get('[data-testid=user-greeting]').should('be.visible');
    });
    
    it('should successfully login as doctor', () => {
      const { email, password } = Cypress.env('doctor');
      
      cy.visit('/login');
      cy.get('[data-testid=email-input]').type(email);
      cy.get('[data-testid=password-input]').type(password);
      cy.get('[data-testid=login-button]').click();
      
      // Verify successful login
      cy.url().should('include', '/doctor/dashboard');
      cy.get('[data-testid=user-greeting]').should('be.visible');
    });
  });
  
  context('Patient Features', () => {
    beforeEach(() => {
      cy.loginAsPatient();
    });
    
    it('should load dashboard correctly', () => {
      cy.visit('/dashboard');
      cy.get('[data-testid=upcoming-appointments-widget]').should('be.visible');
      cy.get('[data-testid=medical-records-widget]').should('be.visible');
      cy.get('[data-testid=prescriptions-widget]').should('be.visible');
    });
    
    it('should navigate to appointment booking', () => {
      cy.visit('/dashboard');
      cy.get('[data-testid=book-appointment-button]').click();
      cy.url().should('include', '/appointments/book');
      cy.get('[data-testid=doctor-search]').should('be.visible');
    });
    
    it('should view medical records', () => {
      cy.visit('/dashboard');
      cy.get('[data-testid=medical-records-widget]').click();
      cy.url().should('include', '/medical-records');
      cy.get('[data-testid=medical-records-list]').should('be.visible');
    });
  });
  
  context('Doctor Features', () => {
    beforeEach(() => {
      cy.loginAsDoctor();
    });
    
    it('should load doctor dashboard correctly', () => {
      cy.visit('/doctor/dashboard');
      cy.get('[data-testid=todays-appointments-widget]').should('be.visible');
      cy.get('[data-testid=patients-widget]').should('be.visible');
    });
    
    it('should navigate to patient list', () => {
      cy.visit('/doctor/dashboard');
      cy.get('[data-testid=patients-widget]').click();
      cy.url().should('include', '/doctor/patients');
      cy.get('[data-testid=patient-list]').should('be.visible');
    });
    
    it('should search for patients', () => {
      cy.visit('/doctor/patients');
      cy.get('[data-testid=patient-search]').type('Smith');
      cy.get('[data-testid=patient-search-button]').click();
      cy.get('[data-testid=search-results]').should('be.visible');
    });
  });
  
  // Responsive testing across different screen sizes
  context('Responsive Layout', () => {
    beforeEach(() => {
      cy.loginAsPatient();
    });
    
    // Test desktop layout
    it('should render correctly on desktop', () => {
      cy.viewport(screenSizes.desktop.width, screenSizes.desktop.height);
      cy.visit('/dashboard');
      cy.get('[data-testid=desktop-navigation]').should('be.visible');
      cy.get('[data-testid=mobile-navigation]').should('not.be.visible');
    });
    
    // Test tablet layout
    it('should render correctly on tablet', () => {
      cy.viewport(screenSizes.tablet.width, screenSizes.tablet.height);
      cy.visit('/dashboard');
      // Check responsive elements
      cy.get('[data-testid=responsive-container]').should('have.css', 'max-width').and('not.eq', '100%');
    });
    
    // Test mobile layout
    it('should render correctly on mobile', () => {
      cy.viewport(screenSizes.mobile.width, screenSizes.mobile.height);
      cy.visit('/dashboard');
      cy.get('[data-testid=mobile-navigation]').should('be.visible');
      cy.get('[data-testid=desktop-navigation]').should('not.be.visible');
      
      // Check hamburger menu
      cy.get('[data-testid=menu-button]').click();
      cy.get('[data-testid=mobile-menu]').should('be.visible');
    });
  });
});
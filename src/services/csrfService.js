/**
 * CSRF Token Service
 * File: frontend/src/services/csrfService.js
 * 
 * Handles CSRF token management for frontend API requests.
 */

import axios from 'axios';
import { API_BASE_URL } from '../config';

// Initialize CSRF token
let csrfToken = null;

/**
 * Get CSRF token from meta tag in the HTML
 */
const getTokenFromMeta = () => {
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  return metaTag ? metaTag.getAttribute('content') : null;
};

/**
 * Fetch new CSRF token from the server
 * @returns {Promise<string>} CSRF token
 */
const fetchCsrfToken = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/csrf-token`, { withCredentials: true });
    
    // Get token from header
    const token = response.headers['x-csrf-token'];
    
    if (!token) {
      throw new Error('Could not retrieve CSRF token from response');
    }
    
    return token;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
};

/**
 * Get the stored CSRF token or fetch a new one
 * @returns {Promise<string>} CSRF token
 */
const getCsrfToken = async () => {
  // First check if we already have a token
  if (csrfToken) {
    return csrfToken;
  }
  
  // Then check for token in meta tag
  const metaToken = getTokenFromMeta();
  if (metaToken) {
    csrfToken = metaToken;
    return csrfToken;
  }
  
  // Finally, fetch from server if needed
  const newToken = await fetchCsrfToken();
  csrfToken = newToken;
  return csrfToken;
};

/**
 * Refresh the CSRF token
 * @returns {Promise<string>} New CSRF token
 */
const refreshCsrfToken = async () => {
  const newToken = await fetchCsrfToken();
  csrfToken = newToken;
  return csrfToken;
};

/**
 * Clear stored CSRF token
 */
const clearCsrfToken = () => {
  csrfToken = null;
};

export default {
  getCsrfToken,
  refreshCsrfToken,
  clearCsrfToken
};
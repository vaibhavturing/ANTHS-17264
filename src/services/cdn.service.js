/**
 * CDN Service
 * Provides integration with Cloudflare API for cache purging and management
 */

const axios = require('axios');
const logger = require('../utils/logger');
const cdnConfig = require('../config/cdn.config');

// Cloudflare API configuration
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_ZONE_ID = process.env.CF_ZONE_ID;

/**
 * CDN service for managing Cloudflare CDN
 */
const cdnService = {
  /**
   * Check if Cloudflare API is configured
   * @returns {boolean} True if Cloudflare API is configured
   */
  isConfigured() {
    return !!(CF_API_TOKEN && CF_ZONE_ID);
  },
  
  /**
   * Create Axios instance for Cloudflare API
   * @returns {Object} Axios instance
   */
  getApiClient() {
    return axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  },
  
  /**
   * Purge specific files from Cloudflare cache
   * @param {Array<string>} files - Array of file paths or URLs to purge
   * @returns {Promise<Object>} Purge result
   */
  async purgeFiles(files) {
    if (!this.isConfigured()) {
      logger.warn('Cloudflare API not configured, skipping cache purge');
      return { success: false, message: 'Cloudflare API not configured' };
    }
    
    if (!Array.isArray(files) || !files.length) {
      return { success: false, message: 'No files specified' };
    }
    
    try {
      // Convert relative paths to full URLs if needed
      const urls = files.map(file => {
        if (file.startsWith('http')) {
          return file;
        }
        return `${cdnConfig.getBaseUrl()}${file}`;
      });
      
      // Call Cloudflare API to purge files
      const client = this.getApiClient();
      const response = await client.post(`/zones/${CF_ZONE_ID}/purge_cache`, {
        files: urls
      });
      
      if (response.data.success) {
        logger.info(`Successfully purged ${urls.length} files from Cloudflare cache`);
        return { 
          success: true, 
          message: `Purged ${urls.length} files`,
          ids: response.data.result.id
        };
      } else {
        logger.error('Failed to purge Cloudflare cache', response.data.errors);
        return { 
          success: false, 
          message: response.data.errors[0]?.message || 'Unknown error',
          errors: response.data.errors 
        };
      }
    } catch (error) {
      logger.error('Error purging Cloudflare cache', error);
      return { 
        success: false, 
        message: error.message, 
        error 
      };
    }
  },
  
  /**
   * Purge everything from Cloudflare cache
   * @returns {Promise<Object>} Purge result
   */
  async purgeEverything() {
    if (!this.isConfigured()) {
      logger.warn('Cloudflare API not configured, skipping cache purge');
      return { success: false, message: 'Cloudflare API not configured' };
    }
    
    try {
      // Call Cloudflare API to purge everything
      const client = this.getApiClient();
      const response = await client.post(`/zones/${CF_ZONE_ID}/purge_cache`, {
        purge_everything: true
      });
      
      if (response.data.success) {
        logger.info('Successfully purged everything from Cloudflare cache');
        return { 
          success: true, 
          message: 'Purged everything',
          id: response.data.result.id
        };
      } else {
        logger.error('Failed to purge Cloudflare cache', response.data.errors);
        return { 
          success: false, 
          message: response.data.errors[0]?.message || 'Unknown error',
          errors: response.data.errors
        };
      }
    } catch (error) {
      logger.error('Error purging Cloudflare cache', error);
      return {
        success: false,
        message: error.message,
        error
      };
    }
  },
  
  /**
   * Purge cache by tags
   * @param {Array<string>} tags - Array of cache tags to purge
   * @returns {Promise<Object>} Purge result
   */
  async purgeTags(tags) {
    if (!this.isConfigured()) {
      logger.warn('Cloudflare API not configured, skipping cache purge');
      return { success: false, message: 'Cloudflare API not configured' };
    }
    
    if (!Array.isArray(tags) || !tags.length) {
      return { success: false, message: 'No tags specified' };
    }
    
    try {
      // Call Cloudflare API to purge by tags
      const client = this.getApiClient();
      const response = await client.post(`/zones/${CF_ZONE_ID}/purge_cache`, {
        tags: tags
      });
      
      if (response.data.success) {
        logger.info(`Successfully purged cache with ${tags.length} tags`);
        return { 
          success: true, 
          message: `Purged cache with tags: ${tags.join(', ')}`,
          id: response.data.result.id
        };
      } else {
        logger.error('Failed to purge Cloudflare cache by tags', response.data.errors);
        return { 
          success: false, 
          message: response.data.errors[0]?.message || 'Unknown error',
          errors: response.data.errors
        };
      }
    } catch (error) {
      logger.error('Error purging Cloudflare cache by tags', error);
      return {
        success: false,
        message: error.message,
        error
      };
    }
  },
  
  /**
   * Get Cloudflare cache analytics
   * @returns {Promise<Object>} Cache analytics data
   */
  async getCacheAnalytics() {
    if (!this.isConfigured() || !CF_ACCOUNT_ID) {
      logger.warn('Cloudflare API not configured, skipping analytics fetch');
      return { success: false, message: 'Cloudflare API not configured' };
    }
    
    try {
      // Call Cloudflare API to get cache analytics
      const client = this.getApiClient();
      const response = await client.get(`/accounts/${CF_ACCOUNT_ID}/storage/analytics`);
      
      if (response.data.success) {
        return { 
          success: true, 
          data: response.data.result
        };
      } else {
        logger.error('Failed to fetch Cloudflare cache analytics', response.data.errors);
        return { 
          success: false, 
          message: response.data.errors[0]?.message || 'Unknown error',
          errors: response.data.errors
        };
      }
    } catch (error) {
      logger.error('Error fetching Cloudflare cache analytics', error);
      return {
        success: false,
        message: error.message,
        error
      };
    }
  }
};

module.exports = cdnService;
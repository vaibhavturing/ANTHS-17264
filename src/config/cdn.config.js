/**
 * CDN Configuration
 * Contains configuration and utilities for CDN integration
 * Used for serving static assets (images, CSS, JS) from Cloudflare
 */

const crypto = require('crypto');
const path = require('path');
const logger = require('../utils/logger');

// Environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_VERSION = process.env.npm_package_version || '1.0.0';
const BUILD_ID = process.env.BUILD_ID || Date.now().toString();

// CDN configuration
const CDN_CONFIG = {
  development: {
    enabled: false,
    baseUrl: '',
    assetPath: '/assets',
  },
  test: {
    enabled: false,
    baseUrl: '',
    assetPath: '/assets',
  },
  staging: {
    enabled: true,
    baseUrl: process.env.CDN_BASE_URL || 'https://staging-cdn.healthcare-app.com',
    assetPath: '/assets',
  },
  production: {
    enabled: true,
    baseUrl: process.env.CDN_BASE_URL || 'https://cdn.healthcare-app.com',
    assetPath: '/assets',
  }
};

/**
 * Cache durations for different asset types (in seconds)
 */
const CACHE_DURATIONS = {
  images: 60 * 60 * 24 * 30, // 30 days
  css: 60 * 60 * 24 * 7,     // 7 days
  js: 60 * 60 * 24 * 7,      // 7 days
  fonts: 60 * 60 * 24 * 30,  // 30 days
  default: 60 * 60 * 24      // 1 day
};

/**
 * CDN configuration based on current environment
 */
const cdnConfig = CDN_CONFIG[NODE_ENV] || CDN_CONFIG.development;

/**
 * CDN service for handling static assets
 */
const cdnService = {
  /**
   * Check if CDN is enabled
   * @returns {boolean} True if CDN is enabled
   */
  isEnabled() {
    return cdnConfig.enabled;
  },
  
  /**
   * Get base CDN URL
   * @returns {string} Base URL
   */
  getBaseUrl() {
    return cdnConfig.baseUrl;
  },
  
  /**
   * Get asset path
   * @returns {string} Asset path
   */
  getAssetPath() {
    return cdnConfig.assetPath;
  },
  
  /**
   * Generate asset URL
   * @param {string} assetPath - Relative path to asset
   * @param {Object} options - Options for asset URL
   * @returns {string} Full asset URL
   */
  getAssetUrl(assetPath, options = {}) {
    if (!assetPath) {
      return '';
    }
    
    // Strip leading slash if present
    const normalizedPath = assetPath.startsWith('/') ? assetPath.substring(1) : assetPath;
    
    // Use CDN if enabled, otherwise use local path
    if (this.isEnabled() && !options.skipCdn) {
      const versionedPath = this.addVersionToPath(normalizedPath);
      return `${cdnConfig.baseUrl}${cdnConfig.assetPath}/${versionedPath}`;
    }
    
    // For local development or when CDN is disabled
    return `${cdnConfig.assetPath}/${normalizedPath}`;
  },
  
  /**
   * Generate image URL with optional transformations
   * @param {string} imagePath - Relative path to image
   * @param {Object} options - Image transformation options
   * @returns {string} Full image URL
   */
  getImageUrl(imagePath, options = {}) {
    if (!imagePath) {
      return '';
    }
    
    // Default options
    const defaultOptions = {
      width: null,
      height: null,
      quality: 80,
      format: null,
      fit: 'cover'
    };
    
    // Merge with default options
    const imageOptions = { ...defaultOptions, ...options };
    
    if (this.isEnabled() && !options.skipCdn) {
      // For Cloudflare Image Resizing
      // https://developers.cloudflare.com/images/image-resizing/url-format/
      const params = new URLSearchParams();
      
      if (imageOptions.width) params.append('width', imageOptions.width);
      if (imageOptions.height) params.append('height', imageOptions.height);
      if (imageOptions.quality) params.append('quality', imageOptions.quality);
      if (imageOptions.format) params.append('format', imageOptions.format);
      if (imageOptions.fit) params.append('fit', imageOptions.fit);
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const normalizedPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
      const versionedPath = this.addVersionToPath(normalizedPath);
      
      return `${cdnConfig.baseUrl}/cdn-cgi/image/${queryString}${cdnConfig.assetPath}/${versionedPath}`;
    }
    
    // For local development or when CDN is disabled
    const normalizedPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
    return `${cdnConfig.assetPath}/${normalizedPath}`;
  },
  
  /**
   * Add version parameter to cache bust when needed
   * @param {string} assetPath - Asset path
   * @returns {string} Versioned asset path
   */
  addVersionToPath(assetPath) {
    // Generate version hash
    const versionHash = crypto
      .createHash('md5')
      .update(`${APP_VERSION}-${BUILD_ID}`)
      .digest('hex')
      .substring(0, 8);
    
    // Parse the path
    const parsedPath = path.parse(assetPath);
    
    // Recompose with version
    return `${parsedPath.dir}/${parsedPath.name}.${versionHash}${parsedPath.ext}`;
  },
  
  /**
   * Get cache control header for asset type
   * @param {string} assetPath - Asset path
   * @returns {string} Cache-Control header value
   */
  getCacheControlHeader(assetPath) {
    if (!assetPath) {
      return `public, max-age=${CACHE_DURATIONS.default}`;
    }
    
    const ext = path.extname(assetPath).toLowerCase();
    
    // Determine cache duration based on file extension
    let maxAge = CACHE_DURATIONS.default;
    
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
      maxAge = CACHE_DURATIONS.images;
    } else if (['.css', '.less', '.scss'].includes(ext)) {
      maxAge = CACHE_DURATIONS.css;
    } else if (['.js', '.mjs'].includes(ext)) {
      maxAge = CACHE_DURATIONS.js;
    } else if (['.woff', '.woff2', '.eot', '.ttf', '.otf'].includes(ext)) {
      maxAge = CACHE_DURATIONS.fonts;
    }
    
    return `public, max-age=${maxAge}`;
  },
  
  /**
   * Get resource hints for preloading or prefetching
   * @param {Array<string>} resources - Array of resource paths
   * @param {string} type - Hint type (preload, prefetch, preconnect)
   * @returns {Array<Object>} Array of resource hint objects
   */
  getResourceHints(resources, type = 'preload') {
    if (!Array.isArray(resources) || !resources.length) {
      return [];
    }
    
    return resources.map(resource => {
      const ext = path.extname(resource).toLowerCase();
      let as = 'fetch';
      
      // Determine resource type based on extension
      if (['.css', '.less', '.scss'].includes(ext)) {
        as = 'style';
      } else if (['.js', '.mjs'].includes(ext)) {
        as = 'script';
      } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
        as = 'image';
      } else if (['.woff', '.woff2', '.eot', '.ttf', '.otf'].includes(ext)) {
        as = 'font';
      }
      
      return {
        url: this.getAssetUrl(resource),
        as,
        type: this.getMimeType(ext),
        crossorigin: 'anonymous',
        hintType: type
      };
    });
  },
  
  /**
   * Get MIME type for file extension
   * @param {string} ext - File extension
   * @returns {string} MIME type
   */
  getMimeType(ext) {
    const mimeTypes = {
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.eot': 'application/vnd.ms-fontobject',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf'
    };
    
    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
  }
};

module.exports = cdnService;
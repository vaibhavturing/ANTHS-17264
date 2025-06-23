/**
 * Image Processing Utility
 * Handles image optimization, resizing, and format conversion
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

// Configure default options
const DEFAULT_OPTIONS = {
  quality: 80,
  maxWidth: 1200,
  maxHeight: 1200,
  format: 'jpeg',
  jpegOptions: {
    quality: 80,
    progressive: true,
    optimizeScans: true
  },
  pngOptions: {
    quality: 80,
    progressive: true,
    compressionLevel: 9
  },
  webpOptions: {
    quality: 80,
    alphaQuality: 100,
    lossless: false
  }
};

/**
 * Image processor utility
 */
const imageProcessor = {
  /**
   * Process and optimize an image
   * @param {Buffer|string} input - Image buffer or file path
   * @param {Object} options - Processing options
   * @returns {Promise<Buffer>} Processed image buffer
   */
  optimize: async (input, options = {}) => {
    try {
      // Merge options with defaults
      const config = { ...DEFAULT_OPTIONS, ...options };
      
      // Create sharp instance from buffer or file
      let image = typeof input === 'string' 
        ? sharp(input)
        : sharp(input);
      
      // Get image metadata
      const metadata = await image.metadata();
      
      // Determine if resizing is needed
      const needsResize = metadata.width > config.maxWidth || metadata.height > config.maxHeight;
      
      // Resize if necessary
      if (needsResize) {
        image = image.resize({
          width: config.maxWidth,
          height: config.maxHeight,
          fit: 'inside',
          withoutEnlargement: true
        });
      }
      
      // Convert to desired format with appropriate options
      switch(config.format.toLowerCase()) {
        case 'jpeg':
        case 'jpg':
          image = image.jpeg(config.jpegOptions);
          break;
        case 'png':
          image = image.png(config.pngOptions);
          break;
        case 'webp':
          image = image.webp(config.webpOptions);
          break;
        default:
          image = image.jpeg(config.jpegOptions);
      }
      
      // Process image and return buffer
      return await image.toBuffer();
    } catch (error) {
      logger.error('Image optimization failed', error);
      throw error;
    }
  },
  
  /**
   * Save an optimized image to the filesystem
   * @param {Buffer|string} input - Image buffer or file path
   * @param {string} destinationDir - Directory to save the image
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Object with saved image information
   */
  saveOptimized: async (input, destinationDir, options = {}) => {
    try {
      // Ensure destination directory exists
      if (!fs.existsSync(destinationDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
      }
      
      // Generate a unique filename
      const filename = options.filename || `${uuidv4()}.${options.format || DEFAULT_OPTIONS.format}`;
      const outputPath = path.join(destinationDir, filename);
      
      // Optimize the image
      const optimizedBuffer = await imageProcessor.optimize(input, options);
      
      // Save to filesystem
      await fs.promises.writeFile(outputPath, optimizedBuffer);
      
      // Get file stats
      const stats = await fs.promises.stat(outputPath);
      
      return {
        path: outputPath,
        filename,
        size: stats.size,
        originalName: options.originalName || filename
      };
    } catch (error) {
      logger.error('Failed to save optimized image', error);
      throw error;
    }
  },
  
  /**
   * Create responsive image versions
   * @param {Buffer|string} input - Image buffer or file path
   * @param {string} destinationDir - Directory to save the images
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Object with paths to different sizes
   */
  createResponsiveVersions: async (input, destinationDir, options = {}) => {
    try {
      const baseFilename = path.parse(options.filename || `${uuidv4()}`).name;
      const format = options.format || DEFAULT_OPTIONS.format;
      
      // Define sizes for responsive images
      const sizes = options.sizes || [
        { suffix: 'sm', width: 400 },
        { suffix: 'md', width: 800 },
        { suffix: 'lg', width: 1200 }
      ];
      
      const results = {};
      
      // Process each size
      for (const size of sizes) {
        const sizeOptions = { 
          ...options,
          maxWidth: size.width,
          maxHeight: size.width,
          filename: `${baseFilename}-${size.suffix}.${format}`
        };
        
        const result = await imageProcessor.saveOptimized(input, destinationDir, sizeOptions);
        results[size.suffix] = result;
      }
      
      return results;
    } catch (error) {
      logger.error('Failed to create responsive images', error);
      throw error;
    }
  }
};

module.exports = imageProcessor;
/**
 * Upload Controller
 * Handles file upload operations
 */

const path = require('path');
const fs = require('fs');
const imageProcessor = require('../utils/imageProcessor');
const memoryProfiler = require('../utils/memoryProfiler');
const logger = require('../utils/logger');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

/**
 * Upload controller
 */
const uploadController = {
  /**
   * Upload a single file
   */
  uploadFile: catchAsync(async (req, res) => {
    if (!req.file) {
      throw new AppError('No file provided', 400);
    }
    
    // Start memory profiling for large uploads
    if (req.file.size > 5 * 1024 * 1024) { // 5MB
      memoryProfiler.takeSnapshot('before-file-processing');
    }
    
    // Generate file URL
    const fileUrl = `/uploads/${req.query.uploadType || 'general'}/optimized/${path.basename(req.file.path)}`;
    
    res.status(200).json({
      success: true,
      file: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        url: fileUrl,
        mimetype: req.file.mimetype,
        size: req.file.size,
        optimized: req.file.optimized || false
      }
    });
    
    // Memory profiling after large uploads
    if (req.file.size > 5 * 1024 * 1024) { // 5MB
      memoryProfiler.takeSnapshot('after-file-processing');
    }
  }),
  
  /**
   * Upload multiple files
   */
  uploadMultipleFiles: catchAsync(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      throw new AppError('No files provided', 400);
    }
    
    // Map files to response format
    const filesInfo = req.files.map(file => {
      const fileUrl = `/uploads/${req.query.uploadType || 'general'}/optimized/${path.basename(file.path)}`;
      
      return {
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        url: fileUrl,
        mimetype: file.mimetype,
        size: file.size,
        optimized: file.optimized || false
      };
    });
    
    res.status(200).json({
      success: true,
      filesCount: filesInfo.length,
      files: filesInfo
    });
  }),
  
  /**
   * Process and resize an existing image
   */
  processExistingImage: catchAsync(async (req, res) => {
    const { filePath, width, height, format, quality } = req.body;
    
    if (!filePath) {
      throw new AppError('File path is required', 400);
    }
    
    // Verify file exists and is accessible
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new AppError('File not found', 404);
    }
    
    // Process based on file type
    const mimeType = path.extname(absolutePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(mimeType)) {
      throw new AppError('Not an image file', 400);
    }
    
    // Track memory usage during processing
    const { result, memoryDiff } = await memoryProfiler.measureFunction(
      async () => {
        const options = {
          maxWidth: width ? parseInt(width) : undefined,
          maxHeight: height ? parseInt(height) : undefined,
          format: format || undefined,
          quality: quality ? parseInt(quality) : undefined
        };
        
        // Generate optimized version
        const uploadType = req.query.uploadType || 'general';
        const optimizedDir = path.join('uploads', uploadType, 'optimized');
        
        return await imageProcessor.saveOptimized(
          absolutePath,
          optimizedDir,
          {
            filename: `processed-${path.basename(absolutePath)}`,
            originalName: path.basename(absolutePath),
            ...options
          }
        );
      }
    );
    
    // Log memory usage for monitoring
    logger.debug('Image processing memory usage:', memoryDiff);
    
    // Generate file URL
    const fileUrl = `/uploads/${req.query.uploadType || 'general'}/optimized/${path.basename(result.path)}`;
    
    res.status(200).json({
      success: true,
      file: {
        originalName: path.basename(absolutePath),
        filename: path.basename(result.path),
        path: result.path,
        url: fileUrl,
        size: result.size,
        optimized: true
      },
      performance: {
        memoryUsed: memoryDiff.heapUsed,
        duration: `${memoryDiff.duration.toFixed(2)}ms`
      }
    });
  }),
  
  /**
   * Create responsive image versions
   */
  createResponsiveImages: catchAsync(async (req, res) => {
    const { filePath, sizes, format, quality } = req.body;
    
    if (!filePath) {
      throw new AppError('File path is required', 400);
    }
    
    // Verify file exists and is accessible
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new AppError('File not found', 404);
    }
    
    // Parse sizes array if provided
    let parsedSizes;
    if (sizes) {
      try {
        parsedSizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
      } catch (error) {
        throw new AppError('Invalid sizes format', 400);
      }
    }
    
    // Track memory during processing
    const { result: versions } = await memoryProfiler.measureFunction(
      async () => {
        // Create responsive versions
        const uploadType = req.query.uploadType || 'general';
        const responsiveDir = path.join('uploads', uploadType, 'responsive');
        
        return await imageProcessor.createResponsiveVersions(
          absolutePath,
          responsiveDir,
          {
            filename: path.basename(absolutePath),
            originalName: path.basename(absolutePath),
            format: format || undefined,
            quality: quality ? parseInt(quality) : undefined,
            sizes: parsedSizes
          }
        );
      }
    );
    
    // Format response
    const results = {};
    Object.keys(versions).forEach(size => {
      const version = versions[size];
      const fileUrl = `/uploads/${req.query.uploadType || 'general'}/responsive/${path.basename(version.path)}`;
      
      results[size] = {
        path: version.path,
        url: fileUrl,
        size: version.size
      };
    });
    
    res.status(200).json({
      success: true,
      versions: results
    });
  })
};

module.exports = uploadController;
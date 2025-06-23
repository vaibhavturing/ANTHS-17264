/**
 * Cloud Storage Configuration for Healthcare Management Application
 * Provides interface to cloud object storage (AWS S3 or compatible)
 * Used to store files and enable stateless application architecture
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const logger = require('../utils/logger');

// Environment variables for S3 configuration
const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const S3_ENDPOINT = process.env.S3_ENDPOINT; // For S3-compatible services like MinIO
const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === 'true';

/**
 * Create S3 client with environment-specific configuration
 */
const createS3Client = () => {
  const clientOptions = {
    region: S3_REGION,
    credentials: S3_ACCESS_KEY && S3_SECRET_KEY ? {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY
    } : undefined
  };
  
  // Add endpoint for S3-compatible services
  if (S3_ENDPOINT) {
    clientOptions.endpoint = S3_ENDPOINT;
  }
  
  // Use path style access if specified
  if (S3_FORCE_PATH_STYLE) {
    clientOptions.forcePathStyle = true;
  }
  
  return new S3Client(clientOptions);
};

// Create and export S3 client
const s3Client = S3_BUCKET ? createS3Client() : null;

/**
 * Storage service for file operations
 */
const storageService = {
  /**
   * Check if cloud storage is configured
   * @returns {boolean} True if cloud storage is configured
   */
  isCloudStorageEnabled() {
    return !!s3Client && !!S3_BUCKET;
  },
  
  /**
   * Upload a file to cloud storage
   * @param {string|Buffer|Stream} file - File to upload (path or buffer)
   * @param {string} key - S3 key (file path in bucket)
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(file, key, options = {}) {
    if (!this.isCloudStorageEnabled()) {
      throw new Error('Cloud storage is not configured');
    }
    
    try {
      // Prepare file content
      let fileContent;
      let contentType;
      
      if (typeof file === 'string') {
        // File is a path to a local file
        fileContent = fs.readFileSync(file);
        contentType = options.contentType || mime.lookup(file) || 'application/octet-stream';
      } else if (Buffer.isBuffer(file)) {
        // File is already a Buffer
        fileContent = file;
        contentType = options.contentType || 'application/octet-stream';
      } else {
        // Assume it's a stream, convert to buffer
        throw new Error('Stream input not supported directly, convert to buffer first');
      }
      
      // Build S3 command parameters
      const params = {
        Bucket: S3_BUCKET,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
        ACL: options.acl || 'private',
        Metadata: options.metadata || {}
      };
      
      // Execute upload command
      const command = new PutObjectCommand(params);
      const result = await s3Client.send(command);
      
      // Return success result
      return {
        success: true,
        key: key,
        location: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`,
        etag: result.ETag
      };
    } catch (error) {
      logger.error('Error uploading to S3:', error);
      throw error;
    }
  },
  
  /**
   * Get a file from cloud storage
   * @param {string} key - S3 key (file path in bucket)
   * @returns {Promise<Buffer>} File content
   */
  async getFile(key) {
    if (!this.isCloudStorageEnabled()) {
      throw new Error('Cloud storage is not configured');
    }
    
    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key
      });
      
      const response = await s3Client.send(command);
      
      // Convert stream to buffer
      return await new Promise((resolve, reject) => {
        const chunks = [];
        response.Body.on('data', (chunk) => chunks.push(chunk));
        response.Body.on('end', () => resolve(Buffer.concat(chunks)));
        response.Body.on('error', reject);
      });
    } catch (error) {
      logger.error(`Error getting file from S3: ${key}`, error);
      throw error;
    }
  },
  
  /**
   * Delete a file from cloud storage
   * @param {string} key - S3 key (file path in bucket)
   * @returns {Promise<Object>} Deletion result
   */
  async deleteFile(key) {
    if (!this.isCloudStorageEnabled()) {
      throw new Error('Cloud storage is not configured');
    }
    
    try {
      const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key
      });
      
      await s3Client.send(command);
      
      return { success: true, key };
    } catch (error) {
      logger.error(`Error deleting file from S3: ${key}`, error);
      throw error;
    }
  },
  
  /**
   * List files in cloud storage
   * @param {string} prefix - Prefix for keys to list
   * @param {Object} options - List options
   * @returns {Promise<Array>} List of files
   */
  async listFiles(prefix = '', options = {}) {
    if (!this.isCloudStorageEnabled()) {
      throw new Error('Cloud storage is not configured');
    }
    
    try {
      const command = new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        MaxKeys: options.maxKeys || 1000,
        ContinuationToken: options.continuationToken
      });
      
      const result = await s3Client.send(command);
      
      return {
        files: result.Contents || [],
        isTruncated: result.IsTruncated,
        nextContinuationToken: result.NextContinuationToken
      };
    } catch (error) {
      logger.error(`Error listing files in S3: ${prefix}`, error);
      throw error;
    }
  },
  
  /**
   * Generate a pre-signed URL for direct upload
   * @param {string} key - S3 key (file path in bucket)
   * @param {Object} options - URL options
   * @returns {Promise<string>} Pre-signed URL
   */
  async getSignedUploadUrl(key, options = {}) {
    if (!this.isCloudStorageEnabled()) {
      throw new Error('Cloud storage is not configured');
    }
    
    try {
      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        ContentType: options.contentType || 'application/octet-stream',
        ACL: options.acl || 'private',
        Metadata: options.metadata || {}
      });
      
      // Create signed URL with expiration
      const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: options.expiresIn || 3600 // 1 hour default
      });
      
      return {
        url: signedUrl,
        key: key,
        expires: new Date(Date.now() + (options.expiresIn || 3600) * 1000)
      };
    } catch (error) {
      logger.error(`Error generating signed URL for S3: ${key}`, error);
      throw error;
    }
  },
  
  /**
   * Generate a pre-signed URL for file download
   * @param {string} key - S3 key (file path in bucket)
   * @param {Object} options - URL options
   * @returns {Promise<string>} Pre-signed URL
   */
  async getSignedDownloadUrl(key, options = {}) {
    if (!this.isCloudStorageEnabled()) {
      throw new Error('Cloud storage is not configured');
    }
    
    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        ResponseContentDisposition: options.filename 
          ? `attachment; filename="${options.filename}"` 
          : undefined
      });
      
      // Create signed URL with expiration
      const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: options.expiresIn || 3600 // 1 hour default
      });
      
      return {
        url: signedUrl,
        key: key,
        expires: new Date(Date.now() + (options.expiresIn || 3600) * 1000)
      };
    } catch (error) {
      logger.error(`Error generating signed download URL for S3: ${key}`, error);
      throw error;
    }
  },
  
  /**
   * Convert local file paths to cloud storage URLs
   * Used for migrating from local to cloud storage
   * @param {string} localPath - Local file path
   * @returns {string} Cloud storage key
   */
  getStorageKeyFromLocalPath(localPath) {
    // Strip upload directory prefix if present
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
    let relativePath = localPath;
    
    if (localPath.startsWith(uploadDir)) {
      relativePath = path.relative(uploadDir, localPath);
    }
    
    // Normalize path separators to forward slashes for S3
    return relativePath.replace(/\\/g, '/');
  }
};

module.exports = storageService;
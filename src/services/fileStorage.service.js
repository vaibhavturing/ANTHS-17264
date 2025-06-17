const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const crypto = require('crypto');
const { promisify } = require('util');
const multer = require('multer');
const AWS = require('aws-sdk');
const { Storage } = require('@google-cloud/storage');
const { BlobServiceClient } = require('@azure/storage-blob');
const MedicalFile = require('../models/medicalFile.model');
const FileTag = require('../models/fileTag.model');
const ApiError = require('../utils/api-error');
const config = require('../config/config');
const logger = require('../utils/logger');
const accessControlService = require('./accessControl.service');

class FileStorageService {
  constructor() {
    // Initialize storage providers based on configuration
    this.initializeStorageProviders();
    
    // Set up encryption
    this.encryptionKey = Buffer.from(config.file.encryption.key, 'hex');
    this.encryptionIv = Buffer.from(config.file.encryption.iv, 'hex');
    
    // Create local storage directories if they don't exist
    if (config.file.provider === 'local') {
      this.ensureLocalStorageDirectories();
    }
  }
  
  /**
   * Initialize different storage providers based on configuration
   */
  initializeStorageProviders() {
    switch (config.file.provider) {
      case 's3':
        this.s3 = new AWS.S3({
          accessKeyId: config.aws.accessKey,
          secretAccessKey: config.aws.secretKey,
          region: config.aws.region
        });
        break;
      
      case 'gcp':
        this.gcs = new Storage({
          projectId: config.gcp.projectId,
          keyFilename: config.gcp.keyFile
        });
        break;
      
      case 'azure':
        this.blobServiceClient = BlobServiceClient.fromConnectionString(
          config.azure.connectionString
        );
        break;
      
      case 'local':
      default:
        // Local file system is the default
        break;
    }
  }
  
  /**
   * Create local storage directories if they don't exist
   */
  async ensureLocalStorageDirectories() {
    try {
      const baseDir = config.file.local.storagePath;
      
      if (!fs.existsSync(baseDir)) {
        await fsPromises.mkdir(baseDir, { recursive: true });
        logger.info(`Created base storage directory: ${baseDir}`);
      }
      
      // Create subdirectories for different file types
      const subdirs = ['dicom', 'pdf', 'documents', 'images'];
      
      for (const subdir of subdirs) {
        const dirPath = path.join(baseDir, subdir);
        if (!fs.existsSync(dirPath)) {
          await fsPromises.mkdir(dirPath, { recursive: true });
          logger.info(`Created storage subdirectory: ${dirPath}`);
        }
      }
    } catch (error) {
      logger.error('Error creating storage directories:', error);
      throw new Error('Failed to initialize storage system');
    }
  }
  
  /**
   * Upload a file to the configured storage provider
   * @param {Object} file - The file object from multer
   * @param {Object} metadata - File metadata
   * @returns {Promise<Object>} Object containing file path and metadata
   */
  async uploadFile(file, metadata) {
    try {
      const fileType = this.determineFileType(file.mimetype, file.originalname);
      const timestamp = Date.now();
      const patientDir = metadata.patientId.toString();
      let storagePath;
      let fileBuffer = await fsPromises.readFile(file.path);
      
      // Encrypt the file if encryption is enabled
      if (config.file.encryption.enabled) {
        fileBuffer = this.encryptBuffer(fileBuffer);
      }
      
      switch (config.file.provider) {
        case 's3':
          storagePath = await this.uploadToS3(fileBuffer, file, fileType, patientDir, timestamp);
          break;
        
        case 'gcp':
          storagePath = await this.uploadToGCS(fileBuffer, file, fileType, patientDir, timestamp);
          break;
        
        case 'azure':
          storagePath = await this.uploadToAzure(fileBuffer, file, fileType, patientDir, timestamp);
          break;
        
        case 'local':
        default:
          storagePath = await this.uploadToLocalStorage(fileBuffer, file, fileType, patientDir, timestamp);
          break;
      }
      
      // If we saved the file with multer, remove the temp file
      if (file.path && fs.existsSync(file.path)) {
        await fsPromises.unlink(file.path);
      }
      
      return {
        storagePath,
        fileType,
        fileSize: file.size,
        mimeType: file.mimetype,
        originalFilename: file.originalname
      };
    } catch (error) {
      logger.error('Error uploading file:', error);
      
      // If we saved a temp file with multer, make sure to clean it up
      if (file.path && fs.existsSync(file.path)) {
        await fsPromises.unlink(file.path).catch(e => 
          logger.warn('Failed to delete temp file:', e));
      }
      
      throw new ApiError(500, 'Failed to upload file');
    }
  }
  
  /**
   * Determine the file type based on MIME type and file extension
   * @param {String} mimeType - File MIME type
   * @param {String} filename - Original filename
   * @returns {String} File type category
   */
  determineFileType(mimeType, filename) {
    const extension = path.extname(filename).toLowerCase();
    
    if (mimeType === 'application/dicom' || extension === '.dcm') {
      return 'dicom';
    } else if (mimeType === 'application/pdf' || extension === '.pdf') {
      return 'pdf';
    } else if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (
      mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      extension === '.doc' || extension === '.docx' ||
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      extension === '.xls' || extension === '.xlsx'
    ) {
      return 'document';
    } else {
      return 'other';
    }
  }
  
  /**
   * Encrypt a file buffer
   * @param {Buffer} buffer - File data buffer
   * @returns {Buffer} Encrypted buffer
   */
  encryptBuffer(buffer) {
    const cipher = crypto.createCipheriv(
      config.file.encryption.algorithm, 
      this.encryptionKey, 
      this.encryptionIv
    );
    
    const encrypted = Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);
    
    return encrypted;
  }
  
  /**
   * Decrypt a file buffer
   * @param {Buffer} buffer - Encrypted file data buffer
   * @returns {Buffer} Decrypted buffer
   */
  decryptBuffer(buffer) {
    const decipher = crypto.createDecipheriv(
      config.file.encryption.algorithm, 
      this.encryptionKey, 
      this.encryptionIv
    );
    
    const decrypted = Buffer.concat([
      decipher.update(buffer),
      decipher.final()
    ]);
    
    return decrypted;
  }
  
  /**
   * Upload file to local storage
   * @param {Buffer} fileBuffer - File data buffer
   * @param {Object} file - File object
   * @param {String} fileType - Type of file
   * @param {String} patientDir - Patient directory name
   * @param {Number} timestamp - Timestamp for filename
   * @returns {Promise<String>} Storage path
   */
  async uploadToLocalStorage(fileBuffer, file, fileType, patientDir, timestamp) {
    const baseDir = config.file.local.storagePath;
    const typeDir = fileType === 'other' ? 'documents' : fileType;
    const patientPath = path.join(baseDir, typeDir, patientDir);
    
    // Create patient directory if it doesn't exist
    if (!fs.existsSync(patientPath)) {
      await fsPromises.mkdir(patientPath, { recursive: true });
    }
    
    // Create unique filename
    const fileExt = path.extname(file.originalname);
    const baseFilename = path.basename(file.originalname, fileExt)
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    
    const filename = `${baseFilename}_${timestamp}${fileExt}`;
    const filePath = path.join(patientPath, filename);
    
    // Save the file
    await fsPromises.writeFile(filePath, fileBuffer);
    
    // Return relative path for storage in DB
    return path.join(typeDir, patientDir, filename);
  }
  
  /**
   * Upload file to Amazon S3
   * @param {Buffer} fileBuffer - File data buffer
   * @param {Object} file - File object
   * @param {String} fileType - Type of file
   * @param {String} patientDir - Patient directory name
   * @param {Number} timestamp - Timestamp for filename
   * @returns {Promise<String>} S3 storage path
   */
  async uploadToS3(fileBuffer, file, fileType, patientDir, timestamp) {
    const typeDir = fileType === 'other' ? 'documents' : fileType;
    const fileExt = path.extname(file.originalname);
    const baseFilename = path.basename(file.originalname, fileExt)
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    
    const filename = `${baseFilename}_${timestamp}${fileExt}`;
    const key = `${typeDir}/${patientDir}/${filename}`;
    
    const params = {
      Bucket: config.aws.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: file.mimetype,
      ServerSideEncryption: 'AES256' // Enable S3 server-side encryption
    };
    
    await this.s3.upload(params).promise();
    
    return key;
  }
  
  /**
   * Upload file to Google Cloud Storage
   * @param {Buffer} fileBuffer - File data buffer
   * @param {Object} file - File object
   * @param {String} fileType - Type of file
   * @param {String} patientDir - Patient directory name
   * @param {Number} timestamp - Timestamp for filename
   * @returns {Promise<String>} GCS storage path
   */
  async uploadToGCS(fileBuffer, file, fileType, patientDir, timestamp) {
    const bucket = this.gcs.bucket(config.gcp.bucketName);
    
    const typeDir = fileType === 'other' ? 'documents' : fileType;
    const fileExt = path.extname(file.originalname);
    const baseFilename = path.basename(file.originalname, fileExt)
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    
    const filename = `${baseFilename}_${timestamp}${fileExt}`;
    const filePath = `${typeDir}/${patientDir}/${filename}`;
    
    const fileOptions = {
      contentType: file.mimetype,
      metadata: {
        contentDisposition: `inline; filename="${file.originalname}"`
      }
    };
    
    const gcsFile = bucket.file(filePath);
    await gcsFile.save(fileBuffer, fileOptions);
    
    return filePath;
  }
  
  /**
   * Upload file to Azure Blob Storage
   * @param {Buffer} fileBuffer - File data buffer
   * @param {Object} file - File object
   * @param {String} fileType - Type of file
   * @param {String} patientDir - Patient directory name
   * @param {Number} timestamp - Timestamp for filename
   * @returns {Promise<String>} Azure storage path
   */
  async uploadToAzure(fileBuffer, file, fileType, patientDir, timestamp) {
    const containerClient = this.blobServiceClient.getContainerClient(
      config.azure.containerName
    );
    
    const typeDir = fileType === 'other' ? 'documents' : fileType;
    const fileExt = path.extname(file.originalname);
    const baseFilename = path.basename(file.originalname, fileExt)
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    
    const filename = `${baseFilename}_${timestamp}${fileExt}`;
    const blobPath = `${typeDir}/${patientDir}/${filename}`;
    
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    
    await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype
      }
    });
    
    return blobPath;
  }
  
  /**
   * Get a file from storage
   * @param {Object} fileData - Medical file data from database
   * @param {Object} user - User requesting the file
   * @param {String} accessType - Type of access (view, download, print)
   * @returns {Promise<Object>} Object with file buffer and metadata
   */
  async getFile(fileData, user, accessType = 'view') {
    try {
      // Check access permissions
      const hasAccess = await accessControlService.checkFileAccess(
        user, 
        fileData.patient, 
        fileData._id
      );
      
      if (!hasAccess) {
        throw new ApiError(403, 'You do not have permission to access this file');
      }
      
      let fileBuffer;
      
      switch (fileData.storageProvider) {
        case 's3':
          fileBuffer = await this.getFileFromS3(fileData.storagePath);
          break;
        
        case 'gcp':
          fileBuffer = await this.getFileFromGCS(fileData.storagePath);
          break;
        
        case 'azure':
          fileBuffer = await this.getFileFromAzure(fileData.storagePath);
          break;
        
        case 'local':
        default:
          fileBuffer = await this.getFileFromLocalStorage(fileData.storagePath);
          break;
      }
      
      // Decrypt the file if it's encrypted
      if (fileData.encryption && fileData.encryption.isEncrypted) {
        fileBuffer = this.decryptBuffer(fileBuffer);
      }
      
      // Log access
      await this.logFileAccess(fileData._id, user._id, accessType, user.ip, user.userAgent);
      
      return {
        buffer: fileBuffer,
        mimeType: fileData.mimeType,
        filename: fileData.originalFilename
      };
    } catch (error) {
      logger.error('Error retrieving file:', error);
      throw error instanceof ApiError ? 
        error : new ApiError(500, 'Failed to retrieve file');
    }
  }
  
  /**
   * Get file from local storage
   * @param {String} storagePath - Storage path of the file
   * @returns {Promise<Buffer>} File buffer
   */
  async getFileFromLocalStorage(storagePath) {
    const baseDir = config.file.local.storagePath;
    const filePath = path.join(baseDir, storagePath);
    
    if (!fs.existsSync(filePath)) {
      throw new ApiError(404, 'File not found');
    }
    
    return await fsPromises.readFile(filePath);
  }
  
  /**
   * Get file from Amazon S3
   * @param {String} storagePath - S3 key of the file
   * @returns {Promise<Buffer>} File buffer
   */
  async getFileFromS3(storagePath) {
    const params = {
      Bucket: config.aws.bucketName,
      Key: storagePath
    };
    
    try {
      const data = await this.s3.getObject(params).promise();
      return data.Body;
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        throw new ApiError(404, 'File not found');
      }
      throw error;
    }
  }
  
  /**
   * Get file from Google Cloud Storage
   * @param {String} storagePath - GCS path of the file
   * @returns {Promise<Buffer>} File buffer
   */
  async getFileFromGCS(storagePath) {
    const bucket = this.gcs.bucket(config.gcp.bucketName);
    const file = bucket.file(storagePath);
    
    try {
      const [fileContent] = await file.download();
      return fileContent;
    } catch (error) {
      if (error.code === 404) {
        throw new ApiError(404, 'File not found');
      }
      throw error;
    }
  }
  
  /**
   * Get file from Azure Blob Storage
   * @param {String} storagePath - Azure blob path of the file
   * @returns {Promise<Buffer>} File buffer
   */
  async getFileFromAzure(storagePath) {
    const containerClient = this.blobServiceClient.getContainerClient(
      config.azure.containerName
    );
    
    const blockBlobClient = containerClient.getBlockBlobClient(storagePath);
    
    try {
      const downloadResponse = await blockBlobClient.download(0);
      
      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      if (error.statusCode === 404) {
        throw new ApiError(404, 'File not found');
      }
      throw error;
    }
  }
  
  /**
   * Log file access
   * @param {String} fileId - Medical file ID
   * @param {String} userId - User ID accessing the file
   * @param {String} accessType - Type of access
   * @param {String} ipAddress - User's IP address
   * @param {String} userAgent - User's browser agent
   * @returns {Promise<void>}
   */
  async logFileAccess(fileId, userId, accessType, ipAddress, userAgent) {
    await MedicalFile.findByIdAndUpdate(fileId, {
      $push: {
        accessTimes: {
          accessedBy: userId,
          accessedAt: new Date(),
          accessType: accessType,
          ipAddress: ipAddress,
          userAgent: userAgent
        }
      }
    });
  }
  
  /**
   * Create a new file record in the database
   * @param {Object} fileData - File data from upload
   * @param {Object} metadata - Metadata for the file
   * @param {Array} tags - Array of tag IDs
   * @param {Object} user - User uploading the file
   * @returns {Promise<Object>} Created file record
   */
  async createFileRecord(fileData, metadata, tags, customTags, user) {
    // Build the complete metadata object
    const fileMetadata = {
      description: metadata.description,
      ...metadata
    };
    
    // Create file record
    const medicalFile = new MedicalFile({
      patient: metadata.patientId,
      originalFilename: fileData.originalFilename,
      storagePath: fileData.storagePath,
      storageProvider: config.file.provider,
      mimeType: fileData.mimeType,
      fileType: fileData.fileType,
      fileSize: fileData.fileSize,
      tags: tags || [],
      customTags: customTags || [],
      metadata: fileMetadata,
      uploadedBy: user._id,
      visit: metadata.visitId || null,
      encryption: {
        isEncrypted: config.file.encryption.enabled,
        algorithm: config.file.encryption.algorithm
      }
    });
    
    await medicalFile.save();
    return medicalFile;
  }
  
  /**
   * Get medical files for a patient with filters
   * @param {String} patientId - Patient ID
   * @param {Object} filters - Query filters
   * @param {Object} options - Pagination options
   * @param {Object} user - User making the request
   * @returns {Promise<Object>} Paginated result
   */
  async getPatientFiles(patientId, filters, options, user) {
    // Check access permissions
    const hasAccess = await accessControlService.checkPatientAccess(user, patientId);
    
    if (!hasAccess) {
      throw new ApiError(403, 'You do not have permission to access this patient\'s files');
    }
    
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    
    // Build query
    const query = {
      patient: patientId,
      isDeleted: false
    };
    
    // Apply filters
    if (filters.fileType) {
      query.fileType = filters.fileType;
    }
    
    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }
    
    if (filters.customTags && filters.customTags.length > 0) {
      query.customTags = { $in: filters.customTags };
    }
    
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }
    
    if (filters.search) {
      query.$or = [
        { originalFilename: { $regex: filters.search, $options: 'i' } },
        { 'metadata.description': { $regex: filters.search, $options: 'i' } },
        { customTags: { $regex: filters.search, $options: 'i' } }
      ];
    }
    
    // Create sort option
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const total = await MedicalFile.countDocuments(query);
    const files = await MedicalFile.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('tags', 'name category color icon')
      .populate('uploadedBy', 'firstName lastName')
      .lean();
    
    return {
      files,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    };
  }
  
  /**
   * Delete a medical file
   * @param {String} fileId - File ID
   * @param {Object} user - User performing the deletion
   * @returns {Promise<Boolean>} Success indicator
   */
  async deleteFile(fileId, user) {
    // Get the file
    const file = await MedicalFile.findById(fileId);
    
    if (!file) {
      throw new ApiError(404, 'File not found');
    }
    
    // Check access permissions (must have delete permissions)
    const hasAccess = await accessControlService.checkFileDeleteAccess(
      user, 
      file.patient
    );
    
    if (!hasAccess) {
      throw new ApiError(403, 'You do not have permission to delete this file');
    }
    
    // Mark as deleted in database (soft delete)
    file.isDeleted = true;
    file.deletedAt = new Date();
    file.deletedBy = user._id;
    
    await file.save();
    
    // Note: We don't actually delete the file from storage for compliance reasons
    // Files should be retained according to retention policies
    
    return true;
  }
  
  /**
   * Get file tags by category
   * @param {String} category - Tag category
   * @returns {Promise<Array>} Array of tags
   */
  async getFileTags(category) {
    const query = {};
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    query.isActive = true;
    
    return await FileTag.find(query)
      .sort('name')
      .lean();
  }
  
  /**
   * Create a new file tag
   * @param {Object} tagData - Tag data
   * @param {Object} user - User creating the tag
   * @returns {Promise<Object>} Created tag
   */
  async createFileTag(tagData, user) {
    const existingTag = await FileTag.findOne({ name: tagData.name });
    
    if (existingTag) {
      throw new ApiError(400, 'Tag with this name already exists');
    }
    
    const tag = new FileTag({
      ...tagData,
      createdBy: user._id
    });
    
    await tag.save();
    return tag;
  }
  
  /**
   * Get configurations for multer file upload
   * @returns {Object} Multer configured instance
   */
  getFileUploadMiddleware() {
    // Configure temporary storage for multer
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const tempDir = path.join(config.file.local.storagePath, 'temp');
        
        // Create temp directory if it doesn't exist
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        cb(null, tempDir);
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname) || '';
        cb(null, `temp-${timestamp}${ext}`);
      }
    });
    
    // File filter - validate file types
    const fileFilter = (req, file, cb) => {
      const allowedMimeTypes = [
        'application/dicom',
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ];
      
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new ApiError(400, 'Unsupported file type'), false);
      }
    };
    
    // Configure multer
    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: config.file.maxSize // Max file size in bytes
      }
    });
  }
}

module.exports = new FileStorageService();
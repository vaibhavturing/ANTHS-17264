const path = require('path');

module.exports = {
  // Base path for file storage
  storagePath: process.env.FILE_STORAGE_PATH || path.resolve(__dirname, '../../storage'),
  
  // Maximum file size in bytes (50MB by default)
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024,
  
  // Allowed file types
  allowedFileTypes: {
    dicom: ['application/dicom', 'application/dicom+json'],
    pdf: ['application/pdf'],
    image: ['image/jpeg', 'image/png', 'image/gif'],
  },
  
  // Storage structure options
  storageStructure: {
    // Structure by: patient/year/month/file-type
    patientBasedPath: true, 
    // Include date in path structure
    includeDate: true,
    // Include file type in path 
    includeFileType: true,
  },
  
  // Encryption settings
  encryption: {
    algorithm: 'aes-256-cbc',
    // Whether to encrypt files at rest
    enabled: true
  },
  
  // DICOM viewer configuration
  dicomViewer: {
    // Max concurrent loading frames
    maxConcurrentLoads: 6,
    // Cache size for DICOM frames in MB
    cacheSize: 128
  }
};
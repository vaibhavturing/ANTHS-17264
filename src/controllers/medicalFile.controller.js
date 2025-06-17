const fileStorageService = require('../services/fileStorage.service');
const dicomParserService = require('../services/dicomParser.service');
const catchAsync = require('../utils/catch-async');
const ApiError = require('../utils/api-error');

/**
 * Upload a new medical file
 */
exports.uploadFile = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded');
  }
  
  const { patientId, description, tags, customTags, visitId } = req.body;
  
  if (!patientId) {
    throw new ApiError(400, 'Patient ID is required');
  }
  
  // Parse tags if provided as string
  let parsedTags = [];
  if (tags) {
    parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
  }
  
  // Parse custom tags if provided as string
  let parsedCustomTags = [];
  if (customTags) {
    parsedCustomTags = typeof customTags === 'string' ? 
      customTags.split(',').map(tag => tag.trim()) : 
      customTags;
  }
  
  // Build metadata
  const metadata = {
    patientId,
    description,
    visitId
  };
  
  // Extract additional metadata based on file type
  if (req.file.mimetype === 'application/dicom' || 
      req.file.originalname.toLowerCase().endsWith('.dcm')) {
    const dicomMetadata = dicomParserService.parseMetadata(req.file.buffer || await fileStorageService.getFileFromLocalStorage(`temp/${req.file.filename}`));
    Object.assign(metadata, dicomMetadata);
    
    // Add modality and body part as custom tags if not provided
    if (dicomMetadata.modality && !parsedCustomTags.includes(dicomMetadata.modality)) {
      parsedCustomTags.push(dicomMetadata.modality);
    }
    
    if (dicomMetadata.bodyPart && !parsedCustomTags.includes(dicomMetadata.bodyPart)) {
      parsedCustomTags.push(dicomMetadata.bodyPart);
    }
    
    // Add study date in custom tag format (MRI—03/2024)
    if (dicomMetadata.studyDate && dicomMetadata.modality) {
      const datePart = dicomMetadata.studyDate ? 
        new Intl.DateTimeFormat('en-US', { month: '2-digit', year: 'numeric' })
          .format(new Date(dicomMetadata.studyDate)) : 
        '';
      
      const formattedTag = `${dicomMetadata.modality}—${datePart}`;
      
      if (!parsedCustomTags.includes(formattedTag)) {
        parsedCustomTags.push(formattedTag);
      }
    }
  }
  
  // For PDF files, extract basic metadata
  if (req.file.mimetype === 'application/pdf') {
    // Add PDF as custom tag
    if (!parsedCustomTags.includes('PDF')) {
      parsedCustomTags.push('PDF');
    }
    
    // Add custom tag with date
    const currentDate = new Intl.DateTimeFormat('en-US', { 
      month: '2-digit', 
      year: 'numeric' 
    }).format(new Date());
    
    const pdfTag = `PDF—${currentDate}`;
    if (!parsedCustomTags.includes(pdfTag)) {
      parsedCustomTags.push(pdfTag);
    }
  }
  
  // Upload the file
  const fileData = await fileStorageService.uploadFile(req, req.file, metadata);
  
  // Create file record
  const medicalFile = await fileStorageService.createFileRecord(
    fileData, 
    metadata, 
    parsedTags, 
    parsedCustomTags, 
    req.user
  );
  
  res.status(201).json({
    success: true,
    data: medicalFile
  });
});

/**
 * Get files for a patient
 */
exports.getPatientFiles = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const { 
    fileType, 
    tags, 
    customTags, 
    startDate, 
    endDate, 
    search, 
    page, 
    limit,
    sortBy,
    sortOrder 
  } = req.query;
  
  // Build filters
  const filters = {
    fileType,
    startDate,
    endDate,
    search
  };
  
  // Parse tags if provided
  if (tags) {
    filters.tags = Array.isArray(tags) ? tags : [tags];
  }
  
  // Parse custom tags if provided
  if (customTags) {
    filters.customTags = Array.isArray(customTags) ? 
      customTags : 
      customTags.split(',').map(tag => tag.trim());
  }
  
  // Set pagination options
  const options = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    sortBy: sortBy || 'createdAt',
    sortOrder: sortOrder || 'desc'
  };
  
  // Add client info to user object for access logging
  const userWithClientInfo = {
    ...req.user,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };
  
  // Get files
  const result = await fileStorageService.getPatientFiles(
    patientId, 
    filters, 
    options,
    userWithClientInfo
  );
  
  res.json({
    success: true,
    ...result
  });
});

/**
 * Get a specific file
 */
exports.getFile = catchAsync(async (req, res) => {
  const { fileId } = req.params;
  const { accessType } = req.query;
  
  // Validate access type
  if (accessType && !['view', 'download', 'print'].includes(accessType)) {
    throw new ApiError(400, 'Invalid access type');
  }
  
  // Add client info to user object for access logging
  const userWithClientInfo = {
    ...req.user,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };
  
  // Get file from database
  const fileData = await MedicalFile.findById(fileId);
  
  if (!fileData || fileData.isDeleted) {
    throw new ApiError(404, 'File not found');
  }
  
  // Get file content
  const { buffer, mimeType, filename } = await fileStorageService.getFile(
    fileData,
    userWithClientInfo,
    accessType || 'view'
  );
  
  // Set appropriate headers
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  
  // If it's a download, change Content-Disposition
  if (accessType === 'download') {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }
  
  res.send(buffer);
});

/**
 * Delete a file
 */
exports.deleteFile = catchAsync(async (req, res) => {
  const { fileId } = req.params;
  
  await fileStorageService.deleteFile(fileId, req.user);
  
  res.json({
    success: true,
    message: 'File deleted successfully'
  });
});

/**
 * Get file tags
 */
exports.getFileTags = catchAsync(async (req, res) => {
  const { category } = req.query;
  
  const tags = await fileStorageService.getFileTags(category);
  
  res.json({
    success: true,
    data: tags
  });
});

/**
 * Create a new file tag
 */
exports.createFileTag = catchAsync(async (req, res) => {
  const { name, category, description, color, icon } = req.body;
  
  if (!name || !category) {
    throw new ApiError(400, 'Name and category are required');
  }
  
  const tag = await fileStorageService.createFileTag(
    { name, category, description, color, icon },
    req.user
  );
  
  res.status(201).json({
    success: true,
    data: tag
  });
});

/**
 * Update file tags
 */
exports.updateFileTags = catchAsync(async (req, res) => {
  const { fileId } = req.params;
  const { tags, customTags } = req.body;
  
  if (!Array.isArray(tags) && !Array.isArray(customTags)) {
    throw new ApiError(400, 'Tags or customTags array is required');
  }
  
  const file = await MedicalFile.findById(fileId);
  
  if (!file || file.isDeleted) {
    throw new ApiError(404, 'File not found');
  }
  
  // Check file access
  const hasAccess = await accessControlService.checkFileAccess(
    req.user,
    file.patient,
    fileId
  );
  
  if (!hasAccess) {
    throw new ApiError(403, 'You do not have permission to update this file');
  }
  
  // Update tags
  if (Array.isArray(tags)) {
    file.tags = tags;
  }
  
  if (Array.isArray(customTags)) {
    file.customTags = customTags;
  }
  
  await file.save();
  
  res.json({
    success: true,
    data: file
  });
});
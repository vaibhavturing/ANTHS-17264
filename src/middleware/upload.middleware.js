// src/middleware/upload.middleware.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure uploads directory exists
const createDirectories = () => {
  const uploadDir = path.join(__dirname, '../../public/uploads/profile');
  
  if (!fs.existsSync(path.join(__dirname, '../../public'))) {
    fs.mkdirSync(path.join(__dirname, '../../public'));
  }
  
  if (!fs.existsSync(path.join(__dirname, '../../public/uploads'))) {
    fs.mkdirSync(path.join(__dirname, '../../public/uploads'));
  }
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
};

// Call this function when the application starts
createDirectories();

// Define storage configuration for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Store files in public/uploads/profile directory
    cb(null, path.join(__dirname, '../../public/uploads/profile'));
  },
  filename: (req, file, cb) => {
    // Generate unique filename: userId-uuid-originalname
    const userId = req.user ? req.user._id.toString() : 'unknown';
    const uniqueSuffix = uuidv4();
    const extension = path.extname(file.originalname);
    
    cb(null, `${userId}-${uniqueSuffix}${extension}`);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    return cb(null, true);
  }
  
  // Reject non-image files
  cb(new Error('Only image files are allowed!'), false);
};

// Configure multer for single file uploads
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  }
});

// Define error handling middleware for multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A multer error occurred
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    // A different error occurred
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  // No error occurred, proceed to next middleware
  next();
};

module.exports = {
  uploadProfilePicture: upload.single('profilePicture'),
  handleMulterError
};
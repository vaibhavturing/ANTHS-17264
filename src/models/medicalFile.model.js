const mongoose = require('mongoose');
const { Schema } = mongoose;

const medicalFileSchema = new Schema(
  {
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true
    },
    storagePath: {
      type: String,
      required: true,
      trim: true
    },
    storageProvider: {
      type: String,
      enum: ['local', 's3', 'azure', 'gcp'],
      default: 'local'
    },
    mimeType: {
      type: String,
      required: true,
      trim: true
    },
    fileType: {
      type: String,
      enum: ['dicom', 'pdf', 'image', 'document', 'other'],
      required: true
    },
    fileSize: {
      type: Number, // Size in bytes
      required: true
    },
    tags: [{
      type: Schema.Types.ObjectId,
      ref: 'FileTag'
    }],
    customTags: [{
      type: String,
      trim: true
    }],
    metadata: {
      // DICOM-specific metadata
      studyInstanceUID: String,
      seriesInstanceUID: String,
      sopInstanceUID: String,
      modality: String, // MRI, CT, X-ray, etc.
      studyDate: Date,
      bodyPart: String,
      
      // PDF-specific metadata
      title: String,
      author: String,
      pageCount: Number,
      
      // Common metadata
      description: String,
      procedureDate: Date,
      procedureType: String,
      orderedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      performedBy: String,
      facilityName: String,
      
      // Additional metadata as needed
      additionalInfo: Schema.Types.Mixed
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    visit: {
      type: Schema.Types.ObjectId,
      ref: 'Visit'
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    encryption: {
      isEncrypted: {
        type: Boolean,
        default: true
      },
      algorithm: {
        type: String,
        enum: ['AES-256-CBC', 'AES-256-GCM'],
        default: 'AES-256-GCM'
      }
    },
    accessTimes: [{
      accessedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      accessedAt: {
        type: Date,
        default: Date.now
      },
      accessType: {
        type: String,
        enum: ['view', 'download', 'print'],
        required: true
      },
      ipAddress: String,
      userAgent: String
    }]
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Indexes for query performance
medicalFileSchema.index({ patient: 1, fileType: 1 });
medicalFileSchema.index({ 'metadata.studyDate': 1 });
medicalFileSchema.index({ 'metadata.procedureDate': 1 });
medicalFileSchema.index({ tags: 1 });
medicalFileSchema.index({ customTags: 'text' });

const MedicalFile = mongoose.model('MedicalFile', medicalFileSchema);

module.exports = MedicalFile;
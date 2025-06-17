const mongoose = require('mongoose');
const { Schema } = mongoose;

const fileTagSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    category: {
      type: String,
      enum: ['modality', 'body_part', 'procedure_type', 'document_type', 'other'],
      required: true
    },
    description: {
      type: String,
      trim: true
    },
    color: {
      type: String,
      default: '#3f51b5', // Default color
      validate: {
        validator: function(v) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: props => `${props.value} is not a valid hex color!`
      }
    },
    icon: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Text index for searching
fileTagSchema.index({ name: 'text', description: 'text' });

const FileTag = mongoose.model('FileTag', fileTagSchema);

module.exports = FileTag;
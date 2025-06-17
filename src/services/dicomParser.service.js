const daikon = require('daikon');
const logger = require('../utils/logger');

class DicomParserService {
  /**
   * Parse DICOM file and extract metadata
   * @param {Buffer} buffer - DICOM file buffer
   * @returns {Object} Extracted metadata
   */
  parseMetadata(buffer) {
    try {
      // Parse the DICOM file
      const data = new DataView(this.bufferToArrayBuffer(buffer));
      const image = daikon.Series.parseImage(data);
      
      if (image === null) {
        throw new Error('Unable to parse DICOM file');
      }
      
      // Extract common metadata
      const metadata = {
        studyInstanceUID: this.getTagValue(image, 'StudyInstanceUID'),
        seriesInstanceUID: this.getTagValue(image, 'SeriesInstanceUID'),
        sopInstanceUID: this.getTagValue(image, 'SOPInstanceUID'),
        modality: this.getTagValue(image, 'Modality'),
        studyDate: this.parseDate(this.getTagValue(image, 'StudyDate')),
        studyTime: this.getTagValue(image, 'StudyTime'),
        studyDescription: this.getTagValue(image, 'StudyDescription'),
        seriesDescription: this.getTagValue(image, 'SeriesDescription'),
        patientName: this.getTagValue(image, 'PatientName'),
        patientID: this.getTagValue(image, 'PatientID'),
        patientBirthDate: this.parseDate(this.getTagValue(image, 'PatientBirthDate')),
        patientSex: this.getTagValue(image, 'PatientSex'),
        bodyPartExamined: this.getTagValue(image, 'BodyPartExamined'),
        sliceThickness: this.getTagValue(image, 'SliceThickness'),
        rows: this.getTagValue(image, 'Rows'),
        columns: this.getTagValue(image, 'Columns'),
        institutionName: this.getTagValue(image, 'InstitutionName')
      };
      
      // Determine body part based on modality and body part examined
      metadata.bodyPart = this.determineBodyPart(metadata.modality, metadata.bodyPartExamined);
      
      return metadata;
    } catch (error) {
      logger.error('Error parsing DICOM file:', error);
      return {
        error: 'Failed to parse DICOM file',
        modality: 'Unknown',
        bodyPart: 'Unknown'
      };
    }
  }
  
  /**
   * Convert Buffer to ArrayBuffer for dicom parser
   * @param {Buffer} buffer - Node.js Buffer
   * @returns {ArrayBuffer} ArrayBuffer representation
   */
  bufferToArrayBuffer(buffer) {
    const arrayBuffer = new ArrayBuffer(buffer.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < buffer.length; i++) {
      view[i] = buffer[i];
    }
    return arrayBuffer;
  }
  
  /**
   * Get value from a DICOM tag
   * @param {Object} image - DICOM image
   * @param {String} tagName - Name of the tag
   * @returns {String} Tag value
   */
  getTagValue(image, tagName) {
    const tag = image.getTag(daikon.Tag.getTagFromKey(daikon.Dictionary[tagName]));
    
    if (tag && tag.value) {
      return tag.value[0];
    }
    
    return null;
  }
  
  /**
   * Parse DICOM date string
   * @param {String} dateStr - DICOM date string (YYYYMMDD)
   * @returns {Date} JavaScript Date object
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    
    try {
      // Format: YYYYMMDD
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-indexed
      const day = parseInt(dateStr.substring(6, 8));
      
      return new Date(year, month, day);
    } catch (error) {
      logger.warn('Error parsing DICOM date:', error);
      return null;
    }
  }
  
  /**
   * Determine body part from modality and body part examined
   * @param {String} modality - DICOM modality
   * @param {String} bodyPartExamined - Body part examined
   * @returns {String} Standardized body part
   */
  determineBodyPart(modality, bodyPartExamined) {
    if (!bodyPartExamined) {
      // Try to infer body part from modality
      switch (modality) {
        case 'MG':
          return 'Breast';
        case 'MMG':
          return 'Breast';
        case 'OPT':
          return 'Eye';
        default:
          return 'Unknown';
      }
    }
    
    // Standardize body part names
    const bodyPartMap = {
      'SKULL': 'Head',
      'HEAD': 'Head',
      'CSPINE': 'Spine',
      'TSPINE': 'Spine',
      'LSPINE': 'Spine',
      'CHEST': 'Chest',
      'ABDOMEN': 'Abdomen',
      'PELVIS': 'Pelvis',
      'HIP': 'Pelvis',
      'KNEE': 'Knee',
      'ANKLE': 'Ankle',
      'SHOULDER': 'Shoulder',
      'ELBOW': 'Elbow',
      'WRIST': 'Wrist',
      'HAND': 'Hand',
      'FOOT': 'Foot'
    };
    
    const upperBodyPart = bodyPartExamined.toUpperCase();
    
    for (const [key, value] of Object.entries(bodyPartMap)) {
      if (upperBodyPart.includes(key)) {
        return value;
      }
    }
    
    return bodyPartExamined; // Return original if no match
  }
}

module.exports = new DicomParserService();
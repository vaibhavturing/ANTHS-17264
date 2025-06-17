const dicomjs = require('dicom-parser');
const logger = require('./logger');

class DicomParser {
  /**
   * Extract metadata from DICOM buffer
   * @param {Buffer} buffer - DICOM file buffer
   * @returns {Object} Extracted metadata
   */
  async extractMetadata(buffer) {
    try {
      const dataSet = dicomjs.parseDicom(buffer);
      
      // Extract common DICOM tags
      return {
        studyInstanceUID: this.getTag(dataSet, 'x0020000d'),
        seriesInstanceUID: this.getTag(dataSet, 'x0020000e'),
        SOPInstanceUID: this.getTag(dataSet, 'x00080018'),
        modality: this.getTag(dataSet, 'x00080060'),
        studyDate: this.parseDate(this.getTag(dataSet, 'x00080020')),
        accessionNumber: this.getTag(dataSet, 'x00080050'),
        patientPosition: this.getTag(dataSet, 'x00185100'),
        acquisitionDate: this.parseDate(this.getTag(dataSet, 'x00080022')),
        numberOfFrames: this.parseInt(this.getTag(dataSet, 'x00280008')) || 1,
        // Add more tags as needed
      };
    } catch (error) {
      logger.warn('Failed to parse DICOM file:', error);
      return {}; // Return empty metadata on parsing failure
    }
  }

  /**
   * Get tag value from DICOM dataset
   * @param {Object} dataSet - DICOM dataset
   * @param {String} tag - Tag ID
   * @returns {String|null} Tag value
   */
  getTag(dataSet, tag) {
    try {
      const element = dataSet.elements[tag];
      if (!element) return null;
      
      return dataSet.string(tag);
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse DICOM date string to Date object
   * @param {String} dateStr - DICOM date string (YYYYMMDD)
   * @returns {Date|null} Parsed date
   */
  parseDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return null;
    
    try {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-based
      const day = parseInt(dateStr.substring(6, 8));
      
      return new Date(year, month, day);
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse integer value from string
   * @param {String} str - String value
   * @returns {Number|null} Parsed integer
   */
  parseInt(str) {
    if (!str) return null;
    
    const parsed = parseInt(str);
    return isNaN(parsed) ? null : parsed;
  }
}

module.exports = new DicomParser();
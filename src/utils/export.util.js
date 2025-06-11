const fs = require('fs');
const path = require('path');
const csv = require('csv-writer').createObjectCsvWriter;
const excel = require('exceljs');
const PDFDocument = require('pdfkit');
const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');

/**
 * Export data to PDF format
 * @param {Object} data - Data to export
 * @param {string} reportType - Type of report
 * @returns {Promise<Object>} Export result
 */
const exportToPdf = async (data, reportType) => {
  try {
    return new Promise((resolve, reject) => {
      // Create a PDF document
      const doc = new PDFDocument();
      const chunks = [];
      
      // Capture PDF data
      doc.on('data', chunk => chunks.push(chunk));
      
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const base64Data = pdfBuffer.toString('base64');
        
        resolve({
          content: base64Data,
          contentType: 'application/pdf',
          filename: `${reportType}_${Date.now()}.pdf`
        });
      });
      
      // Generate PDF content
      doc.fontSize(20).text(`Healthcare Analytics Report: ${reportType}`, {
        align: 'center'
      });
      
      doc.moveDown();
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, {
        align: 'right'
      });
      
      doc.moveDown();
      doc.fontSize(16).text('Report Data', { underline: true });
      doc.moveDown();
      
      // Add data to PDF
      renderObjectToPdf(data, doc);
      
      // Finalize PDF
      doc.end();
    });
  } catch (error) {
    logger.error('Failed to export to PDF', { error: error.message });
    throw new Error('PDF generation failed');
  }
};

/**
 * Render a JavaScript object to PDF
 * @param {Object} obj - Object to render
 * @param {PDFDocument} doc - PDF document
 * @param {number} level - Nesting level
 */
const renderObjectToPdf = (obj, doc, level = 0) => {
  const indent = '  '.repeat(level);
  
  if (obj === null || obj === undefined) {
    doc.text(`${indent}null`);
    return;
  }
  
  if (typeof obj !== 'object') {
    doc.text(`${indent}${obj}`);
    return;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      doc.text(`${indent}[]`);
      return;
    }
    
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === 'object' && obj[i] !== null) {
        doc.text(`${indent}[${i}]:`);
        renderObjectToPdf(obj[i], doc, level + 1);
      } else {
        doc.text(`${indent}[${i}]: ${obj[i]}`);
      }
    }
    return;
  }
  
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    doc.text(`${indent}{}`);
    return;
  }
  
  for (const key of keys) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      doc.text(`${indent}${key}:`);
      renderObjectToPdf(obj[key], doc, level + 1);
    } else {
      doc.text(`${indent}${key}: ${obj[key]}`);
    }
  }
};

/**
 * Export data to CSV format
 * @param {Object} data - Data to export
 * @returns {Promise<Object>} Export result
 */
const exportToCsv = async (data) => {
  try {
    // Flatten the data structure for CSV
    const flattenedData = flattenDataForExport(data);
    
    const fields = Object.keys(flattenedData[0] || {});
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(flattenedData);
    
    return {
      content: csv,
      contentType: 'text/csv',
      filename: `report_${Date.now()}.csv`
    };
  } catch (error) {
    logger.error('Failed to export to CSV', { error: error.message });
    throw new Error('CSV generation failed');
  }
};

/**
 * Export data to Excel format
 * @param {Object} data - Data to export
 * @returns {Promise<Object>} Export result
 */
const exportToExcel = async (data) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report Data');
    
    // Flatten the data structure for Excel
    const flattenedData = flattenDataForExport(data);
    
    if (flattenedData.length === 0) {
      // Add a single empty row
      worksheet.addRow(['No data available']);
    } else {
      // Add headers
      const headers = Object.keys(flattenedData[0]);
      worksheet.addRow(headers);
      
      // Add data
      flattenedData.forEach(item => {
        const row = headers.map(header => item[header]);
        worksheet.addRow(row);
      });
      
      // Format headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    }
    
    // Generate the Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const base64Data = buffer.toString('base64');
    
    return {
      content: base64Data,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `report_${Date.now()}.xlsx`
    };
  } catch (error) {
    logger.error('Failed to export to Excel', { error: error.message });
    throw new Error('Excel generation failed');
  }
};

/**
 * Flatten nested data for CSV/Excel export
 * @param {Object} data - Data to flatten
 * @returns {Array} Flattened data
 */
const flattenDataForExport = (data) => {
  // Handle different types of data structures
  if (Array.isArray(data)) {
    return data.map(item => flattenObject(item));
  }
  
  // If it's a nested object with arrays inside
  for (const key in data) {
    if (Array.isArray(data[key]) && data[key].length > 0 && typeof data[key][0] === 'object') {
      return data[key].map(item => flattenObject({ ...item, reportCategory: key }));
    }
  }
  
  // If it's just an object, wrap it in an array
  return [flattenObject(data)];
};

/**
 * Flatten a nested object into a single level object
 * @param {Object} obj - Object to flatten
 * @param {string} prefix - Key prefix for nested properties
 * @returns {Object} Flattened object
 */
const flattenObject = (obj, prefix = '') => {
  if (!obj || typeof obj !== 'object') {
    return { [prefix]: obj };
  }
  
  return Object.keys(obj).reduce((acc, key) => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(acc, flattenObject(obj[key], newKey));
    } else if (Array.isArray(obj[key])) {
      // For arrays, stringify them
      acc[newKey] = JSON.stringify(obj[key]);
    } else {
      acc[newKey] = obj[key];
    }
    
    return acc;
  }, {});
};

module.exports = {
  exportToPdf,
  exportToCsv,
  exportToExcel,
  flattenDataForExport,
  flattenObject
};
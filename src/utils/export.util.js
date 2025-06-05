const fs = require('fs');
const path = require('path');
const csv = require('csv-writer').createObjectCsvWriter;
const excel = require('exceljs');
const PDFDocument = require('pdfkit');
const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Utility for exporting data in various formats
 */
const exportUtils = {
  /**
   * Generate a CSV file from data
   * @param {Array} data - Array of objects to export
   * @param {Object} options - Export options
   * @returns {Promise<Buffer>} CSV data
   */
  generateCSV: async (data, options = {}) => {
    try {
      if (!data || data.length === 0) {
        throw new Error('No data to export');
      }
      
      const tempFilePath = path.join('temp', `export-${uuidv4()}.csv`);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync('temp')) {
        fs.mkdirSync('temp');
      }
      
      // Get headers from the first data object
      const headers = Object.keys(data[0]).map(key => ({
        id: key,
        title: formatHeaderTitle(key)
      }));
      
      const csvWriter = csv({
        path: tempFilePath,
        header: headers
      });
      
      // Write data to CSV
      await csvWriter.writeRecords(data);
      
      // Read file into buffer
      const buffer = fs.readFileSync(tempFilePath);
      
      // Delete temporary file
      fs.unlinkSync(tempFilePath);
      
      return buffer;
    } catch (error) {
      logger.error('Error generating CSV', { error: error.message });
      throw error;
    }
  },
  
  /**
   * Generate an Excel file from data
   * @param {Array} data - Array of objects to export
   * @param {string} sheetName - Name of the Excel sheet
   * @param {Object} options - Export options
   * @returns {Promise<Buffer>} Excel data
   */
  generateExcel: async (data, sheetName = 'Data', options = {}) => {
    try {
      if (!data || data.length === 0) {
        throw new Error('No data to export');
      }
      
      const tempFilePath = path.join('temp', `export-${uuidv4()}.xlsx`);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync('temp')) {
        fs.mkdirSync('temp');
      }
      
      const workbook = new excel.Workbook();
      workbook.created = new Date();
      workbook.modified = new Date();
      
      // Add creator metadata if provided
      if (options.creator) {
        workbook.creator = options.creator;
      }
      
      const sheet = workbook.addWorksheet(sheetName);
      
      // Get headers from the first data object
      const headers = Object.keys(data[0]).map(key => formatHeaderTitle(key));
      
      // Add headers to the sheet
      sheet.addRow(headers);
      
      // Style the header row
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      
      // Add data rows
      data.forEach(item => {
        const row = Object.values(item);
        sheet.addRow(row);
      });
      
      // Auto-fit columns
      sheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          maxLength = Math.max(maxLength, columnLength);
        });
        column.width = Math.min(maxLength + 2, 30); // Max width of 30
      });
      
      // Write to file
      await workbook.xlsx.writeFile(tempFilePath);
      
      // Read file into buffer
      const buffer = fs.readFileSync(tempFilePath);
      
      // Delete temporary file
      fs.unlinkSync(tempFilePath);
      
      return buffer;
    } catch (error) {
      logger.error('Error generating Excel file', { error: error.message });
      throw error;
    }
  },
  
  /**
   * Generate a PDF file from data
   * @param {Array} data - Array of objects to export
   * @param {Object} options - PDF options (title, creator, etc)
   * @returns {Promise<Buffer>} PDF data
   */
  generatePDF: async (data, options = {}) => {
    return new Promise((resolve, reject) => {
      try {
        if (!data || data.length === 0) {
          throw new Error('No data to export');
        }
        
        const tempFilePath = path.join('temp', `export-${uuidv4()}.pdf`);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync('temp')) {
          fs.mkdirSync('temp');
        }
        
        // Create a PDF document
        const doc = new PDFDocument({
          margin: 30,
          size: 'A4',
          info: {
            Title: options.title || 'Data Export',
            Author: options.creator || 'Healthcare Management System',
            Subject: options.subject || 'Data Export',
            Keywords: options.keywords || 'export, data'
          }
        });
        
        // Pipe output to file
        const stream = fs.createWriteStream(tempFilePath);
        doc.pipe(stream);
        
        // Add title
        doc.fontSize(16).font('Helvetica-Bold').text(options.title || 'Data Export', { align: 'center' });
        doc.moveDown();
        
        // Add generation info
        doc.fontSize(10).font('Helvetica')
          .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown();
        
        // Get headers from the first data object
        const headers = Object.keys(data[0]).map(key => formatHeaderTitle(key));
        
        // Calculate column widths
        const pageWidth = doc.page.width - 2 * doc.page.margins.left;
        const columnCount = headers.length;
        const columnWidth = pageWidth / columnCount;
        
        // Draw table header
        doc.fontSize(10).font('Helvetica-Bold');
        let yPos = doc.y;
        headers.forEach((header, i) => {
          doc.text(header, doc.page.margins.left + i * columnWidth, yPos, 
            { width: columnWidth, align: 'left' });
        });
        
        doc.moveDown();
        yPos = doc.y;
        
        // Draw a line after the header
        doc.moveTo(doc.page.margins.left, yPos).lineTo(doc.page.width - doc.page.margins.right, yPos).stroke();
        
        // Draw table rows
        doc.fontSize(9).font('Helvetica');
        data.forEach((row, rowIndex) => {
          // Check if we need a new page
          if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
            doc.addPage();
            yPos = doc.page.margins.top;
            doc.y = yPos;
          }
          
          yPos = doc.y;
          
          // Draw row data
          Object.values(row).forEach((cell, i) => {
            doc.text(cell?.toString() || '', 
              doc.page.margins.left + i * columnWidth, 
              yPos, 
              { width: columnWidth, align: 'left' }
            );
          });
          
          doc.moveDown();
          
          // Add light row borders for readability
          if (rowIndex % 2 === 0) {
            const rowHeight = doc.y - yPos;
            doc.rect(doc.page.margins.left, yPos, pageWidth, rowHeight)
              .fill('#f5f5f5', 'even-odd');
            doc.y = yPos + rowHeight;
          }
        });
        
        // Add page numbers
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          doc.fontSize(8).text(
            `Page ${i + 1} of ${totalPages}`,
            doc.page.margins.left,
            doc.page.height - doc.page.margins.bottom - 15,
            { align: 'center', width: pageWidth }
          );
        }
        
        // Finalize the PDF and end the stream
        doc.end();
        
        stream.on('finish', () => {
          // Read file into buffer
          const buffer = fs.readFileSync(tempFilePath);
          
          // Delete temporary file
          fs.unlinkSync(tempFilePath);
          
          resolve(buffer);
        });
        
        stream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        logger.error('Error generating PDF', { error: error.message });
        reject(error);
      }
    });
  }
};

/**
 * Format a camelCase or snake_case header to Title Case with spaces
 * @private
 * @param {string} header - Header key
 * @returns {string} Formatted header title
 */
function formatHeaderTitle(header) {
  // Replace camelCase with spaces
  const withSpaces = header.replace(/([A-Z])/g, ' $1');
  
  // Replace snake_case with spaces
  const withoutUnderscores = withSpaces.replace(/_/g, ' ');
  
  // Capitalize first letter of each word
  return withoutUnderscores
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

module.exports = exportUtils;
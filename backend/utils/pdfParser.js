const fs = require('fs').promises;
const PDF2JSON = require('pdf2json');

class PDFParser {
  static async extractText(filePath) {
    try {
      console.log('PDFParser: Attempting to read file:', filePath);
      
      const pdfParser = new PDF2JSON();
      
      const data = await new Promise((resolve, reject) => {
        pdfParser.on('pdfParser_dataReady', (pdfData) => {
          resolve(pdfData);
        });
        
        pdfParser.on('pdfParser_dataError', (error) => {
          reject(error);
        });
        
        pdfParser.loadPDF(filePath);
      });
      
      console.log('PDFParser: Successfully parsed PDF:', {
        pages: data.Pages.length
      });
      
      // Convert all pages to text
      const text = data.Pages.map(page => 
        page.Texts.map(text => decodeURIComponent(text.R[0].T)).join(' ')
      ).join('\n\n');
      
      return {
        text,
        numPages: data.Pages.length,
        info: {},
        metadata: {},
        version: '1.0'
      };
    } catch (error) {
      console.error('PDFParser: Error parsing PDF:', error);
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }

  static async extractPages(filePath) {
    try {
      console.log('PDFParser: Attempting to extract pages from:', filePath);
      
      const pdfParser = new PDF2JSON();
      
      const data = await new Promise((resolve, reject) => {
        pdfParser.on('pdfParser_dataReady', (pdfData) => {
          resolve(pdfData);
        });
        
        pdfParser.on('pdfParser_dataError', (error) => {
          reject(error);
        });
        
        pdfParser.loadPDF(filePath);
      });
      
      // Convert each page to a section
      return data.Pages.map((page, index) => ({
        text: page.Texts.map(text => decodeURIComponent(text.R[0].T)).join(' '),
        pageNumber: index + 1
      }));
    } catch (error) {
      console.error('PDFParser: Error extracting pages:', error);
      throw new Error(`Failed to extract pages: ${error.message}`);
    }
  }

  static async extractSection(filePath, startPage, endPage) {
    try {
      const pages = await this.extractPages(filePath);
      return pages
        .filter(page => page.pageNumber >= startPage && page.pageNumber <= endPage)
        .map(page => page.text)
        .join('\n\n');
    } catch (error) {
      console.error('PDFParser: Error extracting section:', error);
      throw new Error(`Failed to extract section: ${error.message}`);
    }
  }
}

module.exports = PDFParser; 
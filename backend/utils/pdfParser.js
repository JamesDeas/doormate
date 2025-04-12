const fs = require('fs').promises;
const PDF2JSON = require('pdf2json');
const path = require('path');

class PDFParser {
  static async extractText(filePath) {
    try {
      console.log('PDFParser: Starting extraction for:', filePath);
      
      // Normalize path
      const normalizedPath = path.resolve(filePath);
      console.log('PDFParser: Normalized path:', normalizedPath);
      
      // First check if file exists
      try {
        const stats = await fs.stat(normalizedPath);
        console.log('PDFParser: File stats:', {
          size: stats.size,
          isFile: stats.isFile(),
          path: normalizedPath
        });
        
        if (!stats.isFile()) {
          throw new Error('Path exists but is not a file');
        }
      } catch (error) {
        console.error('PDFParser: File access error:', {
          error: error.message,
          path: normalizedPath
        });
        throw new Error(`File access error: ${error.message}`);
      }
      
      const pdfParser = new PDF2JSON();
      
      // Configure parser
      pdfParser.on('pdfParser_onError', 
        errData => console.error('PDFParser: Error event:', errData.parserError)
      );
      pdfParser.on('pdfParser_onProgress', 
        progress => console.log('PDFParser: Progress:', progress)
      );
      
      const data = await new Promise((resolve, reject) => {
        pdfParser.on('pdfParser_dataReady', (pdfData) => {
          console.log('PDFParser: Data ready event received');
          
          if (!pdfData || !pdfData.Pages || !Array.isArray(pdfData.Pages)) {
            console.error('PDFParser: Invalid PDF data structure:', {
              hasData: !!pdfData,
              hasPages: pdfData && !!pdfData.Pages,
              isArray: pdfData && pdfData.Pages && Array.isArray(pdfData.Pages)
            });
            reject(new Error('Invalid PDF data structure'));
            return;
          }
          
          console.log('PDFParser: Valid PDF structure detected:', {
            pages: pdfData.Pages.length,
            hasContent: pdfData.Pages.some(p => p.Texts && p.Texts.length > 0)
          });
          
          resolve(pdfData);
        });
        
        pdfParser.on('pdfParser_dataError', (error) => {
          console.error('PDFParser: Data error event:', error);
          reject(error);
        });
        
        try {
          console.log('PDFParser: Attempting to load PDF:', normalizedPath);
          pdfParser.loadPDF(normalizedPath);
        } catch (error) {
          console.error('PDFParser: Load error:', {
            error: error.message,
            stack: error.stack
          });
          reject(error);
        }
      });
      
      // Convert all pages to text with better error handling
      const textByPage = data.Pages.map((page, pageIndex) => {
        if (!page.Texts) {
          console.warn(`PDFParser: No texts found on page ${pageIndex + 1}`);
          return '';
        }
        
        const pageTexts = page.Texts.map(text => {
          try {
            if (!text.R || !text.R[0] || !text.R[0].T) {
              console.warn(`PDFParser: Invalid text structure on page ${pageIndex + 1}:`, text);
              return '';
            }
            const decoded = decodeURIComponent(text.R[0].T);
            return decoded;
          } catch (error) {
            console.error(`PDFParser: Text decode error on page ${pageIndex + 1}:`, {
              error: error.message,
              text: text
            });
            return '';
          }
        });
        
        console.log(`PDFParser: Extracted ${pageTexts.length} text elements from page ${pageIndex + 1}`);
        return pageTexts.join(' ');
      });
      
      const text = textByPage.join('\n\n');
      
      console.log('PDFParser: Extraction complete:', {
        totalLength: text.length,
        pageCount: data.Pages.length,
        nonEmptyPages: textByPage.filter(p => p.trim().length > 0).length
      });
      
      if (!text.trim()) {
        console.warn('PDFParser: No text content extracted from PDF');
      }
      
      return {
        text,
        numPages: data.Pages.length,
        info: data.Meta || {},
        metadata: data.Metadata || {},
        version: '1.0'
      };
    } catch (error) {
      console.error('PDFParser: Fatal error:', {
        error: error.message,
        stack: error.stack,
        filePath: filePath
      });
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
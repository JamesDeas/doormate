const fs = require('fs').promises;
const pdf = require('pdf-parse');

class PDFParser {
  static async extractText(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);
      
      return {
        text: data.text,
        numPages: data.numpages,
        info: data.info,
        metadata: data.metadata,
        version: data.version
      };
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }

  static async extractPages(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);
      
      // Split text into pages (basic implementation)
      const pages = data.text.split(/\f/);
      
      return pages.map((pageText, index) => ({
        pageNumber: index + 1,
        text: pageText.trim(),
      }));
    } catch (error) {
      console.error('Error extracting PDF pages:', error);
      throw new Error(`Failed to extract PDF pages: ${error.message}`);
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
      console.error('Error extracting PDF section:', error);
      throw new Error(`Failed to extract PDF section: ${error.message}`);
    }
  }
}

module.exports = PDFParser; 
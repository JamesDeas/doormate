const fs = require('fs').promises;
const path = require('path');
const PDFParser = require('pdf2json');

async function testPdfParsing() {
  try {
    const filePath = path.join(__dirname, '../public/manuals/hs100-install.pdf');
    console.log('Reading file:', filePath);
    
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    console.log('File exists:', exists);
    
    if (!exists) {
      console.error('File does not exist');
      return;
    }
    
    const pdfParser = new PDFParser();
    
    const data = await new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        resolve(pdfData);
      });
      
      pdfParser.on('pdfParser_dataError', (error) => {
        reject(error);
      });
      
      pdfParser.loadPDF(filePath);
    });
    
    console.log('PDF Info:', {
      pages: data.Pages.length,
      formImage: data.formImage
    });
    
    // Convert the first page text
    const text = data.Pages[0].Texts.map(text => 
      decodeURIComponent(text.R[0].T)
    ).join(' ');
    
    console.log('\nText content:\n', text);
  } catch (error) {
    console.error('Error:', error);
  }
}

testPdfParsing(); 
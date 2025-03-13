const fs = require('fs');
const path = require('path');
const { createProductEntry, productTemplate } = require('./dataCollection');

// Function to create a CSV template for manual data entry
function createCsvTemplate(type) {
  const template = productTemplate[type];
  if (!template) {
    throw new Error(`Invalid product type: ${type}`);
  }

  const headers = [...template.required, ...template.optional].join(',');
  const csvContent = `${headers}\n`;
  
  const templatePath = path.join(__dirname, `../templates/${type}-template.csv`);
  fs.writeFileSync(templatePath, csvContent);
  
  return templatePath;
}

// Function to process a manually filled CSV file
async function processCsvFile(filePath, type) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n');
  const headers = lines[0].split(',');
  
  const products = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = lines[i].split(',');
    const product = {};
    
    headers.forEach((header, index) => {
      product[header.trim()] = values[index]?.trim();
    });
    
    try {
      const processedProduct = await createProductEntry(product, type);
      products.push(processedProduct);
    } catch (error) {
      console.error(`Error processing row ${i}: ${error.message}`);
    }
  }
  
  return products;
}

// Function to create a manual entry form template
function createFormTemplate(type) {
  const template = productTemplate[type];
  if (!template) {
    throw new Error(`Invalid product type: ${type}`);
  }

  const formTemplate = {
    type,
    required: template.required.map(field => ({
      name: field,
      type: getFieldType(field),
      required: true
    })),
    optional: template.optional.map(field => ({
      name: field,
      type: getFieldType(field),
      required: false
    }))
  };

  const templatePath = path.join(__dirname, `../templates/${type}-form.json`);
  fs.writeFileSync(templatePath, JSON.stringify(formTemplate, null, 2));
  
  return templatePath;
}

// Helper function to determine field type
function getFieldType(field) {
  if (field.includes('date') || field.includes('Updated')) return 'date';
  if (field.includes('dimensions') || field.includes('specifications')) return 'object';
  if (field.includes('features') || field.includes('materials')) return 'array';
  if (field.includes('description')) return 'text';
  if (field.includes('url')) return 'url';
  return 'string';
}

// Function to process manual PDF uploads
async function processManualUpload(pdfPath, productData) {
  const filename = path.basename(pdfPath);
  const targetPath = path.join(__dirname, '../public/manuals', filename);
  
  // Copy PDF to manuals directory
  fs.copyFileSync(pdfPath, targetPath);
  
  // Update manual URL in product data
  if (productData.manuals) {
    productData.manuals = productData.manuals.map(manual => ({
      ...manual,
      url: `http://localhost:5001/manuals/${filename}`
    }));
  }
  
  return productData;
}

// Example usage:
/*
// Create templates
createCsvTemplate('door');
createFormTemplate('door');

// Process a CSV file
processCsvFile('path/to/filled/template.csv', 'door')
  .then(products => {
    console.log(`Processed ${products.length} products`);
  })
  .catch(error => console.error('Error:', error));

// Process manual upload
const productData = {
  name: 'Example Door',
  // ... other fields ...
  manuals: [
    {
      title: 'Installation Guide',
      type: 'installation',
      language: 'English',
      version: '1.0'
    }
  ]
};

processManualUpload('path/to/manual.pdf', productData)
  .then(updatedProduct => {
    console.log('Product updated with manual:', updatedProduct);
  })
  .catch(error => console.error('Error:', error));
*/

module.exports = {
  createCsvTemplate,
  processCsvFile,
  createFormTemplate,
  processManualUpload
}; 
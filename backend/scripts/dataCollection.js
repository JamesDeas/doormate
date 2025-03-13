const fs = require('fs');
const path = require('path');
const axios = require('axios');
const PDFDocument = require('pdfkit');

// Template for collecting product data
const productTemplate = {
  door: {
    required: [
      'name',
      'model',
      'sku',
      'brand',
      'category',
      'description',
      'doorType',
      'operationType',
      'materials',
      'safetyFeatures',
      'maxDimensions',
      'specifications'
    ],
    optional: [
      'images',
      'features',
      'applications',
      'warranty'
    ]
  },
  gate: {
    required: [
      'name',
      'model',
      'sku',
      'brand',
      'category',
      'description',
      'gateType',
      'operationType',
      'materials',
      'safetyFeatures',
      'maxDimensions',
      'specifications'
    ],
    optional: [
      'images',
      'features',
      'applications',
      'warranty'
    ]
  },
  motor: {
    required: [
      'name',
      'model',
      'sku',
      'brand',
      'category',
      'description',
      'motorType',
      'powerSupply',
      'powerRating',
      'torque',
      'specifications'
    ],
    optional: [
      'images',
      'features',
      'applications',
      'warranty'
    ]
  },
  controlSystem: {
    required: [
      'name',
      'model',
      'sku',
      'brand',
      'category',
      'description',
      'systemType',
      'compatibility',
      'connectivity',
      'specifications'
    ],
    optional: [
      'images',
      'features',
      'applications',
      'warranty'
    ]
  }
};

// Function to validate product data against template
function validateProductData(data, type) {
  const template = productTemplate[type];
  if (!template) {
    throw new Error(`Invalid product type: ${type}`);
  }

  const missing = template.required.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  return true;
}

// Function to download and save manual PDFs
async function downloadManual(url, filename) {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(
      path.join(__dirname, '../public/manuals', filename)
    );

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Error downloading manual: ${error.message}`);
    throw error;
  }
}

// Function to create a structured product entry
async function createProductEntry(data, type) {
  try {
    // Validate the data
    validateProductData(data, type);

    // Process manuals if they exist
    if (data.manuals && Array.isArray(data.manuals)) {
      for (const manual of data.manuals) {
        if (manual.url && manual.url.startsWith('http')) {
          const filename = `${data.model.toLowerCase()}-${manual.type}.pdf`;
          await downloadManual(manual.url, filename);
          // Update the manual URL to point to our local server
          manual.url = `http://localhost:5001/manuals/${filename}`;
        }
      }
    }

    return data;
  } catch (error) {
    console.error(`Error creating product entry: ${error.message}`);
    throw error;
  }
}

// Example usage:
/*
const exampleDoor = {
  name: 'High-Speed Door Example',
  model: 'HS200',
  sku: 'HS200-001',
  brand: {
    name: 'Example Brand',
    website: 'https://example.com'
  },
  category: 'High-Speed Doors',
  description: 'Example high-speed door description',
  doorType: 'high-speed',
  operationType: 'automatic',
  materials: ['PVC', 'Aluminum'],
  safetyFeatures: ['Light Curtain', 'Safety Edge'],
  maxDimensions: {
    height: 5000,
    width: 5000,
    unit: 'mm'
  },
  specifications: [
    { key: 'Opening Speed', value: 2.0, unit: 'm/s' }
  ],
  manuals: [
    {
      title: 'Installation Manual',
      url: 'https://example.com/manuals/hs200-install.pdf',
      type: 'installation',
      language: 'English',
      version: '1.0',
      lastUpdated: new Date(),
      fileSize: 2500000
    }
  ]
};

createProductEntry(exampleDoor, 'door')
  .then(product => console.log('Product created:', product))
  .catch(error => console.error('Error:', error));
*/

module.exports = {
  createProductEntry,
  validateProductData,
  downloadManual,
  productTemplate
}; 
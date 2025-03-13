require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Door, Gate, Motor, ControlSystem } = require('../models/Product');

const MANUAL_DIR = path.join(__dirname, '../public/manuals');

// Ensure manual directory exists
if (!fs.existsSync(MANUAL_DIR)) {
  fs.mkdirSync(MANUAL_DIR, { recursive: true });
}

// Example template for manual data entry
const productTemplates = {
  door: {
    name: 'Product Name',
    model: 'Model Number',
    sku: 'SKU-NUMBER',
    brand: {
      id: 'brand-id',
      name: 'Brand Name',
      website: 'https://brand-website.com',
      description: 'Brand description'
    },
    category: 'High-Speed Doors', // One of the predefined categories
    description: 'Detailed product description',
    doorType: 'high-speed', // high-speed, personnel, sectional, roller, fire, other
    operationType: 'automatic', // manual, automatic, semi-automatic
    materials: ['Material 1', 'Material 2'],
    safetyFeatures: ['Safety Feature 1', 'Safety Feature 2'],
    specifications: [
      { key: 'Opening Speed', value: 1.2, unit: 'm/s' },
      { key: 'Max Width', value: 6000, unit: 'mm' }
    ],
    dimensions: {
      height: 3000,
      width: 3000,
      unit: 'mm'
    },
    images: {
      main: 'main-image-url',
      gallery: ['gallery-image-1-url', 'gallery-image-2-url']
    },
    manuals: [
      {
        title: 'Installation Manual',
        url: '/manuals/product-installation.pdf',
        type: 'installation',
        language: 'English',
        version: '1.0',
        lastUpdated: new Date(),
        fileSize: 1024 // in bytes
      }
    ]
  }
  // Add templates for gates, motors, and control systems as needed
};

// Function to validate manual data
function validateProduct(data, type) {
  const requiredFields = {
    door: ['name', 'model', 'sku', 'brand', 'category', 'description', 'doorType', 'operationType'],
    gate: ['name', 'model', 'sku', 'brand', 'category', 'description', 'gateType', 'operationType'],
    motor: ['name', 'model', 'sku', 'brand', 'category', 'description', 'motorType', 'powerSupply'],
    controlSystem: ['name', 'model', 'sku', 'brand', 'category', 'description', 'systemType']
  };

  const missing = requiredFields[type].filter(field => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  return true;
}

// Function to save manual to the manuals directory
async function saveManual(file, productModel, type) {
  const filename = `${productModel.toLowerCase()}-${type}-${path.basename(file)}`;
  const destPath = path.join(MANUAL_DIR, filename);
  
  await fs.promises.copyFile(file, destPath);
  const stats = await fs.promises.stat(destPath);
  
  return {
    url: `/manuals/${filename}`,
    fileSize: stats.size
  };
}

// Function to save product to database
async function saveProduct(data, type) {
  try {
    validateProduct(data, type);
    
    let Model;
    switch (type) {
      case 'door':
        Model = Door;
        break;
      case 'gate':
        Model = Gate;
        break;
      case 'motor':
        Model = Motor;
        break;
      case 'controlSystem':
        Model = ControlSystem;
        break;
      default:
        throw new Error(`Invalid product type: ${type}`);
    }

    const product = await Model.findOneAndUpdate(
      { sku: data.sku },
      { ...data, metadata: { createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true, new: true }
    );

    console.log(`Saved ${type}: ${product.name}`);
    return product;
  } catch (error) {
    console.error(`Error saving ${type}:`, error);
    throw error;
  }
}

// Example usage:
/*
const exampleDoor = {
  name: "D-311 Cleanroom",
  model: "D-311",
  sku: "DYNACO-D-311-CLEANROOM",
  brand: {
    id: "dynaco",
    name: "Dynaco",
    website: "https://www.dynacodoor.com",
    description: "Leading manufacturer of high-speed doors"
  },
  category: "High-Speed Doors",
  description: "The slimmest high-speed cleanroom roll-up door in the market.",
  doorType: "high-speed",
  operationType: "automatic",
  materials: ["PVC", "Stainless Steel"],
  safetyFeatures: ["Light Curtain", "Wireless Safety Edge"],
  specifications: [
    { key: "Opening Speed", value: 2.4, unit: "m/s" },
    { key: "Max Width", value: 4000, unit: "mm" }
  ]
};

saveProduct(exampleDoor, 'door')
  .then(console.log)
  .catch(console.error);
*/

module.exports = {
  saveProduct,
  saveManual,
  validateProduct,
  productTemplates
}; 
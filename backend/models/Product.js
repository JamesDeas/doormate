const mongoose = require('mongoose');

const specificationSchema = new mongoose.Schema({
  key: { type: String, required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  unit: String
});

const manualSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  type: {
    type: String,
    enum: ['installation', 'user', 'maintenance', 'technical'],
    required: true
  },
  language: { type: String, required: true },
  version: { type: String, required: true },
  lastUpdated: { type: Date, required: true },
  fileSize: { type: Number, required: true } // in bytes
});

const brandSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  logo: String,
  website: String
});

const productSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    index: 'text'
  },
  model: { 
    type: String, 
    required: true,
    unique: true 
  },
  brand: {
    type: brandSchema,
    required: true
  },
  category: {
    type: String,
    enum: [
      'High-Speed Doors',
      'Personnel Doors',
      'Sectional Doors',
      'Fire Doors',
      'Gates',
      'Barriers',
      'Motors',
      'Control Systems',
      'Ironmongery'
    ],
    required: true,
    index: true
  },
  description: { 
    type: String, 
    required: true,
    index: 'text'
  },
  images: {
    main: { type: String, required: true },
    gallery: [String]
  },
  manuals: [manualSchema],
  specifications: [specificationSchema],
  features: [{
    type: String,
    index: 'text'
  }],
  applications: [{
    type: String,
    index: 'text'
  }]
}, {
  timestamps: true
});

// Create compound text index for search functionality
productSchema.index({
  title: 'text',
  description: 'text',
  features: 'text',
  applications: 'text'
});

const Product = mongoose.model('Product', productSchema);

module.exports = { Product }; 
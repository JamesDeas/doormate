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
  website: String,
  description: String
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  model: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
  brand: brandSchema,
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
    required: true
  },
  subCategory: String,
  description: { type: String, required: true },
  shortDescription: String,
  status: {
    type: String,
    enum: ['active', 'discontinued', 'coming_soon'],
    default: 'active'
  },
  specifications: [{
    key: String,
    value: String,
    unit: String
  }],
  manuals: [manualSchema],
  images: {
    main: String,
    gallery: [String]
  },
  features: [String],
  applications: [String],
  relatedProducts: [String],
  technicalDrawings: [String],
  certifications: [String],
  warranty: {
    duration: Number, // in months
    description: String
  },
  dimensions: {
    height: Number,
    width: Number,
    depth: Number,
    unit: {
      type: String,
      enum: ['mm', 'cm', 'm']
    }
  },
  weight: {
    value: Number,
    unit: {
      type: String,
      enum: ['kg', 'g']
    }
  },
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    searchKeywords: [String]
  }
}, {
  timestamps: true,
  discriminatorKey: 'productType'
});

// Create text index for search functionality
productSchema.index({
  name: 'text',
  description: 'text',
  shortDescription: 'text',
  'metadata.searchKeywords': 'text'
});

const Product = mongoose.model('Product', productSchema);

// Create discriminators for specific product types
const Door = Product.discriminator('Door', new mongoose.Schema({
  doorType: {
    type: String,
    required: true,
    enum: ['high-speed', 'personnel', 'sectional', 'roller', 'fire', 'other']
  },
  operationType: {
    type: String,
    required: true,
    enum: ['manual', 'automatic', 'semi-automatic']
  },
  materials: [String],
  safetyFeatures: [String],
  maxDimensions: {
    height: Number,
    width: Number,
    unit: {
      type: String,
      enum: ['mm', 'm']
    }
  },
  openingSpeed: Number,
  cyclesPerDay: Number,
  insulationValue: Number,
  windResistance: String
}));

const Gate = Product.discriminator('Gate', new mongoose.Schema({
  gateType: {
    type: String,
    required: true,
    enum: ['sliding', 'swing', 'telescopic', 'cantilever', 'bi-folding']
  },
  operationType: {
    type: String,
    required: true,
    enum: ['manual', 'automatic', 'semi-automatic']
  },
  materials: [String],
  safetyFeatures: [String],
  maxDimensions: {
    height: Number,
    width: Number,
    unit: {
      type: String,
      enum: ['mm', 'm']
    }
  },
  openingSpeed: Number,
  cyclesPerDay: Number,
  maxWeight: Number
}));

const Motor = Product.discriminator('Motor', new mongoose.Schema({
  motorType: {
    type: String,
    required: true,
    enum: ['sliding', 'swing', 'roller', 'sectional', 'barrier']
  },
  powerSupply: { type: String, required: true },
  powerRating: { type: Number, required: true },
  torque: { type: Number, required: true },
  speedRPM: { type: Number, required: true },
  dutyCycle: { type: String, required: true },
  ipRating: { type: String, required: true },
  temperatureRange: {
    min: Number,
    max: Number,
    unit: {
      type: String,
      enum: ['C', 'F']
    }
  },
  maxWeight: Number,
  maxWidth: Number
}));

const ControlSystem = Product.discriminator('ControlSystem', new mongoose.Schema({
  systemType: {
    type: String,
    required: true,
    enum: ['basic', 'advanced', 'smart']
  },
  compatibility: [String],
  connectivity: [String],
  inputVoltage: { type: String, required: true },
  outputVoltage: { type: String, required: true },
  ipRating: { type: String, required: true },
  interfaces: [String],
  programmingMethods: [String],
  safetyInputs: [String]
}));

module.exports = {
  Product,
  Door,
  Gate,
  Motor,
  ControlSystem
}; 
export type ProductCategory = 
  | 'High-Speed Doors'
  | 'Personnel Doors'
  | 'Sectional Doors'
  | 'Gates'
  | 'Barriers'
  | 'Control Systems'
  | 'Motors'
  | 'Ironmongery';

export type ProductStatus = 'active' | 'discontinued' | 'coming_soon';

export interface Specification {
  key: string;
  value: string | number;
  unit?: string;
}

export interface Manual {
  id: string;
  title: string;
  url: string;
  type: 'installation' | 'user' | 'maintenance' | 'technical';
  language: string;
  version: string;
  lastUpdated: string;
  fileSize: number; // in bytes
}

export interface Brand {
  id: string;
  name: string;
  logo?: string;
  website?: string;
  description?: string;
}

export interface Product {
  _id: string;
  id?: string; // Keep for backward compatibility
  name: string;
  model: string;
  sku: string;
  brandId: string;
  brand?: Brand; // For populated queries
  category: ProductCategory;
  subCategory?: string;
  description: string;
  shortDescription?: string;
  status: ProductStatus;
  specifications: Specification[];
  manuals: Manual[];
  images: {
    main: string;
    gallery: string[];
  };
  features: string[];
  applications: string[];
  relatedProducts?: string[]; // Array of product IDs
  technicalDrawings?: string[]; // URLs to technical drawings
  certifications?: string[]; // Product certifications
  warranty?: {
    duration: number; // in months
    description: string;
  };
  dimensions?: {
    height: number;
    width: number;
    depth: number;
    unit: 'mm' | 'cm' | 'm';
  };
  weight?: {
    value: number;
    unit: 'kg' | 'g';
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    searchKeywords: string[]; // For improved search functionality
  };
}

// Specific product type interfaces
export interface Door extends Product {
  doorType: 'high-speed' | 'personnel' | 'sectional' | 'roller' | 'fire' | 'other';
  operationType: 'manual' | 'automatic' | 'semi-automatic';
  materials: string[];
  safetyFeatures: string[];
  maxDimensions: {
    height: number;
    width: number;
    unit: 'mm' | 'm';
  };
  openingSpeed?: number; // in m/s
  cyclesPerDay?: number;
  insulationValue?: number; // U-value
  windResistance?: string; // Class rating
}

export interface Gate extends Product {
  gateType: 'sliding' | 'swing' | 'telescopic' | 'cantilever' | 'bi-folding';
  operationType: 'manual' | 'automatic' | 'semi-automatic';
  materials: string[];
  safetyFeatures: string[];
  maxDimensions: {
    height: number;
    width: number;
    unit: 'mm' | 'm';
  };
  openingSpeed?: number; // in m/s
  cyclesPerDay?: number;
  maxWeight?: number; // in kg
}

export interface Motor extends Product {
  motorType: 'sliding' | 'swing' | 'roller' | 'sectional' | 'barrier';
  powerSupply: string;
  powerRating: number; // in watts
  torque: number; // in Nm
  speedRPM: number;
  dutyCycle: string; // e.g., "40%"
  ipRating: string;
  temperatureRange: {
    min: number;
    max: number;
    unit: 'C' | 'F';
  };
  maxWeight?: number; // maximum door/gate weight in kg
  maxWidth?: number; // maximum door/gate width in m
}

export interface ControlSystem extends Product {
  systemType: 'basic' | 'advanced' | 'smart';
  compatibility: string[]; // Compatible motor types
  connectivity: string[]; // e.g., ["Bluetooth", "WiFi", "RS485"]
  inputVoltage: string;
  outputVoltage: string;
  ipRating: string;
  features: string[];
  interfaces: string[]; // e.g., ["LCD", "LED", "Touch Screen"]
  programmingMethods: string[];
  safetyInputs: string[];
} 
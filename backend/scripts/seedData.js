#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Door, Gate, Motor, ControlSystem } = require('../models/Product');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Door.deleteMany({});
    await Gate.deleteMany({});
    await Motor.deleteMany({});
    await ControlSystem.deleteMany({});

    // Create brands first
    const brands = {
      dynaco: new mongoose.Types.ObjectId(),
      came: new mongoose.Types.ObjectId(),
      nice: new mongoose.Types.ObjectId(),
      bft: new mongoose.Types.ObjectId()
    };

    // Seed Doors
    const door1 = await Door.create({
      name: 'High-Speed Roll-Up Door HS100',
      model: 'HS100',
      sku: 'HS100-001',
      brandId: brands.dynaco,
      brand: {
        id: brands.dynaco.toString(),
        name: 'Dynaco',
        website: 'https://www.dynacodoor.com'
      },
      category: 'High-Speed Doors',
      description: 'Advanced high-speed roll-up door designed for intensive use in industrial environments',
      shortDescription: 'Industrial high-speed door with advanced safety features',
      status: 'active',
      doorType: 'high-speed',
      operationType: 'automatic',
      materials: ['PVC', 'Aluminum'],
      safetyFeatures: ['Light Curtain', 'Safety Edge', 'Emergency Stop'],
      maxDimensions: {
        height: 5000,
        width: 5000,
        unit: 'mm'
      },
      openingSpeed: 2.5,
      cyclesPerDay: 1000,
      insulationValue: 2.3,
      windResistance: 'Class 4',
      specifications: [
        { key: 'Max Opening Speed', value: 2.5, unit: 'm/s' },
        { key: 'Max Closing Speed', value: 0.5, unit: 'm/s' },
        { key: 'Wind Resistance', value: 'Class 4' }
      ],
      features: [
        'Self-reinserting curtain',
        'Frequency inverter operation',
        'Soft start/stop'
      ],
      applications: [
        'Manufacturing facilities',
        'Warehouses',
        'Cold storage'
      ],
      manuals: [
        {
          title: "Installation Manual",
          url: "http://192.168.0.158:5001/manuals/hs100-install.pdf",
          type: "installation",
          language: "English",
          version: "1.0",
          lastUpdated: new Date("2024-01-15"),
          fileSize: 2500000
        },
        {
          title: "User Guide",
          url: "http://192.168.0.158:5001/manuals/hs100-user.pdf",
          type: "user",
          language: "English",
          version: "1.1",
          lastUpdated: new Date("2024-02-01"),
          fileSize: 1800000
        },
        {
          title: "Maintenance Guide",
          url: "https://example.com/manuals/hs100-maintenance.pdf",
          type: "maintenance",
          language: "English",
          version: "1.0",
          lastUpdated: new Date("2024-01-20"),
          fileSize: 1500000
        }
      ],
      metadata: {
        searchKeywords: ['high-speed door', 'roll-up door', 'industrial door', 'rapid door']
      }
    });

    // Seed Gates
    const gate1 = await Gate.create({
      name: 'Sliding Gate SG200',
      model: 'SG200',
      sku: 'SG200-001',
      brandId: brands.came,
      brand: {
        id: brands.came.toString(),
        name: 'CAME',
        website: 'https://www.came.com'
      },
      category: 'Gates',
      description: 'Heavy-duty sliding gate for industrial and commercial applications',
      shortDescription: 'Industrial sliding gate with advanced security features',
      status: 'active',
      gateType: 'sliding',
      operationType: 'automatic',
      materials: ['Steel', 'Aluminum'],
      safetyFeatures: ['Photocells', 'Safety Edges', 'Warning Light'],
      maxDimensions: {
        height: 2500,
        width: 12000,
        unit: 'mm'
      },
      openingSpeed: 0.3,
      cyclesPerDay: 500,
      maxWeight: 2000,
      specifications: [
        { key: 'Max Gate Weight', value: 2000, unit: 'kg' },
        { key: 'Opening Speed', value: 0.3, unit: 'm/s' }
      ],
      features: [
        'Anti-crushing system',
        'Manual release mechanism',
        'Integrated control panel'
      ],
      applications: [
        'Industrial sites',
        'Commercial properties',
        'Logistics centers'
      ],
      manuals: [
        {
          title: "Installation Manual",
          url: "https://example.com/manuals/sg200-install.pdf",
          type: "installation",
          language: "English",
          version: "1.0",
          lastUpdated: new Date("2024-01-10"),
          fileSize: 3200000
        },
        {
          title: "User Guide",
          url: "https://example.com/manuals/sg200-user.pdf",
          type: "user",
          language: "English",
          version: "1.0",
          lastUpdated: new Date("2024-01-10"),
          fileSize: 1500000
        }
      ],
      metadata: {
        searchKeywords: ['sliding gate', 'industrial gate', 'automatic gate']
      }
    });

    // Seed Motors
    const motor1 = await Motor.create({
      name: 'Industrial Door Motor M300',
      model: 'M300',
      sku: 'M300-001',
      brandId: brands.nice,
      brand: {
        id: brands.nice.toString(),
        name: 'Nice',
        website: 'https://www.niceforyou.com'
      },
      category: 'Motors',
      description: 'Powerful motor for industrial sectional doors and rolling shutters',
      shortDescription: 'Industrial door motor with advanced control features',
      status: 'active',
      motorType: 'sectional',
      powerSupply: '230V AC',
      powerRating: 750,
      torque: 70,
      speedRPM: 24,
      dutyCycle: '60%',
      ipRating: 'IP54',
      temperatureRange: {
        min: -20,
        max: 55,
        unit: 'C'
      },
      maxWeight: 400,
      specifications: [
        { key: 'Power Rating', value: 750, unit: 'W' },
        { key: 'Torque', value: 70, unit: 'Nm' }
      ],
      features: [
        'Integrated limit switches',
        'Thermal protection',
        'Emergency manual operation'
      ],
      applications: [
        'Sectional doors',
        'Rolling shutters',
        'Industrial doors'
      ],
      manuals: [
        {
          title: "Installation & Programming Guide",
          url: "https://example.com/manuals/m300-install.pdf",
          type: "installation",
          language: "English",
          version: "2.1",
          lastUpdated: new Date("2024-02-15"),
          fileSize: 4200000
        },
        {
          title: "Technical Manual",
          url: "https://example.com/manuals/m300-technical.pdf",
          type: "technical",
          language: "English",
          version: "2.0",
          lastUpdated: new Date("2024-02-01"),
          fileSize: 5500000
        }
      ],
      metadata: {
        searchKeywords: ['door motor', 'industrial motor', 'sectional door operator']
      }
    });

    // Seed Control Systems
    const controlSystem1 = await ControlSystem.create({
      name: 'Smart Door Controller CS100',
      model: 'CS100',
      sku: 'CS100-001',
      brandId: brands.bft,
      brand: {
        id: brands.bft.toString(),
        name: 'BFT',
        website: 'https://www.bft-automation.com'
      },
      category: 'Control Systems',
      description: 'Advanced control system for industrial doors and gates',
      shortDescription: 'Smart controller with mobile connectivity',
      status: 'active',
      systemType: 'smart',
      compatibility: ['Sectional Doors', 'Rolling Shutters', 'High-Speed Doors'],
      connectivity: ['Bluetooth', 'WiFi', 'RS485'],
      inputVoltage: '230V AC',
      outputVoltage: '24V DC',
      ipRating: 'IP65',
      interfaces: ['LCD Display', 'Mobile App'],
      programmingMethods: ['Mobile App', 'Manual Programming', 'PC Software'],
      safetyInputs: ['Photocells', 'Safety Edge', 'Emergency Stop'],
      specifications: [
        { key: 'Input Voltage', value: '230V AC' },
        { key: 'Output Voltage', value: '24V DC' }
      ],
      features: [
        'Mobile app control',
        'Remote diagnostics',
        'Usage statistics'
      ],
      applications: [
        'Industrial doors',
        'Commercial gates',
        'Access control systems'
      ],
      manuals: [
        {
          title: "Installation & Setup Guide",
          url: "https://example.com/manuals/cs100-install.pdf",
          type: "installation",
          language: "English",
          version: "1.2",
          lastUpdated: new Date("2024-02-20"),
          fileSize: 3800000
        },
        {
          title: "User Manual",
          url: "https://example.com/manuals/cs100-user.pdf",
          type: "user",
          language: "English",
          version: "1.1",
          lastUpdated: new Date("2024-02-15"),
          fileSize: 2200000
        },
        {
          title: "Programming Reference",
          url: "https://example.com/manuals/cs100-programming.pdf",
          type: "technical",
          language: "English",
          version: "1.0",
          lastUpdated: new Date("2024-02-01"),
          fileSize: 1800000
        }
      ],
      metadata: {
        searchKeywords: ['door controller', 'smart controller', 'gate control system']
      }
    });

    console.log('Data seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData(); 
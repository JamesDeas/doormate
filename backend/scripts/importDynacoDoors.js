const mongoose = require('mongoose');
const { DynacoDoor } = require('../models/Product');
const doorData = require('../data/dynacoDoors.json');
require('../database');

// Base template for all Dynaco doors
const dynacoTemplate = {
  productType: 'DynacoDoor',
  brand: {
    id: 'dynaco',
    name: 'Dynaco',
    website: 'https://www.dynacodoor.com'
  },
  category: 'High-Speed Doors',
  doorType: 'high-speed',
  operationType: 'automatic',
  technology: 'Gravity',
  structure: {
    material: 'Galvanised steel'
  },
  curtain: {
    type: 'Flexible',
    selfReinserting: true,
    material: 'Reinforced PVC'
  },
  safetyFeatures: [
    'Light curtain',
    'Safety edge',
    'Flexible curtain without rigid elements',
    'Self-reinserting curtain'
  ],
  certifications: ['EN13241-1', 'EN 12424'],
  status: 'active'
};

// Helper function to create a door with template
const createDoor = (doorData) => {
  return {
    ...dynacoTemplate,
    ...doorData,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      searchKeywords: [
        doorData.name,
        doorData.model,
        doorData.sku,
        dynacoTemplate.brand.name,
        dynacoTemplate.category,
        ...(doorData.features || []),
        ...(doorData.applications || [])
      ].filter(Boolean)
    }
  };
};

// Function to import doors
async function importDoors() {
  try {
    console.log('Starting Dynaco doors import...');
    
    // Clear existing Dynaco doors
    await DynacoDoor.deleteMany({});
    console.log('Cleared existing Dynaco doors');

    // Import all doors from JSON file
    const dynacoDoors = doorData.map(door => createDoor(door));
    
    // Import all doors
    const results = await Promise.all(
      dynacoDoors.map(async (door) => {
        try {
          const newDoor = new DynacoDoor(door);
          await newDoor.save();
          return { success: true, model: door.model };
        } catch (error) {
          return { 
            success: false, 
            model: door.model, 
            error: error.message 
          };
        }
      })
    );

    // Log results
    console.log('\nImport Results:');
    results.forEach(result => {
      if (result.success) {
        console.log(`✓ ${result.model} imported successfully`);
      } else {
        console.error(`✗ ${result.model} failed: ${result.error}`);
      }
    });

    const successful = results.filter(r => r.success).length;
    console.log(`\nImport completed: ${successful}/${results.length} doors imported successfully`);

  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    mongoose.disconnect();
  }
}

// Run the import
importDoors(); 
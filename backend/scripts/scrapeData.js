const axios = require('axios');
const cheerio = require('cheerio');
const { createProductEntry } = require('./dataCollection');

// List of manufacturer websites and their data structures
const manufacturers = {
  dynaco: {
    baseUrl: 'https://www.dynacodoor.com',
    productListPath: '/products',
    selectors: {
      productName: '.product-name',
      description: '.product-description',
      specifications: '.specifications',
      manualLinks: '.manual-downloads a'
    }
  },
  came: {
    baseUrl: 'https://www.came.com',
    productListPath: '/products',
    selectors: {
      productName: '.product-name',
      description: '.product-description',
      specifications: '.specifications',
      manualLinks: '.manual-downloads a'
    }
  }
  // Add more manufacturers as needed
};

async function scrapeProductPage(url, manufacturer) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const selectors = manufacturers[manufacturer].selectors;

    // Extract product data using selectors
    const productData = {
      name: $(selectors.productName).text().trim(),
      description: $(selectors.description).text().trim(),
      specifications: [],
      manuals: []
    };

    // Extract specifications
    $(selectors.specifications).each((i, el) => {
      const spec = {
        key: $(el).find('.spec-key').text().trim(),
        value: $(el).find('.spec-value').text().trim()
      };
      productData.specifications.push(spec);
    });

    // Extract manual links
    $(selectors.manualLinks).each((i, el) => {
      const manual = {
        title: $(el).text().trim(),
        url: $(el).attr('href'),
        type: determineManualType($(el).text()),
        language: 'English', // Default, can be determined from URL or text
        version: '1.0', // Default, can be extracted from filename or text
        lastUpdated: new Date(),
        fileSize: 0 // Will be updated when downloading
      };
      productData.manuals.push(manual);
    });

    return productData;
  } catch (error) {
    console.error(`Error scraping product page: ${error.message}`);
    throw error;
  }
}

function determineManualType(title) {
  title = title.toLowerCase();
  if (title.includes('install')) return 'installation';
  if (title.includes('user')) return 'user';
  if (title.includes('maintenance')) return 'maintenance';
  if (title.includes('technical')) return 'technical';
  return 'user'; // default type
}

async function scrapeManufacturerProducts(manufacturer) {
  try {
    const config = manufacturers[manufacturer];
    if (!config) {
      throw new Error(`Manufacturer ${manufacturer} not configured`);
    }

    const productListUrl = `${config.baseUrl}${config.productListPath}`;
    const response = await axios.get(productListUrl);
    const $ = cheerio.load(response.data);

    // Extract product links and scrape each product
    const productLinks = $('.product-link').map((i, el) => $(el).attr('href')).get();
    
    const products = [];
    for (const link of productLinks) {
      const productData = await scrapeProductPage(link, manufacturer);
      products.push(productData);
    }

    return products;
  } catch (error) {
    console.error(`Error scraping manufacturer products: ${error.message}`);
    throw error;
  }
}

// Example usage:
/*
scrapeManufacturerProducts('dynaco')
  .then(products => {
    products.forEach(async (product) => {
      try {
        const processedProduct = await createProductEntry(product, 'door');
        console.log(`Processed product: ${processedProduct.name}`);
      } catch (error) {
        console.error(`Error processing product: ${error.message}`);
      }
    });
  })
  .catch(error => console.error('Error:', error));
*/

module.exports = {
  scrapeManufacturerProducts,
  scrapeProductPage,
  manufacturers
}; 
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Door } = require('../models/Product');
const mongoose = require('mongoose');
require('dotenv').config();

const DYNACO_BASE_URL = 'https://www.dynacodoor.us';  // Using US website
const DOWNLOAD_DIR = path.join(__dirname, '../public/manuals');
const BRAND_ID = new mongoose.Types.ObjectId(); // Generate a unique ID for Dynaco brand

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

async function downloadPDF(url, filename) {
  try {
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const writer = fs.createWriteStream(path.join(DOWNLOAD_DIR, filename));
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Error downloading PDF ${url}:`, error.message);
    throw error;
  }
}

async function scrapeDynacoProducts() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Enable console logging from the page
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // Set viewport to ensure consistent rendering
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Navigating to products page...');
    // Navigate to products page
    await page.goto(`${DYNACO_BASE_URL}/products`, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    console.log('Getting product links...');
    // Get all product links with debug logging
    const productLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/products/"]'))
        .map(link => link.href)
        .filter(href => 
          href.includes('/products/') && 
          !href.endsWith('/products/') &&
          !href.includes('category')
        );
      
      return [...new Set(links)]; // Remove duplicates
    });

    console.log(`Found ${productLinks.length} product links:`, productLinks);

    const products = [];

    // Process each product
    for (const link of productLinks) {
      try {
        console.log(`Processing product at ${link}`);
        await page.goto(link, { 
          waitUntil: 'networkidle0',
          timeout: 60000
        });

        const productData = await page.evaluate(() => {
          function getTextContent(selector) {
            const element = document.querySelector(selector);
            return element ? element.textContent.trim() : '';
          }

          function getListItems(selector) {
            const items = document.querySelectorAll(selector);
            return Array.from(items).map(item => item.textContent.trim()).filter(Boolean);
          }

          // Get specifications
          const specifications = [];
          document.querySelectorAll('table tr').forEach(row => {
            const key = row.querySelector('th, td:first-child')?.textContent.trim();
            const value = row.querySelector('td:last-child')?.textContent.trim();
            if (key && value) {
              // Try to parse numeric values and units
              const numericMatch = value.match(/^([\d.]+)\s*([a-zA-Z/]+)?$/);
              if (numericMatch) {
                specifications.push({
                  key,
                  value: parseFloat(numericMatch[1]),
                  unit: numericMatch[2] || ''
                });
              } else {
                specifications.push({ key, value });
              }
            }
          });

          // Get manual links
          const manuals = Array.from(document.querySelectorAll('a[href$=".pdf"]')).map(link => ({
            title: link.textContent.trim() || 'Product Manual',
            url: link.href,
            type: link.href.toLowerCase().includes('install') ? 'installation' : 
                  link.href.toLowerCase().includes('user') ? 'user' : 
                  link.href.toLowerCase().includes('maintenance') ? 'maintenance' : 'technical',
            language: 'English',
            version: '1.0',
            lastUpdated: new Date().toISOString(),
            fileSize: 0
          }));

          // Extract dimensions if available
          const dimensionsText = getTextContent('.dimensions, .specifications');
          const dimensions = {
            height: null,
            width: null,
            unit: 'mm'
          };

          const heightMatch = dimensionsText.match(/height[:\s]+(\d+)/i);
          const widthMatch = dimensionsText.match(/width[:\s]+(\d+)/i);
          if (heightMatch) dimensions.height = parseInt(heightMatch[1]);
          if (widthMatch) dimensions.width = parseInt(widthMatch[1]);

          return {
            name: getTextContent('h1, .product-title') || 'Unknown Product',
            model: getTextContent('.model, .reference') || 'Unknown Model',
            description: getTextContent('.description, .content p'),
            shortDescription: getTextContent('.short-description, .summary'),
            specifications,
            manuals,
            features: getListItems('.features li, .benefits li'),
            applications: getListItems('.applications li, .uses li'),
            materials: getListItems('.materials li, .construction li'),
            safetyFeatures: getListItems('.safety li, .safety-features li'),
            dimensions,
            images: {
              main: document.querySelector('.product-image img, .main-image img')?.src || '',
              gallery: Array.from(document.querySelectorAll('.gallery img')).map(img => img.src)
            }
          };
        });

        // Generate SKU
        productData.sku = `DYN-${productData.model.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;

        // Download manuals
        for (const manual of productData.manuals) {
          try {
            const filename = `dynaco-${productData.model.toLowerCase()}-${manual.type}.pdf`;
            console.log(`Downloading manual: ${manual.url} as ${filename}`);
            await downloadPDF(manual.url, filename);
            
            // Update manual URL to point to local server
            manual.url = `/manuals/${filename}`;
            
            // Get file size
            const stats = fs.statSync(path.join(DOWNLOAD_DIR, filename));
            manual.fileSize = stats.size;
          } catch (error) {
            console.error(`Error downloading manual: ${error.message}`);
            continue;
          }
        }

        // Create MongoDB document
        const doorProduct = new Door({
          ...productData,
          brandId: BRAND_ID,
          brand: {
            id: BRAND_ID.toString(),
            name: 'Dynaco',
            website: DYNACO_BASE_URL,
            description: 'Dynaco is a leading manufacturer of high-speed doors'
          },
          category: 'High-Speed Doors',
          subCategory: 'Industrial',
          status: 'active',
          doorType: 'high-speed',
          operationType: 'automatic',
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            searchKeywords: [
              productData.name,
              productData.model,
              'Dynaco',
              'High-Speed Door',
              ...productData.features,
              ...productData.applications
            ]
          }
        });

        products.push(doorProduct);
        console.log(`Processed: ${productData.name}`);
      } catch (error) {
        console.error(`Error processing product ${link}:`, error.message);
      }
    }

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Save products to database
    for (const product of products) {
      try {
        await product.save();
        console.log(`Saved product: ${product.name}`);
      } catch (error) {
        console.error(`Error saving product ${product.name}:`, error.message);
      }
    }

    console.log(`Successfully saved ${products.length} products to database`);
    return products;
  } catch (error) {
    console.error('Scraping error:', error);
    throw error;
  } finally {
    await browser.close();
    await mongoose.disconnect();
  }
}

// Run the scraper
if (require.main === module) {
  scrapeDynacoProducts()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = { scrapeDynacoProducts }; 
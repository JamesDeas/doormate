const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const https = require('https');

const downloadImage = (url, filepath) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        https.get(response.headers.location, (redirectedResponse) => {
          if (redirectedResponse.statusCode !== 200) {
            reject(new Error(`Failed to download image: ${redirectedResponse.statusCode}`));
            return;
          }
          const fileStream = fs.createWriteStream(filepath);
          redirectedResponse.pipe(fileStream);
          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });
          fileStream.on('error', (err) => {
            fsPromises.unlink(filepath);
            reject(err);
          });
        }).on('error', reject);
      } else if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      } else {
        const fileStream = fs.createWriteStream(filepath);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        fileStream.on('error', (err) => {
          fsPromises.unlink(filepath);
          reject(err);
        });
      }
    }).on('error', reject);
  });
};

const products = [
  {
    prefix: 'hs100',
    type: 'door',
    count: 4 // main + 3 gallery
  },
  {
    prefix: 'sg200',
    type: 'gate',
    count: 3 // main + 2 gallery
  },
  {
    prefix: 'm300',
    type: 'motor',
    count: 3 // main + 2 gallery
  },
  {
    prefix: 'cs100',
    type: 'controller',
    count: 3 // main + 2 gallery
  }
];

async function downloadSampleImages() {
  const imagesDir = path.join(__dirname, '../public/images/products');
  
  // Ensure directory exists
  try {
    await fsPromises.mkdir(imagesDir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }

  for (const product of products) {
    console.log(`Downloading images for ${product.prefix}...`);
    
    // Download main image
    const mainImagePath = path.join(imagesDir, `${product.prefix}-main.jpg`);
    await downloadImage(
      `https://picsum.photos/seed/${product.prefix}-main/800/600`,
      mainImagePath
    );
    console.log(`Downloaded main image for ${product.prefix}`);

    // Download gallery images
    for (let i = 1; i < product.count; i++) {
      const galleryImagePath = path.join(imagesDir, `${product.prefix}-gallery${i}.jpg`);
      await downloadImage(
        `https://picsum.photos/seed/${product.prefix}-gallery${i}/800/600`,
        galleryImagePath
      );
      console.log(`Downloaded gallery image ${i} for ${product.prefix}`);
    }
  }

  console.log('All sample images downloaded successfully!');
}

downloadSampleImages().catch(console.error); 
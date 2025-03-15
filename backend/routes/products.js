const express = require('express');
const router = express.Router();
const { Product } = require('../models/Product');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images/products')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed!'));
    }
  }
});

// Create a new product
router.post('/', async (req, res) => {
  try {
    // Create the product using the simplified schema
    const product = new Product(req.body);
    
    // Save the product
    await product.save();

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Error creating product:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }
    res.status(500).json({ message: error.message });
  }
});

// Search products - This needs to come before the :id route
router.get('/search', async (req, res) => {
  try {
    const { q, category, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Create a case-insensitive regex pattern
    const searchPattern = new RegExp(q, 'i');

    const query = {
      $or: [
        { title: searchPattern },
        { description: searchPattern },
        { model: searchPattern },
        { features: searchPattern },
        { applications: searchPattern }
      ]
    };

    if (category) {
      query.category = category;
    }

    const products = await Product.find(query)
      .limit(parseInt(limit))
      .sort({ title: 1 }); // Sort alphabetically by title

    res.json(products);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all products with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      brand
    } = req.query;

    const query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (brand) {
      query['brand.id'] = brand;
    }

    const products = await Product.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ title: 1 });

    const total = await Product.countDocuments(query);

    res.json({
      products,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a single product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload main product image
router.post('/:id/images/main', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Delete old main image if it exists
    if (product.images?.main) {
      const oldImagePath = path.join(__dirname, '..', product.images.main);
      try {
        await fs.unlink(oldImagePath);
      } catch (error) {
        console.error('Error deleting old image:', error);
      }
    }

    // Update product with new image path
    const imagePath = `/images/products/${req.file.filename}`;
    product.images = product.images || {};
    product.images.main = imagePath;
    await product.save();

    res.json({ 
      message: 'Main image uploaded successfully',
      imagePath
    });
  } catch (error) {
    console.error('Error uploading main image:', error);
    res.status(500).json({ message: error.message });
  }
});

// Upload gallery images
router.post('/:id/images/gallery', upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ message: 'No image files provided' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Process new images
    const imagePaths = req.files.map(file => `/images/products/${file.filename}`);
    
    // Initialize gallery array if it doesn't exist
    product.images = product.images || {};
    product.images.gallery = product.images.gallery || [];
    
    // Add new images to gallery
    product.images.gallery.push(...imagePaths);
    await product.save();

    res.json({ 
      message: 'Gallery images uploaded successfully',
      imagePaths
    });
  } catch (error) {
    console.error('Error uploading gallery images:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete gallery image
router.delete('/:id/images/gallery/:imageIndex', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const imageIndex = parseInt(req.params.imageIndex);
    if (!product.images?.gallery || imageIndex >= product.images.gallery.length) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Delete image file
    const imagePath = path.join(__dirname, '..', product.images.gallery[imageIndex]);
    try {
      await fs.unlink(imagePath);
    } catch (error) {
      console.error('Error deleting image file:', error);
    }

    // Remove image from gallery array
    product.images.gallery.splice(imageIndex, 1);
    await product.save();

    res.json({ message: 'Gallery image deleted successfully' });
  } catch (error) {
    console.error('Error deleting gallery image:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 
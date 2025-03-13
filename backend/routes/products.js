const express = require('express');
const router = express.Router();
const { Product } = require('../models/Product');

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
      status: 'active',
      $or: [
        { name: searchPattern },
        { description: searchPattern },
        { shortDescription: searchPattern },
        { 'metadata.searchKeywords': searchPattern },
        { model: searchPattern },
        { sku: searchPattern }
      ]
    };

    if (category) {
      query.category = category;
    }

    const products = await Product.find(query)
      .limit(parseInt(limit))
      .sort({ name: 1 }); // Sort alphabetically by name

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
      status = 'active',
      search,
      brandId
    } = req.query;

    const query = { status };
    
    if (category) {
      query.category = category;
    }
    
    if (brandId) {
      query.brandId = brandId;
    }

    if (search) {
      query.$text = { $search: search };
    }

    const products = await Product.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ 'metadata.createdAt': -1 });

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

module.exports = router; 
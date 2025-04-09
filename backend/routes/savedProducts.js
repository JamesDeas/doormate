const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { Product } = require('../models/Product');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Get all saved products for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('savedProducts');
    res.json(user.savedProducts || []);
  } catch (error) {
    console.error('Error fetching saved products:', error);
    res.status(500).json({ message: 'Error fetching saved products' });
  }
});

// Save a product for offline access
router.post('/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if product is already saved
    const user = await User.findById(req.user._id);
    if (user.savedProducts.includes(productId)) {
      return res.status(400).json({ message: 'Product already saved' });
    }
    
    // Add product to saved products
    user.savedProducts.push(productId);
    await user.save();
    
    res.status(201).json({ message: 'Product saved successfully' });
  } catch (error) {
    console.error('Error saving product:', error);
    res.status(500).json({ message: 'Error saving product' });
  }
});

// Remove a saved product
router.delete('/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const user = await User.findById(req.user._id);
    if (!user.savedProducts.includes(productId)) {
      return res.status(404).json({ message: 'Product not found in saved products' });
    }
    
    // Remove product from saved products
    user.savedProducts = user.savedProducts.filter(id => id.toString() !== productId);
    await user.save();
    
    res.json({ message: 'Product removed from saved products' });
  } catch (error) {
    console.error('Error removing saved product:', error);
    res.status(500).json({ message: 'Error removing saved product' });
  }
});

// Check if a product is saved
router.get('/check/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const user = await User.findById(req.user._id);
    const isSaved = user.savedProducts.includes(productId);
    
    res.json({ isSaved });
  } catch (error) {
    console.error('Error checking saved product:', error);
    res.status(500).json({ message: 'Error checking saved product' });
  }
});

module.exports = router; 
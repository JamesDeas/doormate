const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const router = express.Router();

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

// Register new user
router.post('/signup', async (req, res) => {
  try {
    console.log('Signup request received:', req.body);
    const { email, password, firstName, lastName, company, username } = req.body;

    if (!email || !password || !firstName || !lastName || !username) {
      console.log('Missing required fields:', { 
        email: !email,
        password: !password,
        firstName: !firstName,
        lastName: !lastName,
        username: !username
      });
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: {
          email: !email,
          password: !password,
          firstName: !firstName,
          lastName: !lastName,
          username: !username
        }
      });
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ 
        message: 'Username must contain only letters, numbers, and underscores'
      });
    }

    // Validate username length
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ 
        message: 'Username must be between 3 and 20 characters'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User already exists with email:', email);
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Check if username exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    // Create new user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      company,
      username
    });

    console.log('Attempting to save user:', { email, firstName, lastName, username });
    await user.save();
    console.log('User saved successfully');

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Signup error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    // Check for specific MongoDB errors
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      console.error('MongoDB error code:', error.code);
      if (error.code === 11000) {
        return res.status(400).json({ message: 'Email or username already registered' });
      }
    }
    
    res.status(500).json({ 
      message: 'Error creating user',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        name: error.name,
        code: error.code
      } : undefined
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  res.json(req.user.toJSON());
});

// Check if username is available
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username });
    res.json({ available: !user });
  } catch (error) {
    console.error('Username check error:', error);
    res.status(500).json({ message: 'Error checking username availability' });
  }
});

// Update user profile
router.put('/me', authenticateToken, async (req, res) => {
  try {
    // Log the update request but truncate potential large image data
    console.log('Profile update received:', {
      ...req.body,
      profileImage: req.body.profileImage ? `[Base64 image data: ${req.body.profileImage.substring(0, 50)}...]` : undefined
    });
    
    const { firstName, lastName, company, username, profileImage } = req.body;
    const user = req.user;

    console.log('Current user data:', {
      id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName
    });

    // Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json({ message: 'First name and last name are required' });
    }

    if (username && username !== user.username) {
      console.log(`Username change requested from ${user.username} to ${username}`);
      // Check if new username is available
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        console.log('Username already taken:', username);
        return res.status(400).json({ message: 'Username is already taken' });
      }
      user.username = username;
    }

    user.firstName = firstName;
    user.lastName = lastName;
    user.company = company !== undefined ? company : user.company;
    
    if (profileImage) {
      try {
        // Check if image is a valid base64 data URL
        if (profileImage.startsWith('data:image')) {
          console.log('Valid image data received, updating profile image');
          // Calculate size in KB to log
          const sizeInKB = Math.round(profileImage.length * 0.75 / 1024);
          console.log(`Image size: approximately ${sizeInKB}KB`);
          
          if (sizeInKB > 5000) {
            console.log('Warning: Image is quite large (>5MB). Consider client-side optimization.');
          }
          
          user.profileImage = profileImage;
        } else {
          console.log('Invalid image format received');
          return res.status(400).json({ message: 'Invalid image format. Must be a data URL.' });
        }
      } catch (imageError) {
        console.error('Error processing image:', imageError);
        return res.status(400).json({ message: 'Error processing image. Please try again with a smaller or different image.' });
      }
    }

    console.log('Saving user profile...');
    await user.save();
    console.log('Profile updated successfully for user:', user._id);
    res.json(user.toJSON());
  } catch (error) {
    console.error('Profile update error details:', error);
    res.status(500).json({ 
      message: 'Error updating profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Error changing password' });
  }
});

// Delete account
router.delete('/delete-account', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    const user = req.user;

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Delete the user
    await User.findByIdAndDelete(user._id);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ message: 'Error deleting account' });
  }
});

module.exports = router; 
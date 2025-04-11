const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const User = require('../models/user');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for comment image uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = 'public/images/comments';
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'comment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function(req, file, cb) {
    // Accept only jpeg, jpg, png, webp
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only jpeg, jpg, png, and webp files are allowed'));
  }
});

// Get all comments for a product
router.get('/products/:productId/comments', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Only fetch top-level comments (no parentId)
    const comments = await Comment.find({ 
      productId,
      parentId: null 
    })
      .sort({ createdAt: -1 })
      .populate('userId', 'username firstName lastName profileImage')
      .lean();
    
    // Transform the response to match the expected format
    const formattedComments = comments.map(comment => ({
      _id: comment._id,
      productId: comment.productId,
      userId: comment.userId._id,
      user: {
        _id: comment.userId._id,
        username: comment.userId.username,
        firstName: comment.userId.firstName,
        lastName: comment.userId.lastName,
        profileImage: comment.userId.profileImage
      },
      text: comment.text,
      image: comment.image,
      likes: comment.likes || [],
      likesCount: (comment.likes || []).length,
      replyCount: comment.replyCount || 0,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt
    }));
    
    res.json(formattedComments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Error fetching comments' });
  }
});

// Get replies for a comment
router.get('/comments/:commentId/replies', async (req, res) => {
  try {
    const { commentId } = req.params;
    
    const replies = await Comment.find({ parentId: commentId })
      .sort({ createdAt: 1 })
      .populate('userId', 'username firstName lastName profileImage')
      .lean();
    
    const formattedReplies = replies.map(reply => ({
      _id: reply._id,
      productId: reply.productId,
      userId: reply.userId._id,
      parentId: reply.parentId,
      user: {
        _id: reply.userId._id,
        username: reply.userId.username,
        firstName: reply.userId.firstName,
        lastName: reply.userId.lastName,
        profileImage: reply.userId.profileImage
      },
      text: reply.text,
      image: reply.image,
      likes: reply.likes || [],
      likesCount: (reply.likes || []).length,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt
    }));
    
    res.json(formattedReplies);
  } catch (error) {
    console.error('Error fetching replies:', error);
    res.status(500).json({ message: 'Error fetching replies' });
  }
});

// Add a new comment to a product
router.post('/products/:productId/comments', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    console.log('Comment creation request:', {
      body: req.body,
      file: req.file,
      user: req.user,
      params: req.params
    });
    
    const { productId } = req.params;
    const { text, parentId } = req.body;
    const userId = req.user._id;
    
    // Allow comments with either text or image or both
    if (!text && !req.file) {
      return res.status(400).json({ message: 'Either comment text or image is required' });
    }
    
    // Get image path if an image was uploaded
    const imagePath = req.file ? `/images/comments/${req.file.filename}` : null;
    
    console.log('Creating new comment with:', {
      productId,
      userId,
      text: text || '',
      imagePath,
      parentId: parentId || null
    });
    
    const newComment = new Comment({
      productId,
      userId,
      text: text || '',  // Use empty string if no text
      image: imagePath,
      likes: [],
      parentId: parentId || null
    });
    
    await newComment.save();

    // If this is a reply, increment the parent comment's reply count
    if (parentId) {
      await Comment.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 } });
    }
    
    // Populate user information for the response
    const populatedComment = await Comment.findById(newComment._id)
      .populate('userId', 'username firstName lastName profileImage')
      .lean();
    
    // Format the response
    const formattedComment = {
      _id: populatedComment._id,
      productId: populatedComment.productId,
      userId: populatedComment.userId._id,
      parentId: populatedComment.parentId,
      user: {
        _id: populatedComment.userId._id,
        username: populatedComment.userId.username,
        firstName: populatedComment.userId.firstName,
        lastName: populatedComment.userId.lastName,
        profileImage: populatedComment.userId.profileImage
      },
      text: populatedComment.text,
      image: populatedComment.image,
      likes: [],
      likesCount: 0,
      replyCount: 0,
      createdAt: populatedComment.createdAt,
      updatedAt: populatedComment.updatedAt
    };
    
    res.status(201).json(formattedComment);
  } catch (error) {
    console.error('Detailed error in comment creation:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ message: 'Error creating comment', details: error.message });
  }
});

// Like a comment
router.post('/comments/:commentId/like', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user has already liked the comment
    if (comment.likes.includes(userId)) {
      return res.status(400).json({ message: 'Comment already liked' });
    }

    // Add the user's ID to the likes array
    comment.likes.push(userId);
    await comment.save();

    res.json({ 
      likes: comment.likes,
      likesCount: comment.likes.length
    });
  } catch (error) {
    console.error('Error liking comment:', error);
    res.status(500).json({ message: 'Error liking comment' });
  }
});

// Unlike a comment
router.delete('/comments/:commentId/like', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Remove the user's ID from the likes array
    comment.likes = comment.likes.filter(id => id.toString() !== userId.toString());
    await comment.save();

    res.json({ 
      likes: comment.likes,
      likesCount: comment.likes.length
    });
  } catch (error) {
    console.error('Error unliking comment:', error);
    res.status(500).json({ message: 'Error unliking comment' });
  }
});

// Delete a comment
router.delete('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user._id;
    
    // Find the comment
    const comment = await Comment.findById(commentId);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // If this is a reply, check if the user is either:
    // 1. The reply author
    // 2. The parent comment owner
    // 3. An admin
    let isAuthorized = false;
    
    if (comment.parentId) {
      const parentComment = await Comment.findById(comment.parentId);
      isAuthorized = comment.userId.toString() === userId.toString() || // Reply author
                     (parentComment && parentComment.userId.toString() === userId.toString()) || // Parent comment owner
                     req.user.role === 'admin'; // Admin
    } else {
      // For main comments, only allow the author or admin to delete
      isAuthorized = comment.userId.toString() === userId.toString() || req.user.role === 'admin';
    }

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // If this is a reply, decrement the parent comment's reply count
    if (comment.parentId) {
      await Comment.findByIdAndUpdate(comment.parentId, { $inc: { replyCount: -1 } });
    }

    // Delete all replies if this is a parent comment
    if (!comment.parentId) {
      // Find all replies to get their image paths
      const replies = await Comment.find({ parentId: commentId });
      
      // Delete image files for all replies
      for (const reply of replies) {
        if (reply.image) {
          const imagePath = path.join(__dirname, '..', 'public', reply.image);
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        }
      }
      
      await Comment.deleteMany({ parentId: commentId });
    }
    
    // Delete the image file if it exists
    if (comment.image) {
      const imagePath = path.join(__dirname, '..', 'public', comment.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    await Comment.findByIdAndDelete(commentId);
    
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Error deleting comment' });
  }
});

module.exports = router; 
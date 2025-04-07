const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const User = require('../models/user');
const { authenticateToken } = require('../middleware/auth');

// Get all comments for a product
router.get('/products/:productId/comments', async (req, res) => {
  try {
    const { productId } = req.params;
    
    const comments = await Comment.find({ productId })
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
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt
    }));
    
    res.json(formattedComments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Error fetching comments' });
  }
});

// Add a new comment to a product
router.post('/products/:productId/comments', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Comment text is required' });
    }
    
    const newComment = new Comment({
      productId,
      userId,
      text
    });
    
    await newComment.save();
    
    // Populate user information for the response
    const populatedComment = await Comment.findById(newComment._id)
      .populate('userId', 'username firstName lastName profileImage')
      .lean();
    
    // Format the response
    const formattedComment = {
      _id: populatedComment._id,
      productId: populatedComment.productId,
      userId: populatedComment.userId._id,
      user: {
        _id: populatedComment.userId._id,
        username: populatedComment.userId.username,
        firstName: populatedComment.userId.firstName,
        lastName: populatedComment.userId.lastName,
        profileImage: populatedComment.userId.profileImage
      },
      text: populatedComment.text,
      createdAt: populatedComment.createdAt,
      updatedAt: populatedComment.updatedAt
    };
    
    res.status(201).json(formattedComment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ message: 'Error creating comment' });
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
    
    // Check if the user is the author of the comment or an admin
    if (comment.userId.toString() !== userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }
    
    await Comment.findByIdAndDelete(commentId);
    
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Error deleting comment' });
  }
});

module.exports = router; 
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: function() {
      return !this.image; // Text is required only if there's no image
    },
    trim: true,
    maxlength: 1000
  },
  image: {
    type: String,
    default: null,
    required: function() {
      return !this.text; // Image is required only if there's no text
    }
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  replyCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Create compound index for efficient querying
commentSchema.index({ productId: 1, createdAt: -1 });
commentSchema.index({ parentId: 1, createdAt: 1 });

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment; 
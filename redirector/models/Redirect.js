const mongoose = require('mongoose');

const redirectSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound unique index for slug and userId
redirectSchema.index({ slug: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Redirect', redirectSchema);
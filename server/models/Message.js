const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  room: {
    type: String,
    required: true
  },
  edited: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', MessageSchema);

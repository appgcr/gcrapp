const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  senderId: {
    type: String,
    required: true
  },
  receiverId: {
    type: String,
    required: true
  },
  caseId: {
    type: String,
    default: null // Optional context if they are chatting about a specific case
  },
  text: {
    type: String,
    default: ''
  },
  attachmentUrl: {
    type: String,
    default: null
  },
  attachmentType: {
    type: String,
    enum: ['document', 'gallery', 'location', 'contact', null],
    default: null
  },
  attachmentMetadata: {
    type: Object,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);

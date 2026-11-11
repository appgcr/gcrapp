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
  // Who actually wrote it when sent from the shared office inbox ('ADMIN'), e.g. "Kadapa Branch Admin"
  sentBy: { type: String, default: '' },
  sentByName: { type: String, default: '' },
  readAt: { type: Date, default: null },
  attachmentType: {
    type: String,
    enum: ['document', 'gallery', 'photo', 'location', 'contact', null],
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

ChatMessageSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);

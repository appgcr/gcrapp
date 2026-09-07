const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');

// GET /api/chat/admin/users
// Get list of all users the admin has chats with, including their latest message
router.get('/admin/users', async (req, res) => {
  try {
    const adminId = 'ADMIN'; // Default super admin ID
    
    // Get all messages where admin is sender or receiver
    const messages = await ChatMessage.find({
      $or: [
        { senderId: adminId },
        { receiverId: adminId }
      ]
    }).sort({ timestamp: -1 });
    
    // Group by the "other" user
    const chatsByUser = {};
    messages.forEach(msg => {
      const otherUser = msg.senderId === adminId ? msg.receiverId : msg.senderId;
      if (!chatsByUser[otherUser]) {
        chatsByUser[otherUser] = {
          userId: otherUser,
          lastMessage: msg.text,
          lastMessageTime: msg.timestamp,
          unreadCount: 0
        };
      }
      
      // If it's sent TO the admin and unread, increment count
      if (msg.receiverId === adminId && !msg.isRead) {
        chatsByUser[otherUser].unreadCount += 1;
      }
    });
    
    res.json(Object.values(chatsByUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/:userId1/:userId2
// Fetch chat history between two users
router.get('/:userId1/:userId2', async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    
    // Find messages where either is sender and the other is receiver
    const messages = await ChatMessage.find({
      $or: [
        { senderId: userId1, receiverId: userId2 },
        { senderId: userId2, receiverId: userId1 }
      ]
    }).sort({ timestamp: 1 }); // Sort chronologically (oldest first)
    
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat
// Send a new message
router.post('/', async (req, res) => {
  try {
    const newMessage = new ChatMessage(req.body);
    const savedMessage = await newMessage.save();
    res.status(201).json(savedMessage);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/chat/read/:userId1/:userId2
// Mark messages as read (e.g. userId1 is reading messages sent by userId2)
router.put('/read/:readerId/:senderId', async (req, res) => {
  try {
    const { readerId, senderId } = req.params;
    
    await ChatMessage.updateMany(
      { senderId: senderId, receiverId: readerId, isRead: false },
      { $set: { isRead: true } }
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

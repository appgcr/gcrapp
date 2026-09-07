const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const seedDatabase = require('./seed');

const app = express();
const PORT = process.env.PORT || 5001;

// MongoDB Atlas Connection String
const MONGODB_URI = process.env.MONGODB_URI;

const path = require('path');
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve static local uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/cases', require('./routes/cases'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/extract', require('./routes/extract'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'State Bank of India Panel Valuer Backend API',
    database: mongoose.connection.readyState === 1 ? 'Connected to MongoDB Atlas' : 'Connecting...',
    timestamp: new Date()
  });
});

// Connect to MongoDB Atlas
console.log("🔄 Connecting to MongoDB Atlas Cluster0...");
mongoose.connect(MONGODB_URI, { family: 4 })
  .then(async () => {
    console.log("✅ SUCCESS: Connected to MongoDB Atlas Cluster0!");
    await seedDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 SBI Valuation Backend Server running on http://localhost:${PORT}`);
      console.log(`📡 API Health Check available at http://localhost:${PORT}/api/health`);
    });
  })
  .catch(err => {
    console.error("❌ MongoDB Atlas Connection Error:", err.message);
    process.exit(1);
  });

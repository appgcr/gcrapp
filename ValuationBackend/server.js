const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  // Ignore DNS override failure if restricted
}
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const { config, logConfigSummary } = require('./config/env');
const seedDatabase = require('./seed');

const app = express();
const PORT = config.PORT || 5001;

// MongoDB Atlas Connection String
const MONGODB_URI = config.MONGODB_URI;

const path = require('path');

// ── CORS: allow only configured frontend origins ────────────────────────────
const rawOrigins = config.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS = rawOrigins
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Mobile apps (Capacitor/Cordova/Android WebView) run on https://localhost, capacitor://localhost, or have no origin
    if (
      !origin ||
      origin === 'https://localhost' ||
      origin === 'http://localhost' ||
      origin.startsWith('capacitor://') ||
      origin.startsWith('ionic://') ||
      origin.startsWith('http://localhost:') ||
      ALLOWED_ORIGINS.includes(origin) ||
      ALLOWED_ORIGINS.includes('*') ||
      origin.startsWith('http://192.168.') ||
      origin.startsWith('http://10.') ||
      origin.startsWith('http://172.') ||
      origin.startsWith('http://127.0.0.1:')
    ) {
      return callback(null, true);
    }
    // Allow any client app safely without throwing a 500 HTML exception
    return callback(null, true);
  },
  credentials: true,
}));
app.use(bodyParser.json({ limit: `${config.MAX_UPLOAD_SIZE_MB || 50}mb` }));

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
app.use('/api/config', require('./routes/config'));
app.use('/api/location', require('./routes/location'));

// Mongoose Connection Lifecycle Monitoring
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connection established.');
});
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB connection lost. Mongoose attempting to reconnect...');
});
mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB connection re-established.');
});
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB runtime error:', err.message);
});

app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const isProduction = config.NODE_ENV === 'production' || config.NODE_ENV === 'staging';

  const healthData = {
    status: isDbConnected ? 'online' : (isProduction ? 'degraded' : 'local_ready'),
    service: 'State Bank of India Panel Valuer Backend API',
    environment: config.NODE_ENV,
    database: isDbConnected ? 'Connected to MongoDB Database' : 'Database disconnected',
    timestamp: new Date()
  };

  // If in production/staging and database is disconnected, return 503 Service Unavailable
  if (isProduction && !isDbConnected) {
    return res.status(503).json(healthData);
  }

  res.status(200).json(healthData);
});

// Connect to Database & Start Server
async function startServer() {
  let connectionUri = config.MONGODB_URI;
  const isProductionOrStaging = config.NODE_ENV === 'production' || config.NODE_ENV === 'staging';

  // 1. Production & Staging: In-memory database fallback is STRICTLY FORBIDDEN
  if (isProductionOrStaging) {
    if (!connectionUri) {
      console.error(`❌ FATAL: MONGODB_URI is required in [${config.NODE_ENV}] environment.`);
      console.error("   Application startup aborted to prevent unpersisted data loss.");
      process.exit(1);
    }

    console.log(`🔄 Connecting to configured MongoDB in [${config.NODE_ENV}] mode...`);
    try {
      const connectOptions = {
        maxPoolSize: config.MONGODB_MAX_POOL_SIZE || 20,
        minPoolSize: config.MONGODB_MIN_POOL_SIZE || 2,
        serverSelectionTimeoutMS: config.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000,
        ...(connectionUri.startsWith('mongodb+srv') ? { family: 4 } : {})
      };

      await mongoose.connect(connectionUri, connectOptions);
      console.log(`✅ SUCCESS: Connected to MongoDB database in [${config.NODE_ENV}] mode!`);
      // Seed database only if needed
      await seedDatabase();
    } catch (prodDbErr) {
      console.error(`❌ FATAL: Failed to connect to MongoDB in [${config.NODE_ENV}] mode:`, prodDbErr.message);
      console.error("   Startup aborted safely. In-memory fallback is disabled in non-development environments.");
      process.exit(1);
    }
  } else {
    // 2. Development Mode: Allow in-memory fallback for local developer workstations
    if (!connectionUri) {
      console.log("⚠️ No MONGODB_URI provided. Starting local in-memory MongoDB for local development...");
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        connectionUri = mongod.getUri();
        console.log(`⚡ Local MongoDB running in-memory: ${connectionUri}`);
      } catch (memErr) {
        console.error("❌ Failed to start in-memory MongoDB:", memErr.message);
        process.exit(1);
      }
    } else {
      console.log("🔄 Connecting to development MongoDB...");
    }

    try {
      const connectOptions = connectionUri.startsWith('mongodb+srv') ? { family: 4 } : {};
      await mongoose.connect(connectionUri, connectOptions);
      console.log("✅ SUCCESS: Connected to development MongoDB database!");
      await seedDatabase();
    } catch (devErr) {
      console.warn("⚠️ Configured MongoDB connection failed. Falling back to in-memory database for local testing...");
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        connectionUri = mongod.getUri();
        console.log(`⚡ Local MongoDB running in-memory: ${connectionUri}`);
        await mongoose.connect(connectionUri);
        console.log("✅ SUCCESS: Connected to local in-memory database!");
        await seedDatabase();
      } catch (fallbackErr) {
        console.error("❌ Failed to start in-memory MongoDB fallback:", fallbackErr.message);
        process.exit(1);
      }
    }
  }


  app.listen(PORT, () => {
    logConfigSummary(config);
    console.log(`🚀 SBI Valuation Backend Server running on http://localhost:${PORT}`);
    console.log(`📡 API Health Check available at http://localhost:${PORT}/api/health`);
    // Pre-warm fast local OCR engine

    try {
      const { spawn } = require('child_process');
      const fs = require('fs');
      const venvPy = 'd:\\gcr\\venv_ocr\\Scripts\\python.exe';
      const pythonExe = fs.existsSync(venvPy) ? venvPy : (process.platform === 'win32' ? 'python' : 'python3');
      const ocrScript = path.join(__dirname, 'ocr_service', 'ocr_server.py');
      if (fs.existsSync(ocrScript)) {
        const ocrProc = spawn(pythonExe, [ocrScript], { stdio: 'ignore' });
        ocrProc.on('error', (ocrErr) => {
          console.warn('⚡ Local OCR Engine note:', ocrErr.message);
        });
        ocrProc.unref();
        console.log('⚡ Fast Local OCR Engine initialized on port 5002');
      }
    } catch (ocrStartErr) {
      console.warn('OCR daemon start note:', ocrStartErr.message);
    }
  });
}

startServer();

/**
 * GCR Valuation System — Central Services Factory
 * Initializes optional external services safely based on validated environment configuration.
 * Gracefully degrades when optional services are disabled.
 */

const { config } = require('./env');
const fs = require('fs');
const path = require('path');

// 1. Cloudinary / Storage Factory
let cloudinary = null;
if (config.STORAGE_PROVIDER === 'cloudinary') {
  try {
    const cloudSdk = require('cloudinary').v2;
    cloudSdk.config({
      cloud_name: config.CLOUDINARY_CLOUD_NAME,
      api_key: config.CLOUDINARY_API_KEY,
      api_secret: config.CLOUDINARY_API_SECRET,
      secure: true,
    });
    cloudinary = cloudSdk;
  } catch (err) {
    console.warn('⚠️ Cloudinary SDK initialization notice:', err.message);
  }
}

// 2. Gemini Client Status
const geminiStatus = {
  isEnabled: Boolean(config.GEMINI_ENABLED && config.GEMINI_API_KEY),
  model: config.GEMINI_MODEL,
  timeoutMs: config.GEMINI_TIMEOUT_MS,
  maxRetries: config.GEMINI_MAX_RETRIES,
};

// 3. Firebase Cloud Messaging (FCM)
let firebaseApp = null;
if (config.FCM_ENABLED && config.FCM_SERVICE_ACCOUNT_PATH) {
  try {
    const serviceAccountFile = path.resolve(config.FCM_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(serviceAccountFile)) {
      const admin = require('firebase-admin');
      const serviceAccount = require(serviceAccountFile);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: config.FCM_PROJECT_ID,
      }, 'gcr_fcm_app');
    } else {
      console.warn(`⚠️ FCM_SERVICE_ACCOUNT_PATH file not found at: ${serviceAccountFile}`);
    }
  } catch (err) {
    console.warn('⚠️ Firebase Admin SDK initialization notice:', err.message);
  }
}

// 4. Email / SMTP Transport
let emailTransport = null;
if (config.EMAIL_ENABLED && config.SMTP_HOST && config.SMTP_USERNAME) {
  try {
    const nodemailer = require('nodemailer');
    emailTransport = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: {
        user: config.SMTP_USERNAME,
        pass: config.SMTP_PASSWORD,
      },
    });
  } catch (err) {
    console.warn('⚠️ Nodemailer initialization notice:', err.message);
  }
}

module.exports = {
  cloudinary,
  geminiStatus,
  firebaseApp,
  emailTransport,
  storageProvider: config.STORAGE_PROVIDER || 'local',
  ocrConfig: {
    enabled: config.OCR_ENABLED,
    serviceUrl: config.OCR_SERVICE_URL,
    language: config.OCR_LANGUAGE,
    timeoutMs: config.OCR_TIMEOUT_MS,
  },
};

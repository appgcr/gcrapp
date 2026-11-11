/**
 * GCR Valuation System — Environment Schema Definition
 * Defines rules, validation constraints, and defaults for all configuration keys.
 */

const ENV_SCHEMA = {
  // Application Core
  NODE_ENV: {
    type: 'string',
    enum: ['development', 'staging', 'production', 'test'],
    default: 'development',
  },
  APP_NAME: {
    type: 'string',
    default: 'GCR_VALUATION',
  },
  APP_VERSION: {
    type: 'string',
    default: '1.0.0',
  },
  PORT: {
    type: 'number',
    default: 5001,
    min: 1,
    max: 65535,
  },
  HOST: {
    type: 'string',
    default: '0.0.0.0',
  },
  APP_TIMEZONE: {
    type: 'string',
    default: 'Asia/Kolkata',
  },
  LOG_LEVEL: {
    type: 'string',
    enum: ['debug', 'info', 'warn', 'error'],
    default: 'info',
  },

  // Database
  MONGODB_URI: {
    type: 'string',
    requiredIn: ['staging', 'production'],
    isSecret: true,
    validate: (val) => {
      if (!val) return true;
      return val.startsWith('mongodb://') || val.startsWith('mongodb+srv://');
    },
    errorMessage: 'MONGODB_URI must be a valid mongodb:// or mongodb+srv:// connection URI.',
  },
  MONGODB_DATABASE: {
    type: 'string',
    default: 'gcr_valuation',
  },
  MONGODB_MAX_POOL_SIZE: {
    type: 'number',
    default: 20,
    min: 1,
  },
  MONGODB_MIN_POOL_SIZE: {
    type: 'number',
    default: 2,
    min: 0,
  },
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: {
    type: 'number',
    default: 10000,
  },

  // Authentication & Security
  JWT_SECRET: {
    type: 'string',
    isSecret: true,
    requiredIn: ['staging', 'production'],
    default: (env) => (env === 'development' || env === 'test' ? 'dev_only_super_secure_gcr_valuation_jwt_secret_key_2026_local' : undefined),
    minLength: 16,
    validate: (val, env) => {
      if (env.NODE_ENV === 'production' || env.NODE_ENV === 'staging') {
        if (!val || val.length < 32) return false;
        if (val.includes('dev_only') || val.includes('super_secure_jwt_secret')) return false;
      }
      return true;
    },
    errorMessage: 'In staging and production, JWT_SECRET must be at least 32 characters long and cannot be a default development string.',
  },

  JWT_EXPIRES_IN: {
    type: 'string',
    default: '15m',
  },

  JWT_REFRESH_SECRET: {
    type: 'string',
    isSecret: true,
    default: '',
  },
  JWT_REFRESH_EXPIRES_IN: {
    type: 'string',
    default: '7d',
  },
  BCRYPT_SALT_ROUNDS: {
    type: 'number',
    default: 12,
    min: 8,
    max: 16,
  },
  ENCRYPTION_KEY: {
    type: 'string',
    isSecret: true,
    validate: (val, env) => {
      if (env.NODE_ENV === 'production' && (!val || val.length < 32)) {
        return false;
      }
      return true;
    },
    errorMessage: 'In production, ENCRYPTION_KEY must be a 32-byte (min 32 characters) key for AES encryption.',
  },
  CORS_ALLOWED_ORIGINS: {
    type: 'string',
    default: 'http://localhost:5173',
    validate: (val, env) => {
      if (env.NODE_ENV === 'production') {
        const origins = val.split(',').map(o => o.trim());
        const hasInsecure = origins.some(o => o.startsWith('http://') && !o.includes('localhost'));
        if (hasInsecure) return false;
      }
      return true;
    },
    errorMessage: 'In production, CORS_ALLOWED_ORIGINS must only use secure HTTPS endpoints.',
  },
  RATE_LIMIT_WINDOW_MS: {
    type: 'number',
    default: 900000,
  },
  RATE_LIMIT_MAX_REQUESTS: {
    type: 'number',
    default: 100,
  },
  MAX_UPLOAD_SIZE_MB: {
    type: 'number',
    default: 25,
  },

  // WebAuthn
  WEBAUTHN_RP_NAME: {
    type: 'string',
    default: 'GCR Valuations App',
  },
  WEBAUTHN_RP_ID: {
    type: 'string',
    default: 'localhost',
  },
  WEBAUTHN_ORIGIN: {
    type: 'string',
    default: 'http://localhost:5173',
  },

  // Storage
  STORAGE_PROVIDER: {
    type: 'string',
    enum: ['local', 'cloudinary'],
    default: 'local',
  },
  LOCAL_UPLOAD_DIRECTORY: {
    type: 'string',
    default: './uploads',
  },
  CLOUDINARY_CLOUD_NAME: {
    type: 'string',
    requiredIf: (env) => env.STORAGE_PROVIDER === 'cloudinary',
  },
  CLOUDINARY_API_KEY: {
    type: 'string',
    requiredIf: (env) => env.STORAGE_PROVIDER === 'cloudinary',
  },
  CLOUDINARY_API_SECRET: {
    type: 'string',
    isSecret: true,
    requiredIf: (env) => env.STORAGE_PROVIDER === 'cloudinary',
  },
  MAX_DOCUMENT_SIZE_MB: {
    type: 'number',
    default: 25,
  },
  MAX_IMAGE_SIZE_MB: {
    type: 'number',
    default: 10,
  },

  // OCR Service
  OCR_ENABLED: {
    type: 'boolean',
    default: true,
  },
  OCR_SERVICE_URL: {
    type: 'string',
    default: 'http://127.0.0.1:5002',
    validate: (val) => val.startsWith('http://') || val.startsWith('https://'),
    errorMessage: 'OCR_SERVICE_URL must be a valid HTTP/HTTPS URL.',
  },
  OCR_LANGUAGE: {
    type: 'string',
    default: 'eng+tel',
  },
  OCR_TIMEOUT_MS: {
    type: 'number',
    default: 60000,
  },
  PYTHON_PATH: {
    type: 'string',
    default: '',
  },

  // Gemini AI
  GEMINI_ENABLED: {
    type: 'boolean',
    default: false,
  },
  GEMINI_API_KEY: {
    type: 'string',
    isSecret: true,
    requiredIf: (env) => env.GEMINI_ENABLED === true,
  },
  GEMINI_MODEL: {
    type: 'string',
    default: 'gemini-3.5-flash',
  },
  GEMINI_TIMEOUT_MS: {
    type: 'number',
    default: 30000,
  },
  GEMINI_MAX_RETRIES: {
    type: 'number',
    default: 2,
  },

  // Notifications (FCM)
  FCM_ENABLED: {
    type: 'boolean',
    default: false,
  },
  FCM_PROJECT_ID: {
    type: 'string',
    requiredIf: (env) => env.FCM_ENABLED === true,
  },
  FCM_SERVICE_ACCOUNT_PATH: {
    type: 'string',
    isSecret: true,
    requiredIf: (env) => env.FCM_ENABLED === true,
  },

  // Email (SMTP)
  EMAIL_ENABLED: {
    type: 'boolean',
    default: false,
  },
  SMTP_HOST: {
    type: 'string',
    requiredIf: (env) => env.EMAIL_ENABLED === true,
  },
  SMTP_PORT: {
    type: 'number',
    default: 587,
    requiredIf: (env) => env.EMAIL_ENABLED === true,
  },
  SMTP_USERNAME: {
    type: 'string',
    requiredIf: (env) => env.EMAIL_ENABLED === true,
  },
  SMTP_PASSWORD: {
    type: 'string',
    isSecret: true,
    requiredIf: (env) => env.EMAIL_ENABLED === true,
  },
  EMAIL_FROM: {
    type: 'string',
    default: 'GCR Valuations <no-reply@gcrvaluations.com>',
    requiredIf: (env) => env.EMAIL_ENABLED === true,
  },

  // Monitoring
  SENTRY_DSN: {
    type: 'string',
    default: '',
  },
  SENTRY_ENVIRONMENT: {
    type: 'string',
    default: '',
  },
  SENTRY_TRACES_SAMPLE_RATE: {
    type: 'number',
    default: 0.1,
  },

  // External APIs
  GOOGLE_MAPS_API_KEY: {
    type: 'string',
    default: '',
  },
  EXTERNAL_API_TIMEOUT_MS: {
    type: 'number',
    default: 15000,
  },
};

module.exports = { ENV_SCHEMA };

/**
 * GCR Valuation System — Automated Environment Validation Test Suite
 * Tests requirement constraints, security rules, type coercions, and graceful service degradation.
 */

const { parseAndValidateEnv } = require('../config/env');

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    return true;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('================================================================================');
console.log('🧪 RUNNING GCR ENVIRONMENT ARCHITECTURE VALIDATION TESTS');
console.log('================================================================================\n');

let passed = 0;
let total = 0;

// Test 1: Minimum Development Configuration
total++;
if (runTest('Development mode passes with zero-cost minimum config', () => {
  const env = {
    NODE_ENV: 'development',
  };
  const config = parseAndValidateEnv(env);
  assert(config.NODE_ENV === 'development', 'Should resolve development NODE_ENV');
  assert(config.PORT === 5001, 'Should set default PORT 5001');
  assert(config.STORAGE_PROVIDER === 'local', 'Default storage should be local');
  assert(config.GEMINI_ENABLED === false, 'Gemini should default to disabled');
  assert(config.OCR_ENABLED === true, 'Local OCR should default to enabled');
  assert(config.JWT_SECRET.length >= 16, 'Dev should have a safe default JWT secret');
})) passed++;

// Test 2: Production Missing Required Variables Fails (Names Only)
total++;
if (runTest('Production fails when required variables are missing and outputs names only', () => {
  const env = {
    NODE_ENV: 'production',
    // Missing MONGODB_URI and JWT_SECRET
  };
  let threw = false;
  try {
    parseAndValidateEnv(env);
  } catch (err) {
    threw = true;
    assert(err.isConfigurationError === true, 'Should flag as configuration error');
    assert(err.missingVariables.includes('MONGODB_URI'), 'Should identify missing MONGODB_URI');
    assert(err.missingVariables.includes('JWT_SECRET'), 'Should identify missing JWT_SECRET');
    assert(!err.message.includes('mongodb+srv://'), 'Must NEVER print connection string secrets');
  }
  assert(threw, 'Should throw on missing production variables');
})) passed++;

// Test 3: Invalid Database URL Format Fails
total++;
if (runTest('Rejects malformed MONGODB_URI format', () => {
  const env = {
    NODE_ENV: 'development',
    MONGODB_URI: 'postgresql://user:pass@localhost:5432/db',
  };
  let threw = false;
  try {
    parseAndValidateEnv(env);
  } catch (err) {
    threw = true;
    assert(err.invalidConstraints.some(c => c.includes('MONGODB_URI')), 'Should flag invalid MONGODB_URI');
  }
  assert(threw, 'Should throw on non-MongoDB URI scheme');
})) passed++;

// Test 4: Invalid Port Number
total++;
if (runTest('Rejects non-numeric or out-of-range PORT values', () => {
  const env = {
    NODE_ENV: 'development',
    PORT: 'invalid_port',
  };
  let threw = false;
  try {
    parseAndValidateEnv(env);
  } catch (err) {
    threw = true;
    assert(err.invalidConstraints.some(c => c.includes('PORT')), 'Should flag invalid PORT');
  }
  assert(threw, 'Should throw on invalid port');

  // Test port out of range (> 65535)
  threw = false;
  try {
    parseAndValidateEnv({ NODE_ENV: 'development', PORT: 70000 });
  } catch (err) {
    threw = true;
    assert(err.invalidConstraints.some(c => c.includes('PORT')), 'Should flag port > 65535');
  }
  assert(threw, 'Should throw on port > 65535');
})) passed++;

// Test 5: Production Weak / Default JWT Secret Rejected
total++;
if (runTest('Production rejects default or short JWT secrets', () => {
  const env = {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod?retryWrites=true',
    JWT_SECRET: 'short_key',
    ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    CORS_ALLOWED_ORIGINS: 'https://admin.gcrvaluations.com',
  };
  let threw = false;
  try {
    parseAndValidateEnv(env);
  } catch (err) {
    threw = true;
    assert(err.invalidConstraints.some(c => c.includes('JWT_SECRET')), 'Should flag short JWT secret in production');
  }
  assert(threw, 'Should reject short JWT secret in production');
})) passed++;

// Test 6: Production Insecure HTTP CORS Rejected
total++;
if (runTest('Production rejects insecure plain HTTP CORS origins', () => {
  const env = {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod?retryWrites=true',
    JWT_SECRET: 'production_secure_token_secret_random_32_characters_minimum',
    ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    CORS_ALLOWED_ORIGINS: 'http://admin.insecure-site.com', // Insecure HTTP
  };
  let threw = false;
  try {
    parseAndValidateEnv(env);
  } catch (err) {
    threw = true;
    assert(err.invalidConstraints.some(c => c.includes('CORS_ALLOWED_ORIGINS')), 'Should reject HTTP in production CORS');
  }
  assert(threw, 'Should throw on HTTP CORS in production');
})) passed++;

// Test 7: Optional Services Graceful Degradation
total++;
if (runTest('Optional services can be safely disabled without breaking startup', () => {
  const env = {
    NODE_ENV: 'development',
    GEMINI_ENABLED: 'false',
    STORAGE_PROVIDER: 'local',
    FCM_ENABLED: 'false',
    EMAIL_ENABLED: 'false',
  };
  const config = parseAndValidateEnv(env);
  assert(config.GEMINI_ENABLED === false, 'Gemini disabled');
  assert(config.STORAGE_PROVIDER === 'local', 'Local storage');
  assert(config.FCM_ENABLED === false, 'FCM disabled');
  assert(config.EMAIL_ENABLED === false, 'Email disabled');
})) passed++;

// Test 8: Optional Services When Enabled Require Respective Credentials
total++;
if (runTest('Enabled services strictly require their respective credentials', () => {
  // 1. Gemini enabled without GEMINI_API_KEY
  let threw = false;
  try {
    parseAndValidateEnv({
      NODE_ENV: 'development',
      GEMINI_ENABLED: 'true',
      GEMINI_API_KEY: '',
    });
  } catch (err) {
    threw = true;
    assert(err.missingVariables.includes('GEMINI_API_KEY'), 'Should require GEMINI_API_KEY when GEMINI_ENABLED=true');
  }
  assert(threw, 'Should throw when Gemini enabled without key');

  // 2. Cloudinary enabled without CLOUDINARY_API_KEY / SECRET
  threw = false;
  try {
    parseAndValidateEnv({
      NODE_ENV: 'development',
      STORAGE_PROVIDER: 'cloudinary',
      CLOUDINARY_CLOUD_NAME: 'test_cloud',
      // Missing API_KEY and API_SECRET
    });
  } catch (err) {
    threw = true;
    assert(err.missingVariables.includes('CLOUDINARY_API_KEY'), 'Should require CLOUDINARY_API_KEY');
    assert(err.missingVariables.includes('CLOUDINARY_API_SECRET'), 'Should require CLOUDINARY_API_SECRET');
  }
  assert(threw, 'Should throw when Cloudinary enabled without credentials');
})) passed++;

// Test 9: Complete Staging Environment Template Validation
total++;
if (runTest('Staging template passes full validation', () => {
  const env = {
    NODE_ENV: 'staging',
    APP_NAME: 'GCR_VALUATION_STAGING',
    PORT: '5001',
    MONGODB_URI: 'mongodb+srv://staging_user:password123@staging-cluster.mongodb.net/staging_db?retryWrites=true',
    JWT_SECRET: 'staging_super_secure_random_token_secret_32_characters',
    JWT_REFRESH_SECRET: 'staging_refresh_token_secret_32_characters_minimum',
    ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    CORS_ALLOWED_ORIGINS: 'https://staging-admin.gcrvaluations.com',
    STORAGE_PROVIDER: 'cloudinary',
    CLOUDINARY_CLOUD_NAME: 'staging_cloud',
    CLOUDINARY_API_KEY: 'staging_key',
    CLOUDINARY_API_SECRET: 'staging_secret',
    OCR_ENABLED: 'true',
    GEMINI_ENABLED: 'false',
    FCM_ENABLED: 'false',
    EMAIL_ENABLED: 'false',
  };
  const config = parseAndValidateEnv(env);
  assert(config.NODE_ENV === 'staging', 'Should parse staging environment');
  assert(config.STORAGE_PROVIDER === 'cloudinary', 'Should configure Cloudinary');
})) passed++;

// Test 10: Complete Production Environment Template Validation
total++;
if (runTest('Production template passes full enterprise security validation', () => {
  const env = {
    NODE_ENV: 'production',
    APP_NAME: 'GCR_VALUATION_PROD',
    PORT: '5001',
    MONGODB_URI: 'mongodb+srv://prod_app_user:prod_password_secure@prod-cluster.mongodb.net/gcr_prod?retryWrites=true',
    JWT_SECRET: 'production_high_entropy_jwt_secret_32_characters_long_mandatory',
    JWT_REFRESH_SECRET: 'production_high_entropy_refresh_secret_32_characters_long',
    ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    CORS_ALLOWED_ORIGINS: 'https://admin.gcrvaluations.com,https://portal.gcrvaluations.com',
    STORAGE_PROVIDER: 'cloudinary',
    CLOUDINARY_CLOUD_NAME: 'prod_cloud',
    CLOUDINARY_API_KEY: 'prod_key',
    CLOUDINARY_API_SECRET: 'prod_secret',
    OCR_ENABLED: 'true',
    GEMINI_ENABLED: 'false',
    FCM_ENABLED: 'false',
    EMAIL_ENABLED: 'false',
  };
  const config = parseAndValidateEnv(env);
  assert(config.NODE_ENV === 'production', 'Should parse production environment');
  assert(config.PORT === 5001, 'Port parsed');
})) passed++;

console.log('\n================================================================================');
console.log(`TEST RESULTS: ${passed}/${total} test cases passed (${Math.round((passed / total) * 100)}%)`);
console.log('================================================================================\n');

if (passed !== total) {
  process.exit(1);
}

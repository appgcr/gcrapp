/**
 * GCR Valuation System — Centralized Secure Environment Validator & Loader
 * Validates required variables, types, and security constraints at startup.
 * NEVER prints secret values — only displays missing variable NAMES.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { ENV_SCHEMA } = require('./env.schema');

// Load .env from backend directory if present
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

function parseAndValidateEnv(sourceEnv = process.env) {
  const parsed = {};
  const missingRequired = [];
  const invalidValues = [];

  const nodeEnv = (sourceEnv.NODE_ENV || 'development').trim().toLowerCase();
  parsed.NODE_ENV = nodeEnv;

  for (const [key, rule] of Object.entries(ENV_SCHEMA)) {
    const rawVal = sourceEnv[key];
    const isPresent = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '';

    // 1. Resolve Value or Default
    const resolvedDefault = typeof rule.default === 'function' ? rule.default(nodeEnv) : rule.default;
    let value = isPresent ? String(rawVal).trim() : resolvedDefault;

    // 2. Type Coercion
    if (rule.type === 'number') {
      if (isPresent || resolvedDefault !== undefined) {
        const num = Number(value);
        if (isNaN(num)) {
          invalidValues.push(`${key}: must be a valid number`);
        } else {
          value = num;
        }
      }
    } else if (rule.type === 'boolean') {
      if (isPresent) {
        value = ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
      } else {
        value = Boolean(resolvedDefault);
      }
    }

    parsed[key] = value;

    // 3. Check Requiredness
    let isRequired = false;
    if (rule.required) isRequired = true;
    if (rule.requiredIn && rule.requiredIn.includes(nodeEnv)) isRequired = true;
    if (rule.requiredIf && rule.requiredIf(parsed)) isRequired = true;

    const hasValue = parsed[key] !== undefined && parsed[key] !== null && String(parsed[key]).trim() !== '';
    if (isRequired && ((!isPresent && resolvedDefault === undefined) || !hasValue)) {
      missingRequired.push(key);
      continue;
    }



    // 4. Validate Enums
    if (rule.enum && parsed[key] !== undefined) {
      if (!rule.enum.includes(parsed[key])) {
        invalidValues.push(`${key}: must be one of [${rule.enum.join(', ')}]`);
      }
    }

    // 5. Min / Max range check
    if (rule.type === 'number' && typeof parsed[key] === 'number') {
      if (rule.min !== undefined && parsed[key] < rule.min) {
        invalidValues.push(`${key}: must be greater than or equal to ${rule.min}`);
      }
      if (rule.max !== undefined && parsed[key] > rule.max) {
        invalidValues.push(`${key}: must be less than or equal to ${rule.max}`);
      }
    }

    // 6. Custom Validator
    if (rule.validate && isPresent) {
      try {
        const isValid = rule.validate(parsed[key], parsed);
        if (!isValid) {
          invalidValues.push(rule.errorMessage || `${key}: failed constraint validation`);
        }
      } catch (valErr) {
        invalidValues.push(`${key}: validation error`);
      }
    }
  }

  // 7. Report Errors — NAMES ONLY, ZERO SECRETS DISPLAYED
  if (missingRequired.length > 0 || invalidValues.length > 0) {
    const errorMessages = [
      '================================================================================',
      'CONFIGURATION ERROR: GCR ValuationBackend Environment Validation Failed',
      '================================================================================',
    ];

    if (missingRequired.length > 0) {
      errorMessages.push('Missing required environment variables:');
      missingRequired.forEach(name => errorMessages.push(`  - ${name}`));
      errorMessages.push('');
    }

    if (invalidValues.length > 0) {
      errorMessages.push('Invalid configuration constraints:');
      invalidValues.forEach(msg => errorMessages.push(`  - ${msg}`));
      errorMessages.push('');
    }

    errorMessages.push('Please inspect ValuationBackend/.env or your deployment secret store.');
    errorMessages.push('Refer to ENVIRONMENT_MASTER_GUIDE.md for setup instructions.');
    errorMessages.push('================================================================================');

    const formattedError = errorMessages.join('\n');
    const err = new Error(formattedError);
    err.missingVariables = missingRequired;
    err.invalidConstraints = invalidValues;
    err.isConfigurationError = true;
    throw err;
  }

  return parsed;
}

let validatedConfig = {};
try {
  validatedConfig = parseAndValidateEnv(process.env);
} catch (startupErr) {
  const isServerEntry = process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('seed.js'));
  if (isServerEntry) {
    console.error(startupErr.message);
    process.exit(1);
  } else {
    validatedConfig = {};
  }
}


/**
 * Print safe configuration summary on application boot without printing sensitive credentials
 */
function logConfigSummary(config = validatedConfig) {
  console.log(`\n⚙️  [GCR Environment Boot]`);
  console.log(`   • Environment:      ${config.NODE_ENV}`);
  console.log(`   • Port:             ${config.PORT} (Host: ${config.HOST})`);
  console.log(`   • Storage Provider: ${config.STORAGE_PROVIDER}`);
  console.log(`   • Local OCR:        ${config.OCR_ENABLED ? 'ENABLED (' + config.OCR_LANGUAGE + ')' : 'DISABLED'}`);
  console.log(`   • Gemini AI:        ${config.GEMINI_ENABLED ? 'ENABLED (' + config.GEMINI_MODEL + ')' : 'DISABLED (Using Local OCR)'}`);
  console.log(`   • FCM Notifications:${config.FCM_ENABLED ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   • Transactional Mail:${config.EMAIL_ENABLED ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   • Sentry Telemetry: ${config.SENTRY_DSN ? 'ENABLED' : 'DISABLED'}\n`);
}

module.exports = {
  config: validatedConfig,
  parseAndValidateEnv,
  logConfigSummary,
};

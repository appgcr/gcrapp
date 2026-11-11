#!/usr/bin/env node
/**
 * Create the first Super Admin in a production / staging database (demo logins are never seeded there).
 *
 *   MONGODB_URI="mongodb+srv://…/gcr_valuation…" \
 *   ADMIN_USERNAME="gcr.admin" ADMIN_PASSWORD="<at least 10 characters>" ADMIN_NAME="Er. Gouru Neelakanta Reddy" \
 *   node scripts/create-super-admin.js
 *
 * Does nothing if that username already exists. Weak / default passwords are refused.
 */
const mongoose = require('mongoose');
const { provisionSuperAdmin } = require('../seed');

(async () => {
  const uri = process.env.MONGODB_URI;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!uri || !username || !password) {
    console.error('Set MONGODB_URI, ADMIN_USERNAME and ADMIN_PASSWORD.');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
    const result = await provisionSuperAdmin({ username, password, name: process.env.ADMIN_NAME || 'Super Admin' });
    console.log(result.status === 'CREATED' ? `Created Super Admin "${result.username}".` : result.message);
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();

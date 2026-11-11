const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const seedDatabase = require('../seed');

describe('Phase 1 — Production & Staging Seeding Security Test Suite', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  test('1. seedDatabase() refuses default seeding in production environment', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await seedDatabase();
      expect(res).toEqual({ status: 'BLOCKED', reason: 'PRODUCTION_DEFAULT_SEEDING_FORBIDDEN' });
      const userCount = await User.countDocuments();
      expect(userCount).toBe(0); // Zero users seeded!
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  test('2. seedDatabase() refuses default seeding in staging environment', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'staging';
    try {
      const res = await seedDatabase();
      expect(res).toEqual({ status: 'BLOCKED', reason: 'PRODUCTION_DEFAULT_SEEDING_FORBIDDEN' });
      const userCount = await User.countDocuments();
      expect(userCount).toBe(0); // Zero users seeded!
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  test('3. provisionSuperAdmin rejects default password123 and insecure passwords', async () => {
    await expect(seedDatabase.provisionSuperAdmin({
      username: 'admin@gcrapp.com',
      password: 'password123'
    })).rejects.toThrow(/Insecure default password is strictly prohibited/);

    await expect(seedDatabase.provisionSuperAdmin({
      username: 'admin@gcrapp.com',
      password: 'short'
    })).rejects.toThrow(/Super Admin password must be at least 10 characters long/);
  });

  test('4. provisionSuperAdmin succeeds with strong custom credentials', async () => {
    const res = await seedDatabase.provisionSuperAdmin({
      username: 'superadmin_prod@gcrapp.com',
      password: 'SuperSecurePass2026!#Strong',
      name: 'Production Super Admin'
    });
    expect(res.status).toBe('CREATED');
    expect(res.username).toBe('superadmin_prod@gcrapp.com');
    expect(res.role).toBe('SUPER_ADMIN');

    const createdUser = await User.findOne({ username: 'superadmin_prod@gcrapp.com' });
    expect(createdUser).not.toBeNull();
    expect(createdUser.password).not.toBe('SuperSecurePass2026!#Strong'); // Properly hashed
  });
});

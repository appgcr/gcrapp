const User = require('./models/User');
const ValuationCase = require('./models/ValuationCase');
const Notification = require('./models/Notification');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
  const currentEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  if (currentEnv === 'production' || currentEnv === 'staging') {
    console.warn(`🛡️ Security Warning: seedDatabase() default execution blocked in [${currentEnv}] environment to prevent creating default password123 accounts.`);
    return { status: 'BLOCKED', reason: 'PRODUCTION_DEFAULT_SEEDING_FORBIDDEN' };
  }

  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log("🌱 Seeding initial development users into MongoDB...");
      const hashedPassword = await bcrypt.hash('password123', 10);
      // Sample branch (dev only) — every Branch Admin and Engineer belongs to one branch
      const Branch = require('./models/Branch');
      if (!(await Branch.exists({ id: 'BR-001' }))) {
        await Branch.create({ id: 'BR-001', code: 'KDP', name: 'Kadapa', address: 'RACPC Road, Kadapa, Andhra Pradesh', phone: '9440164412' });
      }
      await User.create([
        {
          id: 'ADMIN-001',
          username: 'admin',
          password: hashedPassword,
          name: 'Super Admin',
          role: 'SUPER_ADMIN',
          phone: '9440164412',
          licenseNo: 'Indian Institution of Valuers F – 13622',
          branch: '1. State Bank of India (SBI) - RACPC Branch, Kadapa',
          status: 'Active'
        },
        {
          id: 'ADMIN-002',
          username: 'appgcr@gmail.com',
          password: hashedPassword,
          name: 'GCR Admin',
          role: 'SUPER_ADMIN',
          phone: '9440164412',
          licenseNo: 'Indian Institution of Valuers F – 13622',
          branch: '1. State Bank of India (SBI) - RACPC Branch, Kadapa',
          status: 'Active'
        },
        {
          id: 'BRA-001',
          username: 'kadapa',
          password: hashedPassword,
          issuedPasswordEnc: require('./services/secretBox').seal('password123'),
          issuedPasswordAt: new Date(),
          name: 'Kadapa Branch Admin',
          role: 'ADMIN',
          branchId: 'BR-001',
          phone: '9440164412',
          status: 'Active'
        },
        {
          id: 'ENG-001',
          username: 'engineer',
          password: hashedPassword,
          issuedPasswordEnc: require('./services/secretBox').seal('password123'),
          issuedPasswordAt: new Date(),
          branchId: 'BR-001',
          name: 'GCR Field Engineer',
          role: 'ENGINEER',
          phone: '9440164412',
          licenseNo: 'Indian Institution of Valuers F – 13622',
          branch: '1. State Bank of India (SBI) - RACPC Branch, Kadapa',
          status: 'Active',
          faceEnrolled: true,
          facePhotoUrl: '/punchin_sample.jpg',
          faceDescriptor: [0.12, -0.05, 0.28, 0.04, -0.15, 0.32, 0.08, -0.22, 0.19, -0.01, 0.15, -0.08],
          faceEnrolledAt: new Date()
        }
      ]);
      console.log("✅ Users seeded successfully!");
    } else {
      console.log(`ℹ️ Database already has ${userCount} users. Skipping user seed.`);
    }

    const caseCount = await ValuationCase.countDocuments();
    if (caseCount === 0) {
      console.log("🌱 Seeding sample valuation case into MongoDB Atlas...");
      await ValuationCase.create({
        id: '20260901',
        branchId: 'BR-001',
        clientName: 'K. Venkata Subba Reddy',
        clientFatherName: 'K. Rami Reddy',
        bankName: 'State Bank of India',
        bankBranch: 'RACPC Branch, Kadapa',
        bankDistrict: 'Y.S.R',
        clientPhone: '9440164412',
        address: 'D.No. 4/128, Yerramukkapalli, Kadapa, Andhra Pradesh',
        note: 'Residential property valuation for SBI Home Loan sanction.',
        inspectionDate: '2026-09-08',
        inspectionTime: '10:30 AM',
        status: 'Pending',
        propertyDetails: {
          deedNo: '1428/2021',
          deedYear: '2021',
          netExtent: '2400 Sq.Ft (266.66 Sq.Yds)',
          surveyNo: '482/1A',
          plotNo: '12',
          khathaNo: 'KH-8842',
          propertyType: 'Independent House',
          buildingAge: '4 Years',
          structureType: 'RCC Framed Structure',
          flooringType: 'Vitrified Tiles',
          roadWidth: '30 Feet',
          boundariesActual: {
            north: 'Plot No. 11',
            south: '30 Feet Wide Road',
            east: 'Plot No. 15',
            west: 'Open Land'
          },
          siteValue: {
            plinthArea: '1850 Sq.Ft',
            floors: [
              { id: '1', label: 'Ground Floor', value: '1850 Sq.Ft' }
            ]
          }
        }
      });
      console.log("✅ Sample valuation case seeded successfully!");
    }

    const notifCount = await Notification.countDocuments();
    if (notifCount === 0) {
      await Notification.create([
        {
          targetUser: 'ADMIN',
          title: 'System Initialized',
          message: 'Valuation Portal backend successfully running and connected to MongoDB Atlas.',
          isRead: false
        },
        {
          targetUser: 'ENG-001',
          title: 'New Case Assigned',
          message: 'Case #20260901 - Residential valuation in Kadapa assigned to you.',
          isRead: false
        }
      ]);
      console.log("✅ Initial notifications seeded successfully!");
    }
  } catch (err) {
    console.error("⚠️ Seed database error:", err.message);
  }
}

/**
 * Secure Initial Super Admin Provisioning for Production & Staging
 * Enforces strong password rules and creates a designated administrative account.
 */
async function provisionSuperAdmin({ username, password, name = 'Super Admin', phone = '9440164412', branch = 'State Bank of India (SBI) - RACPC Branch, Kadapa', licenseNo = 'Indian Institution of Valuers F – 13622' } = {}) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new Error('Provisioning failed: A valid username or email is required.');
  }
  if (!password || typeof password !== 'string') {
    throw new Error('Provisioning failed: Password must be provided.');
  }

  // Security enforcement: Reject trivial/default passwords in production and staging
  const cleanPass = password.trim();
  const currentEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  if (['password123', 'admin', 'password', '12345678', 'admin123'].includes(cleanPass.toLowerCase())) {
    throw new Error('Provisioning security violation: Insecure default password is strictly prohibited.');
  }
  if (cleanPass.length < 10) {
    throw new Error('Provisioning security violation: Super Admin password must be at least 10 characters long.');
  }

  const existing = await User.findOne({ username: username.trim() });
  if (existing) {
    return { status: 'EXISTS', message: `User '${username}' already exists. No action taken.` };
  }

  const hashedPassword = await bcrypt.hash(cleanPass, 12);
  const user = await User.create({
    id: `ADMIN-${Date.now().toString().slice(-4)}`,
    username: username.trim(),
    password: hashedPassword,
    name: name.trim(),
    role: 'SUPER_ADMIN',
    phone: phone.trim(),
    licenseNo: licenseNo.trim(),
    branch: branch.trim(),
    status: 'Active'
  });

  return { status: 'CREATED', username: user.username, role: user.role };
}

seedDatabase.seedDatabase = seedDatabase;
seedDatabase.provisionSuperAdmin = provisionSuperAdmin;

module.exports = seedDatabase;


const User = require('./models/User');
const ValuationCase = require('./models/ValuationCase');
const Notification = require('./models/Notification');

async function seedDatabase() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log("🌱 Seeding initial users into MongoDB Atlas...");
      await User.create([
        {
          id: 'ADMIN-001',
          username: 'admin',
          password: 'password123',
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
          password: 'password123',
          name: 'GCR Admin',
          role: 'SUPER_ADMIN',
          phone: '9440164412',
          licenseNo: 'Indian Institution of Valuers F – 13622',
          branch: '1. State Bank of India (SBI) - RACPC Branch, Kadapa',
          status: 'Active'
        },
        {
          id: 'ENG-001',
          username: 'engineer',
          password: 'password123',
          name: 'GCR Field Engineer',
          role: 'ENGINEER',
          phone: '9440164412',
          licenseNo: 'Indian Institution of Valuers F – 13622',
          branch: '1. State Bank of India (SBI) - RACPC Branch, Kadapa',
          status: 'Active'
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

module.exports = seedDatabase;

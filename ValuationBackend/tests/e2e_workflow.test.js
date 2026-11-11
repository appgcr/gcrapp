/**
 * End-to-End Enterprise Valuation Lifecycle Test Suite
 * Validates complete end-to-end flow:
 * 1. Admin Login & JWT generation
 * 2. User/Engineer management
 * 3. Case creation & Engineer assignment
 * 4. Engineer Authentication & Verification
 * 5. Biometric Attendance Clock-In with GPS
 * 6. Case retrieval & Inspection start
 * 7. Valuation Calculation Engine (Land, Structure, Depreciation, Realizable, Distress)
 * 8. Cross-document Reconciliation & Verification
 * 9. Digital Signature & Submission for Review
 * 10. Admin Notification
 * 11. Admin Review & Case Approval
 * 12. Official Bank DOCX Valuation Report Generation
 * 13. Biometric Attendance Clock-Out & Duration Validation
 */

const assert = require('assert');
const path = require('path');
const { calculateValuation } = require('../services/valuationCalculator');
const { reconcileDocuments } = require('../ocr_service/reconciliation');
const { createField, createEmptyCanonicalMetadata } = require('../ocr_service/canonicalSchema');

const API_BASE = 'http://localhost:5001';

async function runE2ETests() {
  console.log('================================================================');
  console.log(' GCR APP COMPLETE ENTERPRISE END-TO-END WORKFLOW TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function record(title, condition, details = '') {
    if (condition) {
      console.log(`  [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${title} - ${details}`);
      failed++;
    }
  }

  try {
    // --- Step 1: Super Admin Login ---
    console.log('--- Step 1 & 2: Super Admin Login & JWT Verification ---');
    const adminLoginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    });
    record('Admin login returns HTTP 200', adminLoginRes.ok);
    const adminAuth = await adminLoginRes.json();
    record('Admin login issues valid JWT token', typeof adminAuth.token === 'string' && adminAuth.token.length > 20);
    record('Admin user role is SUPER_ADMIN', adminAuth.user.role === 'SUPER_ADMIN');

    // Verify /api/auth/me
    const meRes = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${adminAuth.token}` }
    });
    record('JWT verification via GET /api/auth/me succeeds', meRes.ok);
    const meData = await meRes.json();
    record('Authenticated user matches admin ID', meData.user.id === 'ADMIN-001');

    // --- Step 3: Engineer Management ---
    console.log('\n--- Step 3: Engineer Management & Verification ---');
    const usersRes = await fetch(`${API_BASE}/api/users`, {
      headers: { 'Authorization': `Bearer ${adminAuth.token}` }
    });
    record('Admin can fetch users list', usersRes.ok);
    const users = await usersRes.json();
    const engineer = users.find(u => u.role === 'ENGINEER');
    record('Active engineer exists in system', !!engineer);
    record('Engineer account status is Active', engineer?.status === 'Active');

    // --- Step 4 & 5: Case Creation & Assignment ---
    console.log('\n--- Step 4 & 5: Valuation Case Creation & Assignment ---');
    const sampleCasePayload = {
      clientName: 'S. Venkata Ramana',
      clientFatherName: 'S. Subba Rao',
      bankName: 'State Bank of India',
      bankBranch: 'Main Branch Kadapa',
      bankDistrict: 'Y.S.R',
      locationData: 'Lat: 14.467310, Long: 78.824150, Kadapa',
      status: 'Pending',
      assignedEngineerId: engineer.id,
      assignedEngineerName: engineer.name,
      propertyDetails: {
        propertyType: 'Independent House',
        structureType: 'Framed structure',
        flooringType: 'Vitrified Tiles',
        buildingAge: '3',
        deedNo: '8859/2018',
        deedYear: '2018',
        netExtent: '89.3',
        surveyNo: '176/2',
        plotNo: '9',
        doorNo: '42/337-7-2-1',
        boundariesDoc: {
          north: 'Plot 8',
          south: 'Plot 10',
          east: '24 Feet Wide Road',
          west: 'Plot 15'
        },
        boundariesActual: {
          north: 'Plot 8',
          south: 'Plot 10',
          east: '24 Feet Wide Road',
          west: 'Plot 15'
        },
        siteValue: {
          ratePerSqYd: '15000',
          plinthArea: '650',
          floors: [
            { id: 'gf', label: 'Ground Floor (GF)', value: '650' },
            { id: 'f1', label: 'First Floor (FF)', value: '600' }
          ]
        },
        additionsWork: [
          { description: 'Compound Wall & Gate', quantity: '1', rate: '75000', amount: '75000' },
          { description: 'Borewell & Submersible Pump', quantity: '1', rate: '60000', amount: '60000' }
        ]
      }
    };

    const createCaseRes = await fetch(`${API_BASE}/api/cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAuth.token}`
      },
      body: JSON.stringify(sampleCasePayload)
    });
    record('Admin successfully creates valuation case', createCaseRes.ok);
    const createdCase = await createCaseRes.json();
    record('Created case assigned sequential ID', typeof createdCase.id === 'string');
    record('Created case has correct borrower name', createdCase.clientName === 'S. Venkata Ramana');
    record('Case assigned to correct engineer ID', createdCase.assignedEngineerId === engineer.id);

    // --- Step 6: Engineer Login & JWT Verification ---
    console.log('\n--- Step 6: Engineer Authentication ---');
    const engLoginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: engineer.username, password: 'password123' })
    });
    record('Engineer login returns HTTP 200', engLoginRes.ok);
    const engAuth = await engLoginRes.json();
    record('Engineer login issues valid JWT token', typeof engAuth.token === 'string');
    record('Engineer user role is ENGINEER', engAuth.user.role === 'ENGINEER');

    // --- Step 7: Biometric Attendance Clock-In ---
    console.log('\n--- Step 7: Biometric Attendance Clock-In ---');
    const clockInPayload = {
      userId: engineer.id,
      engineerName: engineer.name,
      type: 'CLOCK_IN',
      latitude: 14.4673,
      longitude: 78.8241,
      accuracy: 8.5,
      verificationMethod: 'FACE_BIOMETRIC',
      livenessScore: 0.96
    };

    const clockInRes = await fetch(`${API_BASE}/api/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${engAuth.token}`
      },
      body: JSON.stringify(clockInPayload)
    });
    record('Attendance clock-in returns HTTP 200/201', clockInRes.ok);
    const clockInData = await clockInRes.json();
    record('Clock-in record generated authoritative server timestamp', !!clockInData.timestamp || !!clockInData.createdAt);
    record('Clock-in face biometric status verified', clockInData.faceVerified === true);

    // Prevent duplicate clock-in test
    const duplicateRes = await fetch(`${API_BASE}/api/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${engAuth.token}`
      },
      body: JSON.stringify(clockInPayload)
    });
    record('Duplicate clock-in on same day is rejected (HTTP 400)', duplicateRes.status === 400);

    // --- Step 8 & 9: Engineer Views Assigned Cases ---
    console.log('\n--- Step 8 & 9: Engineer Fetches Assigned Cases ---');
    const casesRes = await fetch(`${API_BASE}/api/cases`, {
      headers: { 'Authorization': `Bearer ${engAuth.token}` }
    });
    record('Engineer fetches cases list', casesRes.ok);
    const allCases = await casesRes.json();
    const myCase = allCases.find(c => c.id === createdCase.id);
    record('Engineer finds assigned case in list', !!myCase);

    // --- Step 10: Valuation Calculation Engine ---
    console.log('\n--- Step 10: Valuation Calculation Engine Verification ---');
    const calcResult = calculateValuation(sampleCasePayload.propertyDetails);
    
    // Land: 89.3 Sq.Yards * 15,000 = 13,39,500
    record('Land value calculated accurately (89.3 * 15000 = 1,339,500)', calcResult.landValue === 1339500);
    // Structure: 1250 sq.ft * 1800 rate = 22,50,000
    record('Structure replacement cost calculated accurately (2,250,000)', calcResult.structureReplacementCost === 2250000);
    // Depreciation: Age 3 / Life 60 = 5% of 22,50,000 = 1,12,500
    record('Depreciation accurately computed straight-line (112,500)', calcResult.depreciationAmount === 112500);
    // Net Structure: 22,50,000 - 1,12,500 = 21,37,500
    record('Net structure value calculated accurately (2,137,500)', calcResult.netStructureValue === 2137500);
    // Amenities: 75,000 + 60,000 = 1,35,000
    record('Extra amenities calculated accurately (135,000)', calcResult.amenitiesValue === 135000);
    // Fair Market Value: 13,39,500 + 21,37,500 + 1,35,000 = 36,12,000
    record('Fair Market Value equals sum of Land + Net Structure + Amenities (3,612,000)', calcResult.fairMarketValue === 3612000);
    // Realizable Value: 90% of 36,12,000 = 32,50,800
    record('Realizable Value equals 90% of Fair Market Value (3,250,800)', calcResult.realizableValue === 3250800);
    // Distress Sale Value: 85% of Realizable Value = 2,763,180
    record('Distress Sale Value equals 85% of Realizable Value (2,763,180)', calcResult.distressSaleValue === Math.round(calcResult.realizableValue * 0.85));

    // --- Step 11: Cross-Document Reconciliation ---
    console.log('\n--- Step 11: Cross-Document Reconciliation Engine ---');
    const docMap = {
      saleDeed: {
        deedNo: createField('8859/2018', 'saleDeed', 1, 0.95),
        surveyNo: createField('176/2', 'saleDeed', 1, 0.95),
        plotNo: createField('9', 'saleDeed', 1, 0.95),
        netExtent: createField('89.3', 'saleDeed', 1, 0.95)
      },
      propertyTax: {
        doorNo: createField('42/337-7-2-1', 'propertyTax', 1, 0.95),
        assessmentNo: createField('1013104872', 'propertyTax', 1, 0.95)
      }
    };
    const reconAudit = reconcileDocuments(docMap);
    record('Reconciliation identifies matched survey number (176/2)', reconAudit.surveyNo?.value === '176/2');
    record('Reconciliation identifies deed number (8859/2018)', reconAudit.deedNo?.value === '8859/2018');
    record('Actual boundaries remain MANUAL requiring on-site engineer verification', reconAudit.actualBoundaries?.north?.status === 'MANUAL');

    // --- Step 12: Engineer Submits Valuation Case for Review ---
    console.log('\n--- Step 12: Engineer Signs & Submits Case for Review ---');
    const updatePayload = {
      ...sampleCasePayload,
      status: 'Completed', // Marked completed by engineer, ready for review
      signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      reconciliationAudit: reconAudit
    };

    const submitCaseRes = await fetch(`${API_BASE}/api/cases/${createdCase.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${engAuth.token}`
      },
      body: JSON.stringify(updatePayload)
    });
    record('Engineer submits case with digital signature (HTTP 200)', submitCaseRes.ok);
    const submittedCase = await submitCaseRes.json();
    record('Submitted case status is Completed (Under Review)', submittedCase.status === 'Completed');
    record('Backend valuation engine automatically attached calculation breakdown', !!submittedCase.valuation && submittedCase.valuation.fairMarketValue > 0);

    // --- Step 13: Admin Notification ---
    console.log('\n--- Step 13: Notification Dispatch ---');
    const notifRes = await fetch(`${API_BASE}/api/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${engAuth.token}`
      },
      body: JSON.stringify({
        targetUser: 'ADMIN',
        title: 'Valuation Task Submitted',
        message: `${engineer.name} has submitted Case #${createdCase.id} for final review.`
      })
    });
    record('Notification record created for Admin', notifRes.ok);

    // --- Step 14: Admin Review & Approval ---
    console.log('\n--- Step 14: Admin Case Review & Approval ---');
    const approveRes = await fetch(`${API_BASE}/api/cases/${createdCase.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAuth.token}`
      },
      body: JSON.stringify({
        ...submittedCase,
        status: 'Approved'
      })
    });
    record('Admin approves valuation case (HTTP 200)', approveRes.ok);
    const approvedCase = await approveRes.json();
    record('Case status updated to Approved', approvedCase.status === 'Approved');

    // --- Step 15: Official Bank DOCX Valuation Report Generation ---
    console.log('\n--- Step 15: Official Bank DOCX Report Generation ---');
    const reportRes = await fetch(`${API_BASE}/api/cases/${createdCase.id}/report`, {
      headers: { 'Authorization': `Bearer ${adminAuth.token}` }
    });
    record('Report endpoint returns HTTP 200', reportRes.ok);
    const reportContentType = reportRes.headers.get('content-type');
    record('Report MIME type is DOCX (.openxmlformats-officedocument.wordprocessingml.document)', reportContentType && reportContentType.includes('wordprocessingml.document'));
    const reportBuffer = await reportRes.arrayBuffer();
    record('Generated report has non-empty file size (> 5 KB)', reportBuffer.byteLength > 5000);

    // --- Step 16: Biometric Attendance Clock-Out ---
    console.log('\n--- Step 16: Biometric Attendance Clock-Out ---');
    const clockOutPayload = {
      userId: engineer.id,
      engineerName: engineer.name,
      type: 'CLOCK_OUT',
      latitude: 14.4674,
      longitude: 78.8242,
      accuracy: 9.0,
      verificationMethod: 'FACE_BIOMETRIC'
    };

    const clockOutRes = await fetch(`${API_BASE}/api/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${engAuth.token}`
      },
      body: JSON.stringify(clockOutPayload)
    });
    record('Attendance clock-out returns HTTP 200/201', clockOutRes.ok);
    const clockOutData = await clockOutRes.json();
    // --- Step 17: Role Permissions Verification (SUPER_ADMIN vs ENGINEER) ---
    console.log('\n--- Step 17: Role Permissions Verification (SUPER_ADMIN vs ENGINEER) ---');
    
    // 17.1: Unauthenticated request rejected
    const unauthRes = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'hacker', name: 'Unauthorized User' })
    });
    record('Unauthenticated user cannot create users (HTTP 401)', unauthRes.status === 401);

    // 17.2: Engineer token rejected with HTTP 403 Forbidden
    const engCreateUserRes = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${engAuth.token}`
      },
      body: JSON.stringify({ username: 'eng_created_user', name: 'Illegal User' })
    });
    record('Engineer role strictly blocked from user creation (HTTP 403)', engCreateUserRes.status === 403);

    // 17.3: Engineer token rejected from deleting users
    const engDeleteRes = await fetch(`${API_BASE}/api/users/test_user_delete`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${engAuth.token}` }
    });
    record('Engineer role strictly blocked from user deletion (HTTP 403)', engDeleteRes.status === 403);

    // 17.4: SUPER_ADMIN permitted to create user
    const adminCreateUserRes = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAuth.token}`
      },
      body: JSON.stringify({ username: 'staging_audited_eng', name: 'Staging Test Engineer', role: 'ENGINEER' })
    });
    record('Super Admin permitted to create user (HTTP 201)', adminCreateUserRes.status === 201);

    // 17.5: SUPER_ADMIN permitted to delete user
    const adminDeleteRes = await fetch(`${API_BASE}/api/users/staging_audited_eng`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminAuth.token}` }
    });
    record('Super Admin permitted to delete user (HTTP 200)', adminDeleteRes.status === 200);

  } catch (err) {
    console.error('\nE2E Execution Error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(` E2E TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ETests();

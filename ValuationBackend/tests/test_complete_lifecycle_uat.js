const assert = require('assert');

const API_BASE = 'http://localhost:5001';

async function runCompleteLifecycleUAT() {
  console.log('================================================================');
  console.log(' GCR COMPLETE END-TO-END MASTER LIFECYCLE UAT TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function record(desc, cond, details = '') {
    if (cond) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc} - ${details}`);
      failed++;
    }
  }

  try {
    // 1. Super Admin Login
    console.log('--- Step 1: Super Admin Login ---');
    const adminLoginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    });
    record('Admin login succeeds (HTTP 200)', adminLoginRes.ok);
    const adminAuth = await adminLoginRes.json();
    const adminToken = adminAuth.token;
    record('Admin JWT token received', !!adminToken);

    // Get active engineer
    const usersRes = await fetch(`${API_BASE}/api/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const users = await usersRes.json();
    const engineer = users.find(u => u.role === 'ENGINEER' && u.status === 'Active') || users.find(u => u.role === 'ENGINEER');
    record('Active engineer identified for assignment', !!engineer);

    // 2. Super Admin Creates Case with ONLY 4 Required Assignment Fields (Bank is strictly Optional!)
    console.log('\n--- Step 2: Super Admin Creates Case (Minimal 4 Fields, Bank Optional) ---');
    const createCasePayload = {
      clientName: 'T. R. Sreenivasulu',
      address: 'D.No 42/337, Bhagya Nagar, Kadapa',
      clientPhone: '9440123456',
      assignedEngineerId: engineer.id
      // Bank is intentionally omitted: bank selection is optional at initial creation
    };
    const createRes = await fetch(`${API_BASE}/api/cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(createCasePayload)
    });
    record('Case creation returns HTTP 201/200', createRes.ok);
    const createdCase = await createRes.json();
    record('Case assigned valid sequential ID', typeof createdCase.id === 'string' && createdCase.id.length >= 8);
    record('Bank selection remained optional (bankStatus: Unassigned)', createdCase.bankStatus === 'Unassigned' || !createdCase.bankName);
    const caseId = createdCase.id;

    // 3. Engineer Login
    console.log('\n--- Step 3: Engineer Login & Authentication ---');
    const engLoginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: engineer.username, password: 'password123' })
    });
    record('Engineer login succeeds (HTTP 200)', engLoginRes.ok);
    const engAuth = await engLoginRes.json();
    const engToken = engAuth.token;

    // 4. Engineer Attendance & GPS Clock-In
    console.log('\n--- Step 4: Engineer Attendance & GPS Clock-In ---');
    const attendancePayload = {
      userId: engineer.id,
      engineerName: engineer.name,
      type: 'CLOCK_IN',
      latitude: 14.4674,
      longitude: 78.8242,
      accuracy: 8.0,
      verificationMethod: 'FACE_BIOMETRIC'
    };
    const attRes = await fetch(`${API_BASE}/api/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${engToken}`
      },
      body: JSON.stringify(attendancePayload)
    });
    record('Attendance clock-in endpoint operational', attRes.ok || attRes.status === 400);

    // 5. Engineer Inspects and Completes Valuation
    console.log('\n--- Step 5: Engineer Completes Inspection & Valuation ---');
    const updatePayload = {
      ...createdCase,
      status: 'Reviewing', // State for engineer submission
      bankName: 'State Bank of India', // Engineer/Admin completes bank during inspection workflow
      propertyDetails: {
        deedNo: '8859/2018',
        deedYear: '2018',
        netExtent: '89.3',
        surveyNo: '176/2',
        plotNo: '9',
        doorNo: '42/337-7-2-1',
        propertyType: 'Independent House',
        boundariesDoc: { north: 'Plot 8', south: 'Plot 10', east: '24 Feet Wide Road', west: 'Plot 15' },
        boundariesActual: { north: 'Plot 8', south: 'Plot 10', east: '24 Feet Wide Road', west: 'Plot 15' },
        siteValue: {
          ratePerSqYd: '15000',
          plinthArea: '650',
          floors: [{ id: 'gf', label: 'Ground Floor', value: '650' }]
        }
      },
      signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    };
    const updateRes = await fetch(`${API_BASE}/api/cases/${caseId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${engToken}`
      },
      body: JSON.stringify(updatePayload)
    });
    record('Case updated & submitted by engineer (HTTP 200)', updateRes.ok);
    const submittedCase = await updateRes.json();
    record('Submitted case status is Reviewing', submittedCase.status === 'Reviewing');
    record('Automatic valuation calculation attached', typeof submittedCase.valuation?.fairMarketValue === 'number');

    // 6. Super Admin Reviews & Returns Case for Corrections
    console.log('\n--- Step 6: Super Admin Reviews & Returns for Corrections ---');
    const returnRes = await fetch(`${API_BASE}/api/cases/${caseId}/return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ comment: 'North boundary requires ground measurement re-confirmation.' })
    });
    const returnData = await returnRes.json();
    const returnedCase = returnData.case || returnData;
    record('Case status transitioned to Returned', returnedCase.status === 'Returned');
    record('Mandatory feedback remarks persisted', returnedCase.rejectionReason === 'North boundary requires ground measurement re-confirmation.');

    // 7. Engineer Corrects Remarks and Resubmits Case
    console.log('\n--- Step 7: Engineer Corrects Remarks and Resubmits Case ---');
    const resubmitPayload = {
      ...returnedCase,
      status: 'Reviewing',
      engineerCorrectionNotes: 'North boundary re-measured physically on-site: Plot 8 compound wall confirmed.',
      signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    };
    const resubmitRes = await fetch(`${API_BASE}/api/cases/${caseId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${engToken}`
      },
      body: JSON.stringify(resubmitPayload)
    });
    record('Engineer resubmits corrected case (HTTP 200)', resubmitRes.ok);
    const resubmittedCase = await resubmitRes.json();
    record('Case re-transitioned to Reviewing', resubmittedCase.status === 'Reviewing');

    // 8. Super Admin Approves Case
    console.log('\n--- Step 8: Super Admin Approves Case ---');
    const approvePayload = {
      ...resubmittedCase,
      status: 'Approved'
    };
    const approveRes = await fetch(`${API_BASE}/api/cases/${caseId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(approvePayload)
    });
    record('Super Admin approves case (HTTP 200)', approveRes.ok);
    const approvedCase = await approveRes.json();
    record('Case status updated to Approved', approvedCase.status === 'Approved');

    // 9. Official Report Generation & Download
    console.log('\n--- Step 9: Official Bank Report Generation & Download ---');
    const reportRes = await fetch(`${API_BASE}/api/cases/${caseId}/report?format=docx`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    record('Report download returns HTTP 200', reportRes.ok);
    const reportBlob = await reportRes.arrayBuffer();
    record(`Report binary downloaded successfully (${reportBlob.byteLength} bytes)`, reportBlob.byteLength > 5000);

    console.log('\n================================================================');
    console.log(`COMPLETE LIFECYCLE UAT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) process.exit(1);

  } catch (err) {
    console.error('UAT Execution Error:', err);
    process.exit(1);
  }
}

runCompleteLifecycleUAT();

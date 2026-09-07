import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

export async function generateSbiDocx(caseData) {
  const getFileSeq = (id = '', explicitFileNo) => {
    if (explicitFileNo) return explicitFileNo;
    const parts = id.split('-');
    const last = parts[parts.length - 1];
    const num = parseInt(last, 10);
    if (!isNaN(num)) {
      return 'GCR' + String(num).padStart(6, '0');
    }
    return 'GCR000001';
  };
  const fileNo = getFileSeq(caseData.id, caseData.fileNo);
  const accountNo = caseData.accountNo || '111 461 837 79';
  const today = new Date().toLocaleDateString('en-GB');
  const branch = caseData.bankBranch || 'RACPC BRANCH - KADAPA.';
  const borrower = caseData.borrowerName || 'K. Jaya Narasimhulu, S/o K. Suryanarayana';
  const address = caseData.locality || 'Door No. 12-67, Peddachowtapalle, B.C. Colony, YSR (Dist).';
  const estimation = caseData.estimationValue || 'Rs 1,50,00,000/-';
  const valuer = caseData.valuerName || 'Sri Gouru. Neelakanta Reddy / Er. K. Suresh Kumar';
  const gps = caseData.gpsCoordinates || '14°28\'04.4"N 78°50\'13.2"E';
  const bankName = caseData.bank || 'STATE BANK OF INDIA';
  const deedNo = caseData.deedNo || '1041/2024';
  const deedDate = caseData.deedDate || '12-04-2024';
  const surveyNo = caseData.surveyNo || '740/20, 740/21';
  const doorNo = caseData.doorNo || '12-67';
  const planNo = caseData.planApprovalNo || 'KMC/BLD/2025/8891';
  const extent = caseData.extent || '4.70 Cents (227.60 Sqyds)';

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Institutional Header matching reference document
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "Sri Gouru. Neelakanta Reddy, B.Tech., MISTE.\n", bold: true, size: 24, color: "000080" }),
              new TextRun({ text: "Civil Engineering Consultant & Approved PANEL Valuer\n", bold: true, size: 20 }),
              new TextRun({ text: `Approved PANEL Valuer for: A.P.G.Bank, State Bank of India, Indian Bank, Canara Bank, Bank of Baroda, Union Bank Of India, Bank of India, PNB, Central Bank Of India, Indian Overseas Bank, Axis Bank, Hdfc Bank, ICICI Bank, Repco, IDBI, LIC HFL. Punjab National Bank.\n`, size: 16 }),
              new TextRun({ text: "Door No:- 21/659, Beside Airtel Show Room, 7 Roads, Kadapa, Y.S.R (Dist), A.P. | Cell: 9440164412 | Off: 9052589896 | Off: 8341341353\n", size: 16 }),
              new TextRun({ text: `SMN & AR | Indian Institution of Valuers F – 13622 | File No:- ${fileNo}\n`, bold: true, size: 16, color: "008000" })
            ]
          }),

          // Bank Logo & Verification Banner
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 200 },
            children: [
              new TextRun({ text: `[OFFICIAL BANK LOGO & EMBLEM ATTACHED FOR ${bankName}]`, bold: true, size: 18, color: "D97706" })
            ]
          }),

          // Title
          new Paragraph({
            text: `VALUATION REPORT - ${bankName}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 200 }
          }),

          // Subtitle / Branch
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({ text: `District: Y S R | Branch: ${branch} | Date: ${today}\n`, bold: true, size: 20 }),
              new TextRun({ text: `Belongs To: ${borrower}\n`, bold: true, size: 22, color: "000080" }),
              new TextRun({ text: `Property Address: ${address}\n`, size: 20 })
            ]
          }),

          // Executive Summary Box
          createDetailTable([
            ["Deed Number", deedNo],
            ["Net Land Extent", extent],
            ["Survey Numbers", surveyNo],
            ["Door / House Number", doorNo],
            ["Plan Approval Details", `B.A. No: ${planNo}, Dt: ${deedDate}`],
            ["FINAL FAIR MARKET VALUE", estimation]
          ]),

          // Annexure-XI Format-A Section
          createSectionHeader("ANNEXURE–XI / FORMAT–A: VALUATION REPORT OF LAND & BUILDING"),
          createDetailTable([
            ["1. Customer / Borrower Unit", borrower],
            ["2. Application / Case ID", caseData.id || "SBI-VAL-2026-049"],
            ["3. Property Location & Address", address],
            ["4. GPS Geo-Stamping Co-ordinates", gps],
            ["5. Independent Road Access", "Yes, Above 20’0” Wide CC Road"]
          ]),

          createSectionHeader("MANDATORY 5 DOCUMENTS VERIFIED & ENCLOSED"),
          createDetailTable([
            ["1. Registration Deed (Sale Deed)", `Verified & Enclosed (Deed No: ${deedNo}, Dt: ${deedDate})`],
            ["2. Municipal Building Plan Approval", `Approved & Verified (B.A. No: ${planNo})`],
            ["3. Guideline / Market Value Rate", "Verified from SRO Kadapa (Guideline Rate: Rs 4,500 / Sq. Ft.)"],
            ["4. Property Tax Paid Receipt", "Verified & Assessment Paid (Assessment No: 1084920192, Tax: Rs 14,500/-)"],
            ["5. Hand-Drawn Location Sketch Map", "Enclosed with Demarcated Boundaries & Landmarks"]
          ]),

          createSectionHeader("PHYSICAL DETAILS & BOUNDARY MATCHING"),
          createDetailTable([
            ["North Boundary", "Site Of M. Anantha Ramaiah (As Per Deed & Actual)"],
            ["South Boundary", "House Of Door No: 42/337-15 (As Per Deed & Actual)"],
            ["East Boundary", "Kaluva / Drainage Channel (As Per Deed & Actual)"],
            ["West Boundary", "20'0\" Wide CC Road (As Per Deed & Actual)"],
            ["Matching of Boundaries", "Yes (100% Perfect Matching)"],
            ["Plot Demarcated & Approved Use", "Yes / Residential Building (Stilt+GF+FF+SF)"]
          ]),

          createSectionHeader("VALUATION CALCULATION & ROUGH ESTIMATION"),
          createDetailTable([
            ["A. Land Valuation (Prevailing Market Rate)", `${extent} X Rs 18,00,000/- per Cent = Rs 84,60,000/-`],
            ["B. Land Valuation (SRO Guideline Rate)", `${extent} @ Rs 4,500/Sqft = Rs 50,25,575/-`],
            ["C. Justification for >20% Variation", "Prime residential locality with excellent municipal amenities. SRO guideline rates ignore site merits and commercial demand in Kadapa Municipal Corporation."],
            ["D. Building Replacement & Plinth Area", "Stilt + GF + FF + SF (Total 5,188 Sqft) @ Rs 2,500/Sqft"],
            ["E. Depreciated Building Value (1%/yr)", "Rs 1,17,90,000/- (Residual Life: 57 Years)"],
            ["F. Total Land Value", "Rs    84,60,000/-"],
            ["G. Total Building Value", "Rs 1,17,90,000/-"],
            ["H. TOTAL FAIR MARKET VALUE", `${estimation} (Say As ${estimation})`],
            ["I. Realizable Value (95%)", "Rs 1,42,50,000/-"],
            ["J. Forced / Distress Sale Value (90%)", "Rs 1,35,00,000/-"]
          ]),

          createSectionHeader("DECLARATION & SIGN-OFF"),
          new Paragraph({
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({ text: "• SARFAESI Compliance: ", bold: true }),
              new TextRun("The property is fully SARFAESI compliant and independently inspected.\n"),
              new TextRun({ text: "• Independence: ", bold: true }),
              new TextRun("The undersigned has no direct or indirect interest in the above property.\n\n"),
              new TextRun({ text: "Signature of Approved Panel Valuer:\n\n", bold: true, size: 22 }),
              new TextRun({ text: `Name: ${valuer}\n`, bold: true, size: 24, color: "000080" }),
              new TextRun({ text: "Wealth Tax Reg No: 111/06-07 | Institution of Valuers: F-13622\n", bold: true }),
              new TextRun({ text: `Date of Inspection & Valuation: ${today}\n` }),
              new TextRun({ text: `Official Seal: Approved Panel Valuer - ${bankName}\n` })
            ]
          }),

          createSectionHeader("ENCLOSURES & ATTACHED IMAGES VERIFICATION"),
          createDetailTable([
            ["1. Registration Deed Scan", caseData.documents?.registration?.name || "Scan_Deed_1041_2024.jpg"],
            ["2. Municipal Plan Approval", caseData.documents?.planApproval?.name || "Scan_Plan_Approval.jpg"],
            ["3. Guideline Rate Certificate", caseData.documents?.marketValue?.name || "Scan_Guideline_Rate.jpg"],
            ["4. Property Tax Receipt", caseData.documents?.propertyTax?.name || "Scan_Tax_Receipt.jpg"],
            ["5. Hand-Drawn Site Sketch", caseData.documents?.locationMap?.name || "Scan_Site_Sketch.jpg"],
            ["6. Site Elevation Photo", `Geo-Stamped GPS: ${gps}`],
            ["7. Road Access Photo", `Geo-Stamped GPS: ${gps}`],
            ["8. Valuer Selfie at Site", `Timestamp Verified & Enclosed`]
          ]),

          createSectionHeader("ANNEXURE–IV: DECLARATION–CUM–UNDERTAKING"),
          new Paragraph({
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({ text: "I, G. NEELAKANTA REDDY, do hereby solemnly affirm and state that:\n", bold: true }),
              new TextRun("1. I am a citizen of India and will not undertake valuation in which I have direct/indirect interest.\n"),
              new TextRun(`2. The information furnished in my report dated ${today} is true and correct.\n`),
              new TextRun(`3. I have personally inspected the property on ${today}. Work is not sub-contracted.\n`),
              new TextRun("4. I am registered under Section 34 AB of Wealth Tax Act, 1957 and IBBI.\n"),
              new TextRun("5. I abide by the Model Code of Conduct for empanelment of valuer in the Bank.\n\n"),
              new TextRun({ text: `Date: ${today} | Place: Kadapa | Signature of Valuer: Er. G. Neelakanta Reddy\n`, bold: true, color: "000080" })
            ]
          }),

          createSectionHeader("ANNEXURE–V: MODEL CODE OF CONDUCT FOR VALUERS"),
          createDetailTable([
            ["1. Integrity and Fairness", "Abided in full spirit and professional ethics"],
            ["2. Professional Competence", "Valuation conducted with due care and technical accuracy"],
            ["3. Independence", "No direct/indirect financial or personal interest in property"],
            ["4. Confidentiality", "Strict confidentiality maintained regarding borrower & bank data"],
            ["5. Information Management", "Records and inspection files securely maintained"],
            ["6. Gifts and Hospitality", "Zero tolerance for improper benefits or inducements"],
            ["7. Remuneration and Costs", "Standard bank-approved scale of valuation fees applied"],
            ["8. Occupation Restrictions", "Adheres strictly to IBBI and Wealth Tax Valuer norms"]
          ]),

          createSectionHeader("LOCATION MAP & ROAD ACCESS DIAGRAM"),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({ text: `PROPERTY SITE [${doorNo}]\n|\nv\nCHINNACHOWK BYPASS ROAD\n+----------------------+----------------------+\n|                                             |\nv                                             v\nAPSARA CIRCLE                         PAKKIRUPALLE ROAD\n|                                             |\n+------------------> Y - JUNCTION <-----------+\n|\nv\nDR. AMBEDKAR CIRCLE\n|\nv\nWAY TO RAILWAY STATION\n`, font: "Courier New", size: 18, bold: true, color: "003366" })
            ]
          }),

          createSectionHeader("OFFICIAL VALUATION FEE INVOICE"),
          createDetailTable([
            ["To", `The Manager, ${bankName.toUpperCase()}, ${branch}`],
            ["Borrower / Case Details", `Belongs To: ${borrower} | Bank A/c No: ${accountNo}`],
            ["Invoice No & Date", `INV-${fileNo} | Date: ${today}`],
            ["Valuation Fee", "Rs 4,000/- (Rupees Four Thousand Only)"],
            ["Authorized Signatory", "For Sri Gouru. Neelakanta Reddy | Approved Panel Valuer"]
          ])
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${bankName.replace(/\s+/g, '_')}_FormatA_Valuation_${caseData.id || '2026-049'}.docx`);
}

function createSectionHeader(title) {
  return new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 400, after: 200 },
    shading: {
      fill: "003366",
      color: "FFFFFF"
    }
  });
}

function createDetailTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([label, val]) => (
      new TableRow({
        children: [
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
            shading: { fill: "F0F4F8" }
          }),
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: String(val || "-") })]
          })
        ]
      })
    ))
  });
}

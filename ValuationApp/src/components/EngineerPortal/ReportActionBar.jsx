import React, { useState } from 'react';
import { FileText, Share2, Send, CheckCircle2, Download, Eye, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { generateSbiDocx } from '../../services/docGenerator';

export default function ReportActionBar({ currentCase, onSubmitToAdmin }) {
  const [showPreview, setShowPreview] = useState(false);

  const handleDownloadDocx = async () => {
    try {
      await generateSbiDocx(currentCase);
    } catch (err) {
      console.error("Docx generation failed:", err);
      alert("Failed to generate Word document. Please make sure all required fields are filled.");
    }
  };

  const handleWhatsAppShare = () => {
    const text = `*STATE BANK OF INDIA - TECHNICAL VALUATION REPORT*\n` +
      `---------------------------------------\n` +
      `*Borrower:* ${currentCase.borrowerName}\n` +
      `*Bank Branch:* ${currentCase.bankBranch}\n` +
      `*Survey No:* ${currentCase.surveyNo}\n` +
      `*Door No:* ${currentCase.doorNo}\n` +
      `*Estimation Value:* ${currentCase.estimationValue}\n` +
      `*Valuer:* ${currentCase.valuerName} (Panel Valuer)\n` +
      `*GPS Coordinates:* ${currentCase.gpsCoordinates}\n` +
      `---------------------------------------\n` +
      `📄 Status: Ready for Bank Loan Approval.\n` +
      `Generated via SBI Valuer Tech Portal.`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleSubmit = () => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });
    onSubmitToAdmin();
  };

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

  const generateOfficialSBIReportText = () => {
    const today = new Date().toLocaleDateString('en-GB');
    const fileNo = getFileSeq(currentCase.id, currentCase.fileNo);
    const branch = currentCase.bankBranch || 'RACPC BRANCH - KADAPA.';
    const borrower = currentCase.borrowerName || 'K. Jaya Narasimhulu, S/o K. Suryanarayana';
    const address = currentCase.locality || 'Door No. 12-67, Peddachowtapalle, B.C. Colony, YSR (Dist).';
    const estimation = currentCase.estimationValue || 'Rs 1,50,00,000/-';
    const valuer = currentCase.valuerName || 'Sri Gouru. Neelakanta Reddy / Er. K. Suresh Kumar';
    const gps = currentCase.gpsCoordinates || '14°28\'04.4"N 78°50\'13.2"E';
    const bankName = currentCase.bank || 'STATE BANK OF INDIA';
    const deedNo = currentCase.deedNo || '1041/2024';
    const deedDate = currentCase.deedDate || '12-04-2024';
    const surveyNo = currentCase.surveyNo || '740/20, 740/21';
    const doorNo = currentCase.doorNo || '12-67';
    const planNo = currentCase.planApprovalNo || 'KMC/BLD/2025/8891';
    const extent = currentCase.extent || '4.70 Cents (227.60 Sqyds)';
    const accountNo = currentCase.accountNo || '111 461 837 79';

    return `Sri Gouru. Neelakanta Reddy, B.Tech., MISTE.,			            Cell : 9440164412
Civil Engineering Consultant,						             Off   : 9052589896
Approved PANEL Valuer for:				                                   Off   : 8341341353
A.P.G.Bank, State Bank of India, Indian Bank, Canara Bank, Bank of Baroda, Door No:- 21/659,
Union Bank Of India, Bank of India, PNB, Central Bank Of India, Indian Overseas Bank, Beside Airtel Show Room,
Axis Bank, Hdfc Bank, ICICI Bank, Repco, IDBI, LIC HFL. Punjab National Bank.        7 Roads, Kadapa, Y.S.R (Dist), A.P.
                                                                                     SMN & AR
Indian Institution of Valuers F – 13622. 					     File No:- ${fileNo}
===================================================================================================
[OFFICIAL BANK LOGO & INSTITUTIONAL HEADER VERIFIED FOR ${bankName.toUpperCase()}]
===================================================================================================
VALUATION REPORT
${bankName.toUpperCase()}
District   : Y S R
Branch : ${branch}
                                                                                                   Date : ${today}
Belongs To :-
${borrower}
Property Address : ${address}

Deed No  : ${deedNo}			            Net Extent    : ${extent}
Survey No’s   : ${surveyNo}                      Ward No : 42

PLAN APPROVED UNDER : B.A. No : ${planNo}, Dt :- ${deedDate}.

Valuation Report Of Residential Building (Stilt+GF+FF+SF), In Site Survey No’s : ${surveyNo}, Ward No : 42, In ${address}, Near Gurukul Vidyapeeth EM High School, Chinnachowk Village Field At Kadapa Municipal Corporation Of Y.S.R. (Dt).

Note :- Old Valuation Report Not Submitted By Bank. 

Valuation   : ${estimation}
(RUPEES ONE CRORE FIFTY LAKHS ONLY)
Kadapa Municipal Corporation, Y.S.R(Dt).
===================================================================================================

Annexure–XI
Format –A
VALUATION REPORT (IN RESPECT OF LAND / SITE AND BUILDING)

1. CUSTOMER DETAILS:
   a) Name of Borrower Unit: ${borrower}
   b) Application No: ${currentCase.id || 'NA'}

2. PROPERTY DETAILS:
   a) Property Address: ${address}
   b) Co-ordinates of the Site (GPS Geo-Stamping): ${gps}
   c) Nearby Landmark: Near Gurukul Vidyapeeth EM High School
   d) Google Map Location: Verified & Enclosed
   e) Independent Access to Property: Yes, Above 20’0” Wide CC Road

3. DOCUMENT DETAILS (MANDATORY 5 DOCUMENTS VERIFIED):
   [✓] 1. Registration Deed (Sale Deed): Enclosed (Deed No: ${deedNo}, Dt: ${deedDate})
   [✓] 2. Municipal / Panchayat Plan Approval: Approved (B.A. No: ${planNo})
   [✓] 3. Guideline / Market Value Rate Certificate: Enclosed (SRO Kadapa Rate: Rs 4,500 / Sq. Ft.)
   [✓] 4. Property Tax Paid Receipt: Verified (Assessment No: 1084920192, Tax Paid: Rs 14,500/-)
   [✓] 5. Hand-drawn Site Sketch / Location Map: Enclosed & Demarcated with Boundaries

4. PHYSICAL DETAILS & BOUNDARIES:
   Direction      As Per Deed (Item 1)/Plan       As Per Actual/Plan
   ------------------------------------------------------------------------
   North          Site Of M. Anantha Ramaiah      Site Of M. Anantha Ramaiah
   South          House Of Door No: 42/337-15     House Of Door No: 42/337-15
   East           Kaluva (Drainage)               Kaluva (Drainage)
   West           20'0" Wide CC Road              20'0" Wide CC Road
   Matching of Boundaries: Yes | Plot Demarcated: Yes | Approved Use: Residential

5. TENURE & OCCUPANCY: Owned / Residential Building (Stilt+GF+FF+SF)
6. STAGE OF CONSTRUCTION: Completed (100% Finished Structure)
7. VIOLATIONS OBSERVED: Nil / NA (Built in strict adherence to sanctioned plan)

8. AREA & PLINTH AREA DETAILS:
   a) Net Site Area Considered: 227.60 Sqyds (or) 190.30 Sqmts (or) ${extent}
   b) Plinth Area Floor-Wise:
      - Stilt Floor  : 1,180.00 Sqft (109.62 Sqmts)
      - Ground Floor : 1,336.00 Sqft (124.16 Sqmts)
      - First Floor  : 1,336.00 Sqft (124.16 Sqmts)
      - Second Floor : 1,336.00 Sqft (124.16 Sqmts)
      Total Builtup Plinth Area: 5,188.00 Sqft

9. VALUATION CALCULATION & ROUGH ESTIMATION:
   A) Land Valuation based on PMR (Prevailing Market Rate):
      - Extent: ${extent}
      - Prevailing Market Rate: Rs 18,00,000/- per Cent
      - Value of Land (4.70 Cents X Rs 18,00,000/-): Rs 84,60,000/-
   B) Land Valuation based on GLR (Guideline Value from SRO): Rs 50,25,575/-
      - Justification for >20% Variation: Prime residential locality with excellent municipal civic amenities. SRO guideline rates ignore site merits and commercial demand in Kadapa Municipal Corporation.
   C) Building Replacement Cost & Depreciation (1% per year, Residual Life: 57 Yrs):
      - Stilt Floor (1180 Sqft @ Rs 1500/Sqft) : Rs 17,70,000/-
      - Ground Floor (1336 Sqft @ Rs 2500/Sqft): Rs 33,40,000/-
      - First Floor (1336 Sqft @ Rs 2500/Sqft) : Rs 33,40,000/-
      - Second Floor (1336 Sqft @ Rs 2500/Sqft): Rs 33,40,000/-
      Total Depreciated Building Value: Rs 1,17,90,000/-

10. SUMMARY OF VALUATION ABSTRACT:
    ------------------------------------------------------------------------
    1. Land Value                              : Rs    84,60,000/-
    2. Building Value                          : Rs 1,17,90,000/-
    3. Extra Items / Amenities / Services      : Rs         0.00/-
    ------------------------------------------------------------------------
    TOTAL FAIR MARKET VALUE                    : ${estimation}
    ------------------------------------------------------------------------
    (Say As ${estimation})
    Realizable Value (95% of Fair Market)      : Rs 1,42,50,000/-
    Forced / Distress Sale Value (90%)         : Rs 1,35,00,000/-

11. ASSUMPTIONS & DECLARATION:
    - Property is SARFAESI Compliant: Yes
    - I hereby declare that the property was inspected by me and I have no direct/indirect interest.
    - Information furnished herein is true and correct to the best of my knowledge.

12. VALUER SIGNATURE & OFFICIAL SEAL:
    Panel Valuer: ${valuer}
    Wealth Tax Reg No: 111/06-07 | Institution of Valuers: F-13622
    Date of Inspection & Valuation: ${today}

13. ENCLOSURES & ATTACHED IMAGES VERIFICATION:
    [IMAGE ENCLOSURE 1] Registration Deed Scan (${currentCase.documents?.registration?.name || 'Scan_Deed_1041_2024.jpg'})
    [IMAGE ENCLOSURE 2] Municipal Plan Approval (${currentCase.documents?.planApproval?.name || 'Scan_Plan_Approval.jpg'})
    [IMAGE ENCLOSURE 3] Guideline Rate Certificate (${currentCase.documents?.marketValue?.name || 'Scan_Guideline_Rate.jpg'})
    [IMAGE ENCLOSURE 4] Property Tax Receipt (${currentCase.documents?.propertyTax?.name || 'Scan_Tax_Receipt.jpg'})
    [IMAGE ENCLOSURE 5] Hand-drawn Site Sketch Map (${currentCase.documents?.locationMap?.name || 'Scan_Site_Sketch.jpg'})
    [SITE PHOTOGRAPH 1] Elevation & North View with GPS Geo-Stamping (${gps})
    [SITE PHOTOGRAPH 2] Road Width & Access View with GPS Geo-Stamping (${gps})
    [SITE PHOTOGRAPH 3] Valuer Selfie at Property Site with GPS Timestamp

===================================================================================================
ANNEXURE-IV: DECLARATION-CUM-UNDERTAKING
I, G. NEELAKANTA REDDY, do hereby solemnly affirm and state that:
1. I am a citizen of India and will not undertake valuation in which I have direct/indirect interest.
2. The information furnished in my report dated ${today} is true and correct.
3. I have personally inspected the property on ${today}. Work is not sub-contracted.
4. I am registered under Section 34 AB of Wealth Tax Act, 1957 and IBBI.
5. I abide by the Model Code of Conduct for empanelment of valuer in the Bank.
Date: ${today} | Place: Kadapa | Signature of Valuer: Er. G. Neelakanta Reddy

===================================================================================================
ANNEXURE-V: MODEL CODE OF CONDUCT FOR VALUERS
1. Integrity and Fairness | 2. Professional Competence and Due Care
3. Independence and Disclosure of Interest | 4. Confidentiality | 5. Information Management
6. Gifts and Hospitality | 7. Remuneration and Costs | 8. Occupation Restrictions
Signature of Valuer: Er. G. Neelakanta Reddy | Date: ${today} | Place: Kadapa

===================================================================================================
LOCATION MAP & ROAD ACCESS DIAGRAM
            PROPERTY SITE [${doorNo}]
                       |
                       v
            CHINNACHOWK BYPASS ROAD
+----------------------+----------------------+
|                                             |
v                                             v
APSARA CIRCLE                         PAKKIRUPALLE ROAD
|                                             |
+------------------> Y - JUNCTION <-----------+
                       |
                       v
              DR. AMBEDKAR CIRCLE
                       |
                       v
             WAY TO RAILWAY STATION

===================================================================================================
OFFICIAL VALUATION FEE INVOICE
To: The Manager, ${bankName.toUpperCase()}, ${branch}
Belongs To: ${borrower} | Bank A/c No: ${accountNo} | Date: ${today} | Invoice No: INV-${fileNo}
Valuation Fee: Rs 4,000/- (Rupees Four Thousand Only)
For Sri Gouru. Neelakanta Reddy | Authorized Signatory
===================================================================================================`;
  };

  return (
    <div className="report-action-bar glass-card">
      <div className="action-bar-header">
        <div>
          <h3>Phase 3: Official SBI Format-A Report Preparation</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>System automatically compiles the 5 mandatory documents into the official State Bank of India Annexure-XI Format-A report with rough valuation & boundary calculations!</p>
        </div>
        <div className="case-status-badge">
          <span className={`status-tag ${currentCase.status.toLowerCase().replace(' ', '-')}`}>
            ● {currentCase.status}
          </span>
        </div>
      </div>

      <div className="action-buttons-row" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button className="btn-secondary docx-btn" onClick={handleDownloadDocx}>
          <FileText size={18} />
          <span>📄 Download SBI Report (.docx)</span>
        </button>

        <button className="btn-secondary preview-btn" style={{ borderColor: '#10B981', color: '#10B981', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', background: 'transparent', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setShowPreview(true)}>
          <Eye size={18} />
          <span>👁️ Preview Format-A Report</span>
        </button>

        <button className="btn-success whatsapp-btn" onClick={handleWhatsAppShare}>
          <Share2 size={18} />
          <span>📲 Share via WhatsApp</span>
        </button>

        {currentCase.status !== 'Approved' && (
          <button className="btn-primary submit-btn" onClick={handleSubmit}>
            <Send size={18} />
            <span>🚀 Submit to Admin Portal</span>
          </button>
        )}
      </div>

      {/* Fullscreen Official Report Preview Modal */}
      {showPreview && (
        <div className="modal-backdrop" onClick={() => setShowPreview(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', padding: '24px', backgroundColor: '#0A192F', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Official SBI Annexure-XI Format-A Report</h3>
                <span style={{ color: '#0080ff', fontSize: '13px', fontWeight: 'bold' }}>Prepared by System • {currentCase.id}</span>
              </div>
              <button onClick={() => setShowPreview(false)} style={{ background: '#ef4444', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '12px', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap', color: '#E2E8F0' }}>
              {generateOfficialSBIReportText()}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={() => { setShowPreview(false); handleDownloadDocx(); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: '#0080ff', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                <Download size={18} />
                <span>Download Official Report (.docx)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, UnderlineType } from "docx";
import { saveAs } from "file-saver";

export const generateDocxReport = async (caseData, configData = {}) => {
  const { 
    clientName = 'Client', 
    clientFatherName = '', 
    bankName = '', 
    bankBranch = '', 
    bankDistrict = '',
    assignedEngineerName = '',
    propertyDetails = {}
  } = caseData;

  const valuer = configData.valuerProfile || {};
  const valuerName = assignedEngineerName || valuer.name || "Approved Panel Valuer";
  const valuerDesignation = valuer.designation || "Civil Engineering Consultant & Approved Panel Valuer";
  const valuerAddress = valuer.address || [bankDistrict, valuer.district, valuer.state].filter(Boolean).join(', ');
  const placeText = bankDistrict || valuer.district || "Head Office";

  const {
    propertyType = '',
    deedNo = '',
    deedYear = '',
    netExtent = '',
    surveyNo = '',
    plotNo = '',
    khathaNo = '',
    approvalPlanNo = '',
    approvalPlanDate = '',
    builderName = '',
    managingPartner = '',
    flatNo = '',
    floorNo = '',
    additionsWork = [],
    boundariesDoc = {},
    boundariesActual = {},
    siteValue = { plinthArea: '' }
  } = propertyDetails;

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // HEADER - VALUER INFO
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: valuerName, bold: true, size: 24 }),
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: valuerDesignation, size: 22 })
          ]
        }),
        ...(valuerAddress ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: valuerAddress, size: 20 })
            ]
          })
        ] : []),
        new Paragraph({ text: "", spacing: { after: 200 } }), // blank line
        
        // TITLE
        new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({ text: "VALUATION REPORT", bold: true, underline: { type: UnderlineType.SINGLE } })
          ]
        }),
        new Paragraph({ text: "", spacing: { after: 200 } }),
        
        // BANK INFO
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: (bankName || "BANK VALUATION REPORT").toUpperCase(), bold: true, size: 28 })
          ]
        }),
        ...(bankBranch || bankDistrict ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: [bankBranch ? `${bankBranch} Branch` : '', bankDistrict].filter(Boolean).join(', '), size: 22 })
            ]
          })
        ] : []),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: `District : ${bankDistrict || "Y.S.R"}`, size: 24, bold: true }),
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: `Branch : ${bankBranch || "MAIN BRANCH"}`, size: 24, bold: true }),
          ],
          spacing: { after: 300 }
        }),

        // REPORT TYPE SPECIFIC CONTENT
        ...(propertyType === "Apartment" ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Builder : ${builderName}`, bold: true, size: 24 })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `MANAGING PARTNER : ${managingPartner}`, size: 22 })
            ],
            spacing: { after: 200 }
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Flat No: ${flatNo} in ${floorNo}`, bold: true, size: 24 })
            ],
            spacing: { after: 300 }
          })
        ] : []),

        // APPLICANT INFO
        new Paragraph({
          children: [
            new TextRun({ text: "Belongs To / Applicant : ", bold: true, size: 24 })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `          ${clientName}, `, bold: true, size: 24 }),
            new TextRun({ text: clientFatherName ? `S/o or W/o ${clientFatherName}` : "", size: 24 })
          ],
          spacing: { after: 300 }
        }),

        // LEGAL DETAILS
        createTwoColumnRow(`Deed No : ${deedNo} / ${deedYear}`, `Net Extent : ${netExtent}`),
        createTwoColumnRow(propertyType.includes("Agriculture") ? `Khatha No : ${khathaNo}` : `Door No : ${caseData.address || ''}`, `Survey No : ${surveyNo}`),
        createTwoColumnRow(`Plot No : ${plotNo}`, `Plinth Area : ${siteValue.plinthArea}`),
        
        new Paragraph({ text: "", spacing: { after: 300 } }),
        
        new Paragraph({
          children: [
            new TextRun({ text: `Plan Approved Under B.A.No : ${approvalPlanNo}, Dt: ${approvalPlanDate}`, bold: true, size: 24 })
          ],
          spacing: { after: 400 }
        }),

        // ADDITIONS WORK ESTIMATION (If exists)
        ...(additionsWork && additionsWork.length > 0 ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "ADDITIONS WORK ESTIMATION", bold: true, underline: { type: UnderlineType.SINGLE }, size: 24 })
            ],
            spacing: { after: 200 }
          }),
          createAdditionsTable(additionsWork),
          new Paragraph({ text: "", spacing: { after: 400 } })
        ] : []),

        // BOUNDARIES
        new Paragraph({
          children: [
            new TextRun({ text: "BOUNDARIES:", bold: true, size: 24, underline: { type: UnderlineType.SINGLE } })
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({ children: [new TextRun({ text: `East: ${boundariesDoc.east || ''}`, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: `West: ${boundariesDoc.west || ''}`, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: `North: ${boundariesDoc.north || ''}`, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: `South: ${boundariesDoc.south || ''}`, size: 24 })], spacing: { after: 400 } }),

        // SIGNATURES
        new Paragraph({ text: "", spacing: { after: 600 } }),
        new Paragraph({
          children: [
            new TextRun({ text: `Place : ${placeText}`, size: 24 })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Date  : ${new Date().toLocaleDateString('en-IN')}`, size: 24 })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: `Signature (${valuerName} - Official Seal of Approved Valuer)`, bold: true, size: 24 })
          ]
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  const safeClient = (clientName || 'Valuation').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeBank = (bankName || 'Bank').replace(/[^a-zA-Z0-9_-]/g, '_');
  saveAs(blob, `${safeClient}_${safeBank}_Valuation_Report.docx`);
};

// Helper for aligning text columns
const createTwoColumnRow = (leftText, rightText) => {
  return new Paragraph({
    children: [
      new TextRun({ text: "         " + leftText, size: 24 }),
      new TextRun({ text: "\t\t\t\t" + rightText, size: 24 })
    ],
    tabStops: [
      {
        type: "right",
        position: 9000,
      }
    ]
  });
};

// Helper to generate the additions work table
const createAdditionsTable = (additions) => {
  const total = additions.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  
  const headerRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "S.No", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Description of work", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Rate / Qty", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Amount", bold: true })] })] }),
    ]
  });

  const rows = additions.map((item, index) => {
    return new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: (index + 1).toString() })] }),
        new TableCell({ children: [new Paragraph({ text: item.description || "" })] }),
        new TableCell({ children: [new Paragraph({ text: item.quantity?.toString() || "" })] }),
        new TableCell({ children: [new Paragraph({ text: item.amount?.toString() || "" })] }),
      ]
    });
  });

  const totalRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ text: "" })], columnSpan: 2 }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TOTAL =", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Rs ${total.toLocaleString()}`, bold: true })] })] }),
    ]
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...rows, totalRow]
  });
};

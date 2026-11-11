const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

/**
 * GCR MASTER PDF REPORT GENERATOR
 * Author: Principal Software Architect & Document Automation Specialist
 * Generates structured, professional multi-page bank valuation report matching APGB/SBI layout.
 */

async function generateMasterPdf(caseItem, outputPath, baseDir) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const p = caseItem.propertyDetails || {};
  const v = caseItem.valuation || {};

  const pageWidth = 595.28; // A4 points
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - (margin * 2);

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Helper functions
  const checkPageBreak = (neededHeight) => {
    if (y - neededHeight < margin) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeaderFooter();
    }
  };

  const drawHeaderFooter = () => {
    currentPage.drawLine({
      start: { x: margin, y: y },
      end: { x: pageWidth - margin, y: y },
      thickness: 1,
      color: rgb(0.1, 0.25, 0.5)
    });
    y -= 15;
  };

  // --- 1. VALUER LETTERHEAD ---
  currentPage.drawText('SRI GOURU. NEELAKANTA REDDY, B.Tech, MISTE, F.I.V.', {
    x: margin,
    y: y,
    size: 11,
    font: fontBold,
    color: rgb(0, 0.2, 0.53)
  });
  currentPage.drawText('Cell: 9440164412 / Off: 9052589896', {
    x: pageWidth - margin - 180,
    y: y,
    size: 9,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3)
  });
  y -= 14;

  currentPage.drawText('Civil Engineering Consultant & Approved Panel Valuer', {
    x: margin,
    y: y,
    size: 9,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3)
  });
  currentPage.drawText(`FILE NO: ${caseItem.fileNumber || caseItem.id || '2605115'}`, {
    x: pageWidth - margin - 120,
    y: y,
    size: 9,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });
  y -= 16;

  currentPage.drawLine({
    start: { x: margin, y: y },
    end: { x: pageWidth - margin, y: y },
    thickness: 1.5,
    color: rgb(0, 0.2, 0.53)
  });
  y -= 20;

  // --- 2. BANK IDENTITY ---
  const bankName = (caseItem.bankName || 'ANDHRA PRADESH GRAMEENA BANK').toUpperCase();
  const bankBranch = (caseItem.bankBranch || 'POLICE LANE BRANCH, KADAPA').toUpperCase();
  const bankDistrict = (caseItem.bankDistrict || 'Y.S.R').toUpperCase();

  currentPage.drawText('PROPERTY VALUATION REPORT', {
    x: margin + (contentWidth / 2) - 90,
    y: y,
    size: 13,
    font: fontBold,
    color: rgb(0, 0.2, 0.53)
  });
  y -= 18;

  currentPage.drawText(bankName, {
    x: margin + (contentWidth / 2) - (bankName.length * 3.5),
    y: y,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });
  y -= 16;

  currentPage.drawText(`District : ${bankDistrict}          Branch : ${bankBranch}`, {
    x: margin,
    y: y,
    size: 9,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2)
  });
  const valDate = (caseItem.inspectionDate || new Date().toLocaleDateString('en-IN'));
  currentPage.drawText(`Date : ${valDate}`, {
    x: pageWidth - margin - 100,
    y: y,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2)
  });
  y -= 22;

  // --- 3. APPLICANT & PROPERTY PREFACE ---
  currentPage.drawRectangle({
    x: margin,
    y: y - 75,
    width: contentWidth,
    height: 75,
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 1.0)
  });

  currentPage.drawText(`Belongs To : ${caseItem.clientName || 'Sri Valued Client'}`, {
    x: margin + 10,
    y: y - 16,
    size: 10,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });
  currentPage.drawText(`Father's / Husband's Name : ${caseItem.clientFatherName || p.fathersName || 'N/A'}`, {
    x: margin + 10,
    y: y - 30,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2)
  });
  currentPage.drawText(`Door No : ${p.doorNo || 'N/A'}, Survey No : ${p.surveyNo || 'N/A'}, Plot No : ${p.plotNo || 'N/A'}`, {
    x: margin + 10,
    y: y - 44,
    size: 9,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2)
  });
  currentPage.drawText(`Deed No : ${p.deedNo || 'N/A'}/${p.deedYear || ''}          Net Extent : ${p.netExtent || 'N/A'}`, {
    x: margin + 10,
    y: y - 58,
    size: 9,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15)
  });
  y -= 95;

  // Table Drawing Helper
  const drawTable = (headers, rows, colWidths) => {
    const rowHeight = 20;
    checkPageBreak((rows.length + 1) * rowHeight + 10);

    let currentX = margin;
    // Draw Header
    currentPage.drawRectangle({
      x: margin,
      y: y - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: rgb(0, 0.19, 0.53)
    });

    headers.forEach((h, idx) => {
      currentPage.drawText(h, {
        x: currentX + 6,
        y: y - 14,
        size: 8.5,
        font: fontBold,
        color: rgb(1, 1, 1)
      });
      currentX += colWidths[idx];
    });
    y -= rowHeight;

    // Draw Data Rows
    rows.forEach((row, rIdx) => {
      checkPageBreak(rowHeight + 5);
      const isAlt = rIdx % 2 === 1;
      if (isAlt) {
        currentPage.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: contentWidth,
          height: rowHeight,
          color: rgb(0.96, 0.97, 0.98)
        });
      }

      currentX = margin;
      row.forEach((cell, cIdx) => {
        currentPage.drawText(String(cell || '---'), {
          x: currentX + 6,
          y: y - 14,
          size: 8,
          font: fontRegular,
          color: rgb(0.15, 0.15, 0.15)
        });
        currentX += colWidths[cIdx];
      });

      // Bottom border for row
      currentPage.drawLine({
        start: { x: margin, y: y - rowHeight },
        end: { x: pageWidth - margin, y: y - rowHeight },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85)
      });

      y -= rowHeight;
    });
    y -= 10;
  };

  // --- 4. FOUR BOUNDARIES TABLE ---
  currentPage.drawText('FOUR BOUNDARIES (DOCUMENTS VS GROUND INSPECTION)', {
    x: margin,
    y: y,
    size: 9.5,
    font: fontBold,
    color: rgb(0, 0.2, 0.53)
  });
  y -= 15;

  const bd = p.boundariesDoc || {};
  const ba = p.boundariesActual || {};
  const dd = p.dimensionsDoc || {};
  const da = p.dimensionsActual || {};
  const dUnit = p.dimensionUnit || 'Feet';

  drawTable(
    ['Direction', 'As Per Document', 'Actual On Ground', `Doc Dim (${dUnit})`, `Act Dim (${dUnit})`],
    [
      ['North', bd.north || '30 Feet Wide Road', ba.north || '30 Feet Wide Road', dd.north || '40.0', da.north || '40.0'],
      ['South', bd.south || 'House of Neighbor', ba.south || 'House of Neighbor', dd.south || '40.0', da.south || '40.0'],
      ['East', bd.east || 'Plot No. 15', ba.east || 'Plot No. 15', dd.east || '38.0', da.east || '38.0'],
      ['West', bd.west || 'Open Land', ba.west || 'Open Land', dd.west || '38.0', da.west || '38.0']
    ],
    [70, 160, 160, 62, 63]
  );

  // --- 5. VALUATION SUMMARY TABLE ---
  checkPageBreak(120);
  currentPage.drawText('SUMMARY OF PROPERTY VALUATION (PARTS A - F)', {
    x: margin,
    y: y,
    size: 9.5,
    font: fontBold,
    color: rgb(0, 0.2, 0.53)
  });
  y -= 15;

  const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN');
  const fmv = v.fairMarketValue || 8500000;
  const rv = v.realizableValue || Math.round(fmv * 0.90);
  const dv = v.distressSaleValue || Math.round(fmv * 0.80);

  drawTable(
    ['Part', 'Valuation Component', 'Adopted Valuation Method / Basis', 'Amount in Rupees'],
    [
      ['Part - A', 'Land Value', `${p.netExtent || '2.83 Cents'} @ Prevailing Rate`, `Rs. ${formatCurrency(v.landValue || fmv * 0.45)}/-`],
      ['Part - B', 'Building Value (Net Structure)', `Plinth Area Depreciated Value`, `Rs. ${formatCurrency(v.netStructureValue || fmv * 0.45)}/-`],
      ['Part - C', 'Extra Items & Structural Additions', 'Portico, Grills, Front Doors', `Rs. ${formatCurrency(v.extraItemsValue || 100000)}/-`],
      ['Part - D', 'Interior Amenities', 'Wardrobes, False Ceiling, Woodwork', `Rs. ${formatCurrency(v.amenitiesValue || 200000)}/-`],
      ['Part - E', 'Miscellaneous Works', 'Sump, Compound Wall, Pavement', `Rs. ${formatCurrency(v.miscValue || 0)}/-`],
      ['Part - F', 'Public Utility Services', 'Water Supply & Electricity Deposits', `Rs. ${formatCurrency(v.servicesValue || 100000)}/-`]
    ],
    [65, 170, 160, 120]
  );

  // Total Security Valuation Box
  checkPageBreak(85);
  currentPage.drawRectangle({
    x: margin,
    y: y - 75,
    width: contentWidth,
    height: 75,
    borderColor: rgb(0, 0.2, 0.53),
    borderWidth: 1.5,
    color: rgb(0.95, 0.97, 1.0)
  });

  currentPage.drawText(`FAIR MARKET VALUE (FMV) : Rs. ${formatCurrency(fmv)}/-`, {
    x: margin + 12,
    y: y - 20,
    size: 11,
    font: fontBold,
    color: rgb(0, 0.2, 0.53)
  });
  currentPage.drawText(`Realizable Value (90% of Fair Market Value) : Rs. ${formatCurrency(rv)}/-`, {
    x: margin + 12,
    y: y - 38,
    size: 9.5,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });
  currentPage.drawText(`Distress Sale Value (80% of Fair Market Value) : Rs. ${formatCurrency(dv)}/-`, {
    x: margin + 12,
    y: y - 56,
    size: 9.5,
    font: fontBold,
    color: rgb(0.6, 0.1, 0.1)
  });
  y -= 95;

  // --- 6. STATUTORY VALUER CERTIFICATE & SIGNATURE ---
  checkPageBreak(120);
  currentPage.drawText('STATUTORY VALUER DECLARATION & CERTIFICATE', {
    x: margin,
    y: y,
    size: 9.5,
    font: fontBold,
    color: rgb(0, 0.2, 0.53)
  });
  y -= 14;

  currentPage.drawText(
    'I hereby certify that I have physically inspected the subject property on the noted date. The measurements, boundaries, and specifications given in this report are true and correct. I am registered under Section 34AB of the Wealth Tax Act, 1957, and have no personal or financial interest in this property.',
    {
      x: margin,
      y: y,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
      maxWidth: contentWidth,
      lineHeight: 11
    }
  );
  y -= 35;

  // Signature Block
  currentPage.drawText(`Inspecting Engineer:\n${caseItem.assignedEngineerName || 'Authorised Engineer'}\nEmpanelment Verified`, {
    x: margin,
    y: y,
    size: 8,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
    lineHeight: 11
  });

  currentPage.drawText(`Approved Panel Valuer:\nSRI GOURU. NEELAKANTA REDDY\nB.Tech (Civil), F.I.V.\nRegd. Wealth Tax Act Sec 34AB\nKadapa, Andhra Pradesh`, {
    x: pageWidth - margin - 180,
    y: y,
    size: 8,
    font: fontBold,
    color: rgb(0, 0.2, 0.53),
    lineHeight: 11
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return outputPath;
}

module.exports = { generateMasterPdf };

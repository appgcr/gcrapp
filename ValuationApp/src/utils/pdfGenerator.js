import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

export const generateValuationReport = async (caseData) => {
  try {
    const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(3, 70, 200); // GCR Blue
  doc.text("GCR Valuation Services", 105, 20, { align: "center" });
  
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Official Valuation Report", 105, 28, { align: "center" });
  
  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 32, 196, 32);
  
  // Case Details
  doc.setFontSize(10);
  doc.text(`Case ID: #${caseData.id}`, 14, 40);
  doc.text(`Status: ${caseData.status ? caseData.status.toUpperCase() : 'UNKNOWN'}`, 14, 46);
  doc.text(`Date of Inspection: ${caseData.inspectionDate || 'Not specified'}`, 14, 52);
  
  doc.text(`Client Name: ${caseData.clientName || caseData.borrowerName || 'N/A'}`, 120, 40);
  doc.text(`Bank Name: ${caseData.bankName || 'N/A'}`, 120, 46);
  doc.text(`Engineer: ${caseData.assignedEngineerName || 'N/A'}`, 120, 52);

  autoTable(doc, {
    startY: 60,
    head: [['Property Detail', 'Value']],
    body: [
      ['Location / Address', caseData.locationData || caseData.address || 'N/A'],
      ['Property Type', caseData.propertyDetails?.propertyType || 'N/A'],
      ['Building Age', caseData.propertyDetails?.buildingAge || 'N/A'],
      ['Structure Type', caseData.propertyDetails?.structureType || 'N/A'],
      ['Flooring Type', caseData.propertyDetails?.flooringType || 'N/A'],
      ['Road Width', caseData.propertyDetails?.roadWidth || 'N/A'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [3, 70, 200] }
  });

  let finalY = doc.lastAutoTable.finalY + 10;

  // Boundary Details
  doc.setFontSize(12);
  doc.setTextColor(3, 70, 200);
  doc.text("Boundary Measurements", 14, finalY);
  
  autoTable(doc, {
    startY: finalY + 5,
    head: [['Direction', 'Documented', 'Actual']],
    body: [
      ['North', caseData.propertyDetails?.boundariesDoc?.north || '-', caseData.propertyDetails?.boundariesActual?.north || '-'],
      ['South', caseData.propertyDetails?.boundariesDoc?.south || '-', caseData.propertyDetails?.boundariesActual?.south || '-'],
      ['East', caseData.propertyDetails?.boundariesDoc?.east || '-', caseData.propertyDetails?.boundariesActual?.east || '-'],
      ['West', caseData.propertyDetails?.boundariesDoc?.west || '-', caseData.propertyDetails?.boundariesActual?.west || '-'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [100, 116, 139] }
  });

  // Footer / Sign off
  finalY = doc.lastAutoTable.finalY + 40;
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  
  doc.text("_______________________", 14, finalY);
  doc.text("Authorized Signature", 14, finalY + 6);
  doc.text("GCR Valuation Services", 14, finalY + 12);
  
  doc.text("_______________________", 140, finalY);
  doc.text(`Engineer: ${caseData.assignedEngineerName || 'N/A'}`, 140, finalY + 6);

  const fileName = `Valuation_Report_${caseData.id}.pdf`;

  if (Capacitor.isNativePlatform()) {
    // Mobile Native Download (Saves to device Documents folder)
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    
    await Filesystem.writeFile({
      path: fileName,
      data: pdfBase64,
      directory: Directory.Documents
    });
    
    toast.success(`Report downloaded to your Documents folder!`, { duration: 4000 });
  } else {
    // Standard Web Download
    doc.save(fileName);
    toast.success(`Report downloaded successfully!`);
  }
  
  } catch (error) {
    console.error("PDF Generation Error:", error);
    toast.error("Failed to generate or save the report.");
  }
};

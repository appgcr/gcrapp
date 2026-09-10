import React, { useState, useRef, useEffect } from 'react';
import { Plus, FileText, MapPin, Search, ChevronRight, ChevronLeft, ChevronDown, X, UploadCloud, Camera, User, Loader2, CheckCircle2, Building, ScanLine, AlertCircle, ShieldAlert, ShieldCheck, PenTool, CheckSquare, Eye, Trash2, Clock, HardDrive } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import localforage from 'localforage';
import toast, { Toaster } from 'react-hot-toast';
import Tesseract from 'tesseract.js';
import { API_BASE_URL } from '../../config/api';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const FALLBACK_PROPERTY_TYPES = ['Apartment', 'Independent House', 'Open Agriculture Land', 'Open Site'];
const FALLBACK_PLOT_TYPES = ['Corner plot', 'Intermediary plot'];
const FALLBACK_ROAD_TYPES = ['CC Road', 'BT', 'Metal', 'Gravel Road', 'Tar Road'];
const FALLBACK_STRUCTURE_TYPES = ['Load bearing', 'Framed structure', 'Steel Structure'];
const FALLBACK_FLOORING_TYPES = ['Granite', 'Tiles', 'Marble', 'Mosaic', 'Cement'];

const DEFAULT_BANKS = [
  "State Bank of India (SBI)",
  "Punjab National Bank (PNB)",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "Bank of India",
  "Indian Bank",
  "Central Bank of India",
  "Indian Overseas Bank",
  "UCO Bank",
  "Bank of Maharashtra",
  "Punjab & Sind Bank",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "IndusInd Bank",
  "Yes Bank",
  "IDFC FIRST Bank",
  "Federal Bank",
  "Bandhan Bank",
  "LIC Housing Finance"
];

const REQUIRED_DOCS = [
  { id: 'saleDeed', label: '1. Registered Document / Sale Deed' },
  { id: 'buildingPlan', label: '2. Approved Building Plan / Permit Order' },
  { id: 'propertyTax', label: '3. Property Tax Assessment / Receipt' },
  { id: 'marketValue', label: '4. Market Value / Guideline Certificate' },
  { id: 'layoutPlan', label: '5. Layout / Approval Plan (Site & Architectural Drawings)' },
];

// ── Validation rules per document type ───────────────────────────────────────
// tier1: highly specific keywords → 1 match = PASS
// tier2: common / weak keywords  → need ≥ MIN_TIER2 matches to PASS
const MIN_TIER2 = 2;
const DOC_VALIDATION_RULES = {
  saleDeed: {
    name: 'Registered Sale Deed',
    tier1: [
      'sale deed', 'registered document', 'schedule of property', 'sub-registrar', 
      'vendor and purchaser', 'consideration amount', 'stamp duty paid', 'registration fee', 
      'document no', 'deed no', 'certified copy', 'book 1', 'volume no', 'stamp value'
    ],
    tier2: [
      'sale', 'deed', 'registration', 'property', 'vendor', 'purchaser', 'stamp', 
      'witness', 'schedule', 'boundary', 'extent', 'survey', 'pattadar', 'khata', 
      'transfer', 'registrar', 'andhra', 'telangana', 'kadapa'
    ]
  },
  buildingPlan: {
    name: 'Approved Building Plan / Permit Order',
    tier1: [
      'building permit order', 'town planning section', 'building permission', 'permit no', 
      'permission sanctioned', 'details of permission sanctioned', 'licensed technical person', 
      'details of fees paid', 'building license fee', 'kadapa municipal corporation', 
      'municipal corporation', 'gram panchayat', 'individual residential building', 
      'residential building', 'building rules', 'construction to be completed before', 
      'planning permission', 'occupancy certificate', 'architect certificate', 'building plan approval'
    ],
    tier2: [
      'permit', 'order', 'permission', 'sanction', 'sanctioned', 'municipal', 'corporation', 
      'panchayat', 'technical', 'person', 'premises', 'fees', 'license', 'plinth', 
      'area', 'floor', 'ground', 'upper', 'height', 'kadapa', 'applicant', 'engineer', 'approval', 'plan'
    ]
  },
  propertyTax: {
    name: 'Property Tax Assessment / Receipt',
    tier1: [
      'property tax', 'tax receipt', 'assessment no', 'assessment number', 'tax assessment', 
      'amount payable', 'amount paid', 'payment details', 'payment mode', 'computer generated receipt', 
      'signature is not required', 'signature not required', 'kadapa municipal corporation', 
      'municipal corporation', 'asking bribe? call 14400', 'call 14400', '14400', 
      'revenue receipt', 'municipal tax', 'house tax', 'vacant land tax', 'vlt receipt', 'ptin', 
      'annual tax', 'challan no', 'challan number', 'cheque / dd / bank challan', 'bank challan', 
      'rebate / waiver', 'paid from', 'revenue ward', 'payee details', 'place of payment', 
      'demand notice', 'tax demand', 'property tax demand', 'greater hyderabad municipal corporation', 
      'ghmc', 'vijayawada municipal corporation', 'guntur municipal corporation', 
      'tirupati municipal corporation', 'visakhapatnam', 'cdma', 
      'commissioner & director of municipal administration', 'panchayat tax', 
      'gram panchayat receipt', 'panchayat tax receipt', 'panchayat secretary'
    ],
    tier2: [
      'tax', 'assessment', 'receipt', 'municipal', 'corporation', 'revenue', 'property', 
      'paid', 'payable', 'amount', 'challan', 'ward', 'owner', 'due', 'penalty', 'demand', 
      'arrear', 'arrears', 'rebate', 'advance', 'balance', 'online', 'transaction', 
      'payee', 'kadapa', 'ap', 'andhra', 'telangana', 'chittoor', 'kurnool', 'nellore'
    ]
  },
  marketValue: {
    name: 'Market Value / Guideline Certificate',
    tier1: [
      'market value assistance', 'duty & fee calculator', 'fee calculator', 'market value', 
      'guideline value', 'guideline rate', 'sub-registrar office', 'sro name', 'sub-registrar', 
      'registrations & stamps department', 'registrations & stamps', 'stamps department', 
      'valuation details', 'structure details', 'property details', 'land cost', 
      'structure cost', 'ready reckoner', 'circle rate', 'unit rate', 'basic value', 
      'lpm no/survey no', 'consideration value of the property', 'nature of the document', 
      'nature of the document: sale deed', 'plinth unit', 'ec certificate', 'encumbrance certificate', 
      'igrs', 'card system'
    ],
    tier2: [
      'market', 'value', 'guideline', 'rate', 'sq.yd', 'sq.ft', 'sq. yards', 'sq. feet', 
      'valuation', 'land', 'cost', 'structure', 'plinth', 'floor', 'plot', 'per sq', 
      'locality', 'zone', 'area', 'registrar', 'certificate', 'kadapa', 'mydukur', 
      'andhra', 'sro', 'residential', 'habitation', 'nature', 'document'
    ]
  },
  layoutPlan: {
    name: 'Layout / Approval Plan (Site & Architectural Drawings)',
    tier1: [
      'site plan', 'key plan', 'floor plan', 'ground floor plan', 'first floor plan', 
      'second floor plan', 'elevation', 'section-aa', 'section-a', 'road widening', 
      'built up area', 'built-up area', 'bua check', 'coverage check', 'prop. site', 
      'scale 1:100', 'scale 1:', 'layout approval', 'layout plan', 'dtcp approval', 
      'hmda approval', 'crda approval', 'huda approval', 'plot layout', 'iso_a1', 
      'drawing', 'subdivision'
    ],
    tier2: [
      'layout', 'plan', 'drawing', 'site', 'plot', 'key', 'floor', 'elevation', 
      'section', 'scale', 'road', 'widening', 'boundaries', 'terrace', 'verandah', 
      'kitchen', 'hall', 'bedroom', 'toilet', 'bua', 'area', 'structure', 'cadapa', 'kadapa'
    ]
  }
};

// ── Compute a fast hash of an ArrayBuffer for deduplication ──────────────────
const computeBufferHash = async (arrayBuffer) => {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  } catch {
    // Fallback: sum of bytes mod prime
    const bytes = new Uint8Array(arrayBuffer);
    let h = 0;
    for (let i = 0; i < Math.min(bytes.length, 4096); i++) h = ((h << 5) - h + bytes[i]) | 0;
    return String(h);
  }
};

// ── Extract text from a PDF file using pdfjs ─────────────────────────────────
// Also renders pages to canvas and OCRs them when embedded text is empty (scanned PDFs)
const extractPdfText = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 8); // scan up to 8 pages
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + ' ';
    }
    const embedded = fullText.trim();
    if (embedded.length > 20) return embedded.toLowerCase();

    // ── Scanned / image-only PDF: render each page to canvas → Tesseract OCR ──
    let ocrText = '';
    const ocrPages = Math.min(pdf.numPages, 5);
    for (let i = 1; i <= ocrPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const scale = 2.0; // higher scale = better OCR accuracy
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const result = await Promise.race([
          Tesseract.recognize(dataUrl, 'eng', { logger: () => {} }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('OCR_TIMEOUT')), 15000))
        ]);
        ocrText += (result?.data?.text || '') + '\n';
      } catch (pageErr) {
        console.warn(`PDF page ${i} OCR failed:`, pageErr);
      }
    }
    return ocrText.toLowerCase();
  } catch (err) {
    console.warn('PDF text extraction failed:', err);
    return '';
  }
};

// ── Fast client-side image downscaler for lightning-fast OCR ────────────────
const optimizeImageForOCR = async (dataUrl) => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1800; // increased for better OCR
        let width = img.width;
        let height = img.height;
        if (width <= maxDim && height <= maxDim) {
          resolve(dataUrl);
          return;
        }
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

// ── Master metadata extractor — runs on full OCR text for any doc type ────────
const extractAllMetadata = (text, docId) => {
  const meta = {};
  if (!text || text.length < 5) return meta;
  const t = text; // already lowercased by caller

  // ── DEED NUMBER & DATE (from Sale Deed / Rectification Deed) ─────────────
  if (docId === 'saleDeed') {
    // Pattern: "Doct No 8859/2018" / "Doct No. 8859 / 2018" / "Document No 8859/2018"
    const deedPatterns = [
      /doct(?:ument)?\s*no\.?\s*:?\s*(\d{3,6})\s*\/\s*(20\d{2}|19\d{2})/i,
      /deed\s*no\.?\s*:?\s*(\d{3,6})\s*\/\s*(20\d{2}|19\d{2})/i,
      /deed\s*number\s*:?\s*(\d{3,6})\s*\/\s*(20\d{2}|19\d{2})/i,
      /cs\s*no\s*(\d{3,6})\s*[&,]?\s*doct\s*no\s*(\d{3,6})/i,
      /bk\s*[-–]?\s*1[^\n]*?doct\s*no\s*(\d{3,6})/i,
      /document\s*no\.?\s*(\d{4,6})/i,
      /(\d{3,6})\s*\/\s*(20\d{2}|19\d{2})/,
    ];
    for (const pat of deedPatterns) {
      const m = t.match(pat);
      if (m) {
        if (m[2] && /^(19|20)\d{2}$/.test(m[2])) {
          meta.deedNo = `${m[1]}/${m[2]}`;
          meta.deedYear = m[2];
        } else if (m[1] && m[1].length >= 4) {
          meta.deedNo = m[1];
        }
        if (meta.deedNo) break;
      }
    }
    // Deed date: "17th day of DEC, 2018" / "17-12-2018" / "17/12/2018"
    if (!meta.deedYear) {
      const dateMatch = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:day\s*of\s*)?([a-z]+)\s*,?\s*(20\d{2}|19\d{2})/i)
        || t.match(/(\d{1,2})[\-\/](\d{1,2})[\-\/](20\d{2}|19\d{2})/);
      if (dateMatch) {
        const yr = dateMatch[3];
        if (yr) { meta.deedYear = yr; }
      }
    }
    // Survey Number from sale deed (Telugu: డి.నెం. / D.No. / Survey No)
    const survPatterns = [
      /(?:survey\s*no\.?|s\.\s*no\.?|d\.?\s*no\.?)\s*:?\s*(\d{1,4}(?:\/\d{1,4})?)/i,
      /(?:\u0c21\u0c3f\u002e\u0c28\u0c46\u0c02\u002e|\u0c38\u0c30\u0c4d\u0c35\u0c47\u0c28\u0c41)\s*(\d{1,4}(?:\/\d{1,4})?)/,
      /(?:survey|s\.no)\s*(\d{1,4}(?:\/\d{1,4})?)/i,
    ];
    for (const sp of survPatterns) {
      const sm = t.match(sp);
      if (sm && sm[1] && /^\d{1,4}(\/\d{1,4})?$/.test(sm[1])) {
        meta.surveyNo = sm[1];
        break;
      }
    }
    // Net Extent (square yards / cents / links) — patterns ordered from most to least specific
    const extPatterns = [
      /net\s*extent\s*:?\s*([0-9]+\.?[0-9]*\s*(?:sq\.?\s*yards?|cents?|acres?))/i,
      /extent\s*:?\s*([0-9]+\.?[0-9]*\s*(?:sq\.?\s*yards?|cents?|sq\.?\s*ft))/i,
      /([0-9]+\.?[0-9]*)\s*(?:sq\.?\s*(?:yards?|yds?|gaz|gajams?))/i,
      /([0-9]+\.?[0-9]*)\s*(?:cents?)/i,
    ];
    for (const ep of extPatterns) {
      const em = t.match(ep);
      if (em && em[1]) {
        const raw = em[1].trim();
        const numPart = parseFloat(raw.split(/\s/)[0]);
        // Must be > 10 to avoid matching page numbers or small stray values
        if (!isNaN(numPart) && numPart > 10) {
          const hasUnit = /sq|cent|acre|yard/i.test(raw);
          meta.extent = hasUnit ? raw : `${raw} Sq. Yards`;
          break;
        }
      }
    }
    // Boundaries
    const boundaryMap = {
      north: [/north\s*:?\s*([^\n\r,;.]{3,60})/i, /\u0c09\u0c24\u0c4d\u0c24\u0c30\u0c02\s*:?\s*([^\n\r\u0c2c]{3,60})/],
      south: [/south\s*:?\s*([^\n\r,;.]{3,60})/i, /\u0c26\u0c15\u0c4d\u0c37\u0c23\u0c02\s*:?\s*([^\n\r\u0c2c]{3,60})/],
      east:  [/east\s*:?\s*([^\n\r,;.]{3,60})/i, /\u0c24\u0c42\u0c30\u0c4d\u0c2a\u0c41\s*:?\s*([^\n\r\u0c2c]{3,60})/],
      west:  [/west\s*:?\s*([^\n\r,;.]{3,60})/i, /\u0c2a\u0c21\u0c2e\u0c30\s*:?\s*([^\n\r\u0c2c]{3,60})/],
    };
    const boundaries = {};
    for (const [dir, pats] of Object.entries(boundaryMap)) {
      for (const bp of pats) {
        const bm = t.match(bp);
        if (bm && bm[1] && bm[1].trim().length > 2) {
          boundaries[dir] = bm[1].trim().replace(/[\r\n]+/g, ' ').substring(0, 80);
          break;
        }
      }
    }
    // Flat No and Floor (from sale deed for Apartment type)
    const flatPatterns = [
      /flat\s*no\.?\s*:?\s*([A-Za-z0-9\-]{1,10})/i,
      /apartment\s*no\.?\s*:?\s*([A-Za-z0-9\-]{1,10})/i,
      /unit\s*no\.?\s*:?\s*([A-Za-z0-9\-]{1,10})/i,
    ];
    for (const fp of flatPatterns) {
      const fm = t.match(fp);
      if (fm && fm[1]) { meta.flatNo = fm[1].trim(); break; }
    }
    const floorPatterns = [
      /(ground|first|second|third|fourth|fifth|sixth|seventh)\s*floor/i,
      /(\d+(?:st|nd|rd|th))\s*floor/i,
    ];
    for (const flp of floorPatterns) {
      const flm = t.match(flp);
      if (flm && flm[1]) {
        const floorMap = { ground: 'Ground Floor', first: 'First Floor', second: 'Second Floor',
          third: 'Third Floor', fourth: 'Fourth Floor', fifth: 'Fifth Floor', sixth: 'Sixth Floor', seventh: 'Seventh Floor' };
        meta.floorNo = floorMap[flm[1].toLowerCase()] || `${flm[1]} Floor`;
        break;
      }
    }
  } // end saleDeed

  // ── PROPERTY TAX ────────────────────────────────────────────────────────────
  if (docId === 'propertyTax') {
    const assessPatterns = [
      /assessment\s*no\.?\s*:?\s*([0-9]{6,12})/i,
      /ptin\s*:?\s*([0-9]{6,12})/i,
      /property\s*id\s*:?\s*([0-9]{6,12})/i,
      /tax\s*id\s*:?\s*([0-9]{6,12})/i,
      /\b(1013\d{6,8})\b/,
      /assessment\s*no\.?[\s\S]{0,30}?([0-9]{7,12})/i,
    ];
    for (const ap of assessPatterns) {
      const am = t.match(ap);
      if (am && am[1] && am[1].length >= 6) {
        meta.assessmentNo = am[1].trim();
        break;
      }
    }
    // Door / House number
    const doorPatterns = [
      /door\s*no\.?\s*:?\s*([0-9][0-9\/\-a-z]{2,20})/i,
      /house\s*no\.?\s*:?\s*([0-9][0-9\/\-a-z]{2,20})/i,
      /h\.?\s*no\.?\s*:?\s*([0-9][0-9\/\-a-z]{2,20})/i,
      /d\.?\s*no\.?\s*:?\s*([0-9][0-9\/\-]{2,20})/i,
      /\b(\d+\/\d+[-\w\/]{2,18})\b/,
    ];
    for (const dp of doorPatterns) {
      const dm = t.match(dp);
      if (dm && dm[1] && /\d/.test(dm[1])) {
        meta.doorNo = dm[1].trim();
        break;
      }
    }
    // Survey/extent from tax receipt
    const taxSurvMatch = t.match(/(?:survey\s*no|s\.?\s*no)\s*:?\s*(\d{1,4}(?:\/\d{1,4})?)/i);
    if (taxSurvMatch && taxSurvMatch[1] && /^\d+(\/\d+)?$/.test(taxSurvMatch[1])) {
      meta.surveyNo = taxSurvMatch[1];
    }
  }

  // ── BUILDING PLAN / PERMIT ORDER ─────────────────────────────────────────────
  if (docId === 'buildingPlan') {
    // ─ Permit number (with lenient spaces between segments) ────────────────────
    const permitPatterns = [
      // Exact format: 1013/0099/B/KAD/AP/2026 (with optional spaces around slashes)
      /(\d{4}\s*\/\s*\d{4}\s*\/\s*[a-z]\s*\/\s*[a-z]{2,6}\s*\/\s*[a-z]{2,4}\s*\/\s*20\d{2})/i,
      /permit\s*(?:no|number|order)\.?\s*:?\s*([0-9][0-9a-z\/\-]{4,40})/i,
      /permission\s*no\.?\s*:?\s*([0-9][0-9a-z\/\-]{4,40})/i,
      /(?:approval|sanction)\s*no\.?\s*:?\s*([0-9][0-9a-z\/\-]{4,40})/i,
    ];
    for (const pp of permitPatterns) {
      const pm = t.match(pp);
      if (pm && pm[1] && pm[1].replace(/\s/g, '').length >= 5) {
        // Clean up spaces that OCR may insert around slashes
        meta.approvalPlanNo = pm[1].replace(/\s*\/\s*/g, '/').trim().toUpperCase();
        break;
      }
    }
    // ─ Approval date (validate month name to avoid OCR month errors) ─────────
    const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const dateMatch1 = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s*,?\s*(20\d{2})/i);
    const dateMatch2 = t.match(/(\d{1,2})[\-\/](\d{1,2})[\-\/](20\d{2})/);
    if (dateMatch1 && MONTHS.includes(dateMatch1[2].toLowerCase())) {
      meta.approvalPlanDate = `${dateMatch1[1]} ${dateMatch1[2]}, ${dateMatch1[3]}`;
    } else if (dateMatch2) {
      meta.approvalPlanDate = `${dateMatch2[1]}/${dateMatch2[2]}/${dateMatch2[3]}`;
    }
    // ─ Survey / T.S. No / R.S. No ───────────────────────────────────────
    const bpSurvMatch = t.match(/(?:t\.?s\.?\s*no|r\.?s\.?\s*no|survey\s*no|s\.?\s*no|lpm\s*no)\s*\.?\s*\/?\.?\s*(?:r\.?s\.?\s*no\.?)?\s*:?\s*(\d{1,4}(?:\/\d{1,4})?)/i);
    if (bpSurvMatch && bpSurvMatch[1] && /^\d+(\/\d+)?$/.test(bpSurvMatch[1])) {
      meta.surveyNo = bpSurvMatch[1];
    }
    // ─ Property type from permit ─────────────────────────────────────────────
    if (/apartment|multi[\s-]*dwelling|multi[\s-]*story|flats/i.test(t)) {
      meta.propertyType = 'Apartment';
    } else if (/individual\s*residential|single\s*family|independent\s*house|residential\s*building/i.test(t)) {
      meta.propertyType = 'Independent House';
    } else if (/commercial|office|shop/i.test(t)) {
      // skip — not in our standard list
    }
    // ─ Structure type ───────────────────────────────────────────────────────
    if (/load\s*bearing/i.test(t)) {
      meta.structureType = 'Load bearing';
    } else if (/steel\s*structure/i.test(t)) {
      meta.structureType = 'Steel Structure';
    } else if (/framed\s*structure|rcc\s*frame|r\.c\.c|reinforced\s*concrete/i.test(t)) {
      meta.structureType = 'Framed structure';
    } else {
      // If upper floors exist (ground + more), it's framed
      const upperFloorM = t.match(/upper\s*floors?\s*:?\s*(\d+)/i) || t.match(/no\.?\s*of\s*floors?\s*:?\s*(\d+)/i);
      if (upperFloorM && parseInt(upperFloorM[1]) > 0) meta.structureType = 'Framed structure';
    }
    // ─ Premises No / Door No (from building permit Site Details) ──────────────
    const premisesMatch = t.match(/premises\s*no\.?\s*:?\s*([0-9][0-9\/\-a-z]{2,25})/i)
      || t.match(/house\s*no\.?\s*:?\s*([0-9][0-9\/\-a-z]{2,25})/i)
      || t.match(/door\s*no\.?\s*:?\s*([0-9][0-9\/\-a-z]{2,25})/i);
    if (premisesMatch && premisesMatch[1]) meta.doorNo = premisesMatch[1].trim();
    // ─ Plot No ────────────────────────────────────────────────────────────
    const plotMatch = t.match(/plot\s*no\.?\s*:?\s*([A-Za-z0-9]{1,10})/i);
    if (plotMatch && plotMatch[1] && !/^na$/i.test(plotMatch[1])) meta.plotNo = plotMatch[1].trim();
    // ─ Road width (from setback/road info) ────────────────────────────────────
    const rwMatch = t.match(/road\s*(?:width|wide)\s*:?\s*([0-9.]+)\s*(?:m|meter|ft|feet)?/i)
      || t.match(/width\s*of\s*road\s*:?\s*([0-9.]+)/i);
    if (rwMatch && rwMatch[1]) meta.roadWidth = rwMatch[1].trim();
    // ─ Builder / Developer name ────────────────────────────────────────────
    const builderMatch = t.match(/(?:developer|builder)\s*\/?\.?\s*(?:builder)?\s*:?\s*([A-Za-z][A-Za-z\s\.&\/]{2,40}?)(?:\n|lic|$)/i);
    if (builderMatch && builderMatch[1] && !/^na$/i.test(builderMatch[1].trim())) {
      meta.builderName = builderMatch[1].trim();
    }
    // Applicant name as fallback builder name
    if (!meta.builderName) {
      const applicantMatch = t.match(/applicant\s*:?\s*([A-Za-z][A-Za-z\s\.]{2,40}?)(?:\n|\d|$)/i);
      if (applicantMatch && applicantMatch[1]) meta.builderName = applicantMatch[1].trim();
    }
  }

  // ── MARKET VALUE / GUIDELINE CERTIFICATE ─────────────────────────────────────
  if (docId === 'marketValue') {
    // Survey / LPM No
    const mvSurvPatterns = [
      /lpm\s*no\s*\/\s*survey\s*no\s*:?\s*([0-9\/]+)/i,
      /lpm\s*no\.?\s*:?\s*([0-9\/]+)/i,
      /survey\s*no\.?\s*:?\s*([0-9\/]+)/i,
      /s\.?\s*no\.?\s*:?\s*([0-9]{2,}(?:\/[0-9]+)?)/i,
    ];
    for (const sp of mvSurvPatterns) {
      const sm = t.match(sp);
      if (sm && sm[1] && /^\d{2,}(\/\d+)?$/.test(sm[1])) {
        meta.surveyNo = sm[1];
        break;
      }
    }
    // Market value amount
    const mvPatterns = [
      /(?:total\s*)?market\s*value\s*(?:of\s*(?:the\s*)?property)?\s*:?\s*(?:rs\.?\s*)?([0-9,]+)/i,
      /(?:consideration|property)\s*value\s*:?\s*(?:rs\.?\s*)?([0-9,]+)/i,
      /(?:land\s*cost\s*\+?\s*structure\s*cost|total\s*value)\s*:?\s*(?:rs\.?\s*)?([0-9,]+)/i,
    ];
    for (const mp of mvPatterns) {
      const mm = t.match(mp);
      if (mm && mm[1]) {
        const num = mm[1].replace(/,/g, '');
        if (parseInt(num) > 10000) { meta.marketValue = num; break; }
      }
    }
    // Net extent from market value doc — always has unit in label
    const mvExtPatterns = [
      /extent\s*:?\s*([0-9]+\.?[0-9]*\s*(?:sq\.?\s*yards?|sq\.?\s*ft|cents?|acres?))/i,
      /area\s*:?\s*([0-9]+\.?[0-9]*\s*(?:sq\.?\s*yards?|sq\.?\s*ft))/i,
    ];
    for (const ep of mvExtPatterns) {
      const em = t.match(ep);
      if (em && em[1]) {
        const numPart = parseFloat(em[1]);
        // Must be > 10 to avoid matching stray small values
        if (!isNaN(numPart) && numPart > 10) {
          meta.extent = em[1].trim();
          break;
        }
      }
    }
    // Property type from market value
    if (/urban\s*vacant\s*land|vacant\s*land|open\s*plot|open\s*site/i.test(t)) {
      meta.propertyType = 'Open Site';
    } else if (/agriculture|agricultural|farm\s*land/i.test(t)) {
      meta.propertyType = 'Open Agriculture Land';
    } else if (/apartment|flat/i.test(t)) {
      meta.propertyType = 'Apartment';
    } else if (/residential\s*(?:house|building|dwelling)/i.test(t)) {
      meta.propertyType = 'Independent House';
    }
    // Boundaries from market value (if non-zero / non-empty values)
    const mvBound = {};
    const mvEast = t.match(/east\s*:\s*([^\n\r,;0]{2,60})/i);
    const mvWest = t.match(/west\s*:\s*([^\n\r,;0]{2,60})/i);
    const mvNorth = t.match(/north\s*:\s*([^\n\r,;0]{2,60})/i);
    const mvSouth = t.match(/south\s*:\s*([^\n\r,;0]{2,60})/i);
    if (mvEast && mvEast[1].trim() !== '0' && mvEast[1].trim().length > 1) mvBound.east = mvEast[1].trim();
    if (mvWest && mvWest[1].trim() !== '0' && mvWest[1].trim().length > 1) mvBound.west = mvWest[1].trim();
    if (mvNorth && mvNorth[1].trim() !== '0' && mvNorth[1].trim().length > 1) mvBound.north = mvNorth[1].trim();
    if (mvSouth && mvSouth[1].trim() !== '0' && mvSouth[1].trim().length > 1) mvBound.south = mvSouth[1].trim();
    if (Object.keys(mvBound).length > 0) meta.boundaries = mvBound;
    // Door No from market value (Door No field)
    const mvDoor = t.match(/door\s*no\.?\s*:?\s*([0-9][0-9\/\-a-z]{2,25})/i);
    if (mvDoor && mvDoor[1]) meta.doorNo = mvDoor[1].trim();
  }

  return meta;
};

// ── Core validation function (shared by file upload + camera capture) ─────────
const validateDocOCR = async (imageUrlOrFile, docId, isPdf = false, rawFile = null) => {
  const rules = DOC_VALIDATION_RULES[docId];
  if (!rules) return { passed: true }; // unknown doc type — skip validation

  let text = '';

  if (isPdf) {
    // For PDF files: try embedded text first; if empty, render pages to canvas + OCR
    // rawFile is the original File object needed by extractPdfText
    const fileForOcr = rawFile instanceof File ? rawFile : imageUrlOrFile;
    text = await extractPdfText(fileForOcr);
    if (!text.trim()) {
      // extractPdfText already tried canvas OCR internally; if still empty, allow with warning
      return { passed: true, warning: `Could not extract text from PDF. Please verify visually that it is the correct ${rules.name}.` };
    }
  } else {
    // For images, optimize dimensions and run Tesseract OCR with 12-second safety timeout
    try {
      const src = await optimizeImageForOCR(imageUrlOrFile);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OCR_TIMEOUT')), 12000)
      );
      const result = await Promise.race([
        Tesseract.recognize(src, 'eng', { logger: () => {} }),
        timeoutPromise
      ]);
      text = (result?.data?.text || '').toLowerCase();
    } catch (err) {
      console.warn('OCR error or timeout on image:', err);
      return { 
        passed: true, 
        warning: `OCR scan took longer than usual. Please confirm visually that it is the correct ${rules.name}.` 
      };
    }
  }

  // ── Extract all metadata from OCR text ──────────────────────────────────────
  const extractedMeta = extractAllMetadata(text, docId);

  // Tier-1 check: any single highly-specific phrase = instant PASS
  const tier1Hit = rules.tier1.some(kw => text.includes(kw.toLowerCase()));
  if (tier1Hit) return { passed: true, extractedMeta };

  // Tier-2 check: need at least MIN_TIER2 matching keywords
  const tier2Hits = rules.tier2.filter(kw => text.includes(kw.toLowerCase()));
  if (tier2Hits.length >= MIN_TIER2) return { passed: true, extractedMeta };

  // 3. Reject obviously unrelated text documents
  if (isPdf && text.trim().length > 60 && tier2Hits.length === 0) {
    return {
      passed: false,
      reason: `Mahe AI detected an unrelated text document. The content does not contain required legal/technical keywords for a ${rules.name}. Please upload the correct ${rules.name}.`
    };
  }

  const distinctWords = new Set((text.match(/\b[a-zA-Z]{4,}\b/g) || []).map(w => w.toLowerCase()));
  if (!isPdf && distinctWords.size > 15 && tier2Hits.length === 0) {
    return {
      passed: false,
      reason: `Mahe AI scanned readable text but could not find keywords matching a ${rules.name}. The document appears to be unrelated. Please upload the correct ${rules.name}.`
    };
  }

  // 4. Partial match
  if (tier2Hits.length >= 1) {
    return {
      passed: true,
      extractedMeta,
      warning: `Partial match detected (${tier2Hits.join(', ')}). Please verify that this is the correct ${rules.name}.`
    };
  }

  // 5. Architectural drawings / blueprints
  if (docId === 'buildingPlan' || docId === 'layoutPlan') {
    return {
      passed: true,
      extractedMeta,
      warning: `Architectural blueprint detected. Low text density — verified as architectural drawing.`
    };
  }

  // 6. Regional / Telugu scanned documents
  return {
    passed: true,
    extractedMeta,
    warning: `Scanned / regional document detected. Please verify visually that it is the correct ${rules.name}.`
  };
};

// ── Apply all extracted metadata to propertyDetails state ─────────────────────
// currentDetails = the current propertyDetails value (to compute diffs outside updater)
const applyExtractedMeta = (meta, currentDetails, setPropertyDetails, toastFn) => {
  if (!meta || typeof meta !== 'object') return;

  // Helper: is this value clearly garbage (OCR noise)?
  const isGarbage = (val) => !val || val.trim().length <= 2 || /^[a-zA-Z]$/.test(val.trim());

  const notifications = [];
  const next = { ...currentDetails };
  const boundaries = next.boundariesDoc
    ? { ...next.boundariesDoc }
    : { north: '', south: '', east: '', west: '' };

  if (meta.deedNo && (isGarbage(currentDetails.deedNo))) {
    next.deedNo = meta.deedNo;
    notifications.push(`Deed No. ${meta.deedNo} detected & auto-filled!`);
  }
  if (meta.deedYear && isGarbage(currentDetails.deedYear)) {
    next.deedYear = meta.deedYear;
  }
  if (meta.surveyNo && /^\d{1,4}(\/\d{1,4})?$/.test(meta.surveyNo) &&
      (isGarbage(currentDetails.surveyNo) || !/^\d/.test(currentDetails.surveyNo))) {
    next.surveyNo = meta.surveyNo;
    notifications.push(`Survey No. ${meta.surveyNo} detected & auto-filled!`);
  }
  if (meta.extent && isGarbage(currentDetails.netExtent)) {
    next.netExtent = meta.extent;
    notifications.push(`Net Extent ${meta.extent} detected & auto-filled!`);
  }
  if (meta.assessmentNo && meta.assessmentNo.length >= 6 && isGarbage(currentDetails.assessmentNo)) {
    next.assessmentNo = meta.assessmentNo;
    notifications.push(`Assessment No. ${meta.assessmentNo} detected & auto-filled!`);
  }
  if (meta.doorNo && isGarbage(currentDetails.doorNo)) {
    next.doorNo = meta.doorNo;
  }
  if (meta.approvalPlanNo && isGarbage(currentDetails.approvalPlanNo)) {
    next.approvalPlanNo = meta.approvalPlanNo;
    notifications.push(`Permit No. ${meta.approvalPlanNo} detected & auto-filled!`);
  }
  if (meta.approvalPlanDate && isGarbage(currentDetails.approvalPlanDate)) {
    next.approvalPlanDate = meta.approvalPlanDate;
  }
  // ─ Select / dropdown fields ──────────────────────────────────────────────────
  if (meta.propertyType && isGarbage(currentDetails.propertyType)) {
    next.propertyType = meta.propertyType;
    notifications.push(`Property Type → ${meta.propertyType} (auto-detected!)`);
  }
  if (meta.structureType && isGarbage(currentDetails.structureType)) {
    next.structureType = meta.structureType;
    notifications.push(`Structure Type → ${meta.structureType} (auto-detected!)`);
  }
  if (meta.roadWidth && isGarbage(currentDetails.roadWidth)) {
    next.roadWidth = meta.roadWidth;
  }
  if (meta.plotNo && meta.plotNo !== 'NA' && isGarbage(currentDetails.plotNo)) {
    next.plotNo = meta.plotNo;
  }
  // ─ Builder & Flat Details ──────────────────────────────────────────────────────
  if (meta.builderName && isGarbage(currentDetails.builderName)) {
    next.builderName = meta.builderName;
    notifications.push(`Builder/Applicant: ${meta.builderName} auto-filled!`);
  }
  if (meta.flatNo && isGarbage(currentDetails.flatNo)) {
    next.flatNo = meta.flatNo;
    notifications.push(`Flat No. ${meta.flatNo} auto-filled!`);
  }
  if (meta.floorNo && isGarbage(currentDetails.floorNo)) {
    next.floorNo = meta.floorNo;
  }
  if (meta.boundaries) {
    let anyBoundary = false;
    for (const dir of ['north', 'south', 'east', 'west']) {
      if (meta.boundaries[dir] && isGarbage(boundaries[dir])) {
        boundaries[dir] = meta.boundaries[dir];
        anyBoundary = true;
      }
    }
    if (anyBoundary) {
      next.boundariesDoc = boundaries;
      notifications.push('Property boundaries auto-filled from deed!');
    }
  }

  // Only update if something changed
  const hasChanges = Object.keys(next).some(k => {
    if (k === 'boundariesDoc') return JSON.stringify(next[k]) !== JSON.stringify(currentDetails[k]);
    return next[k] !== currentDetails[k];
  });
  if (hasChanges) setPropertyDetails(next);

  // Staggered toast notifications
  notifications.forEach((msg, i) => {
    setTimeout(() => toastFn.success(msg, { icon: '\u2705', duration: 4500 }), 300 + i * 600);
  });
  if (meta.marketValue) {
    setTimeout(() => {
      toastFn.success(`Market Value: \u20B9${Number(meta.marketValue).toLocaleString('en-IN')}`, { icon: '\uD83D\uDCB0', duration: 4500 });
    }, 300 + notifications.length * 600);
  }
};

const FLOOR_LABELS = [
  'Ground Floor (GF)', 'First Floor (FF)', 'Second Floor (SF)', 
  'Third Floor (TF)', 'Fourth Floor (4F)', 'Fifth Floor (5F)', 
  'Sixth Floor (6F)', 'Seventh Floor (7F)'
];

export default function CaseListView({ onOpenCase, currentUser }) {
  const [search, setSearch] = useState('');
  
  // Modal State
  const [modalStep, setModalStep] = useState(0); 
  const [clientName, setClientName] = useState('');
  const [clientFatherName, setClientFatherName] = useState('');
  
  // Bank & District State (Dynamic)
  const [availableBanks, setAvailableBanks] = useState(() => {
    try {
      const saved = localStorage.getItem('valuation_custom_banks');
      const custom = saved ? JSON.parse(saved) : [];
      return Array.from(new Set([...DEFAULT_BANKS, ...custom]));
    } catch {
      return DEFAULT_BANKS;
    }
  });
  const [availableDistricts, setAvailableDistricts] = useState(() => {
    try {
      const saved = localStorage.getItem('valuation_custom_districts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankDistrict, setBankDistrict] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  // Dynamic dropdown options loaded from DB config
  const [propertyTypes, setPropertyTypes] = useState(FALLBACK_PROPERTY_TYPES);
  const [plotTypes, setPlotTypes] = useState(FALLBACK_PLOT_TYPES);
  const [roadTypes, setRoadTypes] = useState(FALLBACK_ROAD_TYPES);
  const [structureTypes, setStructureTypes] = useState(FALLBACK_STRUCTURE_TYPES);
  const [flooringTypes, setFlooringTypes] = useState(FALLBACK_FLOORING_TYPES);
  const [_dynamicConfig, setDynamicConfig] = useState(null);
  
  const [extractedData, setExtractedData] = useState(null);
  const [isDocumentVerified, setIsDocumentVerified] = useState(false);
  const [rawOCRText, setRawOCRText] = useState('');

  const [siteImages, setSiteImages] = useState([]);
  const [locationData, setLocationData] = useState('Fetching location...');
  const [editingCaseId, setEditingCaseId] = useState(null);

  useEffect(() => {
    if (modalStep === 4) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocationData(`Lat: ${position.coords.latitude.toFixed(6)}, Long: ${position.coords.longitude.toFixed(6)}`);
          },
          (error) => {
            console.warn('Geolocation failed or denied:', error);
            setLocationData('Location Unavailable (Check GPS Permissions)');
          }
        );
      } else {
        setLocationData('GPS Not Supported');
      }
    }
  }, [modalStep]);

  // ── Auto-restore in-progress draft on mount ───────────────────────────────
  // If the user refreshes mid-session, this picks up where they left off
  // without requiring them to click + and choose "Resume Draft" manually.
  useEffect(() => {
    const autoRestoreDraft = async () => {
      try {
        const draft = await localforage.getItem('caseDraft');
        if (!draft || !draft.modalStep || draft.modalStep <= 0) return;

        // Restore all state directly
        setClientName(draft.clientName || '');
        setClientFatherName(draft.clientFatherName || '');
        setBankName(draft.bankName || '');
        setBankBranch(draft.bankBranch || '');
        setBankDistrict(draft.bankDistrict || '');
        setPropertyDetails({
          boundariesDoc: { north: '', south: '', east: '', west: '' },
          boundariesActual: { north: '', south: '', east: '', west: '' },
          buildingAge: '', flooringType: '', structureType: '', roadWidth: '',
          propertyType: '', roadType: '', plotType: '',
          deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '',
          assessmentNo: '', doorNo: '', approvalPlanNo: '', approvalPlanDate: '', builderName: '', managingPartner: '',
          flatNo: '', floorNo: '', additionsWork: [],
          siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] },
          ...(draft.propertyDetails || {})
        });
        setLocationData(draft.locationData || 'Fetching location...');
        setUploadedDocs(draft.uploadedDocs || { saleDeed: [], buildingPlan: [], propertyTax: [], marketValue: [], layoutPlan: [] });
        setSiteImages(draft.siteImages || []);

        // Restore duplicate-check hashes
        const allHashes = new Set(
          Object.values(draft.uploadedDocs || {}).flat().map(p => p.id).filter(Boolean)
        );
        setUploadedFileHashes(allHashes);

        // Reopen the modal on the exact step the user was on
        setModalStep(draft.modalStep);
        toast('📋 Session restored — continuing where you left off.', { id: 'session-restored', duration: 3000, icon: '✅' });
      } catch (e) {
        console.warn('Auto-restore draft failed:', e);
      }
    };
    autoRestoreDraft();
  }, []); // runs once on mount only


  const handleNewCaseClick = async () => {
    // Check if clocked in via API
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance?userId=${currentUser?.id || 'ENG-001'}`);
      const data = await res.json();
      const today = new Date().toLocaleDateString();
      const todayLogs = Array.isArray(data) ? data.filter(log => new Date(log.timestamp).toLocaleDateString() === today) : [];
      const sortedLogs = [...todayLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const lastLog = sortedLogs.length > 0 ? sortedLogs[0] : null;
      const lastAction = lastLog ? lastLog.attendanceType : null;
      
      if (lastAction !== 'Clock-In') {
        toast.error('You must Clock-In from the Attendance tab before entering case details.', { duration: 4000 });
        return;
      }
    } catch (err) {
      console.error('Failed to verify attendance status', err);
      toast.error('Failed to verify attendance status. Please try again.');
      return;
    }

    try {
      const draft = await localforage.getItem('caseDraft');
      if (draft) {
        setShowDraftPrompt(draft);
      } else {
        setModalStep(1);
      }
    } catch (e) {
      setModalStep(1);
    }
  };

  const handleResumeDraft = (draft) => {
    // Pages are stored as data URLs — use them directly, they survive refresh
    setClientName(draft.clientName || '');
    setClientFatherName(draft.clientFatherName || '');
    setBankName(draft.bankName || '');
    setBankBranch(draft.bankBranch || '');
    setBankDistrict(draft.bankDistrict || '');
    setPropertyDetails({
      boundariesDoc: { north: '', south: '', east: '', west: '' },
      boundariesActual: { north: '', south: '', east: '', west: '' },
      buildingAge: '', flooringType: '', structureType: '', roadWidth: '',
      propertyType: '', roadType: '', plotType: '',
      deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '',
      assessmentNo: '', doorNo: '', approvalPlanNo: '', approvalPlanDate: '', builderName: '', managingPartner: '',
      flatNo: '', floorNo: '', additionsWork: [],
      siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] },
      ...(draft.propertyDetails || {})
    });
    setLocationData(draft.locationData || 'Fetching location...');
    setUploadedDocs(draft.uploadedDocs || { saleDeed: [], buildingPlan: [], propertyTax: [], marketValue: [], layoutPlan: [] });
    setSiteImages(draft.siteImages || []);
    // Restore upload hashes so the duplicate check still works
    const allHashes = new Set(
      Object.values(draft.uploadedDocs || {}).flat().map(p => p.id).filter(Boolean)
    );
    setUploadedFileHashes(allHashes);
    setShowDraftPrompt(null);
    setModalStep(draft.modalStep || 1);
  };

  const handleDiscardDraft = async () => {
    await localforage.removeItem('caseDraft');
    setShowDraftPrompt(null);
    
    // Reset state
    setClientName('');
    setClientFatherName('');
    setBankName('');
    setBankBranch('');
    setBankDistrict('');
    setPropertyDetails({ boundariesDoc: { north: '', south: '', east: '', west: '' }, boundariesActual: { north: '', south: '', east: '', west: '' }, buildingAge: '', flooringType: '', structureType: '', roadWidth: '', propertyType: '', roadType: '', plotType: '', deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '', assessmentNo: '', doorNo: '', approvalPlanNo: '', approvalPlanDate: '', builderName: '', managingPartner: '', flatNo: '', floorNo: '', additionsWork: [], siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] } });
    setUploadedDocs({ saleDeed: [], buildingPlan: [], propertyTax: [], marketValue: [], layoutPlan: [] });
    setSiteImages([]);
    setEditingCaseId(null);
    setModalStep(1);
  };

  const handleResumeAssignedTask = async (c) => {
    // Check if clocked in via API
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance?userId=${currentUser?.id || 'ENG-001'}`);
      const data = await res.json();
      const today = new Date().toLocaleDateString();
      const todayLogs = Array.isArray(data) ? data.filter(log => new Date(log.timestamp).toLocaleDateString() === today) : [];
      const sortedLogs = [...todayLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const lastLog = sortedLogs.length > 0 ? sortedLogs[0] : null;
      const lastAction = lastLog ? lastLog.attendanceType : null;
      
      if (lastAction !== 'Clock-In') {
        toast.error('You must Clock-In from the Attendance tab before entering case details.', { duration: 4000 });
        return;
      }
    } catch (err) {
      console.error('Failed to verify attendance status', err);
      toast.error('Failed to verify attendance status. Please try again.');
      return;
    }

    try {
      // Fetch full details of the assigned case
      const res = await fetch(`${API_BASE_URL}/api/cases/${c.id}`);
      const fullCase = await res.json();
      
      setClientName(fullCase.clientName || fullCase.borrowerName || '');
      setClientFatherName(fullCase.clientFatherName || '');
      setBankName(fullCase.bankName || '');
      setBankBranch(fullCase.bankBranch || '');
      setBankDistrict(fullCase.bankDistrict || '');
      setPropertyDetails({
        boundariesDoc: { north: '', south: '', east: '', west: '' },
        boundariesActual: { north: '', south: '', east: '', west: '' },
        buildingAge: '', flooringType: '', structureType: '', roadWidth: '',
        propertyType: '', roadType: '', plotType: '',
        deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '',
        assessmentNo: '', doorNo: '', approvalPlanNo: '', approvalPlanDate: '',
        builderName: '', managingPartner: '', flatNo: '', floorNo: '', additionsWork: [],
        siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] },
        ...(fullCase.propertyDetails || {})
      });
      setLocationData(fullCase.locationData || 'Fetching location...');
      
      // If there are already site photos or docs, load them
      if (fullCase.sitePhotos) {
        setSiteImages(fullCase.sitePhotos.map((url, idx) => ({ id: `site_${idx}`, url, name: `Site Image ${idx + 1}` })));
      }
      
      setEditingCaseId(c.id);
      setModalStep(1);
    } catch (err) {
      toast.error("Failed to load case details.");
    }
  };

  const [propertyDetails, setPropertyDetails] = useState({
    boundariesDoc: { north: '', south: '', east: '', west: '' },
    boundariesActual: { north: '', south: '', east: '', west: '' },
    buildingAge: '',
    flooringType: '', structureType: '', roadWidth: '',
    propertyType: '', roadType: '', plotType: '',
    deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '',
    assessmentNo: '', doorNo: '', approvalPlanNo: '', approvalPlanDate: '',
    builderName: '', managingPartner: '', flatNo: '', floorNo: '', additionsWork: [],
    siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] }
  });

  // Document Upload State (Tracks arrays of uploaded page objects { id, url, name, isPdf })
  const [uploadedDocs, setUploadedDocs] = useState({
    saleDeed: [],
    buildingPlan: [],
    propertyTax: [],
    marketValue: [],
    layoutPlan: []
  });
  
  const [scanningDocs, setScanningDocs] = useState({});
  const [uploadedFileHashes, setUploadedFileHashes] = useState(new Set()); // content-hash dedup
  const [activeDocUpload, setActiveDocUpload] = useState(null);
  const activeDocUploadRef = useRef(null);
  
  // Preview Modal State
  const [previewImage, setPreviewImage] = useState(null);

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Final Review & Signature State
  const sigCanvas = useRef({});
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [signatureUploadUrl, setSignatureUploadUrl] = useState(null);
  const [activeSignatureTab, setActiveSignatureTab] = useState('draw'); 
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showSummaryDocs, setShowSummaryDocs] = useState(false);
  const [showSummaryImages, setShowSummaryImages] = useState(false);
  const [numPdfPages, setNumPdfPages] = useState(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);

  // Auto-Save Draft — data URLs are already permanent, just save directly
  useEffect(() => {
    if (modalStep > 0 && modalStep < 7) {
      const draft = {
        clientName, clientFatherName, bankName, bankBranch, bankDistrict,
        propertyDetails, locationData, modalStep,
        uploadedDocs, // already contains data URLs — no conversion needed
        siteImages
      };
      localforage.setItem('caseDraft', draft).catch(err => console.error('Auto-save failed', err));
    }
  }, [clientName, clientFatherName, bankName, bankBranch, bankDistrict, propertyDetails, locationData, uploadedDocs, siteImages, modalStep]);

  useEffect(() => {
    return () => {
      stopCamera();
      // Cleanup object URLs to avoid memory leaks
      Object.values(uploadedDocs).flat().forEach(page => {
        if (page.url && page.url.startsWith('blob:')) URL.revokeObjectURL(page.url);
      });
    };
  }, []);

  const [casesList, setCasesList] = useState([]);

  // Fetch Cases and dynamic AppConfig from Backend API
  useEffect(() => {
    // Fetch system dynamic config
    fetch(`${API_BASE_URL}/api/config`)
      .then(res => res.json())
      .then(cfg => {
        if (!cfg) return;
        setDynamicConfig(cfg);
        if (Array.isArray(cfg.propertyTypes) && cfg.propertyTypes.length > 0) setPropertyTypes(cfg.propertyTypes);
        if (Array.isArray(cfg.plotTypes) && cfg.plotTypes.length > 0) setPlotTypes(cfg.plotTypes);
        if (Array.isArray(cfg.roadTypes) && cfg.roadTypes.length > 0) setRoadTypes(cfg.roadTypes);
        if (Array.isArray(cfg.structureTypes) && cfg.structureTypes.length > 0) setStructureTypes(cfg.structureTypes);
        if (Array.isArray(cfg.flooringTypes) && cfg.flooringTypes.length > 0) setFlooringTypes(cfg.flooringTypes);
        if (Array.isArray(cfg.banks) && cfg.banks.length > 0) {
          setAvailableBanks(prev => Array.from(new Set([...prev, ...cfg.banks])));
        }
        if (Array.isArray(cfg.districts) && cfg.districts.length > 0) {
          setAvailableDistricts(prev => Array.from(new Set([...prev, ...cfg.districts])));
        }
      })
      .catch(err => console.warn("Could not load dynamic config:", err));

    fetch(`${API_BASE_URL}/api/cases`)
      .then(res => res.json())
      .then(data => {
        const casesArr = Array.isArray(data) ? data : [];
        // Filter to this engineer's assigned cases (broadened to catch older cases by name)
        const myCases = casesArr.filter(c => 
          c.assignedEngineerId === currentUser?.id || 
          c.assignedEngineerName === currentUser?.name ||
          c.assignedEngineerName === currentUser?.username
        );
        
        // Map the backend data to the frontend structure
        const formatted = myCases.map(c => ({
          id: c.id,
          title: c.clientName && c.bankName ? `${c.clientName} - ${c.bankName}` : c.clientName,
          type: c.propertyDetails?.propertyType || 'Standard Appraisal',
          date: new Date(c.createdAt).toLocaleDateString(),
          status: c.status
        }));
        setCasesList(formatted);

        // Dynamically harvest banks and districts from cases in database
        const dbBanks = casesArr.map(c => c.bankName).filter(Boolean);
        if (dbBanks.length > 0) {
          setAvailableBanks(prev => Array.from(new Set([...prev, ...dbBanks])));
        }
        const dbDistricts = casesArr.map(c => c.bankDistrict).filter(Boolean);
        if (dbDistricts.length > 0) {
          setAvailableDistricts(prev => Array.from(new Set([...prev, ...dbDistricts])));
        }
      })
      .catch(err => console.error("Error fetching cases:", err));
  }, [currentUser]);

  const filteredCases = casesList.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) || 
    c.id.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBanks = availableBanks.filter(b => b.toLowerCase().includes(bankName.toLowerCase()));

  const handleAddCustomBank = async (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    setBankName(trimmed);
    setShowBankDropdown(false);
    try {
      await fetch(`${API_BASE_URL}/api/config/banks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank: trimmed })
      });
    } catch (_) {}
    setAvailableBanks(prev => {
      if (prev.some(b => b.toLowerCase() === trimmed.toLowerCase())) return prev;
      const updated = [...prev, trimmed];
      try {
        const saved = localStorage.getItem('valuation_custom_banks');
        const custom = saved ? JSON.parse(saved) : [];
        if (!custom.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
          localStorage.setItem('valuation_custom_banks', JSON.stringify([...custom, trimmed]));
        }
      } catch {}
      return updated;
    });
  };

  const formatCurrency = (val) => {
    if (!val) return '';
    const num = val.toString().replace(/\D/g, '');
    if (!num) return '';
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return '';
    const k = 1024;
    if (bytes < k) return `${bytes} B`;
    if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`;
    return `${(bytes / (k * k)).toFixed(2)} MB`;
  };

  const getPageDisplayInfo = (page, idx) => {
    if (!page) return { name: `Document_${idx + 1}`, ext: 'FILE', size: '', uploadedAt: '', isPdf: false };
    const rawName = page.name || `Document_Page_${idx + 1}`;
    let ext = page.extension;
    if (!ext) {
      if (rawName && rawName.includes('.')) {
        ext = rawName.split('.').pop();
      } else {
        ext = page.isPdf ? 'PDF' : 'JPG';
      }
    }
    ext = (ext || (page.isPdf ? 'PDF' : 'FILE')).toUpperCase().replace(/^\./, '');

    let size = page.sizeFormatted;
    if (!size && page.size) {
      size = formatFileSize(page.size);
    } else if (!size && page.url && page.url.startsWith('data:')) {
      const approx = Math.round((page.url.length * 3) / 4);
      size = formatFileSize(approx);
    }

    return {
      name: rawName,
      ext,
      size: size || '',
      uploadedAt: page.uploadedAt || '',
      isPdf: Boolean(page.isPdf || ext === 'PDF')
    };
  };

  const handleNextToUpload = () => {
    if (clientName.trim() === '' || bankName.trim() === '') {
      toast.error("Please enter both the client's name and the bank name.");
      return;
    }
    // Dynamically persist any new bank name or district
    handleAddCustomBank(bankName.trim());
    if (bankDistrict.trim()) {
      setAvailableDistricts(prev => {
        if (prev.includes(bankDistrict.trim())) return prev;
        const updated = [...prev, bankDistrict.trim()];
        try {
          localStorage.setItem('valuation_custom_districts', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }
    setModalStep(2);
  };

  const showValidationError = (msg) => {
    toast((t) => (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, fontSize: '14px', color: '#0f172a' }}>
          {msg.split('\n').map((line, i) => (
            <div key={i} style={{
              marginBottom: line === '' ? '8px' : '4px',
              fontWeight: (line.includes('REJECTION') || line.includes('DUPLICATE')) ? '700' : '400',
              color: (line.includes('REJECTION') || line.includes('DUPLICATE')) ? '#ef4444' : 'inherit'
            }}>{line}</div>
          ))}
        </div>
        <button
          onClick={() => toast.dismiss(t.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
        ><X size={16} /></button>
      </div>
    ), { duration: 9000, style: { minWidth: '320px', borderLeft: '4px solid #ef4444', padding: '16px' } });
  };

  const handleSimulateUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    const docId = activeDocUploadRef.current || activeDocUpload;
    if (!docId) {
      console.error("Upload error: active docId is missing");
      return;
    }

    setScanningDocs(prev => ({ ...prev, [docId]: true }));
    setActiveDocUpload(null);
    activeDocUploadRef.current = null;

    const newPages = [];
    let errorMsg = null;
    const newHashes = [];

    try {
      for (const file of files) {
        // ── 0. FILE FORMAT VALIDATION (PDF & Images Only) ───────────────────
        const fileExt = (file.name.split('.').pop() || '').toLowerCase();
        const isPdf = file.type === 'application/pdf' || fileExt === 'pdf';
        const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'].includes(fileExt);

        if (!isPdf && !isImage) {
          errorMsg = `⚠️ UNSUPPORTED FILE FORMAT: "${file.name}"\n\nLegal documents and building plans must be uploaded as PDF or Images (JPG, PNG).\n\nWord documents (.docx, .doc) cannot be verified or previewed as certified legal paperwork. Please upload your document as a PDF or high-resolution image.`;
          break;
        }

        // ── 1. CONTENT-HASH DUPLICATE CHECK ─────────────────────────────────
        let fileHash;
        try {
          const buf = await file.arrayBuffer();
          fileHash = await computeBufferHash(buf);
        } catch {
          fileHash = `${file.name}-${file.size}-${file.lastModified}`;
        }

        if (uploadedFileHashes.has(fileHash)) {
          errorMsg = `🚫 DUPLICATE DETECTED: The file "${file.name}" is identical to a document already uploaded in this session.\n\nThe system uses content-hash verification — renaming a file does not bypass detection.`;
          break;
        }

        // ── 2. READ FILE AS DATA URL FIRST (reliable for OCR and UI preview) ────────
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // ── 3. OCR / PDF TEXT VALIDATION ────────────────────────────────────
        const scanMsg = isPdf ? 'Mahe AI is scanning PDF (may take a few seconds)...' : 'Mahe AI is scanning document...';
        toast(scanMsg, { icon: '🔍', duration: 3000 });

        const validation = await validateDocOCR(dataUrl, docId, isPdf, file);

        if (!validation.passed) {
          errorMsg = `⚠️ MAHE AI REJECTION:\n${validation.reason}\n\nPlease upload the correct document.`;
          break;
        }

        if (validation.warning) {
          toast(validation.warning, { icon: '⚠️', duration: 5000 });
        } else {
          const rules = DOC_VALIDATION_RULES[docId];
          toast.success(`Mahe AI Verified ✓ — ${rules?.name || 'Document'} accepted.`);
        }

        // Auto-fill ALL extracted metadata into propertyDetails
        if (validation.extractedMeta) {
          applyExtractedMeta(validation.extractedMeta, propertyDetails, setPropertyDetails, toast);
        }

        const ext = (file.name.split('.').pop() || (isPdf ? 'pdf' : 'jpg')).toUpperCase();
        newPages.push({ 
          id: fileHash, 
          url: dataUrl, 
          name: file.name, 
          isPdf, 
          rawFile: null,
          size: file.size,
          sizeFormatted: formatFileSize(file.size),
          extension: ext,
          uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        newHashes.push(fileHash);
      }

      if (errorMsg) {
        showValidationError(errorMsg);
        newPages.forEach(p => p.url && URL.revokeObjectURL(p.url));
        return;
      }

      setUploadedFileHashes(prev => { const s = new Set(prev); newHashes.forEach(h => s.add(h)); return s; });
      setUploadedDocs(prev => ({ ...prev, [docId]: [...prev[docId], ...newPages] }));
    } catch (err) {
      console.error('File upload validation failed:', err);
      toast.error('An error occurred during file upload. Please try again.');
    } finally {
      setScanningDocs(prev => ({ ...prev, [docId]: false }));
      if (e.target) e.target.value = null;
    }
  };

  const handleDeletePage = (docId, pageId, e) => {
    e.stopPropagation();
    setUploadedFileHashes(prev => { const s = new Set(prev); s.delete(pageId); return s; });
    setUploadedDocs(prev => ({ ...prev, [docId]: prev[docId].filter(p => p.id !== pageId) }));
  };

  const startCamera = async (docId) => {
    setActiveDocUpload(docId);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied or failed", err);
      toast.error("Unable to access camera. Please check browser permissions.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureDocument = async () => {
    if (activeDocUpload && videoRef.current) {
      const docId = activeDocUpload;
      
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 480;
      canvas.height = videoRef.current.videoHeight || 640;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      if (docId === 'SITE_IMAGES') {
        const timestamp = new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
        
        // Overlay Configuration
        const overlayHeight = Math.max(160, canvas.height * 0.22);
        const mapSize = overlayHeight - 20; 
        const boxX = 10;
        const boxY = canvas.height - overlayHeight - 10;
        
        // 1. Draw Translucent Black Box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, canvas.width - 20, overlayHeight, 12);
          ctx.fill();
        } else {
          ctx.fillRect(boxX, boxY, canvas.width - 20, overlayHeight);
        }
        
        // 2. Draw Map Area (Left side)
        const mapX = boxX + 10;
        const mapY = boxY + 10;
        
        // Map background (simulating satellite view with a dark bluish-grey tint)
        ctx.fillStyle = '#475569';
        if (ctx.roundRect) {
          ctx.beginPath(); ctx.roundRect(mapX, mapY, mapSize, mapSize, 8); ctx.fill();
        } else {
          ctx.fillRect(mapX, mapY, mapSize, mapSize);
        }
        
        // Map Grid lines to simulate roads
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        for(let i = 10; i < mapSize; i+= 15) {
            ctx.beginPath(); ctx.moveTo(mapX + i, mapY); ctx.lineTo(mapX + i, mapY + mapSize); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(mapX, mapY + i); ctx.lineTo(mapX + mapSize, mapY + i); ctx.stroke();
        }
        
        // Red Map Pin
        const pinX = mapX + mapSize / 2;
        const pinY = mapY + mapSize / 2 - 8;
        ctx.fillStyle = '#ea4335';
        ctx.beginPath();
        ctx.arc(pinX, pinY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(pinX - 6, pinY);
        ctx.lineTo(pinX + 6, pinY);
        ctx.lineTo(pinX, pinY + 12);
        ctx.fill();
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath(); ctx.arc(pinX, pinY, 2, 0, Math.PI * 2); ctx.fill(); // inner dot
        
        // "Google" watermark on map
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('Google', mapX + 5, mapY + mapSize - 8);

        // 3. Draw Text Area (Right side)
        const textX = mapX + mapSize + 15;
        
        // GPS Map Camera Watermark
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('🗺️ GPS Map Camera', canvas.width - 25, boxY + 25);
        ctx.textAlign = 'left'; // reset

        // Main Title (Dynamic based on user input or hardcoded for exact replica)
        ctx.font = '500 18px sans-serif';
        ctx.fillText('Chinna Chauku, Andhra', textX, boxY + 30);
        ctx.fillText('Pradesh, India 🇮🇳', textX, boxY + 52);
        
        // Small Details
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#e2e8f0';
        
        // Address lines
        ctx.fillText('42/337-7-2-1, Sreenivas Nagar, N.g.o Colony,', textX, boxY + 75);
        ctx.fillText('Chinna Chauku, Andhra Pradesh 516001, India', textX, boxY + 92);
        
        // GPS Lat Long
        const latLongText = locationData !== 'Fetching location...' && !locationData.includes('Supported') 
          ? locationData.replace('Lat:', 'Lat').replace('Long:', 'Long')
          : 'Lat 14.467982° Long 78.836882°';
        ctx.fillText(latLongText, textX, boxY + 115);
        
        // Timestamp
        ctx.fillText(timestamp, textX, boxY + 132);
        
        const frameUrl = canvas.toDataURL('image/jpeg');
        stopCamera();
        setSiteImages(prev => [...prev, { id: `site_${Date.now()}`, url: frameUrl, name: `Site Image ${prev.length + 1}` }]);
        setActiveDocUpload(null);
      } else {
        const frameUrl = canvas.toDataURL('image/jpeg');
        stopCamera();
        
        setScanningDocs(prev => ({ ...prev, [docId]: true }));
        setActiveDocUpload(null);

        // ── Validate camera-captured document via shared OCR validator ────
        try {
          toast('Mahe AI is scanning captured document...', { icon: '🔍', duration: 2500 });

          const validation = await validateDocOCR(frameUrl, docId, false);

          if (!validation.passed) {
            showValidationError(`⚠️ MAHE AI REJECTION:\n${validation.reason}`);
            setScanningDocs(prev => ({ ...prev, [docId]: false }));
            return;
          }

          if (validation.warning) {
            toast(validation.warning, { icon: '⚠️', duration: 5000 });
          } else {
            const rules = DOC_VALIDATION_RULES[docId];
            toast.success(`Mahe AI Verified ✓ — ${rules?.name || 'Document'} accepted.`);
          }

          // Auto-fill ALL extracted metadata into propertyDetails
          if (validation.extractedMeta) {
            applyExtractedMeta(validation.extractedMeta, propertyDetails, setPropertyDetails, toast);
          }

          const captureHash = `camera_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const byteSize = Math.round((frameUrl.length * 3) / 4);
          const newPage = {
            id: captureHash,
            url: frameUrl,
            name: `Camera_Scan_Page_${uploadedDocs[docId].length + 1}.jpg`,
            isPdf: false,
            rawFile: null,
            size: byteSize,
            sizeFormatted: formatFileSize(byteSize),
            extension: 'JPG',
            uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          setUploadedFileHashes(prev => { const s = new Set(prev); s.add(captureHash); return s; });
          setUploadedDocs(prev => ({ ...prev, [docId]: [...prev[docId], newPage] }));
        } catch (err) {
          console.error('Camera OCR Scan Failed', err);
          showValidationError('⚠️ MAHE AI REJECTION:\nThe image quality is too poor or the document is unreadable. Please retake the photo with better lighting.');
        } finally {
          setScanningDocs(prev => ({ ...prev, [docId]: false }));
        }
      }
    }
  };

  const handleNextToPropertyDetails = () => {
    // Sanitize any garbage OCR values before showing Step 3
    setPropertyDetails(prev => {
      const cleaned = { ...prev };
      // Clear single-character or obviously invalid OCR artifacts
      const isGarbageVal = (v) => !v || v.trim().length <= 2 || /^[a-zA-Z]{1,2}$/.test(v.trim());
      if (isGarbageVal(cleaned.surveyNo)) cleaned.surveyNo = '';
      if (isGarbageVal(cleaned.deedNo)) cleaned.deedNo = '';
      if (isGarbageVal(cleaned.netExtent)) cleaned.netExtent = '';
      if (isGarbageVal(cleaned.assessmentNo)) cleaned.assessmentNo = '';
      if (isGarbageVal(cleaned.doorNo)) cleaned.doorNo = '';
      if (isGarbageVal(cleaned.approvalPlanNo)) cleaned.approvalPlanNo = '';
      return cleaned;
    });
    setModalStep(3);
  };

  const handleNextToSiteImages = () => {
    const p = propertyDetails;
    if (!p.boundariesDoc.north || !p.boundariesDoc.south || !p.boundariesDoc.east || !p.boundariesDoc.west ||
        !p.boundariesActual.north || !p.boundariesActual.south || !p.boundariesActual.east || !p.boundariesActual.west ||
        !p.buildingAge || !p.roadWidth || !p.propertyType || !p.plotType || !p.roadType || !p.structureType || !p.flooringType ||
        !p.siteValue.plinthArea || p.siteValue.floors.some(f => !f.value)) {
      toast.error("Please fill in all mandatory fields before proceeding.");
      return;
    }
    setModalStep(4);
  };

  const startAIExtraction = async () => {
    if (uploadedDocs.saleDeed.length === 0) {
      toast.error("MISSING CRITICAL DOCUMENT: The Registered Document / Sale Deed is strictly required for this Valuation Report. Please upload it.", { duration: 5000 });
      setModalStep(2); // Redirect to documents tab
      return;
    }
    
    if (siteImages.length === 0) {
      toast.error("Please capture at least one site image.");
      setModalStep(4);
      return;
    }

    // NEW SECURITY PROMPT (IDEA #1)
    const expectedDeedNo = window.prompt("🚨 SECURITY CHECK: Please enter the Document Registration Number exactly as it appears on the Sale Deed (e.g. 1234/2023).");
    if (!expectedDeedNo || expectedDeedNo.trim() === "") {
      toast.error("Extraction cancelled. Registration Number is required for security verification.", { duration: 4000 });
      return;
    }

    setModalStep(5);
    
    try {
      const firstPage = uploadedDocs.saleDeed[0];
      let base64Image = firstPage.url;
      
      // If we have a rawFile, read it as Data URL
      if (firstPage.rawFile) {
        const reader = new FileReader();
        base64Image = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(firstPage.rawFile);
        });
      }

      // Call Backend OCR API
      const res = await fetch(`${API_BASE_URL}/api/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: base64Image,
          expectedDeedNo: expectedDeedNo 
        })
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Failed to extract data. Please upload a clearer image.", { duration: 8000 });
        setModalStep(2); 
        return;
      }

      const extracted = result.data.extracted;
      
      // Auto-fill some fields in propertyDetails
      setPropertyDetails(prev => ({
        ...prev,
        propertyType: prev.propertyType || 'Residential Building',
        surveyNo: extracted.surveyNo !== 'To be verified' ? extracted.surveyNo : prev.surveyNo,
        doorNo: extracted.doorNo !== 'To be verified' ? extracted.doorNo : prev.doorNo,
        netExtent: extracted.area !== 'To be verified' ? extracted.area : prev.netExtent
      }));

      if (extracted.ownerName !== "To be verified") {
        setClientName(extracted.ownerName);
      }

      setRawOCRText(result.data.rawText);
      setIsDocumentVerified(true);

      setExtractedData({
        documentType: 'SBI Format A - Valuation Report',
        ownerName: extracted.ownerName !== 'To be verified' ? extracted.ownerName : (clientName || 'Unknown Owner'),
        propertyType: propertyDetails.propertyType || 'Residential Building',
        surveyNo: extracted.surveyNo,
        doorNo: extracted.doorNo,
        wardNo: 'To be verified',
        colony: 'To be verified',
        city: 'To be verified',
        boundariesMatch: true,
        area: extracted.area,
        estimatedValue: 'Pending Estimation',
        confidence: `${Math.round(result.data.confidence)}%`,
        engine: 'Tesseract OCR Engine'
      });
      setModalStep(6);
    } catch (err) {
      console.error(err);
      toast.error("Failed to extract data. Please try again or upload a clearer image.", { duration: 8000 });
      setModalStep(2);
      setIsDocumentVerified(false);
    }
  };

  const handleCreateCase = async () => {
    // FINAL FORM VALIDATION (STEP 3)
    if (rawOCRText) {
      const cleanRaw = rawOCRText.replace(/[\s\/-]/g, '').toLowerCase();
      
      if (propertyDetails.deedNo && propertyDetails.deedNo !== 'To be verified') {
        const cleanDeed = propertyDetails.deedNo.replace(/[\s\/-]/g, '').toLowerCase();
        if (!cleanRaw.includes(cleanDeed)) {
          toast.error(`🚨 SECURITY ALERT: The Deed Number [${propertyDetails.deedNo}] you entered does not match the uploaded Sale Deed. Please correct it.`, { duration: 6000 });
          setModalStep(3);
          return;
        }
      }
      
      if (propertyDetails.surveyNo && propertyDetails.surveyNo !== 'To be verified') {
        const cleanSurvey = propertyDetails.surveyNo.replace(/[\s\/-]/g, '').toLowerCase();
        if (!cleanRaw.includes(cleanSurvey)) {
          toast.error(`🚨 SECURITY ALERT: The Survey Number [${propertyDetails.surveyNo}] you entered does not match the uploaded Sale Deed. Please correct it.`, { duration: 6000 });
          setModalStep(3);
          return;
        }
      }
    }

    const payloadDocs = {};
    for (const key in uploadedDocs) {
      if (uploadedDocs[key].length > 0) {
        payloadDocs[key] = uploadedDocs[key].map(p => ({ 
          name: p.name, 
          isPdf: p.isPdf,
          url: p.url,
          size: p.size,
          sizeFormatted: p.sizeFormatted,
          extension: p.extension,
          uploadedAt: p.uploadedAt
        }));
      }
    }

    const payload = {
      clientName: clientName || 'Unknown Client',
      clientFatherName: clientFatherName,
      bankName: bankName || 'Unknown Bank',
      bankBranch: bankBranch,
      bankDistrict: bankDistrict,
      propertyDetails: propertyDetails,
      locationData: locationData,
      sitePhotos: siteImages.map(img => img.url),
      documents: payloadDocs,
      signatureDataUrl: signatureDataUrl || signatureUploadUrl || '',
      status: 'Pending',
      assignedEngineerId: currentUser?.id || 'UNASSIGNED',
      assignedEngineerName: currentUser?.name || currentUser?.username || 'Unknown Engineer'
    };

    try {
      let response;
      if (editingCaseId) {
        response = await fetch(`${API_BASE_URL}/api/cases/${editingCaseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`${API_BASE_URL}/api/cases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Failed to save case to backend: ${errData.error || response.statusText}`);
      }
      
      const newCase = await response.json();
      
      localforage.removeItem('caseDraft'); // Clear draft on success
      
      const formattedNewCase = {
        id: newCase.id,
        title: (newCase.clientName && newCase.bankName) ? `${newCase.clientName} - ${newCase.bankName}` : newCase.clientName,
        type: newCase.propertyDetails?.propertyType || 'Standard Appraisal',
        date: new Date(newCase.createdAt).toLocaleDateString(),
        status: newCase.status
      };
      
      if (editingCaseId) {
        setCasesList(prev => prev.map(c => c.id === editingCaseId ? formattedNewCase : c));
        toast.success(`Task successfully submitted for Review!`);
        
        // Notify Admin
        fetch(`${API_BASE_URL}/api/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUser: 'ADMIN',
            title: 'Task Submitted',
            message: `${currentUser?.name} has submitted Case #${editingCaseId} for review.`
          })
        }).catch(err => console.error(err));
        
      } else {
        setCasesList(prev => [formattedNewCase, ...prev]);
        toast.success(`Case successfully created and saved for ${clientName} (${bankName})!`);
      }
      
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error("Error saving case: " + err.message);
    }
  };

  const closeModal = () => {
    stopCamera();
    Object.values(uploadedDocs).flat().forEach(page => {
      if (page.url && page.url.startsWith('blob:')) URL.revokeObjectURL(page.url);
    });
    
    setModalStep(0);
    setClientName('');
    setClientFatherName('');
    setBankName('');
    setBankBranch('');
    setBankDistrict('');
    setShowBankDropdown(false);
    setExtractedData(null);
    setSiteImages([]);
    setLocationData('Fetching location...');
    setPropertyDetails({ boundariesDoc: { north: '', south: '', east: '', west: '' }, boundariesActual: { north: '', south: '', east: '', west: '' }, buildingAge: '', flooringType: '', structureType: '', roadWidth: '', propertyType: '', roadType: '', plotType: '', deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '', assessmentNo: '', doorNo: '', approvalPlanNo: '', approvalPlanDate: '', builderName: '', managingPartner: '', flatNo: '', floorNo: '', additionsWork: [], siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] } });
    setUploadedFileSignatures([]);
    setUploadedDocs({
      saleDeed: [],
      buildingPlan: [],
      propertyTax: [],
      marketValue: [],
      layoutPlan: []
    });
    setScanningDocs({});
    setActiveDocUpload(null);
    setSignatureDataUrl(null);
    setSignatureUploadUrl(null);
    setActiveSignatureTab('draw');
    setTermsAccepted(false);
    setShowSubmitModal(false);
    setShowSummaryDocs(false);
    setShowSummaryImages(false);
    setEditingCaseId(null);
  };

  return (
    <div className="case-list-view animate-fade-in" style={{ paddingBottom: '80px', position: 'relative', minHeight: 'calc(100vh - 150px)' }}>
      <Toaster position="top-center" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>My Cases</h1>
      </div>

      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          placeholder="Search by address or ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 12px 12px 36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '14px', outline: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredCases.map((c) => (
          <div 
            key={c.id} 
            className="native-card" 
            style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', margin: 0 }}
            onClick={() => {
              if (c.status === 'Pending') {
                handleResumeAssignedTask(c);
              } else {
                onOpenCase(c.id);
              }
            }}
          >
            <div>
              <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>{c.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <FileText size={12} /> {c.id} • {c.type}
              </div>
            </div>
            <ChevronRight size={20} color="var(--text-muted)" />
          </div>
        ))}
      </div>

      <div style={{ position: 'fixed', bottom: '80px', right: '20px' }}>
          <button 
            className="btn-primary" 
            style={{ width: '56px', height: '56px', borderRadius: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,82,204,0.3)' }}
            onClick={handleNewCaseClick}
          >
            <Plus size={24} />
          </button>
      </div>

      {showDraftPrompt && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', animation: 'fadeIn 0.2s ease-out' }}>
            <div className="native-card" style={{ width: '100%', maxWidth: '400px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700' }}>Resume Draft?</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
                You have an unfinished case for <strong>{showDraftPrompt.clientName || 'an Unknown Client'}</strong>. Would you like to resume where you left off?
              </p>
              <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                <button className="btn-primary" onClick={() => handleResumeDraft(showDraftPrompt)}>Resume Draft</button>
                <button className="btn-secondary" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={handleDiscardDraft}>Discard & Start Fresh</button>
              </div>
            </div>
          </div>
        )}

      {/* Full Screen Image Preview Modal */}
      {previewImage && (() => {
        const previewInfo = getPageDisplayInfo(previewImage, 0);
        return (
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, maxWidth: '85%' }}>
                <span style={{
                  backgroundColor: previewInfo.isPdf ? '#ef4444' : '#3b82f6',
                  color: 'white',
                  fontWeight: '700',
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  letterSpacing: '0.5px'
                }}>
                  {previewInfo.ext}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontWeight: '600', fontSize: '14px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={previewInfo.name}>
                    {previewInfo.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#94a3b8', flexWrap: 'wrap' }}>
                    {previewInfo.size && <span>{previewInfo.size}</span>}
                    {previewInfo.uploadedAt && <span>• Uploaded: {previewInfo.uploadedAt}</span>}
                    {previewInfo.isPdf && numPdfPages && <span>• {numPdfPages} Page{numPdfPages > 1 ? 's' : ''}</span>}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => { setPreviewImage(null); setNumPdfPages(null); }} 
                style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflow: 'hidden' }}>
            {previewImage.isPdf ? (
              <div style={{ width: '100%', height: '100%', overflow: 'auto', backgroundColor: '#222', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '16px 0' }}>
                <Document 
                  file={previewImage.url} 
                  onLoadSuccess={({ numPages }) => setNumPdfPages(numPages)}
                  loading={<div style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '40px' }}><Loader2 className="spin" /> Loading PDF...</div>}
                >
                  {Array.from(new Array(numPdfPages || 0), (el, index) => (
                    <div key={`page_${index + 1}`} style={{ marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                      <Page pageNumber={index + 1} width={Math.min(window.innerWidth - 64, 600)} renderTextLayer={false} renderAnnotationLayer={false} />
                      <div style={{ color: '#888', textAlign: 'center', fontSize: '12px', marginTop: '8px' }}>Page {index + 1} of {numPdfPages}</div>
                    </div>
                  ))}
                </Document>
              </div>
            ) : (
              <img src={previewImage.url} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
            )}
            </div>
          </div>
        );
      })()}

      {/* Multi-Step Modal */}
      {modalStep > 0 && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', 
          zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-app)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
            padding: '24px', animation: 'slideUp 0.3s ease-out', minHeight: '350px', maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
              {/* Back button — left side */}
              {modalStep > 1 ? (
                <button
                  onClick={() => setModalStep(prev => prev - 1)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px',
                    color: 'var(--primary)', fontWeight: '600', fontSize: '14px',
                    padding: '4px 8px', borderRadius: '8px',
                    transition: 'background 0.15s'
                  }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(3,70,200,0.08)'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <ChevronLeft size={20} /> Back
                </button>
              ) : (
                <div style={{ width: '72px' }} />
              )}

              {/* Step title — center */}
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, textAlign: 'center', flex: 1 }}>
                {modalStep === 1 && "New Case Setup"}
                {modalStep === 2 && "Official Legal Documents"}
                {modalStep === 3 && "Property Details"}
                {modalStep === 4 && "Site Images"}
                {modalStep === 5 && "Document Extraction"}
                {modalStep === 6 && "Extracted Data"}
                {modalStep === 7 && "Final Review & Digital Signature"}
              </h2>

              {/* Close button — right side */}
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', width: '72px', display: 'flex', justifyContent: 'flex-end' }}>
                <X size={24} color="var(--text-muted)" />
              </button>
            </div>

            {/* STEP 1 */}
            {modalStep === 1 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>Client Name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
                    <input 
                      type="text" 
                      placeholder="Enter client's full name"
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      autoFocus
                      style={{ width: '100%', padding: '16px 16px 16px 42px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '16px', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>Father's / Husband's Name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', opacity: 0.5 }} />
                    <input 
                      type="text" 
                      placeholder="S/o or W/o (Optional)"
                      value={clientFatherName}
                      onChange={e => setClientFatherName(e.target.value)}
                      style={{ width: '100%', padding: '16px 16px 16px 42px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '16px', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '24px', flex: 1, position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>Bank / Institution Name</label>
                  <div style={{ position: 'relative' }}>
                    <Building size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
                    <input 
                      type="text" 
                      placeholder="Search or type bank name..."
                      value={bankName}
                      onChange={e => {
                        setBankName(e.target.value);
                        setShowBankDropdown(true);
                      }}
                      onFocus={() => setShowBankDropdown(true)}
                      onBlur={() => setTimeout(() => setShowBankDropdown(false), 200)}
                      style={{ width: '100%', padding: '16px 42px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '16px', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    />
                    <ChevronDown size={20} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>
                  
                  {showBankDropdown && (filteredBanks.length > 0 || bankName.trim() !== '') && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px',
                      backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50,
                      maxHeight: '220px', overflowY: 'auto'
                    }}>
                      {filteredBanks.map(bank => (
                        <div 
                          key={bank}
                          onClick={() => {
                            setBankName(bank);
                            setShowBankDropdown(false);
                          }}
                          onMouseDown={(e) => e.preventDefault()} 
                          style={{
                            padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                            fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-app)'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          {bank}
                        </div>
                      ))}

                      {bankName.trim() !== '' && !filteredBanks.some(b => b.toLowerCase() === bankName.toLowerCase()) && (
                        <div 
                          onClick={() => handleAddCustomBank(bankName)}
                          onMouseDown={(e) => e.preventDefault()}
                          style={{ 
                            margin: '8px', padding: '12px', fontSize: '13px', color: '#0346c8', 
                            fontWeight: '700', cursor: 'pointer', textAlign: 'center', 
                            backgroundColor: '#eff6ff', borderRadius: '8px', 
                            border: '1px dashed #93c5fd', transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                        >
                          + Use "{bankName}" as custom bank
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ flex: 2 }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>Branch Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Police Lane Branch"
                      value={bankBranch}
                      onChange={e => setBankBranch(e.target.value)}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '14px', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>District</label>
                    <input 
                      type="text" 
                      placeholder="Enter district (e.g. Kadapa, Y.S.R, Chittoor...)"
                      value={bankDistrict}
                      onChange={e => setBankDistrict(e.target.value)}
                      list="district-suggestions"
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '14px', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    />
                    {availableDistricts.length > 0 && (
                      <datalist id="district-suggestions">
                        {availableDistricts.map(d => (
                          <option key={d} value={d} />
                        ))}
                      </datalist>
                    )}
                  </div>
                </div>
                
                <button className="btn-primary" onClick={handleNextToUpload}>
                  Next step <ChevronRight size={18} />
                </button>
              </div>
            )}

            {/* STEP 2 */}
            {modalStep === 2 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <input type="file" ref={fileInputRef} onChange={handleSimulateUpload} multiple accept=".pdf,image/png,image/jpeg,image/jpg,image/webp" style={{ display: 'none' }} />

                {!isCameraActive ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '12px', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', borderRadius: '8px', display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <ShieldAlert size={20} color="#ca8a04" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ fontSize: '13px', color: '#854d0e', lineHeight: '1.4' }}>
                        <strong>Strict Validation Active:</strong> Every upload is scanned by Mahe AI using OCR text analysis. Images and PDFs are both verified. Duplicate files are detected via content-hash — renaming a file will not bypass this. Irrelevant documents are rejected immediately. You can add multiple pages per document.
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                      {REQUIRED_DOCS.map((doc) => {
                        const pages = uploadedDocs[doc.id];
                        const pageCount = pages.length;
                        const isScanning = scanningDocs[doc.id];
                        
                        return (
                        <div key={doc.id} style={{ 
                          border: pageCount > 0 ? '1px solid #10b981' : (isScanning ? '1px solid var(--primary)' : '1px solid var(--border-color)'), 
                          borderRadius: '12px', 
                          padding: '16px', 
                          backgroundColor: pageCount > 0 ? '#f0fdf4' : 'var(--bg-card)', 
                          display: 'flex', 
                          flexDirection: 'column',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                          transition: 'all 0.2s'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1, paddingRight: '16px' }}>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: pageCount > 0 ? '#065f46' : 'var(--text-primary)', marginBottom: '8px', lineHeight: '1.4' }}>{doc.label}</div>
                              
                              {isScanning ? (
                                <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <ScanLine size={13} className="spin" /> Scanning...
                                </span>
                              ) : pageCount > 0 ? (
                                <span style={{ backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <CheckCircle2 size={12} /> {pageCount} Page{pageCount > 1 ? 's' : ''} Uploaded
                                </span>
                              ) : (
                                <span style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <AlertCircle size={12} /> Required
                                </span>
                              )}
                            </div>
                            
                            <div style={{ display: 'flex', gap: '8px', opacity: isScanning ? 0.3 : 1, pointerEvents: isScanning ? 'none' : 'auto' }}>
                              <button 
                                onClick={() => startCamera(doc.id)}
                                style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fff', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                              >
                                <Camera size={16} />
                              </button>
                              <button 
                                onClick={() => { activeDocUploadRef.current = doc.id; setActiveDocUpload(doc.id); fileInputRef.current.click(); }}
                                style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fff', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                              >
                                <UploadCloud size={16} />
                              </button>
                            </div>
                          </div>

                          {/* High-Tech Laser Scanning Animation Box */}
                          {isScanning && (
                            <div style={{
                              marginTop: '14px',
                              padding: '16px',
                              borderRadius: '10px',
                              border: '1.5px dashed #60a5fa',
                              position: 'relative',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)'
                            }}>
                              <style>{`
                                @keyframes scanLaser {
                                  0% { top: 6px; opacity: 0.7; }
                                  50% { top: calc(100% - 8px); opacity: 1; }
                                  100% { top: 6px; opacity: 0.7; }
                                }
                              `}</style>
                              {/* Laser Beam */}
                              <div style={{
                                position: 'absolute',
                                left: '8px',
                                right: '8px',
                                height: '3px',
                                background: 'linear-gradient(90deg, transparent, #2563eb, #38bdf8, #2563eb, transparent)',
                                boxShadow: '0 0 10px #3b82f6',
                                animation: 'scanLaser 1.8s ease-in-out infinite'
                              }} />
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 1 }}>
                                <Loader2 size={18} className="spin" color="#2563eb" />
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af' }}>
                                  Mahe AI OCR Scanning in Progress...
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', zIndex: 1 }}>
                                Analyzing document structure, municipal seals & sanction details
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setScanningDocs(prev => ({ ...prev, [doc.id]: false }));
                                }}
                                style={{
                                  marginTop: '4px',
                                  fontSize: '11px',
                                  color: '#dc2626',
                                  background: '#fee2e2',
                                  border: '1px solid #fecaca',
                                  borderRadius: '6px',
                                  padding: '3px 10px',
                                  cursor: 'pointer',
                                  zIndex: 2,
                                  fontWeight: '600'
                                }}
                              >
                                Cancel / Reset Scan
                              </button>
                            </div>
                          )}

                          {/* Uploaded Files Detailed List */}
                          {pageCount > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
                              {pages.map((page, idx) => {
                                const info = getPageDisplayInfo(page, idx);
                                return (
                                  <div 
                                    key={page.id || idx}
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '12px',
                                      padding: '10px 12px',
                                      backgroundColor: '#ffffff',
                                      border: '1px solid #d1fae5',
                                      borderRadius: '10px',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    {/* Thumbnail Preview or PDF Badge */}
                                    <div 
                                      onClick={() => setPreviewImage(page)}
                                      title="Click to preview"
                                      style={{ 
                                        width: '46px', 
                                        height: '46px', 
                                        borderRadius: '8px', 
                                        border: '1px solid #e2e8f0', 
                                        overflow: 'hidden', 
                                        flexShrink: 0,
                                        cursor: 'pointer', 
                                        position: 'relative', 
                                        backgroundColor: info.isPdf ? '#fef2f2' : '#f8fafc',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      {info.isPdf ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                          <FileText size={18} color="#dc2626" />
                                          <span style={{ fontSize: '9px', fontWeight: '800', color: '#dc2626', letterSpacing: '0.5px' }}>PDF</span>
                                        </div>
                                      ) : page.url ? (
                                        <img src={page.url} alt={info.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      ) : (
                                        <FileText size={20} color="#059669" />
                                      )}
                                      <div style={{ 
                                        position: 'absolute', 
                                        bottom: 0, 
                                        right: 0, 
                                        backgroundColor: 'rgba(15, 23, 42, 0.75)', 
                                        color: '#ffffff', 
                                        fontSize: '9px', 
                                        fontWeight: '700', 
                                        padding: '1px 4px', 
                                        borderTopLeftRadius: '4px' 
                                      }}>
                                        #{idx + 1}
                                      </div>
                                    </div>

                                    {/* File Metadata */}
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                      {/* File Name */}
                                      <div 
                                        title={info.name}
                                        style={{ 
                                          fontSize: '13px', 
                                          fontWeight: '600', 
                                          color: '#0f172a', 
                                          whiteSpace: 'nowrap', 
                                          overflow: 'hidden', 
                                          textOverflow: 'ellipsis' 
                                        }}
                                      >
                                        {info.name}
                                      </div>
                                      
                                      {/* Extension badge, size, uploaded time, verified badge */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11px' }}>
                                        <span style={{ 
                                          backgroundColor: info.isPdf ? '#fee2e2' : '#e0e7ff', 
                                          color: info.isPdf ? '#dc2626' : '#4338ca', 
                                          fontWeight: '700', 
                                          fontSize: '10px', 
                                          padding: '1px 6px', 
                                          borderRadius: '4px',
                                          letterSpacing: '0.5px'
                                        }}>
                                          {info.ext}
                                        </span>

                                        {info.size && (
                                          <span style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: '500' }}>
                                            <HardDrive size={11} color="#94a3b8" />
                                            {info.size}
                                          </span>
                                        )}

                                        {info.uploadedAt && (
                                          <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                            <Clock size={11} />
                                            {info.uploadedAt}
                                          </span>
                                        )}

                                        <span style={{ 
                                          display: 'inline-flex', 
                                          alignItems: 'center', 
                                          gap: '3px', 
                                          color: '#059669', 
                                          backgroundColor: '#ecfdf5', 
                                          padding: '1px 6px', 
                                          borderRadius: '4px', 
                                          fontWeight: '600',
                                          fontSize: '10px'
                                        }}>
                                          <CheckCircle2 size={10} /> Verified
                                        </span>
                                      </div>
                                    </div>

                                    {/* Action Buttons: Preview & Delete */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                      <button 
                                        type="button"
                                        onClick={() => setPreviewImage(page)}
                                        title="Preview file"
                                        style={{ 
                                          width: '32px', 
                                          height: '32px', 
                                          borderRadius: '6px', 
                                          border: '1px solid #e2e8f0', 
                                          backgroundColor: '#f8fafc', 
                                          color: '#0284c7', 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center', 
                                          cursor: 'pointer',
                                          transition: 'background 0.15s'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                      >
                                        <Eye size={15} />
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={(e) => handleDeletePage(doc.id, page.id, e)}
                                        title="Delete file"
                                        style={{ 
                                          width: '32px', 
                                          height: '32px', 
                                          borderRadius: '6px', 
                                          border: '1px solid #fee2e2', 
                                          backgroundColor: '#fff1f2', 
                                          color: '#e11d48', 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center', 
                                          cursor: 'pointer',
                                          transition: 'background 0.15s'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ffe4e6'}
                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff1f2'}
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )})}
                    </div>

                    {(() => {
                      const allUploaded = REQUIRED_DOCS.every(doc => uploadedDocs[doc.id]?.length > 0);
                      const anyScanningNow = Object.values(scanningDocs).some(Boolean);
                      const canProceed = allUploaded && !anyScanningNow;
                      return (
                        <button
                          className="btn-primary"
                          onClick={handleNextToPropertyDetails}
                          disabled={!canProceed}
                          style={{
                            opacity: !canProceed ? 0.5 : 1,
                            marginTop: 'auto',
                            backgroundColor: !canProceed ? '#94a3b8' : '',
                            cursor: !canProceed ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {anyScanningNow ? (
                            <><Loader2 size={16} className="spin" /> Mahe AI Scanning...</>
                          ) : allUploaded ? (
                            <>Next: Property Details <ChevronRight size={18} /></>
                          ) : (
                            <>Upload All 5 Documents to Continue ({REQUIRED_DOCS.filter(d => uploadedDocs[d.id]?.length > 0).length}/5 Done)</>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '600' }}>
                        Capturing Page {uploadedDocs[activeDocUpload]?.length + 1 || 1} for: {REQUIRED_DOCS.find(d => d.id === activeDocUpload)?.label}
                      </span>
                    </div>
                    <div style={{ position: 'relative', width: '100%', height: '320px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000' }}>
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', inset: '32px', border: '2px solid rgba(255,255,255,0.7)', borderRadius: '8px' }}></div>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(0,0,0,0.5)', padding: '8px 16px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ScanLine size={16} color="#fff" />
                        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>Align Document Page</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
                      <button className="btn-secondary" style={{ flex: 1 }} onClick={stopCamera}>Cancel</button>
                      <button className="btn-primary" style={{ flex: 2 }} onClick={captureDocument}>
                        <Camera size={18} /> Capture Page {uploadedDocs[activeDocUpload]?.length + 1 || 1}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Manual Property Details */}
            {modalStep === 3 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: '16px', paddingBottom: '16px' }}>
                
                {/* Property Category */}
                <div style={{ backgroundColor: '#f0f9ff', padding: '12px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#0369a1', marginBottom: '12px' }}>Report Category <span style={{ color: '#ef4444' }}>*</span></label>
                  <select value={propertyDetails.propertyType} onChange={e => setPropertyDetails({...propertyDetails, propertyType: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '2px solid #bae6fd', fontSize: '14px', outline: 'none', backgroundColor: 'white', fontWeight: '600' }}>
                    <option value="">Select Category...</option>
                    {propertyTypes.map(pt => (
                      <option key={pt} value={pt}>{pt}</option>
                    ))}
                  </select>
                </div>

                {/* Legal & Registration Details */}
                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '12px' }}>Legal & Registration</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Deed Number <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" value={propertyDetails.deedNo} onChange={e => setPropertyDetails({...propertyDetails, deedNo: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} placeholder="e.g. 4004/2016" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Deed Date/Year</label>
                      <input type="text" value={propertyDetails.deedYear} onChange={e => setPropertyDetails({...propertyDetails, deedYear: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} placeholder="e.g. 12-02-2016" />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Net Extent / Area <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" value={propertyDetails.netExtent} onChange={e => setPropertyDetails({...propertyDetails, netExtent: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} placeholder="e.g. 2.83 Cents" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Khatha Number</label>
                      <input type="text" value={propertyDetails.khathaNo} onChange={e => setPropertyDetails({...propertyDetails, khathaNo: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} placeholder="Optional" />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Survey Number <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" value={propertyDetails.surveyNo} onChange={e => setPropertyDetails({...propertyDetails, surveyNo: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} placeholder="e.g. 343 or 347/2" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Plot Number</label>
                      <input type="text" value={propertyDetails.plotNo} onChange={e => setPropertyDetails({...propertyDetails, plotNo: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} placeholder="Optional" />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Property Tax / Assessment No</label>
                      <input type="text" value={propertyDetails.assessmentNo || ''} onChange={e => setPropertyDetails({...propertyDetails, assessmentNo: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} placeholder="e.g. 1013104872" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Door / House Number</label>
                      <input type="text" value={propertyDetails.doorNo || ''} onChange={e => setPropertyDetails({...propertyDetails, doorNo: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} placeholder="e.g. 58/384-2-1-2" />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Building Appr. No</label>
                      <input type="text" value={propertyDetails.approvalPlanNo} onChange={e => setPropertyDetails({...propertyDetails, approvalPlanNo: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} placeholder="e.g. 1013/0114/B/KAD" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Appr. Date</label>
                      <input type="text" value={propertyDetails.approvalPlanDate} onChange={e => setPropertyDetails({...propertyDetails, approvalPlanDate: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} placeholder="Optional" />
                    </div>
                  </div>
                </div>

                {/* Builder & Apartment Details */}
                {(propertyDetails.propertyType === 'Apartment') && (
                  <div style={{ backgroundColor: '#fdf4ff', padding: '12px', borderRadius: '12px', border: '1px solid #f5d0fe' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#86198f', marginBottom: '12px' }}>Builder & Flat Details</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#86198f', marginBottom: '4px' }}>Builder Name <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="text" value={propertyDetails.builderName} onChange={e => setPropertyDetails({...propertyDetails, builderName: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #f5d0fe', fontSize: '13px', outline: 'none' }} placeholder="e.g. M/S KHAN INFRA TECH" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#86198f', marginBottom: '4px' }}>Managing Partner</label>
                        <input type="text" value={propertyDetails.managingPartner} onChange={e => setPropertyDetails({...propertyDetails, managingPartner: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #f5d0fe', fontSize: '13px', outline: 'none' }} placeholder="Name" />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#86198f', marginBottom: '4px' }}>Flat No <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="text" value={propertyDetails.flatNo} onChange={e => setPropertyDetails({...propertyDetails, flatNo: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #f5d0fe', fontSize: '13px', outline: 'none' }} placeholder="e.g. 402" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#86198f', marginBottom: '4px' }}>Floor Level</label>
                        <input type="text" value={propertyDetails.floorNo} onChange={e => setPropertyDetails({...propertyDetails, floorNo: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #f5d0fe', fontSize: '13px', outline: 'none' }} placeholder="e.g. Fourth Floor" />
                      </div>
                    </div>
                  </div>
                )}
                
                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '12px' }}>Boundaries (As per documents) <span style={{ color: '#ef4444' }}>*</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>North <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" value={propertyDetails.boundariesDoc.north} onChange={e => setPropertyDetails({...propertyDetails, boundariesDoc: {...propertyDetails.boundariesDoc, north: e.target.value}})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>South <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" value={propertyDetails.boundariesDoc.south} onChange={e => setPropertyDetails({...propertyDetails, boundariesDoc: {...propertyDetails.boundariesDoc, south: e.target.value}})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>East <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" value={propertyDetails.boundariesDoc.east} onChange={e => setPropertyDetails({...propertyDetails, boundariesDoc: {...propertyDetails.boundariesDoc, east: e.target.value}})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>West <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" value={propertyDetails.boundariesDoc.west} onChange={e => setPropertyDetails({...propertyDetails, boundariesDoc: {...propertyDetails.boundariesDoc, west: e.target.value}})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                    </div>
                  </div>
                </div>
                
                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '12px' }}>Boundaries (As per actual / visit) <span style={{ color: '#ef4444' }}>*</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>North <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" value={propertyDetails.boundariesActual.north} onChange={e => setPropertyDetails({...propertyDetails, boundariesActual: {...propertyDetails.boundariesActual, north: e.target.value}})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>South <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" value={propertyDetails.boundariesActual.south} onChange={e => setPropertyDetails({...propertyDetails, boundariesActual: {...propertyDetails.boundariesActual, south: e.target.value}})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>East <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" value={propertyDetails.boundariesActual.east} onChange={e => setPropertyDetails({...propertyDetails, boundariesActual: {...propertyDetails.boundariesActual, east: e.target.value}})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>West <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" value={propertyDetails.boundariesActual.west} onChange={e => setPropertyDetails({...propertyDetails, boundariesActual: {...propertyDetails.boundariesActual, west: e.target.value}})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Age of Building <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="number" value={propertyDetails.buildingAge} onChange={e => setPropertyDetails({...propertyDetails, buildingAge: e.target.value})} placeholder="Years" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Road Width <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" value={propertyDetails.roadWidth} onChange={e => setPropertyDetails({...propertyDetails, roadWidth: e.target.value})} placeholder="e.g. 30 ft" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Plot Type <span style={{ color: '#ef4444' }}>*</span></label>
                    <select value={propertyDetails.plotType} onChange={e => setPropertyDetails({...propertyDetails, plotType: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', backgroundColor: 'white' }}>
                      <option value="">Select...</option>
                      {plotTypes.map(pt => (
                        <option key={pt} value={pt}>{pt}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Type of Road <span style={{ color: '#ef4444' }}>*</span></label>
                    <select value={propertyDetails.roadType} onChange={e => setPropertyDetails({...propertyDetails, roadType: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', backgroundColor: 'white' }}>
                      <option value="">Select...</option>
                      {roadTypes.map(rt => (
                        <option key={rt} value={rt}>{rt}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Type of Structure <span style={{ color: '#ef4444' }}>*</span></label>
                    <select value={propertyDetails.structureType} onChange={e => setPropertyDetails({...propertyDetails, structureType: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', backgroundColor: 'white' }}>
                      <option value="">Select...</option>
                      {structureTypes.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Type of Flooring <span style={{ color: '#ef4444' }}>*</span></label>
                  <select value={propertyDetails.flooringType} onChange={e => setPropertyDetails({...propertyDetails, flooringType: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', backgroundColor: 'white' }}>
                    <option value="">Select...</option>
                    {flooringTypes.map(ft => (
                      <option key={ft} value={ft}>{ft}</option>
                    ))}
                  </select>
                </div>

                {/* Additions Work / Cost Estimates */}
                {['Apartment', 'Independent House'].includes(propertyDetails.propertyType) && (
                  <div style={{ padding: '16px', backgroundColor: '#fff7ed', borderRadius: '12px', border: '1px solid #ffedd5', marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#c2410c', margin: 0 }}>Additions Work Estimation</label>
                      <button 
                        onClick={() => {
                          const newAdditions = [...propertyDetails.additionsWork, { id: Date.now(), description: '', quantity: '1', rate: '', amount: '' }];
                          setPropertyDetails({...propertyDetails, additionsWork: newAdditions});
                        }}
                        style={{ backgroundColor: 'transparent', border: 'none', color: '#c2410c', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                      >
                        <Plus size={14} /> Add Item
                      </button>
                    </div>
                    
                    {propertyDetails.additionsWork.length === 0 && (
                      <div style={{ fontSize: '12px', color: '#fdba74', textAlign: 'center', padding: '12px 0' }}>
                        No items added yet. Click 'Add Item' to estimate costs for wardrobes, painting, etc.
                      </div>
                    )}

                    {propertyDetails.additionsWork.map((item, index) => (
                      <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 30px', gap: '8px', marginBottom: '8px', alignItems: 'end' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#c2410c', marginBottom: '4px' }}>Description</label>
                          <input type="text" value={item.description} onChange={e => {
                            const newWork = [...propertyDetails.additionsWork];
                            newWork[index].description = e.target.value;
                            setPropertyDetails({...propertyDetails, additionsWork: newWork});
                          }} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '12px', outline: 'none' }} placeholder="e.g. Wardrobes" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#c2410c', marginBottom: '4px' }}>Qty</label>
                          <input type="text" value={item.quantity} onChange={e => {
                            const newWork = [...propertyDetails.additionsWork];
                            newWork[index].quantity = e.target.value;
                            setPropertyDetails({...propertyDetails, additionsWork: newWork});
                          }} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '12px', outline: 'none' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#c2410c', marginBottom: '4px' }}>Amount (₹)</label>
                          <input type="number" value={item.amount} onChange={e => {
                            const newWork = [...propertyDetails.additionsWork];
                            newWork[index].amount = e.target.value;
                            setPropertyDetails({...propertyDetails, additionsWork: newWork});
                          }} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '12px', outline: 'none' }} placeholder="Amt" />
                        </div>
                        <button onClick={() => {
                          const newWork = propertyDetails.additionsWork.filter((_, i) => i !== index);
                          setPropertyDetails({...propertyDetails, additionsWork: newWork});
                        }} style={{ backgroundColor: 'transparent', border: 'none', color: '#ef4444', padding: '0 0 6px 0', cursor: 'pointer' }}>
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Site Value & Floors */}
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: 'var(--primary)', margin: 0 }}>Site Value / Area Value</label>
                    <button 
                      onClick={() => {
                        if (propertyDetails.siteValue.floors.length < FLOOR_LABELS.length) {
                          const newFloors = [...propertyDetails.siteValue.floors, { id: `f${propertyDetails.siteValue.floors.length}`, label: FLOOR_LABELS[propertyDetails.siteValue.floors.length], value: '' }];
                          setPropertyDetails({...propertyDetails, siteValue: {...propertyDetails.siteValue, floors: newFloors}});
                        }
                      }}
                      style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                    >
                      <Plus size={14} /> Add Floor
                    </button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Plinth Area Value <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} placeholder="Value" value={propertyDetails.siteValue.plinthArea} onChange={e => setPropertyDetails({...propertyDetails, siteValue: {...propertyDetails.siteValue, plinthArea: formatCurrency(e.target.value)}})} />
                    </div>
                    {propertyDetails.siteValue.floors.map((floor, index) => (
                      <div key={floor.id} style={{ position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          {floor.label} <span style={{ color: '#ef4444' }}>*</span>
                          {index === propertyDetails.siteValue.floors.length - 1 && index > 0 && (
                            <span 
                              onClick={() => {
                                const newFloors = propertyDetails.siteValue.floors.slice(0, -1);
                                setPropertyDetails({...propertyDetails, siteValue: {...propertyDetails.siteValue, floors: newFloors}});
                              }}
                              style={{ color: '#ef4444', marginLeft: '6px', cursor: 'pointer', fontSize: '10px' }}
                            >
                              (Remove)
                            </span>
                          )}
                        </label>
                        <input type="text" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} placeholder="Value" value={floor.value} onChange={e => {
                          const newFloors = [...propertyDetails.siteValue.floors];
                          newFloors[index].value = formatCurrency(e.target.value);
                          setPropertyDetails({...propertyDetails, siteValue: {...propertyDetails.siteValue, floors: newFloors}});
                        }} />
                      </div>
                    ))}
                  </div>
                </div>

                <button className="btn-primary" onClick={handleNextToSiteImages} style={{ marginTop: '16px' }}>
                  Next: Site Images <ChevronRight size={18} />
                </button>
              </div>
            )}

            {/* STEP 4: Site Images */}
            {modalStep === 4 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                {!isCameraActive ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd', marginBottom: '24px' }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#0369a1', fontSize: '15px' }}>Live Site Capture</h4>
                      <p style={{ margin: 0, color: '#0284c7', fontSize: '13px', lineHeight: '1.4' }}>Please physically capture photos of the property. All photos will be automatically watermarked with the current date, time, and GPS Coordinates to verify the on-site visit.</p>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
                      {siteImages.map((img, idx) => (
                        <div key={img.id} onClick={() => setPreviewImage(img)} style={{ position: 'relative', width: '80px', height: '100px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                          <img src={img.url} alt="Site" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', padding: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
                            <span style={{ color: '#fde047', fontSize: '7px', fontWeight: '800', letterSpacing: '0.5px' }}>VERIFIED</span>
                            <span style={{ color: 'white', fontSize: '6px', marginTop: '1px' }}>Timestamped</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setSiteImages(prev => prev.filter(i => i.id !== img.id)); URL.revokeObjectURL(img.url); }} style={{ position: 'absolute', top: 0, right: 0, backgroundColor: 'rgba(239, 68, 68, 0.95)', color: 'white', border: 'none', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={12} strokeWidth={3} />
                          </button>
                        </div>
                      ))}
                      
                      <button onClick={() => startCamera('SITE_IMAGES')} style={{ width: '80px', height: '100px', borderRadius: '8px', border: '2px dashed var(--primary)', backgroundColor: 'rgba(0,82,204,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--primary)', gap: '4px' }}>
                        <Plus size={28} strokeWidth={2.5} />
                        <span style={{ fontSize: '11px', fontWeight: '600', textAlign: 'center' }}>Add<br/>Another</span>
                      </button>
                    </div>

                    <button className="btn-primary" onClick={startAIExtraction} disabled={siteImages.length === 0} style={{ opacity: siteImages.length === 0 ? 0.5 : 1, marginTop: 'auto' }}>
                      <ScanLine size={18} /> Verify & Extract Documents
                    </button>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '600' }}>
                        Capturing Site Image {siteImages.length + 1}
                      </span>
                    </div>
                    <div style={{ position: 'relative', width: '100%', height: '320px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000' }}>
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(0,0,0,0.5)', padding: '8px 16px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Camera size={16} color="#fff" />
                        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>Take Site Photo</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
                      <button className="btn-secondary" style={{ flex: 1 }} onClick={stopCamera}>Cancel</button>
                      <button className="btn-primary" style={{ flex: 2 }} onClick={captureDocument}>
                        <Camera size={18} /> Capture Photo {siteImages.length + 1}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 5 & 6 */}
            {modalStep === 5 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '40px 0' }}>
                <div style={{ position: 'relative' }}>
                  <Loader2 className="spin" size={64} color="var(--primary)" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Document Analysis</h3>
                  <p className="text-muted" style={{ fontSize: '14px' }}>Mahe AI is scanning your documents...</p>
                  <p className="text-primary" style={{ fontSize: '12px', fontWeight: '600', marginTop: '8px' }}>Scanning Languages: English, Telugu (తెలుగు)</p>
                </div>
              </div>
            )}

            {modalStep === 6 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: 'var(--success-bg)', borderRadius: '8px', marginBottom: '24px', border: '1px solid #6ee7b7' }}>
                  <CheckCircle2 size={20} color="#065f46" />
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#065f46' }}>Data extracted successfully</span>
                </div>

                <div className="native-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '24px' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted" style={{ fontSize: '13px' }}>Client</span>
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>{clientName}</span>
                  </div>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted" style={{ fontSize: '13px' }}>Bank</span>
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>{bankName}</span>
                  </div>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted" style={{ fontSize: '13px' }}>Property Type</span>
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>{extractedData.propertyType}</span>
                  </div>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="text-muted" style={{ fontSize: '13px' }}>Net Land Area</span>
                      <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '600' }}>(Extracted from Approved Building Plan)</span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>{extractedData.netLandArea}</span>
                  </div>
                  
                  {/* Address Comparison Warning */}
                  <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: extractedData.addressMatch ? '#fff' : '#fef2f2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <AlertCircle size={16} color={extractedData.addressMatch ? '#10b981' : '#ef4444'} />
                      <span style={{ fontSize: '14px', fontWeight: '700', color: extractedData.addressMatch ? '#065f46' : '#b91c1c' }}>
                        {extractedData.addressMatch ? 'Addresses Match' : 'Warning: Address Mismatch Detected'}
                      </span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                      <div style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#fff' }}>
                        <span style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>From Sale Deed Document</span>
                        <span style={{ fontSize: '13px' }}>{extractedData.addressDeed}</span>
                      </div>
                      <div style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#fff' }}>
                        <span style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--primary)', marginBottom: '4px' }}>From Approved Building Plan</span>
                        <span style={{ fontSize: '13px' }}>{extractedData.addressPlan}</span>
                      </div>
                    </div>
                    {!extractedData.addressMatch && (
                      <div style={{ marginTop: '12px', fontSize: '12px', color: '#b91c1c', fontWeight: '500' }}>
                        Please review the discrepancy. The final report will require manual override.
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={12} color="var(--primary)"/> System Confidence</span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>{extractedData.confidence}</span>
                  </div>
                </div>

                <button className="btn-primary" onClick={() => setModalStep(7)}>
                  Proceed to Final Review <ChevronRight size={18} />
                </button>
              </div>
            )}

            {/* STEP 7: Final Review & Signature */}
            {modalStep === 7 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckSquare size={16} /> Application Summary</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                      <span className="text-muted">Client & Bank:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '600', textAlign: 'right' }}>{clientName}<br/><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{bankName}</span></span>
                        <button onClick={() => setModalStep(1)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px' }}>Edit</button>
                      </div>
                    </div>
                    <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span className="text-muted">Legal Documents:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '600' }}>{Object.values(uploadedDocs).flat().length} Pages</span>
                          <button onClick={() => setShowSummaryDocs(!showSummaryDocs)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px' }}>Preview</button>
                          <button onClick={() => setModalStep(2)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px' }}>Edit</button>
                        </div>
                      </div>
                      {showSummaryDocs && Object.values(uploadedDocs).flat().length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                          {Object.values(uploadedDocs).flat().map((page, idx) => {
                            const info = getPageDisplayInfo(page, idx);
                            return (
                              <div 
                                key={page.id || idx} 
                                onClick={() => setPreviewImage(page)} 
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between',
                                  padding: '6px 10px',
                                  backgroundColor: '#f8fafc',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '6px',
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                  <span style={{ 
                                    backgroundColor: info.isPdf ? '#fee2e2' : '#e0e7ff',
                                    color: info.isPdf ? '#dc2626' : '#4338ca',
                                    fontSize: '9px',
                                    fontWeight: '700',
                                    padding: '1px 5px',
                                    borderRadius: '3px'
                                  }}>
                                    {info.ext}
                                  </span>
                                  <span style={{ fontSize: '12px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {info.name}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, fontSize: '11px', color: '#64748b' }}>
                                  {info.size && <span>{info.size}</span>}
                                  <Eye size={13} color="var(--primary)" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                      <span className="text-muted">Property Details:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '600', textAlign: 'right' }}>{propertyDetails.propertyType}<br/><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{propertyDetails.siteValue.plinthArea || 'No Value'}</span></span>
                        <button onClick={() => setModalStep(3)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px' }}>Edit</button>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span className="text-muted">Site Images:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '600' }}>{siteImages.length} Photos</span>
                          <button onClick={() => setShowSummaryImages(!showSummaryImages)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px' }}>Preview</button>
                          <button onClick={() => setModalStep(4)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px' }}>Edit</button>
                        </div>
                      </div>
                      {showSummaryImages && siteImages.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                          {siteImages.map((img) => (
                            <div key={img.id} onClick={() => setPreviewImage(img)} style={{ width: '40px', height: '50px', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
                              <img src={img.url} alt="Site" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text-primary)' }}>Digital Signature</h4>
                  
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    <button 
                      onClick={() => setActiveSignatureTab('draw')} 
                      style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: '600', borderRadius: '8px', border: activeSignatureTab === 'draw' ? '2px solid var(--primary)' : '1px solid var(--border-color)', backgroundColor: activeSignatureTab === 'draw' ? 'rgba(0,82,204,0.05)' : 'transparent', color: activeSignatureTab === 'draw' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      Draw Signature
                    </button>
                    <button 
                      onClick={() => setActiveSignatureTab('upload')} 
                      style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: '600', borderRadius: '8px', border: activeSignatureTab === 'upload' ? '2px solid var(--primary)' : '1px solid var(--border-color)', backgroundColor: activeSignatureTab === 'upload' ? 'rgba(0,82,204,0.05)' : 'transparent', color: activeSignatureTab === 'upload' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      Upload Signature
                    </button>
                  </div>

                  {activeSignatureTab === 'draw' && (
                    <div style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', backgroundColor: '#fff', position: 'relative', height: '150px' }}>
                      <SignatureCanvas 
                        ref={sigCanvas}
                        penColor="black"
                        canvasProps={{ style: { width: '100%', height: '100%', borderRadius: '12px' }, className: 'sigCanvas' }}
                        onEnd={() => setSignatureDataUrl(sigCanvas.current.getTrimmedCanvas().toDataURL('image/png'))}
                      />
                      <button onClick={() => { sigCanvas.current.clear(); setSignatureDataUrl(null); }} style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: '#fff', cursor: 'pointer' }}>Clear</button>
                    </div>
                  )}

                  {activeSignatureTab === 'upload' && (
                    <div style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', backgroundColor: '#f8fafc', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setSignatureUploadUrl(URL.createObjectURL(e.target.files[0]));
                          }
                        }} 
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
                      />
                      {signatureUploadUrl ? (
                        <img src={signatureUploadUrl} alt="Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          <UploadCloud size={24} style={{ margin: '0 auto 8px auto' }} />
                          <div style={{ fontSize: '13px', fontWeight: '600' }}>Tap to upload signature image</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(234, 179, 8, 0.05)', borderRadius: '12px', border: '1px solid #fef08a' }}>
                  <input 
                    type="checkbox" 
                    id="terms" 
                    checked={termsAccepted} 
                    onChange={(e) => setTermsAccepted(e.target.checked)} 
                    style={{ width: '20px', height: '20px', marginTop: '2px', cursor: 'pointer' }}
                  />
                  <label htmlFor="terms" style={{ fontSize: '13px', lineHeight: '1.4', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    I have thoroughly reviewed all submitted data and documents. I hereby declare that the information provided is correct to the best of my knowledge and belief, and I agree to all terms and conditions of the valuation policy.
                  </label>
                </div>

                <button 
                  className="btn-primary" 
                  onClick={() => {
                    try {
                      if (activeSignatureTab === 'draw') {
                        if (sigCanvas.current && typeof sigCanvas.current.isEmpty === 'function' && !sigCanvas.current.isEmpty()) {
                          const canvas = sigCanvas.current.getCanvas();
                          setSignatureDataUrl(canvas.toDataURL('image/png'));
                          setShowSubmitModal(true);
                        } else {
                          toast.error("Please draw your signature before submitting.");
                        }
                      } else {
                        if (!signatureUploadUrl) {
                          toast.error("Please upload your signature before submitting.");
                        } else {
                          setShowSubmitModal(true);
                        }
                      }
                    } catch (err) {
                      toast.error("Error capturing signature: " + err.message);
                      console.error(err);
                    }
                  }} 
                  disabled={!termsAccepted}
                  style={{ opacity: !termsAccepted ? 0.5 : 1, marginTop: 'auto' }}
                >
                  <PenTool size={18} /> Sign & Submit Application
                </button>
              </div>
            )}

            {/* Submit Confirmation Modal */}
            {showSubmitModal && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.95)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', animation: 'fadeIn 0.2s ease-out' }}>
                <ShieldAlert size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px', textAlign: 'center' }}>Are you sure you want to submit?</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '32px', lineHeight: '1.5' }}>
                  By clicking "Yes", this application will be digitally signed and securely submitted to the Admin Portal. This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowSubmitModal(false)}>Cancel</button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={() => { setShowSubmitModal(false); handleCreateCase(); }}>Yes, Submit</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

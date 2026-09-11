import { pdfjs } from 'react-pdf';
import { API_BASE_URL } from '../../config/api';
import { reconcileDocuments } from '../../utils/reconciliation';
import { isStrictlyEmpty, createField, createEmptyCanonicalMetadata } from '../../utils/canonicalSchema';

if (typeof window !== 'undefined' && pdfjs && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

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
// tier1: highly specific keywords → 1 match = instant PASS
// tier2: common / supporting keywords → need ≥ minTier2 matches to PASS
const MIN_TIER2 = 2;
const DOC_VALIDATION_RULES = {
  saleDeed: {
    name: 'Registered Sale Deed',
    minTier2: 3,
    tier1: [
      // English Deed Types
      'sale deed', 'deed of sale', 'absolute sale deed', 'conveyance deed', 'deed of conveyance', 
      'rectification deed', 'deed of rectification', 'title deed', 'gift deed', 'settlement deed', 
      'partition deed', 'release deed', 'agreement of sale', 'registered document',
      // Judicial Stamp Paper Markers
      'india non judicial', 'non judicial', 'non-judicial', 'nonjudicial', 'bharatiya gair nyayik', 
      'gair nyayik', 'bhartiya gair nyayik', 'satyamewa jayate', 'satyameva jayate', 
      'ex. officio stamp vendor', 'stamp vendor', 'stamp duty paid', 'fifty rupees', 'ten rupees', 
      'hundred rupees', 'twenty rupees', 'five hundred rupees', 'rs. 50', 'rs. 10', 'rs. 100', 'rs. 500',
      'government of andhra pradesh', 'government of telangana',
      // Registration Authority & Presentation Endorsement Sheet
      'sub-registrar', 'sub registrar', 'joint sub-registrar', 'joint sub registrar', 'subregistrar',
      'district registrar', 'sub-registrar office', 'sub registrar office', 'sro cuddapah', 'sro kadapa',
      'presentation endorsement', 'section 32-a', 'section 32a', 'sec 32-a', 'sec 32a', 
      'under section 32', 'registration act', 'executants/claimants', 'execution admitted', 
      'thumb impression', 'photographs & thumb impressions', 'aadhar photo',
      // Registration Deed Numbers & Book
      'doct no', 'doct. no', 'document no', 'deed no', 'cs no', 'book 1', 'bk - 1', 'bk-1', 'sheet 1 of', 'sheet of',
      // Property Schedule & Conveyance
      'schedule of property', 'schedule of the property', 'property schedule', 'vendor and purchaser', 'consideration amount',
      // Regional / Telugu Legal Keywords
      'విక్రయ దస్తావేజు', 'సవరణ దస్తావేజు', 'దస్తావేజు', 'విక్రయ', 'సబ్ రిజిస్ట్రార్', 'రిజిస్ట్రార్', 
      'రిజిస్టరు', 'రిజిస్ట్రేషన్', 'షెడ్యూలు', 'హద్దులు', 'చతుర్దిక్కుల', 'చ.గజములు', 'భారతీయ గేర్ న్యాయిక్', 'ఆంధ్ర ప్రదేశ్'
    ],
    tier2: [
      'vendor', 'purchaser', 'executant', 'claimant', 'stamp', 'registrar', 'registration', 
      'schedule', 'boundary', 'extent', 'survey', 'pattadar', 'khata', 'kadapa', 'cuddapah', 
      'andhra', 'telangana', 'chaturdikku', 'rupees', 'plot no', 'plinth', 'sy. no'
    ]
  },
  buildingPlan: {
    name: 'Approved Building Plan / Permit Order',
    minTier2: 2,
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
    minTier2: 2,
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
    minTier2: 2,
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
    minTier2: 1,
    tier1: [
      'site plan', 'key plan', 'floor plan', 'ground floor plan', 'first floor plan', 
      'second floor plan', 'ground floor', 'first floor', 'second floor',
      'elevation', 'section-aa', 'section-a', 'section', 'road widening', 
      'built up area', 'built-up area', 'bua check', 'coverage check', 'prop. site', 'prop site',
      'scale 1:100', 'scale 1:', 'layout approval', 'layout plan', 'dtcp approval', 
      'hmda approval', 'crda approval', 'huda approval', 'plot layout', 'iso_a1', 
      'drawing', 'subdivision', 'proposed construction', 'residential building'
    ],
    tier2: [
      'layout', 'plan', 'drawing', 'site', 'plot', 'key', 'floor', 'elevation', 
      'section', 'scale', 'road', 'widening', 'boundaries', 'terrace', 'verandah', 
      'kitchen', 'hall', 'bedroom', 'toilet', 'bua', 'area', 'structure', 'cadapa', 'kadapa', 'advocate'
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

// ── Extract true page count from PDF (supports File, Blob, ArrayBuffer, Uint8Array, dataUrl) ──
const getPdfPageCount = async (input) => {
  try {
    let arrayBuffer = null;
    if (input instanceof File || input instanceof Blob) {
      arrayBuffer = await input.arrayBuffer();
    } else if (input instanceof ArrayBuffer) {
      arrayBuffer = input;
    } else if (input instanceof Uint8Array) {
      arrayBuffer = input.buffer;
    } else if (typeof input === 'string') {
      if (input.startsWith('data:') || input.startsWith('blob:') || input.startsWith('http')) {
        const res = await fetch(input);
        arrayBuffer = await res.arrayBuffer();
      }
    }

    if (!arrayBuffer) return 1;

    // 1. Try pdfjs from react-pdf (exact DOM standard)
    if (pdfjs && typeof pdfjs.getDocument === 'function') {
      try {
        const task = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
        const doc = await task.promise;
        if (doc && doc.numPages > 0) {
          return doc.numPages;
        }
      } catch (pdfErr) {
        console.warn('pdfjs page count check note:', pdfErr);
      }
    }

    // 2. Binary / text stream parse (ultra-fast & 100% reliable fallback)
    const text = new TextDecoder('latin1').decode(new Uint8Array(arrayBuffer));

    // Root /Pages catalog with /Count N
    const rootMatches = [...text.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/gi)];
    if (rootMatches.length > 0) {
      const counts = rootMatches.map(m => parseInt(m[1], 10)).filter(n => !isNaN(n) && n > 0);
      if (counts.length > 0) return Math.max(...counts);
    }

    // Count individual /Type /Page objects
    const pageMatches = [...text.matchAll(/\/Type\s*\/Page\b/g)];
    if (pageMatches.length > 0) {
      return pageMatches.length;
    }

    // Any /Count N
    const anyMatches = [...text.matchAll(/\/Count\s+(\d+)/gi)];
    if (anyMatches.length > 0) {
      const counts = anyMatches.map(m => parseInt(m[1], 10)).filter(n => !isNaN(n) && n > 0);
      if (counts.length > 0) return Math.max(...counts);
    }
  } catch (err) {
    console.warn('getPdfPageCount error:', err);
  }
  return 1;
};

// ── Extract text from all pages of a PDF with real-time per-page live progress ───
const extractPdfText = async (file, onPageProgress = null) => {
  try {
    let arrayBuffer = null;
    if (file instanceof File || file instanceof Blob) {
      arrayBuffer = await file.arrayBuffer();
    } else if (file instanceof ArrayBuffer) {
      arrayBuffer = file;
    } else if (typeof file === 'string' && (file.startsWith('data:') || file.startsWith('blob:'))) {
      const res = await fetch(file);
      arrayBuffer = await res.arrayBuffer();
    }

    if (!arrayBuffer) return { text: '', rawText: '', numPages: 1, allLines: [], snippets: [] };

    // 1. Client-side pdfjs extraction with live per-page streaming
    if (pdfjs && typeof pdfjs.getDocument === 'function') {
      try {
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages || 1;
        const allLines = [];
        const pageTexts = [];

        // Scan all pages up to 25
        const pagesToScan = Math.min(totalPages, 25);
        for (let pageNum = 1; pageNum <= pagesToScan; pageNum++) {
          try {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            
            // Extract and assemble lines from text items
            const pageLines = [];
            let currentLine = '';
            for (const item of (content.items || [])) {
              const str = (item.str || '').trim();
              if (!str) continue;
              if (item.hasEOL) {
                currentLine += (currentLine ? ' ' : '') + str;
                if (currentLine.trim()) pageLines.push(currentLine.trim());
                currentLine = '';
              } else {
                currentLine += (currentLine ? ' ' : '') + str;
              }
            }
            if (currentLine.trim()) pageLines.push(currentLine.trim());

            // If no EOL tags, fallback to non-empty item strings
            const finalLines = pageLines.length > 0 
              ? pageLines 
              : (content.items || []).map(i => (i.str || '').trim()).filter(s => s.length > 2);

            if (finalLines.length > 0) {
              allLines.push(...finalLines);
              pageTexts.push(finalLines.join('\n'));
            }

            // Report real-time extracted lines to live UI terminal
            if (typeof onPageProgress === 'function') {
              const liveSnippets = finalLines.length > 0 
                ? finalLines.slice(0, 10) 
                : [`Page ${pageNum}: Scanning layout & seal structure...`];
              onPageProgress(pageNum, totalPages, liveSnippets);
            }
          } catch (pageErr) {
            console.warn(`Error reading PDF page ${pageNum}:`, pageErr);
          }
        }

        const fullText = pageTexts.join('\n\n').trim();
        const snippets = allLines.filter(l => l.length > 3).slice(0, 15);

        if (fullText.length > 5) {
          return {
            text: fullText.toLowerCase(),
            rawText: fullText,
            numPages: totalPages,
            allLines,
            snippets
          };
        }

        // Even if digital text is scarce (e.g. scanned PDF), return true numPages
        return {
          text: '',
          rawText: '',
          numPages: totalPages,
          allLines: [],
          snippets: [`PDF document has ${totalPages} page(s). Running OCR...`]
        };
      } catch (pdfErr) {
        console.warn('pdfjs client extract note:', pdfErr);
      }
    }

    // 2. Binary fallback page count
    const numPages = await getPdfPageCount(arrayBuffer);
    return { text: '', rawText: '', numPages, allLines: [], snippets: [] };
  } catch (err) {
    console.warn('PDF text extraction note:', err);
    return { text: '', rawText: '', numPages: 1, allLines: [], snippets: [] };
  }
};

// ── Contrast-enhanced client-side image optimizer for sharp OCR ─────────────
const optimizeImageForOCR = async (dataUrl) => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 2000; // high resolution for fine stamp print
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Preprocess: Grayscale & Contrast stretching
        try {
          const imgData = ctx.getImageData(0, 0, width, height);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const gray = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
            const boosted = gray < 165 ? Math.max(0, gray * 0.72) : Math.min(255, gray * 1.15);
            d[i] = boosted;
            d[i + 1] = boosted;
            d[i + 2] = boosted;
          }
          ctx.putImageData(imgData, 0, 0);
        } catch (_) {}

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
    // Pattern: "Doct No 8859/2018" / "Bk - 1, CS No 9227/2018 & Doct No 8859/2018" / "దస్తావేజు నెం. 8582/2018"
    const deedPatterns = [
      /bk\s*[-–]?\s*1[^\n]*?cs\s*no\s*\d{3,6}\/\d{2,4}\s*[&,]\s*doct\s*no\s*(\d{3,6})(?:\s*\/\s*(20\d{2}|19\d{2}))?/i,
      /bk\s*[-–]?\s*1[^\n]*?doct\s*no\s*(\d{3,6})(?:\s*\/\s*(20\d{2}|19\d{2}))?/i,
      /cs\s*no\s*(\d{3,6}\/\d{2,4})?[^\n]*?doct\s*no\s*(\d{3,6})(?:\s*\/\s*(20\d{2}|19\d{2}))?/i,
      /doct(?:ument)?\s*no\.?\s*:?\s*(\d{3,6})\s*\/\s*(20\d{2}|19\d{2})/i,
      /deed\s*no\.?\s*:?\s*(\d{3,6})\s*\/\s*(20\d{2}|19\d{2})/i,
      /deed\s*number\s*:?\s*(\d{3,6})\s*\/\s*(20\d{2}|19\d{2})/i,
      /దస్తావేజు\s*నెం\.?\s*:?\s*(\d{3,6})\s*\/\s*(20\d{2}|19\d{2})/,
      /దస్తావేజు\s*నెం\.?\s*:?\s*(\d{3,6})/,
      /doct(?:ument)?\s*no\.?\s*:?\s*(\d{3,6})/i,
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
    // Deed date: "17th day of DEC, 2018" / "17-12-2018" / "11.12.2018"
    if (!meta.deedYear) {
      const dateMatch = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:day\s*of\s*)?([a-z]+)\s*,?\s*(20\d{2}|19\d{2})/i)
        || t.match(/(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](20\d{2}|19\d{2})/)
        || t.match(/తేది\s*(\d{1,2})[\.\-](\d{1,2})[\.\-](20\d{2}|19\d{2})/);
      if (dateMatch) {
        const yr = dateMatch[3] || dateMatch[2];
        if (yr && /^(19|20)\d{2}$/.test(yr)) { meta.deedYear = yr; }
      }
    }
    // Survey Number from sale deed (Telugu: సర్కారు పుంజి డి.నెం. / డి.నెం. / Survey No)
    const survPatterns = [
      /సర్కారు\s*పుంజి\s*డి\.నెం\.?\s*(\d{1,4}(?:\/\d{1,4})?)/,
      /డి\.నెం\.?\s*(\d{1,4}(?:\/\d{1,4})?)/,
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

    // Plot Number from sale deed (e.g. ప్లాట్ నెం. 8 / Plot No. 8)
    const plotMatch = t.match(/ప్లాట్\s*నెం\.?\s*([0-9A-Za-z]+)/)
      || t.match(/plot\s*no\.?\s*:?\s*([0-9A-Za-z]+)/i);
    if (plotMatch && plotMatch[1] && !/^na$/i.test(plotMatch[1])) {
      meta.plotNo = plotMatch[1].trim();
      meta.propertyType = 'Open Site';
    }

    // Net Extent (Telugu: 177.77 చ.గజములు / 3 సెంట్ల 673 చ.లింకులు / square yards)
    const extPatterns = [
      /జాగా\s*వైశాల్యం\s*:?\s*([0-9\.]+)\s*చ\.?గజములు/,
      /([0-9\.]+)\s*చ\.?గజములు/,
      /([0-9\.]+)\s*సెంట్ల/,
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
        if (!isNaN(numPart) && numPart > 0) {
          const hasUnit = /sq|cent|acre|yard|చ\.?గజములు/i.test(raw);
          meta.extent = hasUnit ? (raw.includes('చ') ? `${numPart} Sq. Yards` : raw) : `${numPart} Sq. Yards`;
          break;
        }
      }
    }

    // Market Value (Telugu: ఈ ఆస్తి మార్కెట్టు విలువ : రూ. 5,60,000/-లు)
    const mvPatterns = [
      /ఈ\s*ఆస్తి\s*మార్కెట్టు\s*విలువ\s*:?\s*రూ\.?\s*([0-9,]+)/,
      /రూ\.?\s*([0-9,]+)\/-\s*లు\s*విలువ\s*చేయు/,
      /(?:total\s*)?market\s*value\s*:?\s*(?:rs\.?\s*)?([0-9,]+)/i,
      /(?:consideration|property)\s*value\s*:?\s*(?:rs\.?\s*)?([0-9,]+)/i,
    ];
    for (const mp of mvPatterns) {
      const mm = t.match(mp);
      if (mm && mm[1]) {
        const num = mm[1].replace(/,/g, '');
        if (parseInt(num) > 10000) {
          meta.marketValue = num;
          break;
        }
      }
    }

    // Road Width (Telugu: 24 అడుగులు వెడల్పు గల రోడ్డు)
    const rwMatch = t.match(/(\d{1,3})\s*అడుగులు\s*వెడల్పు\s*గల\s*రోడ్డు/)
      || t.match(/road\s*(?:width|wide)\s*:?\s*([0-9.]+)\s*(?:m|meter|ft|feet)?/i);
    if (rwMatch && rwMatch[1]) {
      meta.roadWidth = `${rwMatch[1]} ft`;
    }

    // Boundaries (Telugu: తూర్పు, పడమర, ఉత్తరం, దక్షిణం & English)
    const boundaryMap = {
      north: [/north\s*:?\s*([^\n\r,;.]{3,60})/i, /ఉత్తరం\s*:?\s*([^\n\r,;.]{3,60})/, /\u0c09\u0c24\u0c4d\u0c24\u0c30\u0c02\s*:?\s*([^\n\r\u0c2c]{3,60})/],
      south: [/south\s*:?\s*([^\n\r,;.]{3,60})/i, /దక్షిణం\s*:?\s*([^\n\r,;.]{3,60})/, /\u0c26\u0c15\u0c4d\u0c37\u0c23\u0c02\s*:?\s*([^\n\r\u0c2c]{3,60})/],
      east:  [/east\s*:?\s*([^\n\r,;.]{3,60})/i, /తూర్పు\s*:?\s*([^\n\r,;.]{3,60})/, /\u0c24\u0c42\u0c30\u0c4d\u0c2a\u0c41\s*:?\s*([^\n\r\u0c2c]{3,60})/],
      west:  [/west\s*:?\s*([^\n\r,;.]{3,60})/i, /పడమర\s*:?\s*([^\n\r,;.]{3,60})/, /\u0c2a\u0c21\u0c2e\u0c30\s*:?\s*([^\n\r\u0c2c]{3,60})/],
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
    if (Object.keys(boundaries).length > 0) meta.boundaries = boundaries;

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

  // ── APGB & MUNICIPAL FORMAT (ANY DOC) ───────────────────────────────────────
  const ownerMatch = t.match(/(?:purchased\s*by|in\s*favour\s*of|purchaser|claimant|1-cl[^\n]*\n|owner|name\s*of\s*the\s*applicant|applicant|విక్రయదారు|కొనుగోలుదారు)\s*[:\-\.]?\s*(?:sri|smt|mr|mrs)?\.?\s*([A-Za-z \.]{3,35})/i)
    || t.match(/(?:by\s*sri[\/\s]*smt)\s*[:\-\.]?\s*([A-Za-z \.]{3,35})/i);
  if (ownerMatch && !/sub[\s-]*registrar|corporation|government|municipal|bank/i.test(ownerMatch[1])) {
    const cleanName = ownerMatch[1].replace(/^(?:sri|smt|mr|mrs)\.?\s*/i, '').replace(/[\n\r]/g, '').trim();
    if (cleanName.length >= 3 && !/^(kadapa|cuddapah|sro|self)$/i.test(cleanName)) {
      meta.ownerName = cleanName;
    }
  }

  const fatherMatch = t.match(/(?:s\/o|d\/o|w\/o|c\/o|s\/o\.|d\/o\.|w\/o\.|son\s*of|daughter\s*of|wife\s*of)\s*(?:sri|smt|mr|mrs)?\.?\s*([A-Za-z \.]{3,35})/i);
  if (fatherMatch) {
    const cleanFather = fatherMatch[1].replace(/[\n\r]/g, '').replace(/\b(?:kadapa|cuddapah|poosala|street|for|whom|self|inner|side|revenue|ward|no)\b.*/i, '').trim();
    if (cleanFather.length > 2) meta.fathersName = cleanFather;
  }

  const branchMatch = t.match(/branch\s*[:\-]?\s*([A-Za-z\s,\.]+)/i);
  if (branchMatch) meta.branchName = branchMatch[1].trim();
  
  const wardMatch = t.match(/(?:revenue\s*ward\s*no\.?|ward\s*no\.?|ward\s*number|ward)[^\w\n\r]{0,10}[\s\n\r]*([0-9]{1,4}[a-z]?)/i);
  if (wardMatch && wardMatch[1]) meta.wardNo = wardMatch[1].trim();

  // Building Age
  const ageMatch = t.match(/(?:structure\s*details|building\s*details)[\s\S]{0,120}?\bage\s*[:\-\.]?\s*(\d{1,2})\b/i)
    || t.match(/(?:building\s*age|age\s*of\s*(?:the\s*)?building|structure\s*age|age\s*of\s*property)\s*[:\-\.]?\s*(\d{1,2})/i)
    || t.match(/\bage\s*[:\-\.]?\s*(\d{1,2})\s*(?:years?|yrs?)\b/i)
    || t.match(/\|\s*finished\s*\[.*?\]\s*\|\s*(\d{1,2})\s*\|/i)
    || t.match(/(?:finished|completed)[^\d\n\r]{0,30}(\d{1,2})\b/i);
  if (ageMatch && ageMatch[1]) meta.buildingAge = ageMatch[1].trim();
  
  const valLandMatch = t.match(/(?:land\s*cost|part\s*[-a]+\s*land|land\s*value)[^\d]*([\d,]+)/i);
  if (valLandMatch) meta.valuationLand = valLandMatch[1].replace(/,/g, '');
  
  const valBldgMatch = t.match(/(?:structure\s*cost|building\s*cost|part\s*[-b]+\s*building)[^\d]*([\d,]+)/i);
  if (valBldgMatch) meta.valuationBuilding = valBldgMatch[1].replace(/,/g, '');
  
  const valAmenMatch = t.match(/(?:part\s*[-cd]+\s*amenities|amenities)[^\d]*([\d,]+)/i);
  if (valAmenMatch) meta.valuationAmenities = valAmenMatch[1].replace(/,/g, '');
  
  const valServMatch = t.match(/(?:part\s*[-ef]+\s*services|services)[^\d]*([\d,]+)/i);
  if (valServMatch) meta.valuationServices = valServMatch[1].replace(/,/g, '');
  
  const valTotalMatch = t.match(/(?:market\s*value|total\s*valuation|valuation\s*:|say\s*as)[^\d]*([\d,]+)/i);
  if (valTotalMatch) meta.valuationTotal = valTotalMatch[1].replace(/,/g, '');
  
  const latLngMatch = t.match(/(?:latitude|lat\/?long)?[^\d]*([0-9]{1,2}\.[0-9]{5,8})[\s,]+([0-9]{1,3}\.[0-9]{5,8})/i);
  if (latLngMatch) {
    meta.latitude = latLngMatch[1];
    meta.longitude = latLngMatch[2];
  }

  // Dimensions
  const dims = ['north', 'south', 'east', 'west'];
  for (const dir of dims) {
    const dimRegex = new RegExp(`${dir}\\s+([\\d\\.\\sA-Za-z\\(\\)]+?)\\s*:\\s*([\\d\\.\\sA-Za-z\\(\\)]+)`, 'i');
    const m = t.match(dimRegex);
    if (m) {
       if (!meta.dimensionsDoc) meta.dimensionsDoc = {};
       if (!meta.dimensionsActual) meta.dimensionsActual = {};
       meta.dimensionsDoc[dir] = m[1].trim();
       meta.dimensionsActual[dir] = m[2].trim();
    }
  }

  return meta;
};

// ── Convert plain extractAllMetadata() result → canonical createField() objects ─
// This allows locally-parsed text to feed the same reconciliation engine as
// backend-returned extractedMeta, enabling fallback autofill even if the
// Python OCR daemon is offline.
const convertLocalMetaToCanonical = (meta, docId) => {
  if (!meta || typeof meta !== 'object') return null;
  const out = {};

  const scalarMap = {
    deedNo: 'deedNo', deedYear: 'deedYear',
    surveyNo: 'surveyNo', plotNo: 'plotNo',
    extent: 'netExtent',   // extractAllMetadata uses 'extent'
    netExtent: 'netExtent',
    assessmentNo: 'assessmentNo', doorNo: 'doorNo',
    approvalPlanNo: 'approvalPlanNo', approvalPlanDate: 'approvalPlanDate',
    builderName: 'builderName', roadWidth: 'roadWidth',
    propertyType: 'propertyType', structureType: 'structureType',
    buildingAge: 'buildingAge',
    marketValue: 'marketValue', flatNo: 'flatNo', floorNo: 'floorNo',
    fathersName: 'fathersName', branchName: 'branchName', wardNo: 'wardNo',
    valuationLand: 'valuationLand', valuationBuilding: 'valuationBuilding',
    valuationAmenities: 'valuationAmenities', valuationServices: 'valuationServices',
    valuationTotal: 'valuationTotal', latitude: 'latitude', longitude: 'longitude',
  };

  for (const [localKey, canonKey] of Object.entries(scalarMap)) {
    const val = meta[localKey];
    if (val && typeof val === 'string' && val.trim().length > 0) {
      out[canonKey] = createField(val.trim(), docId, 1, 0.88, val.trim(), 'EXTRACTED');
    }
  }

  if (meta.boundaries && typeof meta.boundaries === 'object') {
    out.documentBoundaries = {};
    for (const dir of ['north', 'south', 'east', 'west']) {
      const bv = meta.boundaries[dir];
      if (bv && typeof bv === 'string' && bv.trim().length > 2) {
        out.documentBoundaries[dir] = createField(bv.trim(), docId, 1, 0.85, bv.trim(), 'EXTRACTED');
      } else {
        out.documentBoundaries[dir] = createField(null, null, null, 0, null, 'EMPTY');
      }
    }
  }

  if (meta.dimensionsDoc && typeof meta.dimensionsDoc === 'object') {
    out.dimensionsDoc = {};
    out.dimensionsActual = {};
    for (const dir of ['north', 'south', 'east', 'west']) {
      if (meta.dimensionsDoc[dir]) out.dimensionsDoc[dir] = createField(meta.dimensionsDoc[dir], docId, 1, 0.85, meta.dimensionsDoc[dir], 'EXTRACTED');
      if (meta.dimensionsActual && meta.dimensionsActual[dir]) out.dimensionsActual[dir] = createField(meta.dimensionsActual[dir], docId, 1, 0.85, meta.dimensionsActual[dir], 'EXTRACTED');
    }
  }

  return Object.keys(out).length > 0 ? out : null;
};

// ── Apply locally extracted meta directly to propertyDetails (synchronous fallback) ─
// Called when backend returns no extractedMeta to ensure immediate autofill.
const applyLocalMetaDirectly = (localMeta, setPropertyDetails, setClientName, manuallyModifiedFields, toastFn) => {
  if (!localMeta || typeof localMeta !== 'object') return;

  const fieldMap = [
    { local: 'deedNo',          state: 'deedNo',          label: 'Deed #' },
    { local: 'deedYear',        state: 'deedYear',         label: 'Deed Year' },
    { local: 'surveyNo',        state: 'surveyNo',         label: 'Survey #' },
    { local: 'extent',          state: 'netExtent',        label: 'Net Extent' },
    { local: 'netExtent',       state: 'netExtent',        label: 'Net Extent' },
    { local: 'assessmentNo',    state: 'assessmentNo',     label: 'Assessment #' },
    { local: 'doorNo',          state: 'doorNo',           label: 'Door #' },
    { local: 'approvalPlanNo',  state: 'approvalPlanNo',   label: 'Permit #' },
    { local: 'approvalPlanDate',state: 'approvalPlanDate', label: 'Approval Date' },
    { local: 'plotNo',          state: 'plotNo',           label: 'Plot #' },
    { local: 'propertyType',    state: 'propertyType',     label: 'Property Type' },
    { local: 'structureType',   state: 'structureType',    label: 'Structure Type' },
    { local: 'buildingAge',     state: 'buildingAge',      label: 'Building Age' },
    { local: 'builderName',     state: 'builderName',      label: 'Builder' },
    { local: 'roadWidth',       state: 'roadWidth',        label: 'Road Width' },
    { local: 'flatNo',          state: 'flatNo',           label: 'Flat #' },
    { local: 'floorNo',         state: 'floorNo',          label: 'Floor' },
    // APGB format
    { local: 'fathersName',     state: 'fathersName',      label: 'Father\'s Name' },
    { local: 'branchName',      state: 'branchName',       label: 'Branch' },
    { local: 'wardNo',          state: 'wardNo',           label: 'Ward No' },
    { local: 'valuationLand',   state: 'valuationLand',    label: 'Land Value' },
    { local: 'valuationBuilding',state: 'valuationBuilding',label: 'Building Value' },
    { local: 'valuationAmenities',state: 'valuationAmenities',label: 'Amenities' },
    { local: 'valuationServices',state: 'valuationServices',label: 'Services' },
    { local: 'valuationTotal',  state: 'valuationTotal',   label: 'Total Valuation' },
    { local: 'latitude',        state: 'latitude',         label: 'Latitude' },
    { local: 'longitude',       state: 'longitude',        label: 'Longitude' },
  ];

  const notifications = [];
  setPropertyDetails(prev => {
    const next = { ...prev };
    const isFieldEmpty = (v) => !v || String(v).trim() === '' || String(v).trim().toLowerCase() === 'optional';

    for (const { local, state, label } of fieldMap) {
      if (manuallyModifiedFields && manuallyModifiedFields.has(state)) continue;
      if (!isFieldEmpty(next[state])) continue;
      const val = localMeta[local];
      if (val && typeof val === 'string' && val.trim().length >= 1) {
        next[state] = val.trim();
        notifications.push(`⚡ Auto-filled: ${label} → ${val.trim()}`);
      }
    }

    // Boundaries from local parsing
    if (localMeta.boundaries && typeof localMeta.boundaries === 'object') {
      const docBound = next.boundariesDoc ? { ...next.boundariesDoc } : { north: '', south: '', east: '', west: '' };
      let anyChanged = false;
      for (const dir of ['north', 'south', 'east', 'west']) {
        const key = `boundariesDoc.${dir}`;
        if (manuallyModifiedFields && manuallyModifiedFields.has(key)) continue;
        if (isFieldEmpty(docBound[dir]) && localMeta.boundaries[dir] && localMeta.boundaries[dir].trim().length > 2) {
          docBound[dir] = localMeta.boundaries[dir].trim();
          anyChanged = true;
        }
      }
      if (anyChanged) {
        next.boundariesDoc = docBound;
        notifications.push('⚡ Auto-filled: Boundaries from document');
      }
    }

    // Dimensions from local parsing
    if (localMeta.dimensionsDoc && typeof localMeta.dimensionsDoc === 'object') {
      const dimDoc = next.dimensionsDoc ? { ...next.dimensionsDoc } : { north: '', south: '', east: '', west: '' };
      const dimActual = next.dimensionsActual ? { ...next.dimensionsActual } : { north: '', south: '', east: '', west: '' };
      let anyDimChanged = false;
      for (const dir of ['north', 'south', 'east', 'west']) {
        const keyDoc = `dimensionsDoc.${dir}`;
        const keyAct = `dimensionsActual.${dir}`;
        if (!manuallyModifiedFields || !manuallyModifiedFields.has(keyDoc)) {
          if (isFieldEmpty(dimDoc[dir]) && localMeta.dimensionsDoc[dir]) {
            dimDoc[dir] = localMeta.dimensionsDoc[dir];
            anyDimChanged = true;
          }
        }
        if (!manuallyModifiedFields || !manuallyModifiedFields.has(keyAct)) {
          if (isFieldEmpty(dimActual[dir]) && localMeta.dimensionsActual && localMeta.dimensionsActual[dir]) {
            dimActual[dir] = localMeta.dimensionsActual[dir];
            anyDimChanged = true;
          }
        }
      }
      if (anyDimChanged) {
        next.dimensionsDoc = dimDoc;
        next.dimensionsActual = dimActual;
        notifications.push('⚡ Auto-filled: Dimensions from document');
      }
    }

    return next;
  });

  // Owner name → clientName
  if (localMeta.ownerName && typeof setClientName === 'function') {
    setClientName(prev => (prev && prev.trim().length > 0) ? prev : localMeta.ownerName);
  }
};

// ── Dedicated Local Sale Deed Autofill Mapper ──────────────────────────────────
export const mapSaleDeedToPropertyDetails = (
  extractedData,
  setPropertyDetails,
  setClientName,
  setClientFatherName,
  manuallyModifiedFields = new Set()
) => {
  if (!extractedData) return;

  setPropertyDetails(prev => {
    const next = { ...prev };
    const isEmpty = (v) => !v || String(v).trim() === '' || String(v).trim().toLowerCase() === 'optional';

    // Deed Number
    if (extractedData.documentNumber && isEmpty(next.deedNo) && !manuallyModifiedFields.has('deedNo')) {
      next.deedNo = extractedData.documentNumber;
    }
    // Deed Year
    if (extractedData.registrationDate && isEmpty(next.deedYear) && !manuallyModifiedFields.has('deedYear')) {
      const yrMatch = extractedData.registrationDate.match(/(20\d{2}|19\d{2})/);
      if (yrMatch) next.deedYear = yrMatch[1];
    }
    // Survey Number
    if (extractedData.property?.surveyNumbers?.length > 0 && isEmpty(next.surveyNo) && !manuallyModifiedFields.has('surveyNo')) {
      next.surveyNo = extractedData.property.surveyNumbers.join(', ');
    }
    // Plot Number
    if (extractedData.property?.plotNumbers?.length > 0 && isEmpty(next.plotNo) && !manuallyModifiedFields.has('plotNo')) {
      next.plotNo = extractedData.property.plotNumbers.join(', ');
    }
    // Khatha Number
    if (extractedData.property?.khathaNumbers?.length > 0 && isEmpty(next.khathaNo) && !manuallyModifiedFields.has('khathaNo')) {
      next.khathaNo = extractedData.property.khathaNumbers.join(', ');
    }
    // Net Extent
    if (extractedData.property?.totalExtent && isEmpty(next.netExtent) && !manuallyModifiedFields.has('netExtent')) {
      const unit = extractedData.property.totalExtentUnit || 'cents';
      next.netExtent = `${extractedData.property.totalExtent} ${unit}`;
    }
    // Boundaries
    if (extractedData.boundaries) {
      const bDoc = next.boundariesDoc ? { ...next.boundariesDoc } : { north: '', south: '', east: '', west: '' };
      for (const dir of ['north', 'south', 'east', 'west']) {
        const key = `boundariesDoc.${dir}`;
        if (extractedData.boundaries[dir] && isEmpty(bDoc[dir]) && !manuallyModifiedFields.has(key)) {
          bDoc[dir] = extractedData.boundaries[dir];
        }
      }
      next.boundariesDoc = bDoc;
    }

    return next;
  });

  // Client Name & Father Name (Purchaser)
  if (extractedData.purchaser && extractedData.purchaser[0]) {
    const p = extractedData.purchaser[0];
    if (p.name && typeof setClientName === 'function') {
      setClientName(prev => (!prev || prev.trim() === '') ? p.name : prev);
    }
    if (p.fatherName && typeof setClientFatherName === 'function') {
      setClientFatherName(prev => (!prev || prev.trim() === '') ? p.fatherName : prev);
    }
  }
};

// ── Core validation function (shared by file upload + camera capture) ─────────
const validateDocOCR = async (imageUrlOrFile, docId, isPdf = false, rawFile = null, clientText = '') => {
  const rules = DOC_VALIDATION_RULES[docId];
  if (!rules) return { passed: true }; // unknown doc type — skip validation

  try {
    let dataUrlToSend = imageUrlOrFile;
    if (rawFile instanceof File && (!dataUrlToSend || !dataUrlToSend.startsWith('data:'))) {
      dataUrlToSend = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(rawFile);
      });
    }

    if (dataUrlToSend && typeof dataUrlToSend === 'string' && dataUrlToSend.startsWith('data:')) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      // Route to dedicated local document intelligence endpoint for Sale Deed
      const endpointUrl = docId === 'saleDeed'
        ? `${API_BASE_URL}/api/extract/sale-deed`
        : `${API_BASE_URL}/api/extract/validate-doc`;

      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: dataUrlToSend,
          image: dataUrlToSend,
          pdfBase64: isPdf ? dataUrlToSend : null,
          docId,
          isPdf,
          clientText
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const result = await res.json();
        const isDrawingSlot = docId === 'layoutPlan' || docId === 'buildingPlan';
        const shouldPass = Boolean(result.passed) || isDrawingSlot || Boolean(isPdf) || Boolean(result.success);

        return {
          passed: shouldPass,
          ocrText: result.ocrText || result.rawText || '',
          snippets: result.snippets || [],
          numPages: result.numPages || 1,
          extractedMeta: result.extractedMeta || result.canonical || result.extractedData || null,
          saleDeedIntelligence: docId === 'saleDeed' ? result : null,
          fields: result.fields || [],
          warnings: result.warnings || []
        };
      }
    }

    return { passed: true };
  } catch (err) {
    console.warn(`Doc OCR validation note for ${docId}:`, err.message);
    return { passed: true };
  }
};

// ── Canonical Extracted Metadata & Auto-fill Handler ─────────────────────────
const handleExtractedDocMeta = (
  docId,
  extractedMeta,
  currentDetails,
  setPropertyDetails,
  toastFn,
  manuallyModifiedFields,
  setExtractedDocsMeta,
  setReconciledPropertyMeta,
  setClientName,
  clientName
) => {
  if (!extractedMeta) return;

  setExtractedDocsMeta(prevDocs => {
    const updatedDocs = { ...prevDocs, [docId]: extractedMeta };
    const reconciled = reconcileDocuments(updatedDocs);
    setReconciledPropertyMeta(reconciled);

    setPropertyDetails(prevDetails => {
      const next = { ...prevDetails };
      const notifications = [];
      const isFieldEmpty = (v) => !v || String(v).trim() === '' || String(v).trim().toLowerCase() === 'optional';

      const scalarFields = [
        { key: 'deedNo', label: 'Deed #' },
        { key: 'deedYear', label: 'Deed Year' },
        { key: 'surveyNo', label: 'Survey #' },
        { key: 'netExtent', label: 'Extent' },
        { key: 'khathaNo', label: 'Khatha #' },
        { key: 'assessmentNo', label: 'Assessment #' },
        { key: 'doorNo', label: 'Door #' },
        { key: 'approvalPlanNo', label: 'Permit #' },
        { key: 'approvalPlanDate', label: 'Approval Date' },
        { key: 'builderName', label: 'Builder' },
        { key: 'managingPartner', label: 'Managing Partner' },
        { key: 'flatNo', label: 'Flat #' },
        { key: 'floorNo', label: 'Floor Level' },
        { key: 'propertyType', label: 'Property Type' },
        { key: 'buildingAge', label: 'Building Age' },
        { key: 'roadWidth', label: 'Road Width' },
        { key: 'roadType', label: 'Road Type' },
        { key: 'plotType', label: 'Plot Type' },
        { key: 'structureType', label: 'Structure' },
        { key: 'flooringType', label: 'Flooring' },
        { key: 'plotNo', label: 'Plot #' },
        { key: 'fathersName', label: "Father's Name" },
        { key: 'branchName', label: 'Branch' },
        { key: 'wardNo', label: 'Ward No' },
        { key: 'valuationLand', label: 'Land Valuation' },
        { key: 'valuationBuilding', label: 'Building Valuation' },
        { key: 'valuationTotal', label: 'Total Valuation' }
      ];

      for (const { key, label } of scalarFields) {
        if (manuallyModifiedFields && manuallyModifiedFields.has(key)) continue;
        if (!isFieldEmpty(next[key])) continue;

        const f = reconciled[key];
        if (f && (f.status === 'VERIFIED' || f.status === 'EXTRACTED') && !isStrictlyEmpty(f.value)) {
          next[key] = f.value;
          notifications.push(`⚡ Auto-filled: ${label} ${f.value}`);
        }
      }

      const docBoundaries = next.boundariesDoc ? { ...next.boundariesDoc } : { north: '', south: '', east: '', west: '' };
      let anyBoundChanged = false;
      for (const dir of ['north', 'south', 'east', 'west']) {
        const boundKey = `boundariesDoc.${dir}`;
        if (manuallyModifiedFields && manuallyModifiedFields.has(boundKey)) continue;
        if (!isFieldEmpty(docBoundaries[dir])) continue;

        const bf = reconciled.documentBoundaries?.[dir];
        if (bf && (bf.status === 'VERIFIED' || bf.status === 'EXTRACTED') && !isStrictlyEmpty(bf.value)) {
          docBoundaries[dir] = bf.value;
          anyBoundChanged = true;
        }
      }
      if (anyBoundChanged) {
        next.boundariesDoc = docBoundaries;
        notifications.push('⚡ Auto-filled: Boundaries');
      }

      if ((!manuallyModifiedFields || !manuallyModifiedFields.has('siteValue')) && reconciled.siteValue?.value) {
        const rSite = reconciled.siteValue.value;
        if (rSite.floors && rSite.floors.length > 0 && rSite.floors[0].value) {
          if (isFieldEmpty(next.siteValue?.plinthArea)) {
            next.siteValue = {
              plinthArea: rSite.plinthArea || '',
              floors: rSite.floors
            };
            notifications.push('⚡ Auto-filled: Floor plinth areas');
          }
        }
      }

      if (reconciled.ownerName?.value && (!clientName || clientName === '')) {
        if (setClientName) setClientName(reconciled.ownerName.value);
      }

      return next;
    });

    return updatedDocs;
  });
};

// ── Sanitize PropertyDetails State ──────────────────────────────────────────
// Guarantees all scalar fields are clean strings and unwraps any nested canonical objects.
const sanitizePropertyDetails = (details = {}) => {
  if (!details || typeof details !== 'object') return {};
  const cleanScalar = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      if ('value' in val) return cleanScalar(val.value);
      return '';
    }
    const str = String(val).trim();
    if (str === '[object Object]' || str === 'null' || str === 'undefined' || str.toLowerCase() === 'optional') return '';
    return str;
  };

  const cleanBoundaries = (b = {}) => {
    if (!b || typeof b !== 'object') return { north: '', south: '', east: '', west: '' };
    return {
      north: cleanScalar(b.north),
      south: cleanScalar(b.south),
      east: cleanScalar(b.east),
      west: cleanScalar(b.west)
    };
  };

  const cleanSiteValue = (sv = {}) => {
    if (!sv || typeof sv !== 'object') return { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] };
    const rawVal = 'value' in sv && typeof sv.value === 'object' ? sv.value : sv;
    return {
      plinthArea: cleanScalar(rawVal.plinthArea),
      floors: Array.isArray(rawVal.floors) && rawVal.floors.length > 0 
        ? rawVal.floors.map(f => ({
            id: f.id || 'gf',
            label: cleanScalar(f.label) || 'Floor',
            value: cleanScalar(f.value)
          }))
        : [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }]
    };
  };

  return {
    ...details,
    boundariesDoc: cleanBoundaries(details.boundariesDoc || details.documentBoundaries),
    boundariesActual: cleanBoundaries(details.boundariesActual || details.actualBoundaries),
    buildingAge: cleanScalar(details.buildingAge),
    flooringType: cleanScalar(details.flooringType),
    structureType: cleanScalar(details.structureType),
    roadWidth: cleanScalar(details.roadWidth),
    propertyType: cleanScalar(details.propertyType),
    roadType: cleanScalar(details.roadType),
    plotType: cleanScalar(details.plotType),
    deedNo: cleanScalar(details.deedNo),
    deedYear: cleanScalar(details.deedYear),
    netExtent: cleanScalar(details.netExtent || details.extent),
    surveyNo: cleanScalar(details.surveyNo),
    plotNo: cleanScalar(details.plotNo),
    khathaNo: cleanScalar(details.khathaNo),
    assessmentNo: cleanScalar(details.assessmentNo),
    doorNo: cleanScalar(details.doorNo),
    approvalPlanNo: cleanScalar(details.approvalPlanNo),
    approvalPlanDate: cleanScalar(details.approvalPlanDate),
    builderName: cleanScalar(details.builderName),
    managingPartner: cleanScalar(details.managingPartner),
    flatNo: cleanScalar(details.flatNo),
    floorNo: cleanScalar(details.floorNo),
    fathersName: cleanScalar(details.fathersName),
    branchName: cleanScalar(details.branchName),
    wardNo: cleanScalar(details.wardNo),
    valuationTotal: cleanScalar(details.valuationTotal),
    valuationLand: cleanScalar(details.valuationLand),
    valuationBuilding: cleanScalar(details.valuationBuilding),
    valuationAmenities: cleanScalar(details.valuationAmenities),
    valuationServices: cleanScalar(details.valuationServices),
    latitude: cleanScalar(details.latitude),
    longitude: cleanScalar(details.longitude),
    documentPreparedBy: cleanScalar(details.documentPreparedBy),
    correctionDetails: cleanScalar(details.correctionDetails),
    additionsWork: Array.isArray(details.additionsWork) ? details.additionsWork : [],
    siteValue: cleanSiteValue(details.siteValue),
    vendors: Array.isArray(details.vendors) ? details.vendors : [],
    aadharNumbers: Array.isArray(details.aadharNumbers) ? details.aadharNumbers : [],
    stampPapers: Array.isArray(details.stampPapers) ? details.stampPapers : [],
    witnesses: Array.isArray(details.witnesses) ? details.witnesses : []
  };
};

// ── Apply all extracted metadata to propertyDetails state ─────────────────────
// Supports both plain-string meta (from applyLocalMetaDirectly) and canonical
// { value, status, confidence, ... } objects returned by the backend extract route.
const applyExtractedMeta = (
  meta,
  currentDetails,
  setPropertyDetails,
  toastFn,
  // Optional extended context — passed from CaseCreationModal for Step 2 badge support
  docId,
  setExtractedDocsMeta,
  setReconciledPropertyMeta,
  setClientName,
  clientName
) => {
  if (!meta || typeof meta !== 'object') return;

  // ── Unwrap canonical { value, status } field objects returned by the backend ──
  // Guarantees only plain string values enter propertyDetails state and toasts.
  const getVal = (item) => {
    if (item === null || item === undefined) return null;
    if (typeof item === 'string') {
      const s = item.trim();
      if (!s || s === '[object Object]' || s === 'null' || s === 'undefined') return null;
      return s;
    }
    if (typeof item === 'number') return String(item);
    if (typeof item === 'object') {
      if ('value' in item) {
        return getVal(item.value);
      }
      return null;
    }
    return null;
  };

  // ── Safe garbage detector ─────────────────────────────────────────────────────
  // Works on plain strings, canonical objects, and undefined/null without throwing.
  const isGarbage = (rawVal) => {
    const s = getVal(rawVal);
    if (!s) return true;
    if (s.toLowerCase() === 'optional') return true;
    if (/^[a-zA-Z]$/.test(s)) return true;
    return false;
  };

  const notifications = [];
  const next = sanitizePropertyDetails(currentDetails);
  const boundaries = next.boundariesDoc
    ? { ...next.boundariesDoc }
    : { north: '', south: '', east: '', west: '' };

  // ─ Core scalar fields ────────────────────────────────────────────────────────
  const deedNo = getVal(meta.deedNo);
  if (deedNo && isGarbage(next.deedNo)) {
    next.deedNo = deedNo;
    notifications.push(`Deed No. ${deedNo} detected & auto-filled!`);
  }

  const deedYear = getVal(meta.deedYear);
  if (deedYear && isGarbage(next.deedYear)) {
    next.deedYear = deedYear;
  }

  const surveyNo = getVal(meta.surveyNo);
  if (surveyNo && /^\d{1,4}(\/\d{1,4})?$/.test(surveyNo) &&
      (isGarbage(next.surveyNo) || !/^\d/.test(String(next.surveyNo || '')))) {
    next.surveyNo = surveyNo;
    notifications.push(`Survey No. ${surveyNo} detected & auto-filled!`);
  }

  const netExtent = getVal(meta.netExtent || meta.extent);
  if (netExtent && isGarbage(next.netExtent)) {
    next.netExtent = netExtent;
    notifications.push(`Net Extent ${netExtent} detected & auto-filled!`);
  }

  const assessmentNo = getVal(meta.assessmentNo);
  if (assessmentNo && assessmentNo.length >= 6 && isGarbage(next.assessmentNo)) {
    next.assessmentNo = assessmentNo;
    notifications.push(`Assessment No. ${assessmentNo} detected & auto-filled!`);
  }

  const doorNo = getVal(meta.doorNo);
  if (doorNo && isGarbage(next.doorNo)) {
    next.doorNo = doorNo;
  }

  const approvalPlanNo = getVal(meta.approvalPlanNo);
  if (approvalPlanNo && isGarbage(next.approvalPlanNo)) {
    next.approvalPlanNo = approvalPlanNo;
    notifications.push(`Permit No. ${approvalPlanNo} detected & auto-filled!`);
  }

  const approvalPlanDate = getVal(meta.approvalPlanDate);
  if (approvalPlanDate && isGarbage(next.approvalPlanDate)) {
    next.approvalPlanDate = approvalPlanDate;
  }

  // ─ Dropdown / select fields ────────────────────────────────────────────────────
  const propertyType = getVal(meta.propertyType);
  if (propertyType && isGarbage(next.propertyType)) {
    next.propertyType = propertyType;
    notifications.push(`Property Type → ${propertyType} (auto-detected!)`);
  }

  const structureType = getVal(meta.structureType);
  if (structureType && isGarbage(next.structureType)) {
    next.structureType = structureType;
    notifications.push(`Structure Type → ${structureType} (auto-detected!)`);
  }

  const buildingAge = getVal(meta.buildingAge);
  if (buildingAge && isGarbage(next.buildingAge)) {
    next.buildingAge = buildingAge;
    notifications.push(`Building Age → ${buildingAge} yr(s) auto-filled!`);
  }

  const roadWidth = getVal(meta.roadWidth);
  if (roadWidth && isGarbage(next.roadWidth)) {
    next.roadWidth = roadWidth;
  }

  const plotNo = getVal(meta.plotNo);
  if (plotNo && plotNo !== 'NA' && isGarbage(next.plotNo)) {
    next.plotNo = plotNo;
  }

  const wardNo = getVal(meta.wardNo);
  if (wardNo && isGarbage(next.wardNo)) {
    next.wardNo = wardNo;
    notifications.push(`Ward No. ${wardNo} auto-filled!`);
  }

  const fathersName = getVal(meta.fathersName);
  if (fathersName && isGarbage(next.fathersName)) {
    next.fathersName = fathersName;
  }

  const branchName = getVal(meta.branchName);
  if (branchName && isGarbage(next.branchName)) {
    next.branchName = branchName;
  }

  const valLand = getVal(meta.valuationLand);
  if (valLand && isGarbage(next.valuationLand)) {
    next.valuationLand = valLand;
  }

  const valBldg = getVal(meta.valuationBuilding);
  if (valBldg && isGarbage(next.valuationBuilding)) {
    next.valuationBuilding = valBldg;
  }

  const valTotal = getVal(meta.valuationTotal || meta.marketValue);
  if (valTotal && isGarbage(next.valuationTotal)) {
    next.valuationTotal = valTotal;
  }

  // ─ Builder & Flat Details ──────────────────────────────────────────────────────
  const builderName = getVal(meta.builderName);
  if (builderName && isGarbage(next.builderName)) {
    next.builderName = builderName;
    notifications.push(`Builder/Applicant: ${builderName} auto-filled!`);
  }

  const flatNo = getVal(meta.flatNo);
  if (flatNo && isGarbage(next.flatNo)) {
    next.flatNo = flatNo;
    notifications.push(`Flat No. ${flatNo} auto-filled!`);
  }

  const floorNo = getVal(meta.floorNo);
  if (floorNo && isGarbage(next.floorNo)) {
    next.floorNo = floorNo;
  }

  // ─ Floor Plinth Areas & siteValue ─────────────────────────────────────────────
  if (meta.siteValue?.value || meta.siteValue) {
    const rawSv = meta.siteValue?.value || meta.siteValue;
    if (rawSv && typeof rawSv === 'object' && Array.isArray(rawSv.floors) && rawSv.floors.length > 0 && rawSv.floors[0].value) {
      if (!next.siteValue?.plinthArea || isGarbage(next.siteValue?.plinthArea)) {
        next.siteValue = {
          plinthArea: rawSv.plinthArea || '',
          floors: rawSv.floors
        };
      }
    }
  }

  // ─ Boundaries ─────────────────────────────────────────────────────────────────
  // Support both plain { boundaries: { north, south... } } and canonical { documentBoundaries: { north: { value } } }
  const rawBounds = meta.documentBoundaries || meta.boundaries;
  if (rawBounds && typeof rawBounds === 'object') {
    let anyBoundary = false;
    for (const dir of ['north', 'south', 'east', 'west']) {
      const bv = getVal(rawBounds[dir]);
      if (bv && isGarbage(boundaries[dir])) {
        boundaries[dir] = bv;
        anyBoundary = true;
      }
    }
    if (anyBoundary) {
      next.boundariesDoc = boundaries;
      notifications.push('Property boundaries auto-filled from deed!');
    }
  }

  // ─ Owner name (for clientName state) ──────────────────────────────────────────
  const ownerName = getVal(meta.ownerName);
  if (ownerName && typeof setClientName === 'function') {
    const currentClient = typeof clientName === 'string' ? clientName : '';
    if (!currentClient.trim()) {
      setClientName(ownerName);
    }
  }

  // ─ Advanced Deed Fields (Vendors, Aadhars, Stamp Papers, Witnesses, Preparer, Correction) ─
  if (Array.isArray(meta.vendors) && meta.vendors.length > 0 && (!Array.isArray(next.vendors) || next.vendors.length === 0)) {
    next.vendors = meta.vendors;
    notifications.push(`${meta.vendors.length} Vendor(s) detected & auto-filled!`);
  }
  if (Array.isArray(meta.aadharNumbers) && meta.aadharNumbers.length > 0 && (!Array.isArray(next.aadharNumbers) || next.aadharNumbers.length === 0)) {
    next.aadharNumbers = meta.aadharNumbers;
    notifications.push(`${meta.aadharNumbers.length} Aadhaar number(s) detected!`);
  }
  if (Array.isArray(meta.stampPapers) && meta.stampPapers.length > 0 && (!Array.isArray(next.stampPapers) || next.stampPapers.length === 0)) {
    next.stampPapers = meta.stampPapers;
    notifications.push(`${meta.stampPapers.length} Stamp paper(s) detected!`);
  }
  if (Array.isArray(meta.witnesses) && meta.witnesses.length > 0 && (!Array.isArray(next.witnesses) || next.witnesses.length === 0)) {
    next.witnesses = meta.witnesses;
    notifications.push(`${meta.witnesses.length} Witness(es) detected!`);
  }
  const docPrep = getVal(meta.documentPreparedBy);
  if (docPrep && isGarbage(next.documentPreparedBy)) {
    next.documentPreparedBy = docPrep;
    notifications.push(`Document Preparer: ${docPrep} detected!`);
  }
  const corrDet = getVal(meta.correctionDetails);
  if (corrDet && isGarbage(next.correctionDetails)) {
    next.correctionDetails = corrDet;
    notifications.push('Correction deed details detected & auto-filled!');
  }

  // ─ Update state if anything changed ───────────────────────────────────────────
  const sanitizedNext = sanitizePropertyDetails(next);
  setPropertyDetails(sanitizedNext);

  // ─ Update Step 2 document intelligence badges if context is provided ───────────
  if (docId && typeof setExtractedDocsMeta === 'function') {
    setExtractedDocsMeta(prev => {
      const updated = { ...prev, [docId]: meta };
      if (typeof setReconciledPropertyMeta === 'function') {
        try {
          // reconcileDocuments is imported at the top of this file
          setReconciledPropertyMeta(reconcileDocuments(updated));
        } catch (_) {}
      }
      return updated;
    });
  }

  // ─ Staggered toast notifications ─────────────────────────────────────────────
  if (toastFn) {
    notifications.forEach((msg, i) => {
      setTimeout(() => toastFn.success(msg, { icon: '✅', duration: 4500 }), 300 + i * 600);
    });
    // Market value toast — safely parse numeric value only
    const rawMv = meta.marketValue;
    const mvString = rawMv && typeof rawMv === 'object' && 'value' in rawMv
      ? String(rawMv.value || '')
      : String(rawMv || '');
    const mvNum = Number(mvString.replace(/[^0-9.]/g, ''));
    if (!isNaN(mvNum) && mvNum > 0) {
      setTimeout(() => {
        toastFn.success(`Market Value: ₹${mvNum.toLocaleString('en-IN')}`, { icon: '💰', duration: 4500 });
      }, 300 + notifications.length * 600);
    }
  }
};


const FLOOR_LABELS = [
  'Ground Floor (GF)', 'First Floor (FF)', 'Second Floor (SF)', 
  'Third Floor (TF)', 'Fourth Floor (4F)', 'Fifth Floor (5F)', 
  'Sixth Floor (6F)', 'Seventh Floor (7F)'
];

export {
  FALLBACK_PROPERTY_TYPES,
  FALLBACK_PLOT_TYPES,
  FALLBACK_ROAD_TYPES,
  FALLBACK_STRUCTURE_TYPES,
  FALLBACK_FLOORING_TYPES,
  DEFAULT_BANKS,
  REQUIRED_DOCS,
  MIN_TIER2,
  DOC_VALIDATION_RULES,
  computeBufferHash,
  getPdfPageCount,
  extractPdfText,
  optimizeImageForOCR,
  extractAllMetadata,
  convertLocalMetaToCanonical,
  applyLocalMetaDirectly,
  validateDocOCR,
  handleExtractedDocMeta,
  applyExtractedMeta,
  sanitizePropertyDetails,
  FLOOR_LABELS
};

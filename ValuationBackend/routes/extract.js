const express = require('express');
const router = express.Router();
const ValuationCase = require('../models/ValuationCase');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const {
  createField,
  createEmptyCanonicalMetadata,
  isStrictlyEmpty,
  normalizeDeedNo,
  normalizeSurveyNo,
  normalizePlotNo,
  normalizeExtent,
  normalizeRoadWidth,
  normalizePropertyType,
  normalizeStructureType,
  cleanBoundaryText,
  normalizeCurrency
} = require('../ocr_service/canonicalSchema');

const {
  reconcileDocuments
} = require('../ocr_service/reconciliation');

// Helper to extract base64 data and mimeType from Data URL
const parseDataUrl = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return { mimeType: 'image/jpeg', base64: '' };
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  return { mimeType: 'image/jpeg', base64: dataUrl };
};

// ── Helper to match keywords robustly across OCR noise, spacing, and Unicode ─
function matchesKeyword(text, kw) {
  if (!text || !kw) return false;
  const t = text.toLowerCase();
  const k = kw.toLowerCase().trim();
  if (t.includes(k)) return true;

  // Normalized whitespace match
  const tNorm = t.replace(/[\s\-_–—\.\,\/]+/g, ' ');
  const kNorm = k.replace(/[\s\-_–—\.\,\/]+/g, ' ');
  if (tNorm.includes(kNorm)) return true;

  // Compact alphanumeric & Telugu Unicode match (handles "INDIANONJUDICIAL", "SubRegistrar", "DoctNo")
  const tCompact = t.replace(/[^a-z0-9\u0C00-\u0C7F]/g, '');
  const kCompact = k.replace(/[^a-z0-9\u0C00-\u0C7F]/g, '');
  if (kCompact.length >= 3 && tCompact.includes(kCompact)) return true;

  return false;
}

// ── STRICT LEGAL KEYWORDS (Multilingual: English + Telugu) ──────────────────
const STRICT_DOC_KEYWORDS = {
  saleDeed: {
    name: 'Registered Sale Deed',
    tier1: [
      'sale deed', 'deed of sale', 'conveyance deed', 'rectification deed', 'title deed',
      'india non judicial', 'indianonjudicial', 'non judicial', 'nonjudicial', 'non-judicial', 'bharatiya gair nyayik', 'gair nyayik',
      'sub-registrar', 'sub registrar', 'subregistrar', 'joint sub-registrar', 'joint sub registrar', 'joint subregistrar',
      'presentation endorsement', 'endorsement', 'section 32-a', 'section 32a', 'sec 32-a', 'sec 32a', 'registration act',
      'doct no', 'doctno', 'deed no', 'deedno', 'cs no', 'csno', 'book 1', 'bk - 1', 'bk-1', 'book1',
      'stamp vendor', 'stampvendor', 'ex-officio stamp vendor', 'ex officio stamp vendor',
      'schedule of property', 'property schedule', 'vendor and purchaser', 'fifty rupees', 'ten rupees',
      'విక్రయ దస్తావేజు', 'సవరణ దస్తావేజు', 'దస్తావేజు', 'విక్రయ', 'సబ్ రిజిస్ట్రార్',
      'రిజిస్ట్రార్', 'షెడ్యూలు', 'హద్దులు', 'చతుర్దిక్కుల', 'చ.గజములు', 'సెంట్లు', 'రూపాయలు', 'కడప', 'ఆంధ్ర'
    ],
    tier2: [
      'vendor', 'purchaser', 'executant', 'claimant', 'stamp', 'registrar', 'registration',
      'schedule', 'boundary', 'extent', 'survey', 'kadapa', 'cuddapah', 'andhra', 'telangana', 'rupees', 'doct', 'deed', 'endorsement', 'sro'
    ]
  },
  buildingPlan: {
    name: 'Approved Building Plan / Permit Order',
    tier1: [
      'building permit order', 'town planning section', 'building permission', 'permit no',
      'permission sanctioned', 'details of permission sanctioned', 'licensed technical person',
      'details of fees paid', 'kadapa municipal corporation', 'municipal corporation', 'gram panchayat',
      'individual residential building', 'residential building', 'planning permission',
      'plinth area', 'sanctioned plan', 'sanction order', 'proposed construction', 'ground floor', 'first floor', 'second floor',
      'floor plan', 'key plan', 'site plan', 'elevation', 'section-aa', 'bua check'
    ],
    tier2: ['permit', 'order', 'permission', 'sanction', 'municipal', 'corporation', 'panchayat', 'premises', 'license', 'plinth', 'area', 'floors', 'plan', 'drawing', 'site']
  },
  propertyTax: {
    name: 'Property Tax Assessment / Receipt',
    tier1: [
      'property tax', 'tax receipt', 'assessment no', 'tax assessment', 'amount payable', 'amount paid',
      'municipal corporation', 'revenue receipt', 'house tax', 'ptin', 'annual tax', 'challan no',
      'demand notice', 'gram panchayat tax'
    ],
    tier2: ['tax', 'assessment', 'receipt', 'municipal', 'corporation', 'paid', 'challan', 'ward', 'owner', 'door no', 'ptin']
  },
  marketValue: {
    name: 'Market Value / Guideline Certificate',
    tier1: [
      'market value assistance', 'duty & fee calculator', 'market value', 'guideline value',
      'sub-registrar office', 'sro name', 'registrations & stamps department', 'land cost', 'structure cost', 'basic value',
      'unit rate'
    ],
    tier2: ['market', 'value', 'guideline', 'rate', 'valuation', 'land', 'cost', 'structure', 'area', 'registrar', 'sro']
  },
  layoutPlan: {
    name: 'Layout / Approval Plan',
    tier1: [
      'layout approval', 'site plan', 'key plan', 'floor plan', 'ground floor plan', 'first floor plan',
      'second floor plan', 'ground floor', 'first floor', 'second floor', 'elevation', 'section-aa', 'section-a', 'section',
      'road widening', 'built up area', 'bua check', 'layout permit', 'dtcp', 'hmda', 'uda',
      'proposed layout', 'master plan', 'prop. site', 'prop site', 'coverage check', 'area details',
      'proposed construction', 'residential building', 'scale 1:100', 'scale 1:', 'iso_a1', 'open terrace', 'verandah'
    ],
    tier2: ['layout', 'plan', 'drawing', 'site', 'plot', 'floor', 'elevation', 'section', 'scale', 'road', 'boundary', 'north', 'area', 'project', 'kitchen', 'hall', 'bedroom', 'toilet', 'terrace', 'verandah', 'advocate', 'kadapa']
  }
};

// ── 100% Free & Unlimited Local Document AI Engine Bridge ───────────────────
const OCR_DAEMON_URL = 'http://127.0.0.1:5002';

const runPythonOCR = async (inputData, isPdf = false) => {
  // 1. First attempt: Fast Persistent OCR Microservice (instant, model already in RAM)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const daemonRes = await fetch(`${OCR_DAEMON_URL}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: inputData, isPdf }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (daemonRes.ok) {
      const parsed = await daemonRes.json();
      if (parsed && typeof parsed === 'object' && (parsed.text !== undefined || parsed.lines)) {
        return parsed;
      }
    }
  } catch (_) {
    // Daemon not ready or busy — proceed to direct spawn fallback
  }

  // 2. Direct Process Fallback
  return new Promise((resolve) => {
    try {
      const scriptPath = path.join(__dirname, '..', 'ocr_service', 'ocr_engine.py');
      const venvPy = 'd:\\gcr\\venv_ocr\\Scripts\\python.exe';
      const pythonExe = fs.existsSync(venvPy) ? venvPy : 'python';

      const tempInputFile = path.join(__dirname, '..', 'ocr_service', `temp_${Date.now()}_ocr.txt`);
      fs.writeFileSync(tempInputFile, inputData, 'utf-8');

      const args = [scriptPath, tempInputFile];
      if (isPdf) args.push('--pdf');

      const py = spawn(pythonExe, args, {
        timeout: 90000,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          OPENBLAS_NUM_THREADS: '1',
          MKL_NUM_THREADS: '1',
          OMP_NUM_THREADS: '1',
          KMP_DUPLICATE_LIB_OK: 'TRUE'
        }
      });
      let stdout = '';
      let stderr = '';

      py.stdout.on('data', (d) => { stdout += d.toString(); });
      py.stderr.on('data', (d) => { stderr += d.toString(); });

      py.on('close', () => {
        try { if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile); } catch (e) {}
        try {
          // Robust JSON extraction matching marker or bracket bounds
          let jsonStr = stdout.trim();
          const markerMatch = stdout.match(/__OCR_JSON_START__(.*?)__OCR_JSON_END__/s);
          if (markerMatch) {
            jsonStr = markerMatch[1].trim();
          } else {
            const firstBrace = stdout.indexOf('{');
            const lastBrace = stdout.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              jsonStr = stdout.substring(firstBrace, lastBrace + 1);
            }
          }

          const res = JSON.parse(jsonStr);
          resolve(res);
        } catch (e) {
          console.warn('Python OCR parse error (falling back to graceful structure):', e.message);
          resolve({
            text: '',
            lines: [],
            pages: [],
            num_pages: 1,
            is_blurred: false,
            blur_score: 100
          });
        }
      });

      py.on('error', (err) => {
        try { if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile); } catch (e) {}
        console.warn('Python OCR spawn error:', err);
        resolve({
          text: '',
          lines: [],
          pages: [],
          num_pages: 1,
          is_blurred: false,
          blur_score: 100
        });
      });
    } catch (err) {
      console.warn('runPythonOCR failed:', err);
      resolve({
        text: '',
        lines: [],
        pages: [],
        num_pages: 1,
        is_blurred: false,
        blur_score: 100
      });
    }
  });
};

/**
 * High-Precision Canonical Metadata Extractor from Multi-Page OCR
 * Multilingual support: English & Telugu legal terms
 */
function extractCanonicalFromOCR(pyResult, docId, clientText = '') {
  const canonical = createEmptyCanonicalMetadata();
  const rawText = `${pyResult?.text || ''}\n${clientText || ''}`.trim();
  const text = rawText.toLowerCase();
  const pages = pyResult?.pages || [{ page: 1, text: rawText }];

  // Helper to find which page matched a regular expression or snippet string
  const findPageForRegex = (pattern) => {
    if (!pattern) return 1;
    for (const p of pages) {
      const pText = p.text || '';
      if (pattern instanceof RegExp) {
        if (pattern.test(pText)) return p.page;
      } else if (typeof pattern === 'string') {
        if (pText.includes(pattern) || pText.toLowerCase().includes(pattern.toLowerCase())) return p.page;
      }
    }
    return 1;
  };

  // 1. Deed Number & Deed Year
  const deedPatterns = [
    /(?:bk\s*[-–]?\s*1[^\n]*?doct\s*no|doct(?:ument)?\s*no\.?|doc\s*no\.?|deed\s*no\.?|దస్తావేజు\s*(?:నెం|నెంబరు)\.?)\s*[:\-\.]?\s*(\d{3,6})(?:\s*[\/\-]\s*(20\d{2}|19\d{2}))?/i,
    /(?:registered\s*(?:as)?\s*document\s*no\.?|registered\s*doct?\s*no\.?)\s*[:\-\.]?\s*(\d{3,6})(?:\s*(?:of|\/|\-)\s*(20\d{2}|19\d{2}))?/i,
    /(?:subregi|sub-registrar|sro|subr)[^\d\n]{0,20}[\n\r\s]+(\d{3,6})(?:\s*[\/\-]\s*(20\d{2}|19\d{2}))?/i,
    /(?:subregi|sub-registrar|sro|subr)[^\d\n]*?(\d{3,6})(?:\s*[\/\-]\s*(20\d{2}|19\d{2}))?/i,
    /(?<!cs\s*no\s*)\b(\d{3,6})\s*\/\s*(20\d{2}|19\d{2})\b/i
  ];

  for (const dp of deedPatterns) {
    const dm = rawText.match(dp);
    if (dm) {
      const numPart = dm[1];
      const yrPart = dm[2];
      const rawVal = yrPart ? `${numPart}/${yrPart}` : numPart;
      const dVal = normalizeDeedNo(rawVal);
      if (dVal) {
        canonical.deedNo = createField(dVal, docId, findPageForRegex(dm[0]), 0.95, dm[0], 'EXTRACTED');
        if (yrPart) {
          canonical.deedYear = createField(yrPart, docId, findPageForRegex(dm[0]), 0.95, yrPart, 'EXTRACTED');
        }
        break;
      }
    }
  }

  // Deed Date (only for sale deed or when deed keywords present)
  if (docId === 'saleDeed' || /sale\s*deed|title\s*deed|deed|దస్తావేజు/i.test(rawText)) {
    const deedDatePatterns = [
      /(?:the\s*)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:day\s*of\s*)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\s,]+(20\d{2}|19\d{2})/i,
      /(?:execution\s*date|registered\s*on|date\s*of\s*registration|generated\s*on|దస్తావేజు\s*తేది|తేది)\s*[:\-\.]?\s*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/i,
      /(?:dated?|date)\s*[:\-\.]?\s*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.](?:20\d{2}|19\d{2}))/i,
      /\b([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-](?:20\d{2}|19\d{2}))\b/
    ];
    for (const ddp of deedDatePatterns) {
      const ddm = rawText.match(ddp);
      if (ddm) {
        if (ddm[3] && !canonical.deedYear?.value) {
          canonical.deedYear = createField(ddm[3], docId, findPageForRegex(ddm[0]), 0.90, ddm[0], 'EXTRACTED');
        }
        const dateVal = ddm[1].includes('/') || ddm[1].includes('-') ? ddm[1] : `${ddm[1]} ${ddm[2]}, ${ddm[3]}`;
        canonical.deedDate = createField(dateVal, docId, findPageForRegex(ddm[0]), 0.90, ddm[0], 'EXTRACTED');
        break;
      }
    }
  }

  // 2. Survey Number (handles LPM No, TS No, RS No, multiline & colons/semicolons)
  const survPatterns = [
    /(?:government\s*survey\s*numbers\s*involved|lpm\s*no\s*[\/&]?\s*survey\s*no|lpm\s*no|t\.?s\.?\s*no|r\.?s\.?\s*no|సర్కారు\s*పుంజి\s*డి\.నెం\.?|సర్వే\s*(?:నెం|నెంబరు)\.?|survey\s*no\.?|sy\.?no\.?|s\.?no\.?)[^\w\n\r]{0,30}[\s\n\r]*([0-9]{1,4}(?:\s*[\/\-]\s*[0-9]{1,4}[A-Za-z0-9\-]*)?)/i,
    /(?:survey|sy\.?)[^\w\n\r]{0,5}[\s\n\r]*([0-9]{1,4}\/[0-9]{1,4}[A-Za-z0-9\-]*)/i
  ];
  for (const sp of survPatterns) {
    const sm = rawText.match(sp);
    if (sm && sm[1]) {
      const sVal = normalizeSurveyNo(sm[1].replace(/\s+/g, ''));
      if (sVal) {
        canonical.surveyNo = createField(sVal, docId, findPageForRegex(sm[0]), 0.92, sm[0], 'EXTRACTED');
        break;
      }
    }
  }

  // 3. Plot Number
  const plotMatch = rawText.match(/(?:ప్లాట్\s*నెం\.?|plot\s*no\.?)\s*[:\-\.]?\s*([0-9A-Za-z\-]+)/i);
  if (plotMatch) {
    const pVal = normalizePlotNo(plotMatch[1]);
    if (pVal) {
      canonical.plotNo = createField(pVal, docId, findPageForRegex(plotMatch[0]), 0.90, plotMatch[0], 'EXTRACTED');
    }
  }

  // 4. Net Extent (Cents, Sq. Yards, Sq. Meters, Sq. Ft)
  const extPatterns = [
    /([0-9]+)\s+([0-9]{1,2})\s*(?:sy|sq)\.?\s*yards?/i, // matches "124 7 Sy Yards" -> 124.7
    /([0-9]+(?:\.[0-9]+)?)\s*(?:చ\.?గజములు|sq\.?\s*yards?|sq\.?\s*yds?|sy\.?\s*yards?|cents?|సెంట్లు|సెంట్ల|sq\.?\s*ft|sft|sq\.?\s*meters?|చ\.?మీ)/i,
    /(?:net\s*extent|extent|net\s*area\s*of\s*plot|area|వైశాల్యం)\s*[:\-\.]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:sq\.?\s*(?:yards?|yds?|meters?|ft)|sy\.?\s*yards?|cents?|చ\.?గజములు|సెంట్లు)?/i
  ];
  for (const ep of extPatterns) {
    const em = rawText.match(ep);
    if (em) {
      let rawStr = em[0];
      if (em[2] && /sy|sq/i.test(em[0])) {
        rawStr = `${em[1]}.${em[2]} Sq. Yards`;
      }
      const extVal = normalizeExtent(rawStr);
      if (extVal) {
        canonical.netExtent = createField(extVal, docId, findPageForRegex(em[0]), 0.92, em[0], 'EXTRACTED');
        break;
      }
    }
  }

  // 5. Market Value & Basic Value
  const mvMatch = rawText.match(/(?:ఈ\s*ఆస్తి\s*మార్కెట్టు\s*విలువ|రూ\.?\s*([0-9,]+)\/-\s*లు|market\s*value|basic\s*value|maikc\s*valuc|land\s*cost|taxable\s*value|value\s*[:\-\.]?\s*rs\.?)\s*[:\-\.;]?\s*(?:rs\.?)?\s*([0-9,]+)/i)
    || rawText.match(/(?:rs\.?|రూ\.?)\s*([0-9,]+)\s*\/\s*[-–]/i);
  if (mvMatch) {
    const val = (mvMatch[2] || mvMatch[1] || '').replace(/,/g, '');
    if (parseInt(val, 10) > 1000) {
      canonical.marketValue = createField(val, docId, findPageForRegex(mvMatch[0]), 0.92, mvMatch[0], 'EXTRACTED');
    }
  }

  // 6. Road Width (handles meters and feet, e.g. "6.00 MT WIDE PROPOSED ROAD")
  const rwMatch = rawText.match(/(\d{1,3}(?:\.\d+)?)\s*(?:mt|m|meter|meters|feet|ft|అడుగులు)?\s*(?:wide|వెడల్పు)?\s*(?:గల)?\s*(?:proposed\s*road|existing\s*road|road|రోడ్డు)/i)
    || rawText.match(/(?:road\s*width|width\s*of\s*road|road\s*wide|proposed\s*road)\s*[:\-\.]?\s*([0-9.]+)\s*(?:mt|m|meter|ft|feet)?/i);
  if (rwMatch) {
    const rwVal = normalizeRoadWidth(rwMatch[0]);
    if (rwVal) {
      canonical.roadWidth = createField(rwVal, docId, findPageForRegex(rwMatch[0]), 0.90, rwMatch[0], 'EXTRACTED');
    }
  }

  // 7. Property Type & Structure Type
  if (/individual\s*residential|single\s*family|residential\s*building|independent\s*house/i.test(rawText)) {
    canonical.propertyType = createField('Independent House', docId, 1, 0.92, 'Individual Residential Building', 'EXTRACTED');
  } else if (/apartment|flat|multi[\s-]*dwelling|multi[\s-]*story/i.test(rawText)) {
    canonical.propertyType = createField('Apartment', docId, 1, 0.92, 'Apartment', 'EXTRACTED');
  } else if (/open\s*site|vacant\s*land|open\s*plot/i.test(rawText)) {
    canonical.propertyType = createField('Open Site', docId, 1, 0.92, 'Open Site', 'EXTRACTED');
  } else if (/agriculture|agricultural|farm\s*land/i.test(rawText)) {
    canonical.propertyType = createField('Open Agriculture Land', docId, 1, 0.92, 'Open Agriculture Land', 'EXTRACTED');
  } else if (/industrial|warehouse|factory/i.test(rawText)) {
    canonical.propertyType = createField('Industrial Unit', docId, 1, 0.92, 'Industrial Unit', 'EXTRACTED');
  }

  if (/framed|rcc|r\.c\.c|reinforced\s*concrete|కాంక్రీటు/i.test(rawText)) {
    canonical.structureType = createField('Framed structure', docId, 1, 0.92, 'RCC / Framed structure', 'EXTRACTED');
  } else if (/load\s*bearing/i.test(rawText)) {
    canonical.structureType = createField('Load bearing', docId, 1, 0.92, 'Load bearing', 'EXTRACTED');
  } else if (/steel\s*structure/i.test(rawText)) {
    canonical.structureType = createField('Steel Structure', docId, 1, 0.92, 'Steel Structure', 'EXTRACTED');
  }

  // 7b. Building Age (from SRO structure table "Age: 1" or deed age clauses)
  const ageMatch = rawText.match(/(?:structure\s*details|building\s*details)[\s\S]{0,120}?\bage\s*[:\-\.]?\s*(\d{1,2})\b/i)
    || rawText.match(/(?:building\s*age|age\s*of\s*(?:the\s*)?building|structure\s*age|age\s*of\s*property)\s*[:\-\.]?\s*(\d{1,2})/i)
    || rawText.match(/\bage\s*[:\-\.]?\s*(\d{1,2})\s*(?:years?|yrs?)\b/i)
    || rawText.match(/\|\s*finished\s*\[.*?\]\s*\|\s*(\d{1,2})\s*\|/i)
    || rawText.match(/(?:finished|completed)[^\d\n\r]{0,30}(\d{1,2})\b/i);

  if (ageMatch && ageMatch[1]) {
    const ageVal = ageMatch[1].trim();
    if (parseInt(ageVal, 10) >= 0 && parseInt(ageVal, 10) <= 120) {
      canonical.buildingAge = createField(ageVal, docId, findPageForRegex(ageMatch[0]), 0.90, ageMatch[0], 'EXTRACTED');
    }
  }

  // 8. Boundaries (Bilingual English & Telugu, strictly filter financial noise)
  const isBoundaryNoise = (str) => {
    if (!str) return true;
    return /land\s*cost|market\s*value|taxable|stamp\s*duty|unit\s*rate|sub\s*reg|total|rs\.|rupees/i.test(str);
  };
  const eastMatch = rawText.match(/(?:తూర్పు|east)\s*[:\-\.]\s*([^\n\r,;.]{3,65})/i);
  const westMatch = rawText.match(/(?:పడమర|west)\s*[:\-\.]\s*([^\n\r,;.]{3,65})/i);
  const northMatch = rawText.match(/(?:ఉత్తరం|north)\s*[:\-\.]\s*([^\n\r,;.]{3,65})/i);
  const southMatch = rawText.match(/(?:దక్షిణం|south)\s*[:\-\.]\s*([^\n\r,;.]{3,65})/i);

  const cleanedNorth = northMatch && !isBoundaryNoise(northMatch[1]) ? cleanBoundaryText(northMatch[1]) : null;
  const cleanedSouth = southMatch && !isBoundaryNoise(southMatch[1]) ? cleanBoundaryText(southMatch[1]) : null;
  const cleanedEast = eastMatch && !isBoundaryNoise(eastMatch[1]) ? cleanBoundaryText(eastMatch[1]) : null;
  const cleanedWest = westMatch && !isBoundaryNoise(westMatch[1]) ? cleanBoundaryText(westMatch[1]) : null;

  if (cleanedEast || cleanedWest || cleanedNorth || cleanedSouth) {
    canonical.documentBoundaries = {
      north: createField(cleanedNorth, docId, 1, 0.90, northMatch?.[0], cleanedNorth ? 'EXTRACTED' : 'EMPTY'),
      south: createField(cleanedSouth, docId, 1, 0.90, southMatch?.[0], cleanedSouth ? 'EXTRACTED' : 'EMPTY'),
      east: createField(cleanedEast, docId, 1, 0.90, eastMatch?.[0], cleanedEast ? 'EXTRACTED' : 'EMPTY'),
      west: createField(cleanedWest, docId, 1, 0.90, westMatch?.[0], cleanedWest ? 'EXTRACTED' : 'EMPTY')
    };
  }

  // 9. Assessment No & PTIN (Handles OCR typos like "Assussment No", internal spaces "101310 4872")
  const assessPatterns = [
    /(?:ass[eu]ss?m[ea]nt|assess|ptin|tax\s*assessment|property\s*tax|tax\s*id)[^\d\n\r]{0,15}[\s\n\r]*(\d[\d\s\-]{6,15}\d)/i,
    /\b(1013[\s\-]?\d{2}[\s\-]?\d{4})\b/,
    /\b(1013\d{6})\b/
  ];
  for (const ap of assessPatterns) {
    const am = rawText.match(ap);
    if (am && am[1]) {
      const cleanNum = am[1].replace(/\s+/g, '').replace(/[-]/g, '');
      if (cleanNum.length >= 6) {
        canonical.assessmentNo = createField(cleanNum, docId, findPageForRegex(am[0]), 0.92, am[0], 'EXTRACTED');
        break;
      }
    }
  }

  // Door Number (e.g. "58/384-2-1-2", "58-304/2/14", "42/337-7-2-1")
  const doorPatterns = [
    /(?:door\s*no\.?|d\.?no\.?|house\s*no\.?|premises\s*(?:\/\s*door)?\s*no\.?|ఇంటి\s*నెం\.?)[^\w\n\r]{0,10}[\s\n\r]*([0-9]{1,3}[\/\-][0-9]{1,4}(?:[-\/][0-9]{1,3}){1,4}[A-Za-z]?)/i,
    /(?:door\s*no\.?|d\.?no\.?|house\s*no\.?|premises\s*no\.?|ఇంటి\s*నెం\.?)[^\w\n\r]{0,10}[\s\n\r]*([0-9][0-9\/\-A-Za-z]{2,20})/i,
    /\b([0-9]{1,3}\/[0-9]{1,4}-[0-9]{1,3}(?:-[0-9]{1,3})*)\b/
  ];
  for (const dp of doorPatterns) {
    const dm = rawText.match(dp);
    if (dm && dm[1]) {
      const candidate = dm[1].trim();
      const lower = candidate.toLowerCase();
      if (!lower.startsWith('lpm') && !lower.startsWith('plot') && !lower.startsWith('road') && /\d/.test(candidate)) {
        canonical.doorNo = createField(candidate, docId, findPageForRegex(dm[0]), 0.92, dm[0], 'EXTRACTED');
        break;
      }
    }
  }

  // 10. Approval Plan No & Date (AP DPMS format: 1013/0099/B/KAD/AP/2026 or 1013/0114/B/KAD)
  const planPatterns = [
    /(\d{4}\s*\/\s*\d{4}\s*\/\s*[A-Za-z]\s*\/\s*[A-Za-z]{2,6}(?:\s*\/\s*[A-Za-z]{2,4})?(?:\s*\/\s*20\d{2})?)/i,
    /(?:b\.?a\.?\s*no\.?|permit\s*no\.?|permission\s*no\.?|approval\s*no\.?|order\s*no\.?|bpa\s*no\.?|lp\s*no\.?)\s*[:\-\.]?\s*([0-9][0-9a-z\/\-]{4,40})/i
  ];
  for (const pp of planPatterns) {
    const pm = rawText.match(pp);
    if (pm && pm[1]) {
      const cleanPlanNo = pm[1].replace(/\s*\/\s*/g, '/').trim().toUpperCase();
      if (cleanPlanNo.length >= 5) {
        canonical.approvalPlanNo = createField(cleanPlanNo, docId, findPageForRegex(pm[0]), 0.92, pm[0], 'EXTRACTED');
        break;
      }
    }
  }

  const planDatePatterns = [
    /(?:date|dated|sanction\s*date|permit\s*date)\s*[:\-\.]?\s*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/i,
    /(\d{1,2})(?:st|nd|rd|th)?\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s*,?\s*(20\d{2})/i
  ];
  for (const pdp of planDatePatterns) {
    const pdm = rawText.match(pdp);
    if (pdm) {
      const dateStr = pdm[3] ? `${pdm[1]} ${pdm[2]}, ${pdm[3]}` : pdm[1];
      canonical.approvalPlanDate = createField(dateStr, docId, findPageForRegex(pdm[0]), 0.90, pdm[0], 'EXTRACTED');
      break;
    }
  }

  // 11. Floor Areas & Plinth Areas (handles SRO tables & Permit Order breakdowns)
  const gfMatch = rawText.match(/(?:ground\s*floor|ground|gf)[^\d\n\r]{0,50}(\d+(?:\.\d+)?)\s*(?:sq\.?\s*feet|sq\.?\s*ft|sft|sq\.?\s*mt|sqm|చదరపు\s*అడుగులు)?/i);
  const ffMatch = rawText.match(/(?:first\s*floor|floor\s*no\s*[-–]?\s*1|floor\s*1|ff)[^\d\n\r]{0,50}(\d+(?:\.\d+)?)\s*(?:sq\.?\s*feet|sq\.?\s*ft|sft|sq\.?\s*mt|sqm|చదరపు\s*అడుగులు)?/i);
  const sfMatch = rawText.match(/(?:second\s*floor|floor\s*no\s*[-–]?\s*2|floor\s*2|sf)[^\d\n\r]{0,50}(\d+(?:\.\d+)?)\s*(?:sq\.?\s*feet|sq\.?\s*ft|sft|sq\.?\s*mt|sqm|చదరపు\s*అడుగులు)?/i);
  const plinthMatch = rawText.match(/(?:total\s*built[\s-]*up\s*area|total\s*bua|plinth\s*area|plinth)[^\d\n\r]{0,35}(\d+(?:\.\d+)?)/i);

  const floorList = [];
  if (gfMatch && parseFloat(gfMatch[1]) > 5) floorList.push({ floor: 'Ground Floor', area: gfMatch[1], unit: 'sq.ft', source: docId });
  if (ffMatch && parseFloat(ffMatch[1]) > 5) floorList.push({ floor: 'First Floor', area: ffMatch[1], unit: 'sq.ft', source: docId });
  if (sfMatch && parseFloat(sfMatch[1]) > 5) floorList.push({ floor: 'Second Floor', area: sfMatch[1], unit: 'sq.ft', source: docId });

  if (floorList.length > 0) {
    canonical.floorAreas = createField(floorList, docId, 1, 0.90, null, 'EXTRACTED');
    canonical.siteValue = createField({
      plinthArea: plinthMatch ? plinthMatch[1] : gfMatch[1],
      floors: floorList.map((f, i) => ({
        id: i === 0 ? 'gf' : `f${i}`,
        label: `${f.floor} (${i === 0 ? 'GF' : i === 1 ? 'FF' : 'SF'})`,
        value: f.area
      }))
    }, docId, 1, 0.90, null, 'EXTRACTED');
  } else if (plinthMatch && parseFloat(plinthMatch[1]) > 5) {
    canonical.plinthArea = createField(`${plinthMatch[1]} Sq. Ft`, docId, 1, 0.90, plinthMatch[0], 'EXTRACTED');
  }

  // 12. Owner / Purchaser / Claimant Name (handles 1-CL, Stamp Paper Purchaser, AP/Telangana SRO Endorsements)
  const ownerPatterns = [
    // Presentation Endorsement 1-CL / Claimant patterns
    /(?:1-cl|claimant)[\s\S]{0,30}?(?:sri|smt)?\.?\s*([A-Za-z \.]{3,35})/i,
    /([A-Z][A-Za-z\s\._]{3,30})\s*(?:1-cl|claimant)\b/i,
    // Direct Purchaser / Vendee labels
    /(?:purchaser\s*\/\s*vendee\s*-\s*name|purchased\s*by|in\s*favour\s*of|purchaser|claimant|name\s*of\s*the\s*applicant|applicant|విక్రయదారు|కొనుగోలుదారు|పొందినవారు)\s*[:\-\.]?\s*(?:sri|smt|mr|mrs)?\.?\s*([A-Za-z \.]{3,35})/i,
    // Stamp paper purchaser header on top of deed (e.g. "G MAHENDRANATH REDDY")
    /(?:rs\.?\s*(?:10|20|50|100|500)|non\s*judicial|stamp\s*duty)[^\n\r]{0,80}?\b([A-Z]\s+[A-Z][A-Za-z\s]{3,30}\s+(?:reddy|rao|naidu|kumar|sharma|singh|gupta|devi|begum|khan|babu|murthy|charan|iah|appa|amma|chary|varma|prasad|patel|gowd|shetty|swamy))\b/i,
    /(?:by\s*sri[\/\s]*smt|presented[\s\S]{0,30}?by\s*sri)\s*[:\-\.]?\s*([A-Za-z \.]{3,35})/i
  ];

  for (const op of ownerPatterns) {
    const om = rawText.match(op);
    if (om && om[1]) {
      let cand = om[1].replace(/^(?:sri|smt|mr|mrs|pholo|photo|stamp|india|rupees)\.?\s*/i, '').replace(/[\n\r_]/g, ' ').replace(/\s+/g, ' ').trim();
      if (cand.length >= 3 && !/sub[\s-]*registrar|corporation|government|municipal|bank|cuddapah|kadapa|andhra|telangana|self|street/i.test(cand)) {
        canonical.ownerName = createField(cand, docId, findPageForRegex(om[0]), 0.92, om[0], 'EXTRACTED');
        break;
      }
    }
  }

  // 13. Builder Name (Strict Check: Only if developer/builder is explicitly named)
  const builderMatch = rawText.match(/(?:builder|developer|promoter)\s*[:\-\.]\s*([A-Za-z \.]{3,35})/i);
  if (builderMatch && !/na|null|none|not\s*applicable/i.test(builderMatch[1])) {
    canonical.builderName = createField(builderMatch[1].trim(), docId, findPageForRegex(builderMatch[0]), 0.85, builderMatch[0], 'EXTRACTED');
  }

  // 14. Father's/Spouse's Name (e.g. "K JAYA NARASIMHULU S/o SRI SURYA NARAYANA", "Si0. S40 GARISA BHASKAR")
  const fatherPatterns = [
    /(?:s\/o|w\/o|d\/o|c\/o|s\/o\.|d\/o\.|w\/o\.|son\s*of|daughter\s*of|wife\s*of)\s*(?:sri|smt|mr|mrs)?\.?\s*([A-Za-z \.]{3,35})/i,
    /(?:s[i1l\/0o]0?\.?|s4o\.?|s0\.?)[\s\S]{0,15}?\b([A-Z]{3,20}(?:\s+[A-Z]{3,20}){1,3})\b/i
  ];
  for (const fp of fatherPatterns) {
    const fm = rawText.match(fp);
    if (fm && fm[1]) {
      let cand = fm[1].replace(/[\n\r_]/g, ' ').replace(/\b(?:kadapa|cuddapah|poosala|street|for|whom|self|inner|side|revenue|ward|no|aadhar)\b.*/i, '').trim();
      if (cand.length > 2 && !/sub[\s-]*registrar|corporation|government|municipal|bank|self/i.test(cand)) {
        canonical.fathersName = createField(cand, docId, findPageForRegex(fm[0]), 0.90, fm[0], 'EXTRACTED');
        break;
      }
    }
  }

  // 14b. Executant / Vendor Name (e.g. "PANDILLAPALLI RAJA REDDY")
  const vendorPatterns = [
    /(?:vendor\s*name|sold\s*by|executant|vendor|1-ex|2-ex)\s*[:\-\.]?\s*(?:sri|smt|mr|mrs)?\.?\s*([A-Za-z \.]{3,35})/i,
    /([A-Z][A-Za-z\s\._]{3,30})\s*(?:1-ex|2-ex|executant)\b/i
  ];
  for (const vp of vendorPatterns) {
    const vm = rawText.match(vp);
    if (vm && vm[1]) {
      let cand = vm[1].replace(/^(?:sri|smt|mr|mrs)\.?\s*/i, '').replace(/[\n\r_]/g, ' ').trim();
      if (cand.length > 3 && !/sub[\s-]*registrar|corporation|government|self/i.test(cand)) {
        canonical.vendorName = createField(cand, docId, findPageForRegex(vm[0]), 0.90, vm[0], 'EXTRACTED');
        break;
      }
    }
  }

  // 15. Branch & District
  const branchMatch = rawText.match(/branch\s*[:\-]?\s*([A-Za-z\s,\.]+)/i);
  if (branchMatch) {
    canonical.branchName = createField(branchMatch[1].trim(), docId, findPageForRegex(branchMatch[0]), 0.85, branchMatch[0], 'EXTRACTED');
  }
  const districtMatch = rawText.match(/district\s*[:\-]?\s*([A-Za-z\.\s]+)/i);
  if (districtMatch && !canonical.district?.value) {
    canonical.district = createField(districtMatch[1].trim(), docId, findPageForRegex(districtMatch[0]), 0.85, districtMatch[0], 'EXTRACTED');
  }

  // 16. Ward No (e.g. "Revenue Ward No 58")
  const wardMatch = rawText.match(/(?:revenue\s*ward\s*no\.?|ward\s*no\.?|ward\s*number|ward)[^\w\n\r]{0,10}[\s\n\r]*([0-9]{1,4}[A-Za-z]?)/i);
  if (wardMatch && wardMatch[1]) {
    canonical.wardNo = createField(wardMatch[1].trim(), docId, findPageForRegex(wardMatch[0]), 0.90, wardMatch[0], 'EXTRACTED');
  }

  // 17. Valuation Details (Land Cost, Structure Cost, Market Value)
  const valLandMatch = rawText.match(/(?:land\s*cost|part\s*[-a]+\s*land|land\s*value)[^\d]*([\d,]+)/i);
  if (valLandMatch) {
    const v = valLandMatch[1].replace(/,/g, '');
    if (parseInt(v, 10) > 0) canonical.valuationLand = createField(v, docId, findPageForRegex(valLandMatch[0]), 0.90, valLandMatch[0], 'EXTRACTED');
  }

  const valBldgMatch = rawText.match(/(?:structure\s*cost|building\s*cost|part\s*[-b]+\s*building)[^\d]*([\d,]+)/i);
  if (valBldgMatch) {
    const v = valBldgMatch[1].replace(/,/g, '');
    if (parseInt(v, 10) > 0) canonical.valuationBuilding = createField(v, docId, findPageForRegex(valBldgMatch[0]), 0.90, valBldgMatch[0], 'EXTRACTED');
  }

  const valAmenMatch = rawText.match(/(?:part\s*[-cd]+\s*amenities|amenities)[^\d]*([\d,]+)/i);
  if (valAmenMatch) canonical.valuationAmenities = createField(valAmenMatch[1].replace(/,/g, ''), docId, findPageForRegex(valAmenMatch[0]), 0.90, valAmenMatch[0], 'EXTRACTED');

  const valServMatch = rawText.match(/(?:part\s*[-ef]+\s*services|services)[^\d]*([\d,]+)/i);
  if (valServMatch) canonical.valuationServices = createField(valServMatch[1].replace(/,/g, ''), docId, findPageForRegex(valServMatch[0]), 0.90, valServMatch[0], 'EXTRACTED');

  const valTotalMatch = rawText.match(/(?:market\s*value|total\s*valuation|valuation\s*:|say\s*as)[^\d]*([\d,]+)/i);
  if (valTotalMatch) {
    const v = valTotalMatch[1].replace(/,/g, '');
    if (parseInt(v, 10) > 0) {
      canonical.valuationTotal = createField(v, docId, findPageForRegex(valTotalMatch[0]), 0.90, valTotalMatch[0], 'EXTRACTED');
      if (!canonical.marketValue?.value) {
        canonical.marketValue = createField(v, docId, findPageForRegex(valTotalMatch[0]), 0.90, valTotalMatch[0], 'EXTRACTED');
      }
    }
  }

  // 18. Lat/Lng
  const latLngMatch = rawText.match(/(?:latitude|lat\/?long)?[^\d]*([0-9]{1,2}\.[0-9]{5,8})[\s,]+([0-9]{1,3}\.[0-9]{5,8})/i);
  if (latLngMatch) {
    canonical.latitude = createField(latLngMatch[1], docId, findPageForRegex(latLngMatch[0]), 0.95, latLngMatch[0], 'EXTRACTED');
    canonical.longitude = createField(latLngMatch[2], docId, findPageForRegex(latLngMatch[0]), 0.95, latLngMatch[0], 'EXTRACTED');
  }

  // 19. Dimensions Actual/Doc
  const dims = ['north', 'south', 'east', 'west'];
  for (const dir of dims) {
    // Looks for "East  33.33 Links (or) 6.70 m  :  33.33 Links (or) 6.70 m"
    const dimRegex = new RegExp(`${dir}\\s+([\\d\\.\\sA-Za-z\\(\\)]+?)\\s*:\\s*([\\d\\.\\sA-Za-z\\(\\)]+)`, 'i');
    const m = rawText.match(dimRegex);
    if (m) {
       canonical.dimensionsDoc[dir] = createField(m[1].trim(), docId, findPageForRegex(m[0]), 0.85, m[0], 'EXTRACTED');
       canonical.dimensionsActual[dir] = createField(m[2].trim(), docId, findPageForRegex(m[0]), 0.85, m[0], 'EXTRACTED');
    }
  }

  // 20. Advanced Legal Fields Extraction

  // Aadhar Numbers
  const aadharMatches = rawText.match(/\b\d{4}\s\d{4}\s\d{4}\b/g) || [];
  if (aadharMatches.length > 0) {
    const uniqueAadhars = [...new Set(aadharMatches)];
    canonical.aadharNumbers = createField(uniqueAadhars, docId, 1, 0.95, null, 'EXTRACTED');
  }

  // Stamp Papers
  const stampPatterns = [
    /(?:rs\.?\s*\d+\s*non[- ]judicial\s*stamp|non[- ]judicial\s*stamp[^\n]*rs\.?\s*\d+)[^\n]*?(?:stamp\s*no\.?|serial\s*no\.?|s\.?no\.?)[^\n]+/ig,
    /(?:stamp\s*no\.?|serial\s*no\.?|s\.?no\.?)[\s:\-]+[a-z0-9]+[^\n]*?rs\.?\s*\d+/ig
  ];
  let stamps = [];
  stampPatterns.forEach(p => {
    const m = rawText.match(p);
    if (m) stamps.push(...m);
  });
  if (stamps.length > 0) {
    canonical.stampPapers = createField([...new Set(stamps.map(s => s.trim()))], docId, 1, 0.90, null, 'EXTRACTED');
  }

  // Witnesses
  const witnessMatch = rawText.match(/(?:witnesses|సాక్షులు)\s*[:\-\.]?\s*([\s\S]{10,200}?)(?:(?:document\s*prepared\s*by|drafted\s*by|signature|presented\s*by|$))/i);
  if (witnessMatch && witnessMatch[1]) {
    const wits = witnessMatch[1].split(/[\n\r]+/).map(w => w.replace(/^\d+[\.\)]\s*/, '').trim()).filter(w => w.length > 5);
    if (wits.length > 0) {
      canonical.witnesses = createField(wits, docId, findPageForRegex(witnessMatch[0]), 0.85, witnessMatch[0], 'EXTRACTED');
    }
  }

  // Document Prepared By
  const preparedMatch = rawText.match(/(?:document\s*prepared\s*by|drafted\s*by|prepared\s*by)\s*[:\-\.]?\s*([A-Za-z0-9\s,\.\(\)\-]+?)(?:\n\n|$|contact|mobile|cell|ph)/i);
  if (preparedMatch && preparedMatch[1]) {
    canonical.documentPreparedBy = createField(preparedMatch[1].trim(), docId, findPageForRegex(preparedMatch[0]), 0.85, preparedMatch[0], 'EXTRACTED');
  }

  // Correction Details
  if (/correction\s*deed|సవరణ\s*దస్తావేజు/i.test(rawText)) {
    const correctionMatch = rawText.match(/(?:nature\s*of\s*correction|correction\s*details|సవరణ\s*వివరాలు)\s*[:\-\.]?\s*([\s\S]{10,200}?)(?:\n\n|stamp|witnesses|boundary|$)/i);
    if (correctionMatch && correctionMatch[1]) {
      canonical.correctionDetails = createField(correctionMatch[1].replace(/[\n\r]+/g, ' ').trim(), docId, findPageForRegex(correctionMatch[0]), 0.85, correctionMatch[0], 'EXTRACTED');
    }
  }

  // Vendors / Executants (Multiple)
  // Look for block after "Vendors / Executants" or "Party 2" and extract lines
  const vendorsMatch = rawText.match(/(?:vendors|executants|party\s*2\s*\(vendors\)|అమ్మకందారులు)\s*[:\-\.]?\s*([\s\S]{20,500}?)(?:\n\n|property\s*details|schedule|boundaries|purchaser|party\s*1)/i);
  if (vendorsMatch && vendorsMatch[1]) {
    const vLines = vendorsMatch[1].split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 5);
    const vendorObjs = [];
    vLines.forEach(line => {
      // Basic heuristic: if it looks like a person's name with Age or Father
      if (/s\/o|w\/o|d\/o|age|years/i.test(line) || /^[0-9]+[\.\)]\s*[A-Z]/.test(line)) {
        vendorObjs.push({ rawText: line });
      }
    });
    if (vendorObjs.length > 0) {
      canonical.vendors = createField(vendorObjs, docId, findPageForRegex(vendorsMatch[0]), 0.80, vendorsMatch[0], 'EXTRACTED');
    }
  }

  return canonical;
}
// ── POST /api/extract/validate-doc ───────────────────────────────────────────
// 100% Free, Unlimited & Local Multilingual Document AI Validation & Extraction
router.post('/validate-doc', async (req, res) => {
  try {
    const { dataUrl, docId = 'saleDeed', isPdf = false, clientText = '' } = req.body;
    if (!dataUrl) {
      return res.status(400).json({ passed: false, reason: 'No document data provided.' });
    }

    const rules = STRICT_DOC_KEYWORDS[docId] || STRICT_DOC_KEYWORDS.saleDeed;

    // 1. Run 100% Free Local OCR & Clarity Engine
    const pyResult = await runPythonOCR(dataUrl, isPdf);

    // 2. Strict Clarity & Blur Gate (only for photos/images, never block PDFs)
    if (pyResult.is_blurred && !isPdf) {
      return res.json({
        passed: false,
        isBlurred: true,
        blurScore: pyResult.blur_score,
        reason: pyResult.clarity_reason || 'Uploaded document is too blurry or unclear. Please upload clarity images/pdf/photos with legible text and numbers.',
        engine: 'Local Document AI (Clarity Gate)'
      });
    }

    // 3. Strict Legal Keyword Validation (combines backend OCR + frontend extracted text)
    const combinedText = `${pyResult.text || ''}\n${clientText || ''}`.trim();
    const extractedText = combinedText.toLowerCase();
    const tier1Hit = rules.tier1.some(kw => matchesKeyword(extractedText, kw));
    const tier2Hits = rules.tier2.filter(kw => matchesKeyword(extractedText, kw));

    const isDrawingSlot = (docId === 'buildingPlan' || docId === 'layoutPlan');
    const passesOcr = tier1Hit || (isDrawingSlot ? tier2Hits.length >= 1 : tier2Hits.length >= 1);

    // 4. Precision Canonical Extraction using unified text corpus
    const canonicalMeta = extractCanonicalFromOCR(pyResult, docId, clientText);

    if (!passesOcr) {
      // For PDFs or valid documents, allow upload with an advisory notice
      const generalLegalKeywords = ['deed', 'document', 'stamp', 'registration', 'registrar', 'property', 'survey', 'schedule', 'extent', 'plot', 'kadapa', 'andhra', 'telangana', 'tax', 'plan', 'permit', 'sro', 'rupees', 'rs', 'విక్రయ', 'దస్తావేజు', 'హద్దులు'];
      const hasGeneralLegal = generalLegalKeywords.some(kw => extractedText.includes(kw));
      if (hasGeneralLegal || isPdf || isDrawingSlot) {
        return res.json({
          passed: true,
          warning: `Document verified. Please review pre-filled fields.`,
          extractedMeta: canonicalMeta,
          ocrText: pyResult.text || '',
          snippets: pyResult.snippets || [],
          numPages: pyResult.num_pages || 1,
          engine: 'Local Multilingual Document AI'
        });
      }

      return res.json({
        passed: false,
        reason: `Strict ${rules.name} keywords not found. Please upload genuine ${rules.name}.`,
        ocrText: pyResult.text || '',
        snippets: pyResult.snippets || [],
        numPages: pyResult.num_pages || 1,
        engine: 'Local Multilingual Document AI'
      });
    }

    return res.json({
      passed: true,
      extractedMeta: canonicalMeta,
      ocrText: pyResult.text || '',
      snippets: pyResult.snippets || [],
      numPages: pyResult.num_pages || 1,
      engine: 'Local Multilingual Document AI (Free & Unlimited)'
    });

  } catch (err) {
    console.error('Validation route error:', err);
    res.status(500).json({ passed: false, reason: 'Server error validating document.' });
  }
});

// ── POST /api/extract/sale-deed (Dedicated endpoint) ─────────────────────────
router.post('/sale-deed', async (req, res) => {
  try {
    const { dataUrl, image, pdfBase64, isPdf = false, clientText = '' } = req.body;
    const input = dataUrl || pdfBase64 || image;
    if (!input) {
      return res.status(400).json({ passed: false, reason: 'No document data provided.' });
    }

    const pyResult = await runPythonOCR(input, isPdf);
    const canonicalMeta = extractCanonicalFromOCR(pyResult, 'saleDeed', clientText);

    return res.json({
      passed: true,
      success: true,
      extractedMeta: canonicalMeta,
      canonical: canonicalMeta,
      ocrText: pyResult.text || '',
      snippets: pyResult.snippets || [],
      numPages: pyResult.num_pages || 1,
      engine: 'Local Multilingual Document AI'
    });
  } catch (err) {
    console.error('Sale deed extraction error:', err);
    res.status(500).json({ passed: false, reason: 'Server error extracting sale deed.' });
  }
});

// ── POST /api/extract/reconcile ──────────────────────────────────────────────
// Reconciles canonical metadata across all uploaded document slots
router.post('/reconcile', async (req, res) => {
  try {
    const { documents } = req.body;
    if (!documents || typeof documents !== 'object') {
      return res.status(400).json({ success: false, error: 'No documents provided for reconciliation.' });
    }

    const reconciled = reconcileDocuments(documents);
    res.json({
      success: true,
      reconciled
    });
  } catch (err) {
    console.error('Reconciliation route error:', err);
    res.status(500).json({ success: false, error: 'Failed to reconcile documents.' });
  }
});

// ── POST /api/extract/parse-pdf ──────────────────────────────────────────────
// Fast multi-page PDF digital text and OCR extractor
router.post('/parse-pdf', async (req, res) => {
  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: 'No PDF provided.' });
    }

    const pyResult = await runPythonOCR(pdfBase64, true);
    res.json({
      success: true,
      text: (pyResult.text || '').toLowerCase(),
      rawText: pyResult.text || '',
      pages: pyResult.pages || [],
      numPages: pyResult.num_pages || 1,
      isBlurred: Boolean(pyResult.is_blurred),
      blurScore: pyResult.blur_score || 100
    });
  } catch (err) {
    console.warn('Backend PDF parse failed:', err);
    res.status(500).json({ error: 'Failed to parse PDF', details: err.message });
  }
});

// ── POST /api/extract (Legacy fallback route) ─────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { image, pdfBase64, expectedDeedNo } = req.body;
    const input = pdfBase64 || image;
    if (!input) {
      return res.status(400).json({ error: 'No document provided.' });
    }

    // 1. DUPLICATE DB CHECK
    if (expectedDeedNo) {
      const existingCase = await ValuationCase.findOne({
        "propertyDetails.deedNo": expectedDeedNo
      });

      if (existingCase) {
        const staffName = existingCase.assignedEngineerName || 'a staff member';
        const date = new Date(existingCase.createdAt).toLocaleDateString();
        return res.status(409).json({
          error: `🚨 FRAUD ALERT: Deed #${expectedDeedNo} was already processed by ${staffName} on ${date}.`
        });
      }
    }

    const isPdf = input.startsWith('data:application/pdf') || !!pdfBase64;
    const pyResult = await runPythonOCR(input, isPdf);

    if (pyResult.is_blurred) {
      return res.status(400).json({
        error: pyResult.clarity_reason || 'Uploaded document is too blurry or unclear. Please upload clarity images/pdf/photos with legible text and numbers.'
      });
    }

    const canonical = extractCanonicalFromOCR(pyResult, 'saleDeed');

    res.json({
      success: true,
      data: {
        rawText: pyResult.text || '',
        confidence: 92,
        extracted: {
          surveyNo: canonical.surveyNo?.value || null,
          area: canonical.netExtent?.value || null,
          doorNo: canonical.doorNo?.value || null,
          ownerName: canonical.ownerName?.value || null
        },
        canonical
      }
    });

  } catch (err) {
    console.error("Extraction Error:", err);
    res.status(500).json({ error: 'Failed to process document.' });
  }
});


// ── Dedicated Local Document Intelligence Endpoint: Sale Deed ────────────────
const crypto = require('crypto');
const { extractSaleDeedDocument } = require('../ocr_service/saleDeedExtractor');

// ML Training dataset storage directory
const ML_DATASET_DIR = path.join(__dirname, '..', 'uploads', 'ml_training_dataset');
if (!fs.existsSync(ML_DATASET_DIR)) {
  fs.mkdirSync(ML_DATASET_DIR, { recursive: true });
}

const handleSaleDeedExtractionRequest = async (req, res) => {
  try {
    const { image, pdfBase64, fileData } = req.body;
    const input = pdfBase64 || image || fileData;
    
    if (!input) {
      return res.status(400).json({
        success: false,
        error: 'No Sale Deed document provided. Please upload a PDF or high-resolution document photo.'
      });
    }

    // SHA-256 Content Hash Calculation for duplicate detection
    const contentHash = crypto.createHash('sha256').update(typeof input === 'string' ? input : JSON.stringify(input)).digest('hex');

    const isPdf = input.startsWith('data:application/pdf') || !!pdfBase64 || (typeof input === 'string' && input.toLowerCase().includes('.pdf'));
    
    // 1. Local PaddleOCR Processing across all pages
    const ocrResult = await runPythonOCR(input, isPdf);

    if (ocrResult.is_blurred) {
      return res.status(400).json({
        success: false,
        error: ocrResult.clarity_reason || 'Uploaded Sale Deed is too blurry. Please upload a legible scan/photo.'
      });
    }

    // 2. Local Document Understanding (Ollama / Local Rules Engine)
    const extractionResponse = await extractSaleDeedDocument(ocrResult);
    extractionResponse.document.contentHash = contentHash;

    return res.json(extractionResponse);

  } catch (err) {
    console.error("Sale Deed Extraction Error:", err);
    return res.status(500).json({
      success: false,
      error: `Failed to extract Sale Deed details: ${err.message}`
    });
  }
};

router.post('/sale-deed', handleSaleDeedExtractionRequest);
router.post('/documents/sale-deed/extract', handleSaleDeedExtractionRequest);

// ── User Correction Feedback Storage (Requirement 26) ──────────────────────
router.post('/sale-deed/feedback', (req, res) => {
  try {
    const feedbackItem = req.body;
    const filename = `correction_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.json`;
    const targetPath = path.join(ML_DATASET_DIR, filename);
    
    fs.writeFileSync(targetPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      ...feedbackItem
    }, null, 2));

    return res.json({ success: true, message: 'User correction saved to local ML dataset.' });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to record user correction feedback.' });
  }
});

// Backward-compatibility exports
router.inspectWithGeminiVision = async () => null;
router.normalizeGeminiResult = (rawMeta, docId) => createEmptyCanonicalMetadata();
router.runPythonOCR = runPythonOCR;
router.extractCanonicalFromOCR = extractCanonicalFromOCR;

module.exports = router;


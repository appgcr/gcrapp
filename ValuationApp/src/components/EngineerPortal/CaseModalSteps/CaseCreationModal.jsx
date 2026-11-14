import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, X, Loader2, ShieldAlert, FileText } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

if (typeof window !== 'undefined' && pdfjs && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}
import { useBanks, matchBank } from '../../../utils/banks';
import ReportViewer, { fetchReport } from '../../Shared/ReportViewer';
import localforage from 'localforage';
import toast from 'react-hot-toast';
import { isWordFile, fileMime, uploadDocumentFile, formatMB, resolveDocUrl } from '../../../utils/docFiles';
import { API_BASE_URL } from '../../../config/api';
import { queueOfflineCase } from '../../../services/offlineSyncService';
import { reconcileDocuments } from '../../../utils/reconciliation';
import { isStrictlyEmpty } from '../../../utils/canonicalSchema';

import Step1CaseSetup from './Step1CaseSetup';
import Step2LegalDocs from './Step2LegalDocs';
import Step3PropertyDetails from './Step3PropertyDetails';
import Step4SiteImages from './Step4SiteImages';
import Step5ExtractedDataReview from './Step5ExtractedDataReview';
import Step6FinalReviewSignature from './Step6FinalReviewSignature';
import { getPageDisplayInfo, formatFileSize, isBuiltProperty } from './caseModalHelpers';
import { MAX_SITE_PHOTOS, currentPosition, addressFor, drawStamp, fileHash, readExifGps, imageToCanvas } from '../../../utils/sitePhotos';

import {
  FALLBACK_PROPERTY_TYPES,
  FALLBACK_PLOT_TYPES,
  FALLBACK_ROAD_TYPES,
  FALLBACK_STRUCTURE_TYPES,
  FALLBACK_FLOORING_TYPES,
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
  mapSaleDeedToPropertyDetails,
  sanitizePropertyDetails
} from '../caseValidationHelpers';

export default function CaseCreationModal({
  isOpen,
  onClose,
  currentUser,
  editingCaseId: propEditingCaseId,
  onCaseSaved
}) {

  // Modal State
  const [modalStep, setModalStep] = useState(1); 
  const [clientName, setClientName] = useState('');
  const [clientFatherName, setClientFatherName] = useState('');
  // Client name and bank set by the admin on an assigned case: shown, not editable
  const [lockedFields, setLockedFields] = useState({ clientName: false, bankName: false, bankBranch: false });
  
  // Bank & District State (Dynamic)
  // One bank list for the whole app (Super Admin → Settings → Banks)
  const bankRecords = useBanks();
  const availableBanks = bankRecords.map(b => b.name);
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
  const [editingCaseId, setEditingCaseId] = useState(propEditingCaseId || null);
  // Each case keeps its own saved draft (per engineer), so one case's half-filled form
  // never appears inside another case.
  const draftKey = `caseDraft:${currentUser?.id || 'me'}:${editingCaseId || 'new'}`;
  // Don't auto-save until an assigned case has finished loading — otherwise an empty
  // form would be saved and later "restored" over the real case details.
  const [draftReady, setDraftReady] = useState(!propEditingCaseId);
  const usableDraft = (d) => d && d.modalStep > 0 && String(d.clientName || '').trim();

  useEffect(() => {
    setEditingCaseId(propEditingCaseId || null);
  }, [propEditingCaseId]);

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
        if (editingCaseId) return; // assigned cases restore their draft after loading from the server
        const draft = await localforage.getItem(draftKey);
        if (!usableDraft(draft)) return;

        // Restore all state directly
        setClientName(draft.clientName || '');
        setClientFatherName(draft.clientFatherName || '');
        setBankName(draft.bankName || '');
        setBankBranch(draft.bankBranch || '');
        setBankDistrict(draft.bankDistrict || '');
        setPropertyDetails(sanitizePropertyDetails({
          boundariesDoc: { north: '', south: '', east: '', west: '' },
          boundariesActual: { north: '', south: '', east: '', west: '' },
          buildingAge: '', flooringType: '', structureType: '', roadWidth: '',
          propertyType: '', roadType: '', plotType: '',
          deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '',
          assessmentNo: '', doorNo: '', approvalPlanNo: '', approvalPlanDate: '', builderName: '', managingPartner: '',
          flatNo: '', floorNo: '', additionsWork: [],
          siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] },
          ...(draft.propertyDetails || {})
        }));
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
      // On duty = the latest Check-In / Check-Out (location on/off events and updates don't change it)
      const todayLogs = Array.isArray(data) ? data.filter(log => log.attendanceType === 'Clock-In' || log.attendanceType === 'Clock-Out') : [];
      const sortedLogs = [...todayLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const lastLog = sortedLogs.length > 0 ? sortedLogs[0] : null;
      const lastAction = lastLog ? lastLog.attendanceType : null;
      
      if (lastAction !== 'Clock-In') {
        toast.error('Please Check In on the Today tab first.', { duration: 4000 });
        return;
      }
    } catch (err) {
      console.error('Failed to verify attendance status', err);
      toast.error('Failed to verify attendance status. Please try again.');
      return;
    }

    try {
      const draft = await localforage.getItem(draftKey);
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
    setPropertyDetails(sanitizePropertyDetails({
      boundariesDoc: { north: '', south: '', east: '', west: '' },
      boundariesActual: { north: '', south: '', east: '', west: '' },
      buildingAge: '', flooringType: '', structureType: '', roadWidth: '',
      propertyType: '', roadType: '', plotType: '',
      deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '',
      assessmentNo: '', doorNo: '', approvalPlanNo: '', approvalPlanDate: '', builderName: '', managingPartner: '',
      flatNo: '', floorNo: '', additionsWork: [],
      siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] },
      vendors: [], aadharNumbers: [], stampPapers: [], witnesses: [], documentPreparedBy: '', correctionDetails: '',
      ...(draft.propertyDetails || {})
    }));
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
    await localforage.removeItem(draftKey);
    setShowDraftPrompt(null);
    
    // Reset state
    setClientName(''); setLockedFields({ clientName: false, bankName: false, bankBranch: false });
    setClientFatherName('');
    setBankName('');
    setBankBranch('');
    setBankDistrict('');
    setPropertyDetails({ boundariesDoc: { north: '', south: '', east: '', west: '' }, boundariesActual: { north: '', south: '', east: '', west: '' }, buildingAge: '', flooringType: '', structureType: '', roadWidth: '', propertyType: '', roadType: '', plotType: '', deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '', assessmentNo: '', doorNo: '', approvalPlanNo: '', approvalPlanDate: '', builderName: '', managingPartner: '', flatNo: '', floorNo: '', additionsWork: [], siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] }, vendors: [], aadharNumbers: [], stampPapers: [], witnesses: [], documentPreparedBy: '', correctionDetails: '' });
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
      // On duty = the latest Check-In / Check-Out (location on/off events and updates don't change it)
      const todayLogs = Array.isArray(data) ? data.filter(log => log.attendanceType === 'Clock-In' || log.attendanceType === 'Clock-Out') : [];
      const sortedLogs = [...todayLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const lastLog = sortedLogs.length > 0 ? sortedLogs[0] : null;
      const lastAction = lastLog ? lastLog.attendanceType : null;
      
      if (lastAction !== 'Clock-In') {
        toast.error('Please Check In on the Today tab first.', { duration: 4000 });
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
      setLockedFields({ clientName: !fullCase.selfFiled && !!(fullCase.clientName || fullCase.borrowerName), bankName: !fullCase.selfFiled && !!fullCase.bankName, bankBranch: !fullCase.selfFiled && !!fullCase.bankBranch });
      setClientFatherName(fullCase.clientFatherName || '');
      setBankName(fullCase.bankName || '');
      setBankBranch(fullCase.bankBranch || '');
      setBankDistrict(fullCase.bankDistrict || '');
      setPropertyDetails(sanitizePropertyDetails({
        boundariesDoc: { north: '', south: '', east: '', west: '' },
        boundariesActual: { north: '', south: '', east: '', west: '' },
        buildingAge: '', flooringType: '', structureType: '', roadWidth: '',
        propertyType: '', roadType: '', plotType: '',
        deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '',
        assessmentNo: '', doorNo: '', approvalPlanNo: '', approvalPlanDate: '',
        builderName: '', managingPartner: '', flatNo: '', floorNo: '', additionsWork: [],
        siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] },
        vendors: [], aadharNumbers: [], stampPapers: [], witnesses: [], documentPreparedBy: '', correctionDetails: '',
        ...(fullCase.propertyDetails || {})
      }));
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
    siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] },
    vendors: [], aadharNumbers: [], stampPapers: [], witnesses: [], documentPreparedBy: '', correctionDetails: ''
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
  const [docErrors, setDocErrors] = useState({});
  const [scanProgress, setScanProgress] = useState({});
  const [extractedDocsMeta, setExtractedDocsMeta] = useState({});
  const [manuallyModifiedFields, setManuallyModifiedFields] = useState(() => new Set());
  const [reconciledPropertyMeta, setReconciledPropertyMeta] = useState(null);
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
  const siteImageFileInputRef = useRef(null);

  const renderFieldBadge = (fieldKey) => {
    if (!reconciledPropertyMeta) return null;
    const f = reconciledPropertyMeta[fieldKey];
    if (!f || !f.status || f.status === 'EMPTY') return null;
    const isVerified = f.status === 'VERIFIED';
    const isConflict = f.status === 'CONFLICT';
    const bgColor = isVerified ? '#dcfce7' : isConflict ? '#fef3c7' : '#e0f2fe';
    const textColor = isVerified ? '#166534' : isConflict ? '#92400e' : '#0369a1';
    const label = isVerified ? '✓ Verified' : isConflict ? '⚠ Conflict' : '⚡ Extracted';
    return (
      <span style={{ marginLeft: '8px', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: bgColor, color: textColor, fontWeight: '700' }}>
        {label}
      </span>
    );
  };

  const renderConflictOptions = (fieldKey) => {
    if (!reconciledPropertyMeta) return null;
    const f = reconciledPropertyMeta[fieldKey];
    if (!f || f.status !== 'CONFLICT' || !f.conflicts || f.conflicts.length === 0) return null;
    return (
      <div style={{ marginTop: '6px', fontSize: '12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '6px 10px', color: '#92400e' }}>
        <strong>Multiple values found:</strong>
        {f.conflicts.map((c, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setPropertyDetails(prev => ({ ...prev, [fieldKey]: c.value }));
              setManuallyModifiedFields(prev => new Set(prev).add(fieldKey));
            }}
            style={{ display: 'inline-block', margin: '4px 4px 0 0', padding: '2px 8px', backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#78350f' }}
          >
            Use {c.value} ({c.source})
          </button>
        ))}
      </div>
    );
  };

  // Final Review & Signature State
  const sigCanvas = useRef({});
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  // Final check: the engineer sees the finished bank-format report before submitting it
  const [reviewSignature, setReviewSignature] = useState(null);
  const openReportReview = (sig) => setReviewSignature(sig || '');
  // The engineer's saved digital signature (Settings → Digital Signature)
  const [savedSignature, setSavedSignature] = useState('');
  useEffect(() => {
    if (modalStep !== 7) return;
    fetch(`${API_BASE_URL}/api/auth/me`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : {}))
      .then(d => setSavedSignature(d?.user?.savedSignature || '')).catch(() => {});
  }, [modalStep]);
  // Figures from the bank's own report (APGB…) for the final-step summary
  const [bankValues, setBankValues] = useState(null);
  useEffect(() => {
    if (modalStep !== 7 || !editingCaseId || !bankName) { setBankValues(null); return; }  // 7 = Final Review
    let alive = true;
    fetch(`${API_BASE_URL}/api/cases/${editingCaseId}/report-preview?values=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName, clientFatherName, bankName, bankBranch, bankDistrict, propertyDetails }),
    }).then(r => (r.ok ? r.json() : {})).then(v => { if (alive) setBankValues(v && v.fairMarketValue ? v : null); }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalStep, editingCaseId, bankName]);
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
    if (draftReady && modalStep > 0 && modalStep < 7) {
      const draft = {
        clientName, clientFatherName, bankName, bankBranch, bankDistrict,
        propertyDetails, locationData, modalStep,
        uploadedDocs, // already contains data URLs — no conversion needed
        siteImages
      };
      localforage.setItem(draftKey, draft).catch(err => console.error('Auto-save failed', err));
    }
  }, [draftReady, clientName, clientFatherName, bankName, bankBranch, bankDistrict, propertyDetails, locationData, uploadedDocs, siteImages, modalStep]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      // Cleanup object URLs to avoid memory leaks
      Object.values(uploadedDocs).flat().forEach(page => {
        if (page.url && page.url.startsWith('blob:')) URL.revokeObjectURL(page.url);
      });
    };
  }, []);

  // Fetch dynamic AppConfig from Backend API
  useEffect(() => {
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
        if (Array.isArray(cfg.districts) && cfg.districts.length > 0) {
          setAvailableDistricts(prev => Array.from(new Set([...prev, ...cfg.districts])));
        }
      })
      .catch(err => console.warn("Could not load dynamic config:", err));
  }, []);

  const filteredBanks = availableBanks.filter(b => b.toLowerCase().includes(bankName.toLowerCase()));



  // Load existing case when editingCaseId is passed
  useEffect(() => {
    if (!editingCaseId) return;
    fetch(`${API_BASE_URL}/api/cases/${editingCaseId}`)
      .then(res => res.json())
      .then(fullCase => {
        setClientName(fullCase.clientName || fullCase.borrowerName || '');
        setLockedFields({ clientName: !fullCase.selfFiled && !!(fullCase.clientName || fullCase.borrowerName), bankName: !fullCase.selfFiled && !!fullCase.bankName, bankBranch: !fullCase.selfFiled && !!fullCase.bankBranch });
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
        if (fullCase.sitePhotos) {
          setSiteImages(fullCase.sitePhotos.map((url, idx) => ({ id: `site_${idx}`, url, name: `Site Image ${idx + 1}` })));
        }
        // Work saved on this phone for this case (e.g. app closed mid-way) wins over the server copy
        return localforage.getItem(draftKey).then((draft) => {
          if (usableDraft(draft)) {
            handleResumeDraft(draft);
            toast('📋 Restored your unsaved work on this case.', { id: 'session-restored', duration: 3000, icon: '✅' });
          } else {
            setModalStep(1);
          }
        }).finally(() => setDraftReady(true));
      })
      .catch(err => {
        setDraftReady(true);
        console.error('Failed to load case details', err);
        toast.error('Failed to load case details.');
      });
  }, [editingCaseId]);

  // Picks a bank from the list (a typed short or old name is matched to the official one)
  const handleAddCustomBank = (name) => {
    const bank = matchBank(bankRecords, name);
    if (bank) setBankName(bank.name);
    setShowBankDropdown(false);
    return bank;
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
    if (!propertyDetails.propertyType) {
      toast.error('Please choose the report type (House, Apartment, Open Site, Agriculture Land…).');
      return;
    }
    // The bank must be one from the list
    if (!handleAddCustomBank(bankName.trim())) {
      toast.error(`“${bankName.trim()}” is not in the bank list. Pick one from the list, or ask the Super Admin to add it.`);
      return;
    }
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
              fontWeight: i === 0 ? '700' : '400',
              color: i === 0 ? '#dc2626' : 'inherit'
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
    ), { duration: 9000, style: { background: '#ffffff', color: '#0f172a', width: '92vw', maxWidth: '420px', borderLeft: '4px solid #ef4444', padding: '16px', boxShadow: '0 10px 30px rgba(0,0,0,.25)' } });
  };

  const handleSimulateUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    const docId = activeDocUploadRef.current || activeDocUpload;
    if (!docId) {
      console.error("Upload error: active docId is missing");
      return;
    }

    const totalFiles = files.length;

    setScanningDocs(prev => ({ ...prev, [docId]: true }));
    setScanProgress(prev => ({
      ...prev,
      [docId]: {
        status: totalFiles > 1 ? `Preparing ${totalFiles} files...` : 'Preparing document...',
        detail: 'Reading file & verifying format',
        extractedPairs: [],
        total: totalFiles,
        completed: 0
      }
    }));
    setActiveDocUpload(null);
    activeDocUploadRef.current = null;

    const newPages = [];
    let errorMsg = null;
    let errorDetail = null; // shown on the document's own card
    const newHashes = [];
    setDocErrors(prev => ({ ...prev, [docId]: null })); // a new try clears the old message

    try {
      for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
        const file = files[fileIdx];
        const fileLabel = totalFiles > 1 ? ` (${fileIdx + 1}/${totalFiles})` : '';

        // ── Progress: format check ───────────────────────────────────────────
        setScanProgress(prev => ({
          ...prev,
          [docId]: {
            ...prev[docId],
            status: `Checking file format${fileLabel}...`,
            detail: `Verifying ${file.name}`,
            completed: fileIdx
          }
        }));

        // ── 0. FILE FORMAT: PDF, Word or photo — any size ───────────────────
        const fileExt = (file.name.split('.').pop() || '').toLowerCase();
        const isPdf = file.type === 'application/pdf' || fileExt === 'pdf';
        const isWord = isWordFile(file);
        const isImage = !isWord && (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tif', 'tiff', 'heic'].includes(fileExt));

        if (!isPdf && !isImage && !isWord) {
          errorMsg = `⚠️ UNSUPPORTED FILE FORMAT: "${file.name}"\n\nPlease upload the document as a PDF, a Word file (.docx / .doc) or a photo (JPG, PNG).`;
          break;
        }

        // ── 1. CONTENT-HASH DUPLICATE CHECK ─────────────────────────────────
        setScanProgress(prev => ({
          ...prev,
          [docId]: {
            ...prev[docId],
            status: `Checking for duplicates${fileLabel}...`,
            detail: 'Computing content hash (detects renamed files)'
          }
        }));
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
        // Same file already used on another case?
        try {
          const dupRes = await fetch(`${API_BASE_URL}/api/cases/check-duplicates`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hashes: [fileHash], caseId: editingCaseId || '' }),
          });
          const dup = dupRes.ok ? await dupRes.json() : null;
          if (dup && dup.duplicates && dup.duplicates.length) {
            errorMsg = `🚫 DUPLICATE DETECTED: "${file.name}" is already used on case ${dup.duplicates[0].fileNumber}.\n\nEvery case needs its own documents. Please upload this customer's own document.`;
            break;
          }
        } catch { /* offline: the server checks again when the case is saved */ }

        // ── 2. KEEP THE ORIGINAL ON THE SERVER (PDF / Word / anything over 1 MB) ────
        // The case then saves only a link, so a document of any size fits.
        let storedUrl = null;
        if (isPdf || isWord || file.size > 1024 * 1024) {
          setScanProgress(prev => ({
            ...prev,
            [docId]: { ...prev[docId], status: `Uploading ${formatMB(file.size)}${fileLabel}...`, detail: 'Saving the original document safely' }
          }));
          try {
            storedUrl = await uploadDocumentFile(file);
          } catch (upErr) {
            errorMsg = `⚠️ UPLOAD FAILED\n${upErr.message}`;
            break;
          }
        }

        // ── 3. READ THE FILE FOR CHECKING AND PREVIEW (Word files are read on the server) ────
        setScanProgress(prev => ({
          ...prev,
          [docId]: {
            ...prev[docId],
            status: `Reading file${fileLabel}...`,
            detail: 'Loading document into memory'
          }
        }));
        const readInline = !isWord && file.size <= 60 * 1024 * 1024; // very large files are checked from storage
        const dataUrl = readInline ? await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }) : null;

        // ── 3. OCR / PDF TEXT VALIDATION WITH LIVE STREAMING ─────────────
        const scanMsg = isWord ? 'Mahe AI is reading the Word file...' : isPdf ? 'Mahe AI is scanning PDF (may take a few seconds)...' : 'Mahe AI is scanning document...';
        toast(scanMsg, { icon: '🔍', duration: 3000 });

        let clientText = '';
        let detectedPageCount = 1;
        let pdfExtracted = null;

        if (isPdf && readInline) {
          setScanProgress(prev => ({
            ...prev,
            [docId]: {
              ...prev[docId],
              status: `Analyzing PDF stream${fileLabel}...`,
              detail: 'Reading document pages & embedded text layers',
              currentPage: 1,
              totalPages: 1,
              liveSnippets: ['Scanning PDF stream...']
            }
          }));

          try {
            pdfExtracted = await extractPdfText(file, (pageNum, totalPages, pageLines) => {
              setScanProgress(prev => ({
                ...prev,
                [docId]: {
                  ...prev[docId],
                  status: `Mahe AI OCR Scanning Page ${pageNum} of ${totalPages}...`,
                  detail: `Extracting live text stream (Page ${pageNum}/${totalPages})`,
                  currentPage: pageNum,
                  totalPages: totalPages,
                  pageCount: totalPages,
                  liveSnippets: pageLines && pageLines.length > 0 ? pageLines.slice(0, 8) : [`Page ${pageNum}: Scanning layout & seal structure...`]
                }
              }));
            });

            if (pdfExtracted) {
              clientText = pdfExtracted.text || '';
              detectedPageCount = pdfExtracted.numPages || 1;
            }
          } catch (pdfErr) {
            console.warn('extractPdfText warning:', pdfErr);
          }
        }

        setScanProgress(prev => ({
          ...prev,
          [docId]: {
            ...prev[docId],
            status: `Mahe AI OCR Scanning in Progress${fileLabel}...`,
            detail: isPdf
              ? `Analyzing ${detectedPageCount} page${detectedPageCount > 1 ? 's' : ''}, municipal seals & sanction details`
              : 'Running OCR — reading stamps, signatures & seal details',
            currentPage: isPdf ? detectedPageCount : (fileIdx + 1),
            totalPages: isPdf ? detectedPageCount : totalFiles,
            pageCount: detectedPageCount,
            liveSnippets: (pdfExtracted?.snippets && pdfExtracted.snippets.length > 0)
              ? pdfExtracted.snippets.slice(0, 8)
              : (prev[docId]?.liveSnippets || ['Processing document text layers...'])
          }
        }));

        const validation = await validateDocOCR(dataUrl, docId, isPdf, readInline ? file : null, clientText, clientName, storedUrl);

        if (!validation.passed) {
          errorDetail = {
            title: validation.nameMismatch ? 'Name doesn’t match the customer' : 'Document not accepted',
            text: validation.reason || 'This document could not be accepted.',
            nameMismatch: Boolean(validation.nameMismatch),
            names: validation.namesOnDocument || [],
            fileName: file.name
          };
          errorMsg = validation.nameMismatch
            ? `⚠️ NAME MISMATCH — DOCUMENT REJECTED\n${validation.reason}`
            : `⚠️ DOCUMENT REJECTED\n${validation.reason}\n\nPlease upload the correct document.`;
          break;
        }

        if (validation.warning) {
          toast(validation.warning, { icon: '⚠️', duration: 5000 });
        } else {
          const rules = DOC_VALIDATION_RULES[docId];
          toast.success(`Mahe AI Verified ✓ — ${rules?.name || 'Document'} accepted.`);
        }

        // Show live extracted field badges and text snippets in the scanning box
        const extractedPairs = [];
        if (validation.extractedMeta) {
          const meta = validation.extractedMeta;
          const getv = (f) => (f && typeof f === 'object' && 'value' in f) ? f.value : f;
          const owner = getv(meta.ownerName || meta.purchaserName || meta.claimant || meta.clientName);
          if (owner) extractedPairs.push(`Owner: ${String(owner).slice(0, 22)}`);
          const father = getv(meta.fathersName || meta.fatherName);
          if (father) extractedPairs.push(`Father: ${String(father).slice(0, 22)}`);
          const vendor = getv(meta.vendorName || meta.executant);
          if (vendor) extractedPairs.push(`Vendor: ${String(vendor).slice(0, 22)}`);
          if (getv(meta.deedNo)) extractedPairs.push(`Deed No: ${getv(meta.deedNo)}`);
          if (getv(meta.deedYear)) extractedPairs.push(`Year: ${getv(meta.deedYear)}`);
          if (getv(meta.surveyNo)) extractedPairs.push(`Survey: ${getv(meta.surveyNo)}`);
          if (getv(meta.netExtent || meta.extent)) extractedPairs.push(`Extent: ${getv(meta.netExtent || meta.extent)}`);
          if (getv(meta.assessmentNo)) extractedPairs.push(`Assess: ${getv(meta.assessmentNo)}`);
          if (getv(meta.wardNo)) extractedPairs.push(`Ward: ${getv(meta.wardNo)}`);
          if (getv(meta.buildingAge)) extractedPairs.push(`Age: ${getv(meta.buildingAge)} yr(s)`);
          if (getv(meta.approvalPlanNo)) extractedPairs.push(`Permit: ${getv(meta.approvalPlanNo)}`);
          if (getv(meta.propertyType)) extractedPairs.push(`Type: ${getv(meta.propertyType)}`);
          if (getv(meta.structureType)) extractedPairs.push(`Structure: ${getv(meta.structureType)}`);
          if (getv(meta.marketValue)) {
            const rawMv = meta.marketValue;
            const mvStr = typeof rawMv === 'object' && rawMv ? String(rawMv.value || '') : String(rawMv || '');
            const mvNum = Number(mvStr.replace(/[^0-9.]/g, ''));
            if (!isNaN(mvNum) && mvNum > 0) extractedPairs.push(`MV: ₹${mvNum.toLocaleString('en-IN')}`);
          }
        }

        const finalPageCount = (validation.numPages && validation.numPages > 1)
          ? validation.numPages
          : (detectedPageCount > 1 ? detectedPageCount : (isPdf && readInline ? await getPdfPageCount(file) : 1));

        const liveSnippets = (validation.snippets && validation.snippets.length > 0)
          ? validation.snippets
          : ((pdfExtracted?.snippets && pdfExtracted.snippets.length > 0)
            ? pdfExtracted.snippets
            : (validation.ocrText ? validation.ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 3).slice(0, 10) : []));

        setScanProgress(prev => ({
          ...prev,
          [docId]: {
            ...prev[docId],
            status: `Fields detected${fileLabel} ✓`,
            detail: `${extractedPairs.length} key fields extracted (${finalPageCount} page${finalPageCount > 1 ? 's' : ''})`,
            currentPage: isPdf ? finalPageCount : (fileIdx + 1),
            totalPages: isPdf ? finalPageCount : totalFiles,
            pageCount: finalPageCount,
            extractedPairs,
            liveSnippets
          }
        }));

        if (validation.extractedMeta) {
          // Apply extracted metadata to form
          applyExtractedMeta(
            validation.extractedMeta,
            propertyDetails,
            setPropertyDetails,
            toast,
            docId,
            setExtractedDocsMeta,
            setReconciledPropertyMeta,
            setClientName,
            clientName
          );
        }

        // Allow UI to showcase extracted field pills for 1.2 seconds before transitioning
        await new Promise(r => setTimeout(r, 1200));

        // ── Sale Deed: Deep auto-fill from local extractor ──────
        if (docId === 'saleDeed' && validation.saleDeedIntelligence?.extractedData) {
          const sdi = validation.saleDeedIntelligence.extractedData;
          mapSaleDeedToPropertyDetails(
            sdi,
            setPropertyDetails,
            setClientName,
            setClientFatherName,
            manuallyModifiedFields
          );
          if (Array.isArray(validation.saleDeedIntelligence.warnings)) {
            validation.saleDeedIntelligence.warnings.forEach(w => {
              if (w && typeof w === 'string' && !w.toLowerCase().includes('ollama')) {
                toast(w, { icon: 'ℹ️', duration: 5000 });
              }
            });
          }
        }

        const ext = (file.name.split('.').pop() || (isPdf ? 'pdf' : 'jpg')).toUpperCase();
        newPages.push({ 
          id: fileHash, 
          url: storedUrl || dataUrl, 
          name: file.name, 
          isPdf, 
          isWord,
          mime: fileMime(file),
          pageCount: finalPageCount,
          rawFile: null,
          size: file.size,
          sizeFormatted: formatFileSize(file.size),
          extension: ext,
          pendingVerification: Boolean(validation.pendingVerification),
          uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        newHashes.push(fileHash);

        // ── Per-file progress tick ────────────────────────────────────────────
        setScanProgress(prev => ({
          ...prev,
          [docId]: {
            ...prev[docId],
            completed: fileIdx + 1
          }
        }));
      }

      if (errorMsg) {
        // The full message sits on the document's card (with a fix button); the toast is one short line
        const lines = errorMsg.split('\n').map(l => l.trim()).filter(Boolean);
        const detail = errorDetail || {
          title: (lines[0] || 'Document not accepted').replace(/^[^A-Za-z]+/, '').replace(/:.*$/, '').toLowerCase().replace(/^./, c => c.toUpperCase()),
          text: lines.slice(1).join(' ') || lines[0] || '',
          nameMismatch: false,
          names: []
        };
        setDocErrors(prev => ({ ...prev, [docId]: detail }));
        const slotName = { saleDeed: 'Sale Deed', buildingPlan: 'Building plan', propertyTax: 'Property tax', marketValue: 'Market value certificate', layoutPlan: 'Layout plan' }[docId] || 'Document';
        toast.error(`${slotName}: ${detail.title.toLowerCase()} — see the message on the card.`, { duration: 4500 });
        newPages.forEach(p => p.url && p.url.startsWith('blob:') && URL.revokeObjectURL(p.url));
        return;
      }

      setUploadedFileHashes(prev => { const s = new Set(prev); newHashes.forEach(h => s.add(h)); return s; });
      setUploadedDocs(prev => ({ ...prev, [docId]: [...prev[docId], ...newPages] }));
    } catch (err) {
      console.error('File upload validation failed:', err);
      toast.error('An error occurred during file upload. Please try again.');
    } finally {
      setScanningDocs(prev => ({ ...prev, [docId]: false }));
      setScanProgress(prev => { const next = { ...prev }; delete next[docId]; return next; });
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

  const captureDocument = async () => {
    if (activeDocUpload && videoRef.current) {
      const docId = activeDocUpload;
      
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 480;
      canvas.height = videoRef.current.videoHeight || 640;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      if (docId === 'SITE_IMAGES') {
        if (siteImages.length >= MAX_SITE_PHOTOS) {
          stopCamera(); setActiveDocUpload(null);
          showValidationError(`⚠️ PHOTO LIMIT REACHED\nA case can have at most ${MAX_SITE_PHOTOS} site photos. Remove one to add another.`);
          return;
        }
        // Real GPS fix at the moment of capture — no location, no photo
        let pos;
        try {
          pos = await currentPosition();
        } catch (err) {
          stopCamera(); setActiveDocUpload(null);
          showValidationError(`⚠️ LOCATION REQUIRED\n${err.message}`);
          return;
        }
        stopCamera();
        setActiveDocUpload(null);
        const address = await addressFor(pos.lat, pos.lng);
        drawStamp(canvas, { ...pos, address, caseLabel: [clientName, bankName].filter(Boolean).join(' · '),
                            engineer: currentUser?.name || currentUser?.username || '' });
        const frameUrl = canvas.toDataURL('image/jpeg', 0.9);
        const hash = await fileHash(await (await fetch(frameUrl)).arrayBuffer());
        setSiteImages(prev => [...prev, { id: `site_${Date.now()}`, hash, url: frameUrl, name: `Site Image ${prev.length + 1}`,
                                          lat: pos.lat, lng: pos.lng, takenAt: pos.time.toISOString(), source: 'camera' }]);
        setLocationData(`Lat: ${pos.lat.toFixed(6)}, Long: ${pos.lng.toFixed(6)}`);
        toast.success('Site photo saved with location and time.');
      } else {
        const frameUrl = canvas.toDataURL('image/jpeg');
        stopCamera();
        
        setScanningDocs(prev => ({ ...prev, [docId]: true }));
        setActiveDocUpload(null);

        // ── Validate camera-captured document via shared OCR validator ────
        try {
          toast('Mahe AI is scanning captured document...', { icon: '🔍', duration: 2500 });

          const validation = await validateDocOCR(frameUrl, docId, false, null, '', clientName);

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
            applyExtractedMeta(
              validation.extractedMeta,
              propertyDetails,
              setPropertyDetails,
              toast,
              docId,
              setExtractedDocsMeta,
              setReconciledPropertyMeta,
              setClientName,
              clientName
            );
          }

          const captureHash = `camera_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const byteSize = Math.round((frameUrl.length * 3) / 4);
          const newPage = {
            id: captureHash,
            url: frameUrl,
            name: `Camera_Scan_Page_${uploadedDocs[docId].length + 1}.jpg`,
            isPdf: false,
            pageCount: 1,
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
    if (!uploadedDocs.saleDeed || uploadedDocs.saleDeed.length === 0) {
      showValidationError('⚠️ SALE DEED REQUIRED\nThe Registered Sale Deed is required for every valuation. Please upload all its pages before continuing.');
      return;
    }
    if (Object.values(scanningDocs || {}).some(Boolean)) {
      toast.error('Please wait — a document is still being checked.');
      return;
    }
    // Sanitize any garbage / object OCR values before showing Step 3
    setPropertyDetails(prev => sanitizePropertyDetails(prev));
    setModalStep(3);
  };

  const handleNextToSiteImages = () => {
    const p = propertyDetails;
    const built = isBuiltProperty(p.propertyType);
    const ba = p.boundariesActual || {};
    const missing = [];
    ['north', 'south', 'east', 'west'].forEach(s => { if (!String(ba[s] || '').trim()) missing.push(`Boundary ${s[0].toUpperCase()}${s.slice(1)} (as per visit)`); });
    if (!p.propertyType) missing.push('Category type');
    if (!String(p.roadWidth || '').trim()) missing.push('Road width');
    if (!p.plotType) missing.push('Plot type');
    if (!p.roadType) missing.push('Road type');
    if (built) {
      if (String(p.buildingAge ?? '').trim() === '') missing.push('Age of building');
      if (!p.structureType) missing.push('Type of structure');
      if (!p.flooringType) missing.push('Type of flooring');
      if (!String(p.siteValue?.plinthArea || '').trim()) missing.push('Plinth area value');
      (p.siteValue?.floors || []).forEach(f => { if (!String(f.value || '').trim()) missing.push(`${f.label} area`); });
    }
    if (missing.length) {
      toast.error(`Please fill in: ${missing.join(', ')}.`, { duration: 6000 });
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

      if (extracted.ownerName !== "To be verified" && !lockedFields.clientName) {
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
        const cleanDeed = String(propertyDetails.deedNo).replace(/[\s\/-]/g, '').toLowerCase();
        if (!cleanRaw.includes(cleanDeed)) {
          toast.error(`🚨 SECURITY ALERT: The Deed Number [${propertyDetails.deedNo}] you entered does not match the uploaded Sale Deed. Please correct it.`, { duration: 6000 });
          setModalStep(3);
          return;
        }
      }
      
      if (propertyDetails.surveyNo && propertyDetails.surveyNo !== 'To be verified') {
        const cleanSurvey = String(propertyDetails.surveyNo).replace(/[\s\/-]/g, '').toLowerCase();
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
          hash: p.id,
          pendingVerification: Boolean(p.pendingVerification),
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
      bankName: bankName || '',
      bankBranch: bankBranch,
      bankDistrict: bankDistrict,
      propertyDetails: propertyDetails,
      locationData: locationData,
      sitePhotos: siteImages.map(img => img.url),
      photoHashes: siteImages.map(img => img.hash).filter(Boolean),
      documents: payloadDocs,
      signatureDataUrl: signatureDataUrl || signatureUploadUrl || '',
      status: editingCaseId ? 'Reviewing' : 'Pending',
      assignedEngineerId: currentUser?.id || 'UNASSIGNED',
      assignedEngineerName: currentUser?.name || currentUser?.username || 'Unknown Engineer'
    };

    // If device is offline, immediately queue offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await queueOfflineCase(payload, editingCaseId);
        await localforage.removeItem(draftKey);
        const formattedOfflineCase = {
          id: editingCaseId || `OFFLINE-${Date.now().toString().slice(-6)}`,
          title: (payload.clientName && payload.bankName) ? `${payload.clientName} - ${payload.bankName}` : payload.clientName,
          type: payload.propertyDetails?.propertyType || 'Standard Appraisal',
          date: new Date().toLocaleDateString(),
          status: 'Pending Sync'
        };
        if (onCaseSaved) onCaseSaved(formattedOfflineCase, !!editingCaseId);
        toast.success(`Saved offline! Queued to sync automatically when reconnected.`, { icon: '💾', duration: 6000 });
        closeModal();
        return;
      } catch (queueErr) {
        toast.error(`Failed to save offline: ${queueErr.message}`);
        return;
      }
    }

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
        // The server answered and refused: show why and keep the form open (this is not a network problem)
        const errData = await response.json().catch(() => ({}));
        const why = errData.details || errData.error || response.statusText || 'The server could not save this case.';
        toast.error(why, { duration: 7000 });
        return;
      }
      
      const newCase = await response.json();
      
      localforage.removeItem(draftKey); // Clear draft on success
      
      const formattedNewCase = {
        ...newCase, // name, file number, bank… so the case list shows it correctly straight away
        id: newCase.id,
        client: newCase.clientName || 'Client',
        bank: newCase.bankName || '',
        fileNumber: newCase.fileNumber || '',
        title: (newCase.clientName && newCase.bankName) ? `${newCase.clientName} - ${newCase.bankName}` : newCase.clientName,
        type: newCase.propertyDetails?.propertyType || 'Standard Appraisal',
        date: new Date(newCase.createdAt).toLocaleDateString(),
        status: newCase.status
      };
      
      if (editingCaseId) {
        if (onCaseSaved) onCaseSaved(formattedNewCase, true);
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
        if (onCaseSaved) onCaseSaved(formattedNewCase, false);
        toast.success(`Case successfully created and saved for ${clientName} (${bankName})!`);
      }
      
      closeModal();
    } catch (err) {
      console.warn('Network error while saving case, saving to offline queue:', err);
      try {
        await queueOfflineCase(payload, editingCaseId);
        await localforage.removeItem(draftKey);
        const formattedOfflineCase = {
          id: editingCaseId || `OFFLINE-${Date.now().toString().slice(-6)}`,
          title: (payload.clientName && payload.bankName) ? `${payload.clientName} - ${payload.bankName}` : payload.clientName,
          type: payload.propertyDetails?.propertyType || 'Standard Appraisal',
          date: new Date().toLocaleDateString(),
          status: 'Pending Sync'
        };
        if (onCaseSaved) onCaseSaved(formattedOfflineCase, !!editingCaseId);
        toast.success(`Network unavailable. Case saved locally and queued for auto-sync!`, { icon: '💾', duration: 7000 });
        closeModal();
      } catch (fallbackErr) {
        console.error(fallbackErr);
        toast.error("Error saving case: " + err.message);
      }
    }
  };

  const closeModal = () => {
    stopCamera();
    Object.values(uploadedDocs).flat().forEach(page => {
      if (page.url && page.url.startsWith('blob:')) URL.revokeObjectURL(page.url);
    });
    
    setModalStep(0);
    setClientName(''); setLockedFields({ clientName: false, bankName: false, bankBranch: false });
    setClientFatherName('');
    setBankName('');
    setBankBranch('');
    setBankDistrict('');
    setShowBankDropdown(false);
    setExtractedData(null);
    setSiteImages([]);
    setLocationData('Fetching location...');
    setPropertyDetails({ boundariesDoc: { north: '', south: '', east: '', west: '' }, boundariesActual: { north: '', south: '', east: '', west: '' }, buildingAge: '', flooringType: '', structureType: '', roadWidth: '', propertyType: '', roadType: '', plotType: '', deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '', assessmentNo: '', doorNo: '', approvalPlanNo: '', approvalPlanDate: '', builderName: '', managingPartner: '', flatNo: '', floorNo: '', additionsWork: [], siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] } });
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
    if (onClose) onClose();
  };



  const handleSiteImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (e.target) e.target.value = null;
    if (files.length === 0) return;
    let count = siteImages.length;
    const seen = new Set(siteImages.map(i => i.hash).filter(Boolean));
    for (const file of files) {
      if (count >= MAX_SITE_PHOTOS) {
        showValidationError(`⚠️ PHOTO LIMIT REACHED\nA case can have at most ${MAX_SITE_PHOTOS} site photos. "${file.name}" and any after it were not added.`);
        break;
      }
      if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.type)) {
        showValidationError(`⚠️ NOT A PHOTO\n"${file.name}" is not a photo. Site images must be JPG / PNG photos of the property.`);
        continue;
      }
      try {
        const buf = await file.arrayBuffer();
        const hash = await fileHash(buf);
        if (seen.has(hash)) {
          showValidationError(`🚫 DUPLICATE PHOTO\n"${file.name}" is already added to this case.`);
          continue;
        }
        const dupRes = await fetch(`${API_BASE_URL}/api/cases/check-duplicates`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hashes: [hash], caseId: editingCaseId || '' }),
        }).catch(() => null);
        const dup = dupRes && dupRes.ok ? await dupRes.json() : null;
        if (dup && dup.duplicates && dup.duplicates.length) {
          showValidationError(`🚫 DUPLICATE PHOTO\n"${file.name}" is already used on case ${dup.duplicates[0].fileNumber}. Take fresh photos at this site.`);
          continue;
        }
        // The phone must have recorded where and when the photo was taken
        const gps = readExifGps(buf);
        if (!gps || !gps.time) {
          showValidationError(`⚠️ NO LOCATION IN PHOTO\n"${file.name}" has no GPS location / time recorded by the camera.\n\nUse "Take Photo" in the app at the site, or turn on location for the phone camera and upload the original photo.`);
          continue;
        }
        const url = URL.createObjectURL(file);
        const canvas = await imageToCanvas(url);
        URL.revokeObjectURL(url);
        const address = await addressFor(gps.lat, gps.lng);
        drawStamp(canvas, { lat: gps.lat, lng: gps.lng, time: gps.time, address,
                            caseLabel: [clientName, bankName].filter(Boolean).join(' · '),
                            engineer: currentUser?.name || currentUser?.username || '' });
        const stamped = canvas.toDataURL('image/jpeg', 0.9);
        seen.add(hash);
        count += 1;
        setSiteImages(prev => [...prev, { id: `site_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, hash, url: stamped,
                                          name: file.name, lat: gps.lat, lng: gps.lng, takenAt: gps.time.toISOString(), source: 'gallery' }]);
      } catch (err) {
        showValidationError(`⚠️ PHOTO REJECTED\n${err.message || `"${file.name}" could not be read.`}`);
      }
    }
  };

  // Step 4 → final step. Documents were already checked/extracted when uploaded in Step 2.
  const handleRunSecurityExtraction = () => {
    if (uploadedDocs.saleDeed.length === 0) {
      toast.error("The Sale Deed is required. Please upload it in Step 2.", { duration: 5000 });
      setModalStep(2);
      return;
    }
    if (siteImages.length === 0) {
      toast.error("Please capture at least one geo-tagged site image.");
      return;
    }
    if (siteImages.length > MAX_SITE_PHOTOS) {
      toast.error(`At most ${MAX_SITE_PHOTOS} site images are allowed.`);
      return;
    }
    setModalStep(7);
  };

  if (!isOpen && modalStep === 0 && !showDraftPrompt) return null;

  return (
    <>
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
                    {previewInfo.isPdf && (previewImage.pageCount || numPdfPages) && (
                      <span>• {previewImage.pageCount || numPdfPages} Page{(previewImage.pageCount || numPdfPages) > 1 ? 's' : ''}</span>
                    )}
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
            {isWordFile(previewImage) ? (
              <div style={{ color: 'white', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                <FileText size={56} color="#60a5fa" />
                <div style={{ fontSize: '15px', maxWidth: '320px', lineHeight: 1.5 }}>Word document — checked by Mahe AI on the server. Open it in Word or another app to view.</div>
                <a href={resolveDocUrl(previewImage.url)} target="_blank" rel="noreferrer" style={{ background: '#2563eb', color: 'white', padding: '10px 18px', borderRadius: '10px', fontWeight: 600, textDecoration: 'none' }}>Open / download</a>
              </div>
            ) : previewImage.isPdf ? (
              <div style={{ width: '100%', height: '100%', overflow: 'auto', backgroundColor: '#222', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '16px 0' }}>
                <Document 
                  file={resolveDocUrl(previewImage.url)} 
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
              <img src={resolveDocUrl(previewImage.url)} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
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
          backgroundColor: 'var(--bg-app)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
          padding: 'clamp(14px, 3.5vw, 24px)', animation: 'slideUp 0.3s ease-out', minHeight: '350px', maxHeight: '92vh', display: 'flex', flexDirection: 'column'
        }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0, gap: '8px' }}>
            {/* Back button — left side */}
            {modalStep > 1 ? (
              <button
                onClick={() => setModalStep(prev => (prev === 7 ? 4 : prev - 1))}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '2px',
                  color: 'var(--primary)', fontWeight: '600', fontSize: '13px',
                  padding: '4px 6px', borderRadius: '8px',
                  transition: 'background 0.15s', flexShrink: 0
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(3,70,200,0.08)'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <ChevronLeft size={18} /> Back
              </button>
            ) : (
              <div style={{ width: '36px', flexShrink: 0 }} />
            )}

            {/* Step title — center */}
            <h2 style={{ fontSize: 'clamp(14px, 4vw, 18px)', fontWeight: '700', margin: 0, textAlign: 'center', flex: 1, minWidth: 0, lineHeight: 1.3, color: 'var(--text-primary)' }}>
              {modalStep === 1 && (editingCaseId ? "Case Setup" : "New Case Setup")}
              {modalStep === 2 && "Official Legal Documents"}
              {modalStep === 3 && "Property Details"}
              {modalStep === 4 && "Site Images"}
              {modalStep === 5 && "Document Extraction"}
              {modalStep === 6 && "Extracted Data"}
              {modalStep === 7 && "Final Review & Digital Signature"}
            </h2>

            {/* Close button — right side */}
            <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
              <X size={22} color="var(--text-muted)" />
            </button>
          </div>

            {/* STEP 1: Case Setup */}
            {modalStep === 1 && (
              <Step1CaseSetup
                propertyTypes={propertyTypes}
                propertyType={propertyDetails.propertyType || ''}
                setPropertyType={(v) => setPropertyDetails(prev => ({ ...prev, propertyType: v }))}
                clientName={clientName}
                setClientName={setClientName}
                lockedFields={lockedFields}
                clientFatherName={clientFatherName}
                setClientFatherName={setClientFatherName}
                bankName={bankName}
                setBankName={setBankName}
                bankBranch={bankBranch}
                setBankBranch={setBankBranch}
                bankDistrict={bankDistrict}
                setBankDistrict={setBankDistrict}
                showBankDropdown={showBankDropdown}
                setShowBankDropdown={setShowBankDropdown}
                availableBanks={availableBanks}
                bankRecords={bankRecords}
                availableDistricts={availableDistricts}
                handleAddCustomBank={handleAddCustomBank}
                handleNextToUpload={handleNextToUpload}
              />
            )}

            {/* STEP 2: Official Legal Documents */}
            {modalStep === 2 && (
              <Step2LegalDocs
                uploadedDocs={uploadedDocs}
                scanningDocs={scanningDocs}
                docErrors={docErrors}
                scanProgress={scanProgress}
                setDocErrors={setDocErrors}
                clientName={clientName}
                nameLocked={Boolean(lockedFields.clientName)}
                onUseOwnerName={(name) => { setClientName(name); toast.success(`Customer name changed to “${name}”. Choose the deed again.`, { duration: 4000 }); }}
                setScanningDocs={setScanningDocs}
                activeDocUpload={activeDocUpload}
                setActiveDocUpload={setActiveDocUpload}
                activeDocUploadRef={activeDocUploadRef}
                fileInputRef={fileInputRef}
                isCameraActive={isCameraActive}
                videoRef={videoRef}
                startCamera={startCamera}
                stopCamera={stopCamera}
                captureDocument={captureDocument}
                handleSimulateUpload={handleSimulateUpload}
                handleDeletePage={handleDeletePage}
                setPreviewImage={setPreviewImage}
                extractedDocsMeta={extractedDocsMeta}
                handleNextToPropertyDetails={handleNextToPropertyDetails}
              />
            )}

            {/* STEP 3: Property Details */}
            {modalStep === 3 && (
              <Step3PropertyDetails
                propertyDetails={propertyDetails}
                setPropertyDetails={setPropertyDetails}
                propertyTypes={propertyTypes}
                plotTypes={plotTypes}
                roadTypes={roadTypes}
                structureTypes={structureTypes}
                flooringTypes={flooringTypes}
                renderFieldBadge={renderFieldBadge}
                renderConflictOptions={renderConflictOptions}
                setManuallyModifiedFields={setManuallyModifiedFields}
                handleNextToSiteImages={handleNextToSiteImages}
                bankName={bankName}
              />
            )}

            {/* STEP 4: Site Images */}
            {modalStep === 4 && (
              <Step4SiteImages
                siteImages={siteImages}
                setSiteImages={setSiteImages}
                siteImageFileInputRef={siteImageFileInputRef}
                handleSiteImageUpload={handleSiteImageUpload}
                isCameraActive={isCameraActive}
                startCamera={startCamera}
                stopCamera={stopCamera}
                captureDocument={captureDocument}
                videoRef={videoRef}
                setPreviewImage={setPreviewImage}
                handleRunSecurityExtraction={handleRunSecurityExtraction}
              />
            )}

            {/* STEP 5 & 6: Document Analysis & Extracted Data Review */}
            {(modalStep === 5 || modalStep === 6) && (
              <Step5ExtractedDataReview
                modalStep={modalStep}
                setModalStep={setModalStep}
                clientName={clientName}
                bankName={bankName}
                propertyDetails={propertyDetails}
                extractedData={extractedData}
                setIsDocumentVerified={setIsDocumentVerified}
              />
            )}

            {/* STEP 7: Final Review & Digital Signature */}
            {modalStep === 7 && (
              <Step6FinalReviewSignature
                clientName={clientName}
                bankName={bankName}
                propertyDetails={propertyDetails}
                uploadedDocs={uploadedDocs}
                siteImages={siteImages}
                showSummaryDocs={showSummaryDocs}
                setShowSummaryDocs={setShowSummaryDocs}
                showSummaryImages={showSummaryImages}
                setShowSummaryImages={setShowSummaryImages}
                setPreviewImage={setPreviewImage}
                setModalStep={setModalStep}
                activeSignatureTab={activeSignatureTab}
                setActiveSignatureTab={setActiveSignatureTab}
                sigCanvas={sigCanvas}
                signatureUploadUrl={signatureUploadUrl}
                setSignatureUploadUrl={setSignatureUploadUrl}
                setSignatureDataUrl={setSignatureDataUrl}
                termsAccepted={termsAccepted}
                setTermsAccepted={setTermsAccepted}
                showSubmitModal={showSubmitModal}
                setShowSubmitModal={setShowSubmitModal}
                handleCreateCase={handleCreateCase}
                savedSignature={savedSignature}
                onReviewReport={editingCaseId ? openReportReview : undefined}
                bankValues={bankValues}
              />
            )}

          </div>
        </div>
      )}

      {reviewSignature !== null && editingCaseId && (
        <ReportViewer
          title="Check the bank report"
          subtitle={`${clientName || 'Client'} · ${bankName || ''} — this is exactly what the bank receives`}
          fileName={`Preview_${editingCaseId}.docx`}
          load={() => fetchReport(`${API_BASE_URL}/api/cases/${editingCaseId}/report-preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientName, clientFatherName, bankName, bankBranch, bankDistrict,
              propertyDetails,
              sitePhotos: siteImages.map(img => img.url),
              signatureDataUrl: reviewSignature || signatureUploadUrl || '',
            }),
          })}
          onClose={() => setReviewSignature(null)}
          footer={(
            <>
              <button type="button" className="btn-secondary" onClick={() => setReviewSignature(null)}>Back to edit</button>
              <button type="button" className="btn-primary" onClick={() => { setReviewSignature(null); handleCreateCase(); }}>Submit report</button>
            </>
          )}
        />
      )}

    </>
  );
}
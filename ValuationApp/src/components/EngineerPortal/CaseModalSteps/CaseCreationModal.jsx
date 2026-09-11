import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, X, Loader2, ShieldAlert } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

if (typeof window !== 'undefined' && pdfjs && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}
import localforage from 'localforage';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../../config/api';
import { reconcileDocuments } from '../../../utils/reconciliation';
import { isStrictlyEmpty } from '../../../utils/canonicalSchema';

import Step1CaseSetup from './Step1CaseSetup';
import Step2LegalDocs from './Step2LegalDocs';
import Step3PropertyDetails from './Step3PropertyDetails';
import Step4SiteImages from './Step4SiteImages';
import Step5ExtractedDataReview from './Step5ExtractedDataReview';
import Step6FinalReviewSignature from './Step6FinalReviewSignature';
import { getPageDisplayInfo, formatFileSize } from './caseModalHelpers';

import {
  FALLBACK_PROPERTY_TYPES,
  FALLBACK_PLOT_TYPES,
  FALLBACK_ROAD_TYPES,
  FALLBACK_STRUCTURE_TYPES,
  FALLBACK_FLOORING_TYPES,
  DEFAULT_BANKS,
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
  const [editingCaseId, setEditingCaseId] = useState(propEditingCaseId || null);

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
        const draft = await localforage.getItem('caseDraft');
        if (!draft || !draft.modalStep || draft.modalStep <= 0) return;

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
    await localforage.removeItem('caseDraft');
    setShowDraftPrompt(null);
    
    // Reset state
    setClientName('');
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
        if (Array.isArray(cfg.banks) && cfg.banks.length > 0) {
          setAvailableBanks(prev => Array.from(new Set([...prev, ...cfg.banks])));
        }
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
        setModalStep(1);
      })
      .catch(err => {
        console.error('Failed to load case details', err);
        toast.error('Failed to load case details.');
      });
  }, [editingCaseId]);

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
    const newHashes = [];

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

        // ── 0. FILE FORMAT VALIDATION (PDF & Images Only) ───────────────────
        const fileExt = (file.name.split('.').pop() || '').toLowerCase();
        const isPdf = file.type === 'application/pdf' || fileExt === 'pdf';
        const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'].includes(fileExt);

        if (!isPdf && !isImage) {
          errorMsg = `⚠️ UNSUPPORTED FILE FORMAT: "${file.name}"\n\nLegal documents and building plans must be uploaded as PDF or Images (JPG, PNG).\n\nWord documents (.docx, .doc) cannot be verified or previewed as certified legal paperwork. Please upload your document as a PDF or high-resolution image.`;
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

        // ── 2. READ FILE AS DATA URL FIRST (reliable for OCR and UI preview) ────────
        setScanProgress(prev => ({
          ...prev,
          [docId]: {
            ...prev[docId],
            status: `Reading file${fileLabel}...`,
            detail: 'Loading document into memory'
          }
        }));
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // ── 3. OCR / PDF TEXT VALIDATION WITH LIVE STREAMING ─────────────
        const scanMsg = isPdf ? 'Mahe AI is scanning PDF (may take a few seconds)...' : 'Mahe AI is scanning document...';
        toast(scanMsg, { icon: '🔍', duration: 3000 });

        let clientText = '';
        let detectedPageCount = 1;
        let pdfExtracted = null;

        if (isPdf) {
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

        const validation = await validateDocOCR(dataUrl, docId, isPdf, file, clientText);

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
          : (detectedPageCount > 1 ? detectedPageCount : (isPdf ? await getPdfPageCount(file) : 1));

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
          url: dataUrl, 
          name: file.name, 
          isPdf, 
          pageCount: finalPageCount,
          rawFile: null,
          size: file.size,
          sizeFormatted: formatFileSize(file.size),
          extension: ext,
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
    // Sanitize any garbage / object OCR values before showing Step 3
    setPropertyDetails(prev => sanitizePropertyDetails(prev));
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
    if (files.length === 0) return;
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSiteImages(prev => [
          ...prev,
          {
            id: `site_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            url: event.target.result,
            name: file.name
          }
        ]);
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = null;
  };

  const handleRunSecurityExtraction = startAIExtraction;

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
          backgroundColor: 'var(--bg-app)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
          padding: 'clamp(14px, 3.5vw, 24px)', animation: 'slideUp 0.3s ease-out', minHeight: '350px', maxHeight: '92vh', display: 'flex', flexDirection: 'column'
        }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0, gap: '8px' }}>
            {/* Back button — left side */}
            {modalStep > 1 ? (
              <button
                onClick={() => setModalStep(prev => prev - 1)}
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
              {modalStep === 1 && "New Case Setup"}
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
                clientName={clientName}
                setClientName={setClientName}
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
              />
            )}

          </div>
        </div>
      )}

    </>
  );
}
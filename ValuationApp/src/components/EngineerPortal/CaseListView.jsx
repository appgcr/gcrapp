import React, { useState, useRef, useEffect } from 'react';
import { Plus, FileText, MapPin, Search, ChevronRight, ChevronDown, X, UploadCloud, Camera, User, Loader2, CheckCircle2, Building, ScanLine, AlertCircle, ShieldAlert, ShieldCheck, PenTool, CheckSquare } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import localforage from 'localforage';
import toast, { Toaster } from 'react-hot-toast';
import Tesseract from 'tesseract.js';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const INDIAN_BANKS = [
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
  { id: 'buildingPlan', label: '2. Approved Building Plan' },
  { id: 'propertyTax', label: '3. Property Tax Assessment' },
  { id: 'marketValue', label: '4. Market Value Document' },
  { id: 'layoutPlan', label: '5. Layout / Approval Plan' },
];

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
  
  // Bank State
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankDistrict, setBankDistrict] = useState('Y.S.R');
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  
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
            setLocationData('Lat: 17.4065° N, Long: 78.4772° E (Simulated)');
          }
        );
      } else {
        setLocationData('GPS Not Supported');
      }
    }
  }, [modalStep]);

  const handleNewCaseClick = async () => {
    // Check if clocked in via API
    try {
      const res = await fetch(`https://gcr-9ys1.onrender.com/api/attendance?userId=${currentUser?.id || 'ENG-001'}`);
      const data = await res.json();
      const today = new Date().toLocaleDateString();
      const todayLogs = data.filter(log => new Date(log.timestamp).toLocaleDateString() === today);
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
    const restoredDocs = { ...draft.uploadedDocs };
    for (const key in restoredDocs) {
      if (restoredDocs[key]) {
        restoredDocs[key] = restoredDocs[key].map(page => ({
          ...page,
          url: page.rawFile ? URL.createObjectURL(page.rawFile) : page.url
        }));
      }
    }
    const restoredImages = (draft.siteImages || []).map(img => ({
      ...img,
      url: img.rawFile ? URL.createObjectURL(img.rawFile) : img.url
    }));

    setClientName(draft.clientName || '');
    setClientFatherName(draft.clientFatherName || '');
    setBankName(draft.bankName || '');
    setBankBranch(draft.bankBranch || '');
    setBankDistrict(draft.bankDistrict || 'Y.S.R');
    setPropertyDetails({
      boundariesDoc: { north: '', south: '', east: '', west: '' },
      boundariesActual: { north: '', south: '', east: '', west: '' },
      buildingAge: '', flooringType: '', structureType: '', roadWidth: '',
      propertyType: '', roadType: '', plotType: '',
      deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '', approvalPlanNo: '', approvalPlanDate: '',
      builderName: '', managingPartner: '', flatNo: '', floorNo: '', additionsWork: [],
      siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] },
      ...(draft.propertyDetails || {})
    });
    setLocationData(draft.locationData || 'Fetching location...');
    setUploadedDocs(restoredDocs);
    setSiteImages(restoredImages);

    setShowDraftPrompt(null);
    setModalStep(1);
  };

  const handleDiscardDraft = async () => {
    await localforage.removeItem('caseDraft');
    setShowDraftPrompt(null);
    
    // Reset state
    setClientName('');
    setClientFatherName('');
    setBankName('');
    setBankBranch('');
    setBankDistrict('Y.S.R');
    setPropertyDetails({ boundariesDoc: { north: '', south: '', east: '', west: '' }, boundariesActual: { north: '', south: '', east: '', west: '' }, buildingAge: '', flooringType: '', structureType: '', roadWidth: '', propertyType: '', roadType: '', plotType: '', deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '', approvalPlanNo: '', approvalPlanDate: '', builderName: '', managingPartner: '', flatNo: '', floorNo: '', additionsWork: [], siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] } });
    setUploadedDocs({ saleDeed: [], buildingPlan: [], propertyTax: [], marketValue: [], layoutPlan: [] });
    setSiteImages([]);
    setEditingCaseId(null);
    setModalStep(1);
  };

  const handleResumeAssignedTask = async (c) => {
    // Check if clocked in via API
    try {
      const res = await fetch(`https://gcr-9ys1.onrender.com/api/attendance?userId=${currentUser?.id || 'ENG-001'}`);
      const data = await res.json();
      const today = new Date().toLocaleDateString();
      const todayLogs = data.filter(log => new Date(log.timestamp).toLocaleDateString() === today);
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
      const res = await fetch(`https://gcr-9ys1.onrender.com/api/cases/${c.id}`);
      const fullCase = await res.json();
      
      setClientName(fullCase.clientName || fullCase.borrowerName || '');
      setClientFatherName(fullCase.clientFatherName || '');
      setBankName(fullCase.bankName || '');
      setBankBranch(fullCase.bankBranch || '');
      setBankDistrict(fullCase.bankDistrict || 'Y.S.R');
      setPropertyDetails({
        boundariesDoc: { north: '', south: '', east: '', west: '' },
        boundariesActual: { north: '', south: '', east: '', west: '' },
        buildingAge: '', flooringType: '', structureType: '', roadWidth: '',
        propertyType: '', roadType: '', plotType: '',
        deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '', approvalPlanNo: '', approvalPlanDate: '',
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
    deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '', approvalPlanNo: '', approvalPlanDate: '',
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
  const [uploadedFileSignatures, setUploadedFileSignatures] = useState([]);
  const [activeDocUpload, setActiveDocUpload] = useState(null);
  
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

  // Auto-Save Draft
  useEffect(() => {
    if (modalStep > 0 && modalStep < 7) { // Don't save if closed or on final submission
      const draft = {
        clientName,
        clientFatherName,
        bankName,
        bankBranch,
        bankDistrict,
        propertyDetails,
        locationData,
        uploadedDocs,
        siteImages
      };
      localforage.setItem('caseDraft', draft).catch(err => console.error("Auto-save failed", err));
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

  // Fetch Cases from Backend API
  useEffect(() => {
    fetch('https://gcr-9ys1.onrender.com/api/cases')
      .then(res => res.json())
      .then(data => {
        // Filter to this engineer's assigned cases (broadened to catch older cases by name)
        const myCases = data.filter(c => 
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
      })
      .catch(err => console.error("Error fetching cases:", err));
  }, [currentUser]);

  const filteredCases = casesList.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) || 
    c.id.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBanks = INDIAN_BANKS.filter(b => b.toLowerCase().includes(bankName.toLowerCase()));

  const formatCurrency = (val) => {
    if (!val) return '';
    const num = val.toString().replace(/\D/g, '');
    if (!num) return '';
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const handleNextToUpload = () => {
    if (clientName.trim() === '' || bankName.trim() === '') {
      toast.error("Please enter both the client's name and the bank name.");
      return;
    }
    setModalStep(2);
  };

  const handleSimulateUpload = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const docId = activeDocUpload;
      
      setScanningDocs(prev => ({ ...prev, [docId]: true }));
      setActiveDocUpload(null);

      let newPages = [];
      let errorMsg = null;
      
      for (let file of files) {
        const fileSignature = `${file.name}-${file.size}`;
        
        if (uploadedFileSignatures.includes(fileSignature)) {
          errorMsg = `🚫 DUPLICATE DETECTED: Page "${file.name}" has already been uploaded in this session.\n\nSystem strictly rejects duplicate files.`;
          break;
        }
        
        const isPdf = file.type === 'application/pdf';

        // REAL OCR Document Verification (For non-PDF images)
        if (!isPdf) {
          try {
            toast('Mahe AI is scanning document text...', { icon: '🔍', duration: 2000 });
            const result = await Tesseract.recognize(file, 'eng');
            const extractedText = result.data.text.toLowerCase();
            
            let legalKeywords = [];
            let docName = '';

            switch(docId) {
              case 'saleDeed':
                legalKeywords = ['sale', 'deed', 'registration', 'schedule', 'property', 'vendor', 'purchaser', 'stamp', 'witness'];
                docName = 'Sale Deed';
                break;
              case 'buildingPlan':
                legalKeywords = ['plan', 'approval', 'municipal', 'corporation', 'panchayat', 'engineer', 'architect', 'drawing', 'scale', 'plot', 'floor'];
                docName = 'Building Plan';
                break;
              case 'propertyTax':
                legalKeywords = ['tax', 'assessment', 'receipt', 'municipal', 'revenue', 'property', 'paid', 'amount', 'challan'];
                docName = 'Property Tax';
                break;
              case 'marketValue':
                legalKeywords = ['market', 'value', 'guideline', 'sub-registrar', 'rate', 'sq.yd', 'sq.ft', 'valuation', 'sro'];
                docName = 'Market Value Document';
                break;
              case 'layoutPlan':
                legalKeywords = ['layout', 'plan', 'approval', 'survey', 'dtcp', 'huda', 'plot', 'boundaries', 'road', 'master'];
                docName = 'Layout Plan';
                break;
              default:
                legalKeywords = [];
            }
            
            if (legalKeywords.length > 0) {
              const foundCount = legalKeywords.filter(kw => extractedText.includes(kw)).length;
              
              // STRCITER VALIDATION: We want to make sure it's actually the right document
              // For sale deed and building plan, let's require at least 1 very strong keyword or 2 weak ones
              if (foundCount < 2) {
                // If it only found 1 keyword, it might be a false positive (like just the word "floor" or "sale")
                // Let's be strict and reject if < 2, UNLESS it's a very specific keyword like "schedule of property" or "sub-registrar"
                const strongMatch = extractedText.includes('sub-registrar') || extractedText.includes('schedule of property') || extractedText.includes('building permission');
                if (!strongMatch) {
                  errorMsg = `⚠️ MAHE AI REJECTION: Mahe AI scanned the image and could not confidently verify it as a ${docName}. It appears to be an irrelevant document or photo.\n\nPlease upload the correct legal paperwork.`;
                  break;
                }
              }
              toast.success(`Mahe AI Scan Passed! Verified as ${docName}.`);
            }
          } catch (err) {
            console.error("OCR Scan Failed", err);
            errorMsg = `⚠️ MAHE AI REJECTION: The image quality is too poor or the document is unreadable. Please upload a clear scan of the ${docName}.`;
            break;
          }
        } else if (isPdf) {
           // We allow PDFs directly as we aren't running PDF.js text extraction here in pre-scan yet
        }

        const objectUrl = URL.createObjectURL(file);

        newPages.push({ 
          id: fileSignature, 
          url: objectUrl, 
          name: file.name,
          isPdf,
          rawFile: file
        });
      }

      if (errorMsg) {
        toast((t) => (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1, fontSize: '14px', color: '#0f172a' }}>
              {errorMsg.split('\n').map((line, i) => <div key={i} style={{ marginBottom: line === '' ? '8px' : '4px', fontWeight: line.includes('REJECTION') || line.includes('DETECTED') ? '700' : '400', color: line.includes('REJECTION') || line.includes('DETECTED') ? '#ef4444' : 'inherit' }}>{line}</div>)}
            </div>
            <button 
              onClick={() => toast.dismiss(t.id)} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X size={16} />
            </button>
          </div>
        ), { duration: 8000, style: { minWidth: '300px', borderLeft: '4px solid #ef4444', padding: '16px' } });
        
        setScanningDocs(prev => ({ ...prev, [docId]: false }));
        newPages.forEach(p => p.url && URL.revokeObjectURL(p.url));
        // clear input
        e.target.value = null;
        return;
      }

      setUploadedFileSignatures(prev => [...prev, ...newPages.map(p => p.id)]);
      setUploadedDocs(prev => ({ 
        ...prev, 
        [docId]: [...prev[docId], ...newPages] 
      }));
      setScanningDocs(prev => ({ ...prev, [docId]: false }));
      
      e.target.value = null; 
    }
  };

  const handleDeletePage = (docId, pageId, e) => {
    e.stopPropagation();
    const page = uploadedDocs[docId].find(p => p.id === pageId);
    if (page && page.url && page.url.startsWith('blob:')) {
      URL.revokeObjectURL(page.url);
    }
    setUploadedFileSignatures(prev => prev.filter(sig => sig !== pageId));
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

        // Run Real Pre-Scan for Camera capture
        try {
          const { data: { text } } = await window.Tesseract.recognize(frameUrl, 'eng');
          const extractedText = text.toLowerCase();
          
          let legalKeywords = [];
          let docName = '';

          switch(docId) {
            case 'saleDeed':
              legalKeywords = ['sale', 'deed', 'registration', 'schedule', 'property', 'vendor', 'purchaser', 'stamp', 'witness'];
              docName = 'Sale Deed';
              break;
            case 'buildingPlan':
              legalKeywords = ['plan', 'approval', 'municipal', 'corporation', 'panchayat', 'engineer', 'architect', 'drawing', 'scale', 'plot', 'floor'];
              docName = 'Building Plan';
              break;
            case 'propertyTax':
              legalKeywords = ['tax', 'assessment', 'receipt', 'municipal', 'revenue', 'property', 'paid', 'amount', 'challan'];
              docName = 'Property Tax';
              break;
            case 'marketValue':
              legalKeywords = ['market', 'value', 'guideline', 'sub-registrar', 'rate', 'sq.yd', 'sq.ft', 'valuation', 'sro'];
              docName = 'Market Value Document';
              break;
            case 'layoutPlan':
              legalKeywords = ['layout', 'plan', 'approval', 'survey', 'dtcp', 'huda', 'plot', 'boundaries', 'road', 'master'];
              docName = 'Layout Plan';
              break;
            default:
              legalKeywords = [];
          }

          if (legalKeywords.length > 0) {
            const foundCount = legalKeywords.filter(kw => extractedText.includes(kw)).length;
            if (foundCount < 2) {
              const strongMatch = extractedText.includes('sub-registrar') || extractedText.includes('schedule of property') || extractedText.includes('building permission');
              if (!strongMatch) {
                toast.error(`⚠️ MAHE AI REJECTION: Mahe AI scanned the image and could not confidently verify it as a ${docName}. It appears to be an irrelevant document or photo.`, { duration: 8000 });
                setScanningDocs(prev => ({ ...prev, [docId]: false }));
                return;
              }
            }
            toast.success(`Mahe AI Scan Passed! Verified as ${docName}.`);
          }

          const dummyCameraSignature = `camera_capture_${Date.now()}`;
          const newPage = { 
            id: dummyCameraSignature, 
            url: frameUrl, 
            name: `Camera Capture ${uploadedDocs[docId].length + 1}`,
            isPdf: false,
            rawFile: null // Camera captures are data URLs
          };
          
          setUploadedFileSignatures(prev => [...prev, dummyCameraSignature]);
          setUploadedDocs(prev => ({ 
            ...prev, 
            [docId]: [...prev[docId], newPage] 
          }));
          setScanningDocs(prev => ({ ...prev, [docId]: false }));

        } catch (err) {
          console.error("Camera OCR Scan Failed", err);
          toast.error(`⚠️ MAHE AI REJECTION: The image quality is too poor or the document is unreadable. Please upload a clear scan of the document.`, { duration: 8000 });
          setScanningDocs(prev => ({ ...prev, [docId]: false }));
        }
      }
    }
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
      // Note: Make sure the URL matches where your backend is actually deployed.
      const backendUrl = window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://gcr-9ys1.onrender.com';
      const res = await fetch(`${backendUrl}/api/extract`, {
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
        payloadDocs[key] = uploadedDocs[key].map(p => ({ name: p.name, isPdf: p.isPdf }));
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
        response = await fetch(`https://gcr-9ys1.onrender.com/api/cases/${editingCaseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch('https://gcr-9ys1.onrender.com/api/cases', {
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
        fetch('https://gcr-9ys1.onrender.com/api/notifications', {
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
    setBankDistrict('Y.S.R');
    setShowBankDropdown(false);
    setExtractedData(null);
    setSiteImages([]);
    setLocationData('Fetching location...');
    setPropertyDetails({ boundariesDoc: { north: '', south: '', east: '', west: '' }, boundariesActual: { north: '', south: '', east: '', west: '' }, buildingAge: '', flooringType: '', structureType: '', roadWidth: '', propertyType: '', roadType: '', plotType: '', deedNo: '', deedYear: '', netExtent: '', surveyNo: '', plotNo: '', khathaNo: '', approvalPlanNo: '', approvalPlanDate: '', builderName: '', managingPartner: '', flatNo: '', floorNo: '', additionsWork: [], siteValue: { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] } });
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
      {previewImage && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <span style={{ fontWeight: '600', fontSize: '14px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
              {previewImage.name}
            </span>
            <button onClick={() => { setPreviewImage(null); setNumPdfPages(null); }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}>
              <X size={24} />
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
      )}

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
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                {modalStep === 1 && "New Case Setup"}
                {modalStep === 2 && "Official Legal Documents"}
                {modalStep === 3 && "Property Details"}
                {modalStep === 4 && "Site Images"}
                {modalStep === 5 && "Document Extraction"}
                {modalStep === 6 && "Extracted Data"}
                {modalStep === 7 && "Final Review & Digital Signature"}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
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
                          onClick={() => setShowBankDropdown(false)}
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
                      placeholder="e.g. Y.S.R"
                      value={bankDistrict}
                      onChange={e => setBankDistrict(e.target.value)}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '14px', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    />
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
                <input type="file" ref={fileInputRef} onChange={handleSimulateUpload} multiple accept=".pdf,.doc,.docx,image/*" style={{ display: 'none' }} />

                {!isCameraActive ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '12px', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', borderRadius: '8px', display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <ShieldAlert size={20} color="#ca8a04" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', color: '#854d0e', lineHeight: '1.4' }}>
                        <strong>Strict Validation Active:</strong> Uploads are pre-scanned. Duplicates or irrelevant documents will be immediately rejected. You can add multiple pages per document.
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
                                <span style={{ backgroundColor: 'rgba(0,82,204,0.1)', color: 'var(--primary)', border: '1px solid rgba(0,82,204,0.2)', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Loader2 size={12} className="spin" /> Scanning...
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
                                onClick={() => { setActiveDocUpload(doc.id); fileInputRef.current.click(); }}
                                style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fff', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                              >
                                <UploadCloud size={16} />
                              </button>
                            </div>
                          </div>

                          {/* Image Thumbnails Previews */}
                          {pageCount > 0 && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
                              {pages.map((page, idx) => (
                                <div 
                                  key={page.id}
                                  onClick={() => setPreviewImage(page)}
                                  style={{ 
                                    width: '48px', height: '48px', borderRadius: '8px', 
                                    border: '1px solid #a7f3d0', overflow: 'hidden', flexShrink: 0,
                                    cursor: 'pointer', position: 'relative', backgroundColor: '#fff',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                  }}
                                >
                                  {page.isPdf ? (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '10px', fontWeight: 'bold' }}>PDF</div>
                                  ) : (
                                    <img src={page.url} alt={page.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  )}
                                  <button
                                    onClick={(e) => handleDeletePage(doc.id, page.id, e)}
                                    style={{
                                      position: 'absolute', top: 0, right: 0,
                                      backgroundColor: 'rgba(239, 68, 68, 0.95)', color: 'white',
                                      border: 'none', width: '16px', height: '16px',
                                      borderBottomLeftRadius: '4px', display: 'flex',
                                      alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                      padding: 0
                                    }}
                                  >
                                    <X size={10} strokeWidth={3} />
                                  </button>
                                  <div style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '9px', padding: '1px 4px', borderTopLeftRadius: '4px' }}>
                                    {idx + 1}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )})}
                    </div>

                    <button 
                      className="btn-primary" 
                      onClick={() => setModalStep(3)}
                      disabled={!isDocumentVerified}
                      style={{ 
                        opacity: !isDocumentVerified ? 0.5 : 1,
                        marginTop: 'auto',
                        backgroundColor: !isDocumentVerified ? '#94a3b8' : ''
                      }}
                    >
                      {isDocumentVerified ? (
                        <>Next: Property Details <ChevronRight size={18} /></>
                      ) : (
                        <>Complete AI Verification First (Auto-Extract)</>
                      )}
                    </button>
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
                    <option value="Apartment">Apartment</option>
                    <option value="Independent House">Independent House</option>
                    <option value="Open Agriculture Land">Open Agriculture Land</option>
                    <option value="Open Site">Open Site</option>
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
                      <option value="Corner plot">Corner plot</option>
                      <option value="Intermediary plot">Intermediary plot</option>
                    </select>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Type of Road <span style={{ color: '#ef4444' }}>*</span></label>
                    <select value={propertyDetails.roadType} onChange={e => setPropertyDetails({...propertyDetails, roadType: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', backgroundColor: 'white' }}>
                      <option value="">Select...</option>
                      <option value="CC Road">CC Road</option>
                      <option value="BT">BT</option>
                      <option value="Metal">Metal</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Type of Structure <span style={{ color: '#ef4444' }}>*</span></label>
                    <select value={propertyDetails.structureType} onChange={e => setPropertyDetails({...propertyDetails, structureType: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', backgroundColor: 'white' }}>
                      <option value="">Select...</option>
                      <option value="Load bearing">Load bearing</option>
                      <option value="Framed structure">Framed structure</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Type of Flooring <span style={{ color: '#ef4444' }}>*</span></label>
                  <select value={propertyDetails.flooringType} onChange={e => setPropertyDetails({...propertyDetails, flooringType: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', backgroundColor: 'white' }}>
                    <option value="">Select...</option>
                    <option value="Granite">Granite</option>
                    <option value="Tiles">Tiles</option>
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
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                          {Object.values(uploadedDocs).flat().map((page, idx) => (
                            <div key={page.id} onClick={() => setPreviewImage(page)} style={{ width: '40px', height: '40px', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', backgroundColor: '#fff' }}>
                              {page.isPdf ? (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '9px', fontWeight: 'bold' }}>PDF</div>
                              ) : (
                                <img src={page.url} alt={page.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              )}
                            </div>
                          ))}
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

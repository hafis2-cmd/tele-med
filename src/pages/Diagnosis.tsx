import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { 
  Upload, 
  Camera, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Image as ImageIcon, 
  X, 
  Activity, 
  FileText, 
  Scan,
  Crown,
  ArrowRight,
  Sparkles,
  HelpCircle,
  ArrowLeft,
  Check,
  Mic,
  MicOff,
  Share2,
  Copy,
  ExternalLink,
  Lock,
  Clock,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { analyzeSymptoms, parseMedicalReport, getTriageNextQuestion } from '../services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { DISEASE_CATEGORIES } from '../constants';

export default function Diagnosis() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const preselectedEmail = location.state?.patientEmail || location.state?.targetPatientEmail || location.state?.targetEmail;
  const preselectedName = location.state?.patientName || location.state?.targetPatientName || location.state?.targetName;

  const [targetPatient, setTargetPatient] = useState<{ email: string; name: string } | null>(
    preselectedEmail ? { email: preselectedEmail, name: preselectedName || preselectedEmail.split('@')[0] } : null
  );

  const [disease, setDisease] = useState('General');
  const [symptoms, setSymptoms] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [testValues, setTestValues] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAnalyzingRef = useRef(false);

  // Sharing diagnostic findings states
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareDuration, setShareDuration] = useState<'1_hour' | '24_hours' | '3_days' | '7_days'>('24_hours');
  const [selectedPhysicianEmail, setSelectedPhysicianEmail] = useState('');
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [generatedShareLink, setGeneratedShareLink] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Load doctors on component mount for direct physician sharing option
  useEffect(() => {
    async function loadDoctorsList() {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'Doctor'));
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDoctorsList(docs);
      } catch (err) {
        console.error("Error loading doctors:", err);
      }
    }
    loadDoctorsList();
  }, []);

  const handleGenerateShareLink = async () => {
    if (!result) return;
    setIsSharing(true);
    setShareError(null);
    setGeneratedShareLink('');

    try {
      const now = new Date();
      let expiresAt = new Date();
      if (shareDuration === '1_hour') {
        expiresAt.setHours(now.getHours() + 1);
      } else if (shareDuration === '24_hours') {
        expiresAt.setDate(now.getDate() + 1);
      } else if (shareDuration === '3_days') {
        expiresAt.setDate(now.getDate() + 3);
      } else if (shareDuration === '7_days') {
        expiresAt.setDate(now.getDate() + 7);
      }

      const patientEmail = targetPatient ? targetPatient.email : (profile?.email || 'anonymous@telemed.ai');
      const patientName = targetPatient ? targetPatient.name : (profile?.name || (profile?.email ? profile.email.split('@')[0] : 'Patient'));

      const shareDocData = {
        patientEmail,
        patientName,
        doctorEmail: selectedPhysicianEmail || null,
        condition: result.condition || "Potential Condition Detected",
        risk: result.confidence_score || 85,
        explanation: result.explanation || "No explanation provided.",
        recommendations: result.recommendations || [],
        expiresAt: expiresAt,
        createdAt: now
      };

      // Add to shared_diagnoses collection
      const docRef = await addDoc(collection(db, 'shared_diagnoses'), shareDocData);

      // Also push to standard diagnoses collection so the doctor can view it in their history directly
      try {
        await addDoc(collection(db, 'diagnoses'), {
          patientEmail,
          condition: result.condition || "Potential Condition Detected",
          risk: result.confidence_score || 85,
          explanation: result.explanation || "No explanation provided.",
          timestamp: serverTimestamp(),
          feature_importance: result.feature_importance || []
        });
      } catch (diagErr) {
        console.warn("Could not write duplicate to diagnoses collection:", diagErr);
      }
      
      const shareUrl = `${window.location.origin}/shared-diagnosis/${docRef.id}`;
      setGeneratedShareLink(shareUrl);
    } catch (err: any) {
      console.error("Error storing shared diagnosis:", err);
      setShareError("Failed to register access link. Please try again.");
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedShareLink) return;
    navigator.clipboard.writeText(generatedShareLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Voice-to-text dictation states
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition is not supported in this browser. Please use a modern browser like Google Chrome, Apple Safari, or Microsoft Edge with microphone permissions enabled.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert("Microphone permission was denied. Please update your browser permissions to allow microphone access on this website.");
        } else if (event.error === 'no-speech') {
          // No speech detected, handle gracefully without alert
        } else {
          alert(`Speech recognition issue: ${event.error}`);
        }
        setIsListening(false);
      };

      rec.onresult = (event: any) => {
        const results = event.results;
        const transcript = results[results.length - 1][0].transcript;
        if (transcript) {
          setSymptoms(prev => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${transcript.trim()}` : transcript.trim();
          });
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error("Failed to start SpeechRecognition:", err);
      setIsListening(false);
    }
  };

  // Smart Triage Mode States
  const [isSmartTriage, setIsSmartTriage] = useState(true); // Default to on for high engagement
  const [triageStep, setTriageStep] = useState(0); // 0: Config/Text, 1..4: Interactive questions
  const [triageHistory, setTriageHistory] = useState<any[]>([]);
  const [currentTriageQuestion, setCurrentTriageQuestion] = useState<any>(null);
  const [isTriageLoading, setIsTriageLoading] = useState(false);
  const [triageCustomAnswer, setTriageCustomAnswer] = useState('');
  const [triageError, setTriageError] = useState<string | null>(null);

  const totalTriageSteps = 4;

  const resetTriage = () => {
    setTriageStep(0);
    setTriageHistory([]);
    setCurrentTriageQuestion(null);
    setTriageCustomAnswer('');
    setTriageError(null);
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    const emeraldColor = [16, 185, 129];
    const charcoalColor = [15, 23, 42];
    const lightGrayColor = [248, 250, 252];
    const textDarkColor = [30, 41, 59];
    const textMutedColor = [100, 116, 139];

    let y = 20;

    // Top Header line
    doc.setFillColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
    doc.rect(margin, y, contentWidth, 3, 'F');
    y += 10;

    // Title / Clinic Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(charcoalColor[0], charcoalColor[1], charcoalColor[2]);
    doc.text("MediClinic AI", margin, y);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
    doc.text("INTELLIGENT HEALTH ASSESSMENT & DIAGNOSIS", margin, y + 5);

    // Metadata block
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(textMutedColor[0], textMutedColor[1], textMutedColor[2]);
    const dateStr = `Report Date: ${new Date().toLocaleDateString()}`;
    const timeStr = `Time: ${new Date().toLocaleTimeString()}`;
    doc.text(dateStr, pageWidth - margin, y, { align: 'right' });
    doc.text(timeStr, pageWidth - margin, y + 4, { align: 'right' });

    y += 15;

    // Draw separator line
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Patient Info section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(charcoalColor[0], charcoalColor[1], charcoalColor[2]);
    doc.text("PATIENT INFORMATION & CLINICAL METRICS", margin, y);
    
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(textDarkColor[0], textDarkColor[1], textDarkColor[2]);
    doc.text(`Patient Account: ${profile?.email || 'Guest User'}`, margin, y);
    
    const selectedCategoryDisplay = DISEASE_CATEGORIES.find((cat: any) => cat.id === disease)?.name || disease;
    doc.text(`Symptom Category: ${selectedCategoryDisplay}`, margin + 90, y);
    
    y += 10;
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;

    // Primary Diagnosis Block
    doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
    doc.rect(margin, y, contentWidth, 32, 'F');
    doc.setFillColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
    doc.rect(margin, y, 2.5, 32, 'F');

    // Text inside primary block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
    doc.text("PRIMARY PREDICTED CONDITION:", margin + 6, y + 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(charcoalColor[0], charcoalColor[1], charcoalColor[2]);
    doc.text(result.condition || "Potential Condition Detected", margin + 6, y + 17);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(textDarkColor[0], textDarkColor[1], textDarkColor[2]);
    doc.text("AI Confidence Level: ", margin + 6, y + 25);
    
    doc.setFont("helvetica", "bold");
    doc.text(`${result.confidence_score}%`, margin + 43, y + 25);

    const scoreText = result.confidence_score > 80 ? 'HIGH CLINICAL MATCH' : result.confidence_score > 50 ? 'MODERATE CLINICAL MATCH' : 'INVESTIGATIVE INDICATION';
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(textMutedColor[0], textMutedColor[1], textMutedColor[2]);
    doc.text(`(${scoreText})`, margin + 54, y + 25);

    y += 42;

    // Detailed clinical explanation
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(charcoalColor[0], charcoalColor[1], charcoalColor[2]);
    doc.text("Symptom Interpretation & Assessment Details", margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(textDarkColor[0], textDarkColor[1], textDarkColor[2]);

    const explanationLines = doc.splitTextToSize(result.explanation || "No explanation provided.", contentWidth);
    doc.text(explanationLines, margin, y);
    y += (explanationLines.length * 5) + 8;

    // Feature Importance section if present and has length
    if (result.feature_importance && result.feature_importance.length > 0) {
      if (y > pageHeight - 60) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(charcoalColor[0], charcoalColor[1], charcoalColor[2]);
      doc.text("Contributing Physical & Symptomatic Factors:", margin, y);
      y += 6;

      result.feature_importance.forEach((item: any) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(textDarkColor[0], textDarkColor[1], textDarkColor[2]);
        const impactPct = Math.round((item.impact || 0) * 100);
        doc.text(`• ${item.feature || 'Factor'}`, margin + 4, y);
        
        doc.setFont("helvetica", "bold");
        doc.text(`${impactPct}% influence`, pageWidth - margin - 35, y);
        y += 5.5;
      });
      y += 6;
    }

    // Recommendations section
    if (result.recommendations && result.recommendations.length > 0) {
      if (y > pageHeight - 65) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(charcoalColor[0], charcoalColor[1], charcoalColor[2]);
      doc.text("Patient Recommendations & Next Action Steps", margin, y);
      y += 6;

      result.recommendations.forEach((rec: string, idx: number) => {
        const recText = `${idx + 1}. ${rec}`;
        const recLines = doc.splitTextToSize(recText, contentWidth - 6);
        
        if (y + (recLines.length * 5) > pageHeight - 35) {
          doc.addPage();
          y = 20;
        }

        doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
        doc.rect(margin, y, contentWidth, (recLines.length * 5) + 4, 'F');

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(textDarkColor[0], textDarkColor[1], textDarkColor[2]);
        doc.text(recLines, margin + 4, y + 4.5);
        
        y += (recLines.length * 5) + 7;
      });
      y += 4;
    }

    // Disclaimer Box
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(254, 243, 199);
    doc.rect(margin, y, contentWidth, 24, 'F');
    doc.setDrawColor(251, 191, 36);
    doc.rect(margin, y, contentWidth, 24, 'D');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(146, 64, 14);
    doc.text("IMPORTANT CLINICAL DISCLAIMER:", margin + 5, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 53, 4);
    const disclaimerText = "This clinical assessment reports a premium preliminary model projection. This analysis is completely automated for informational purposes only. It is not an alternative for authorized physical medical prescription, diagnostic determination, or hands-on clinical care from a physical doctor. Seek an accredited medical physician or hospital system in support of any acute health questions or emergency conditions.";
    const disclaimerLines = doc.splitTextToSize(disclaimerText, contentWidth - 10);
    doc.text(disclaimerLines, margin + 5, y + 9);

    y += 32;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(textMutedColor[0], textMutedColor[1], textMutedColor[2]);
    doc.text("Secure AI clinical analysis generated under license. Confidential HIPAA-compliant template format.", margin, y);

    const filename = `AI_Diagnostic_Report_${result.condition?.replace(/[^a-z0-9]/gi, '_') || 'Report'}.pdf`;
    doc.save(filename);
  };

  const isSubscribed = profile?.subscribed || profile?.role === 'Admin';

  React.useEffect(() => {
    setTestValues({});
  }, [disease]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSubscribed) return;
    const file = e.target.files?.[0];
    if (file) {
      // Use createObjectURL for preview performance
      const url = URL.createObjectURL(file);
      setImage(url);
      
      // Keep base64 for AI processing if needed, or convert on demand
      const reader = new FileReader();
      reader.onloadend = () => {
        // We'll store the base64 in a ref or local variable when needed for AI
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOCR = async () => {
    if (!image) return;
    setIsScanning(true);
    try {
      // Convert current image URL back to base64 for API if it's a blob URL
      let base64 = image;
      if (image.startsWith('blob:')) {
        const response = await fetch(image);
        const blob = await response.blob();
        base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      const parsedData = await parseMedicalReport(base64, disease);
      const symptomsText = Object.entries(parsedData)
        .map(([key, val]) => `${key}: ${val}`)
        .join(', ');
      setSymptoms(prev => prev ? `${prev}\n\nExtracted from report: ${symptomsText}` : `Extracted from report: ${symptomsText}`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsScanning(false);
    }
  };

  const startTriageSession = async () => {
    if (!symptoms.trim()) {
      setTriageError("Please describe your initial symptoms first to start the Smart Triage.");
      return;
    }
    setTriageError(null);
    setIsTriageLoading(true);
    setTriageStep(1);
    try {
      const response = await getTriageNextQuestion(disease, symptoms, []);
      setCurrentTriageQuestion(response);
    } catch (err: any) {
      console.error(err);
      setTriageError("Failed to initialize Smart Triage. Please try again or use standard diagnostic mode.");
      setTriageStep(0);
    } finally {
      setIsTriageLoading(false);
    }
  };

  const submitTriageAnswer = async (answerText: string) => {
    if (!answerText.trim()) return;
    setTriageError(null);

    const updatedHistory = [
      ...triageHistory,
      { question: currentTriageQuestion?.question || "Question", answer: answerText }
    ];
    setTriageHistory(updatedHistory);
    setTriageCustomAnswer('');

    const nextStep = triageStep + 1;
    if (nextStep > totalTriageSteps) {
      // Complete triage and execute final assessment code
      await runFinalTriageAnalysis(updatedHistory);
    } else {
      setTriageStep(nextStep);
      setIsTriageLoading(true);
      try {
        const response = await getTriageNextQuestion(disease, symptoms, updatedHistory);
        setCurrentTriageQuestion(response);
      } catch (err) {
        console.error(err);
        setTriageError("Could not retrieve next triage question. Performing clinical assessment of current symptoms.");
        await runFinalTriageAnalysis(updatedHistory);
      } finally {
        setIsTriageLoading(false);
      }
    }
  };

  const runFinalTriageAnalysis = async (historyToUse = triageHistory) => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    setTriageError(null);
    try {
      const testValuesStr = Object.entries(testValues)
        .filter(([_, val]) => val.trim() !== '')
        .map(([key, val]) => `${key}: ${val}`)
        .join(', ');

      let base64 = image;
      if (image && image.startsWith('blob:')) {
        const response = await fetch(image);
        const blob = await response.blob();
        base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      const data = await analyzeSymptoms(symptoms, base64 || undefined, disease, testValuesStr, historyToUse);
      setResult(data);

      if (profile || targetPatient) {
        try {
          await addDoc(collection(db, 'diagnoses'), {
            patientEmail: targetPatient ? targetPatient.email : (profile?.email || 'anonymous@telemed.ai'),
            condition: data.condition,
            risk: data.confidence_score,
            explanation: data.explanation,
            feature_importance: data.feature_importance || [],
            timestamp: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'diagnoses');
        }
      }
      
      // End triage step session visually
      setTriageStep(0);
    } catch (error) {
      console.error(error);
      setTriageError("An error occurred during diagnostic analysis.");
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    if (isAnalyzingRef.current) return;
    if (!symptoms && !image && Object.keys(testValues).length === 0) return;
    
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    try {
      const testValuesStr = Object.entries(testValues)
        .filter(([_, val]) => val.trim() !== '')
        .map(([key, val]) => `${key}: ${val}`)
        .join(', ');

      // Convert current image URL back to base64 for API if it's a blob URL
      let base64 = image;
      if (image && image.startsWith('blob:')) {
        const response = await fetch(image);
        const blob = await response.blob();
        base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      const data = await analyzeSymptoms(symptoms, base64 || undefined, disease, testValuesStr, []);
      setResult(data);

      // Save to Firestore
      if (profile || targetPatient) {
        try {
          await addDoc(collection(db, 'diagnoses'), {
            patientEmail: targetPatient ? targetPatient.email : (profile?.email || 'anonymous@telemed.ai'),
            condition: data.condition,
            risk: data.confidence_score,
            explanation: data.explanation,
            feature_importance: data.feature_importance || [],
            timestamp: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'diagnoses');
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 relative">
      {!isSubscribed && (
        <div className="absolute inset-0 z-40 bg-white/60 backdrop-blur-md rounded-[3rem] flex items-center justify-center p-8 text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 space-y-6"
          >
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
              <Crown className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">Premium Feature</h2>
              <p className="text-slate-500 font-medium">
                AI-powered diagnosis and report scanning are exclusive to premium subscribers.
              </p>
            </div>
            <button 
              onClick={() => navigate('/subscription')}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
            >
              Upgrade Now
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      )}
      {targetPatient && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-200/50 px-2.5 py-0.5 rounded-full inline-block">
                  Quick-Start Triage Session
                </span>
              </div>
              <h3 className="font-bold text-slate-800 mt-1">
                Active Assessment for: <span className="text-emerald-700">{targetPatient.name}</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">{targetPatient.email}</p>
            </div>
          </div>
          <div>
            <button
              onClick={() => {
                setTargetPatient(null);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Cancel Triage / Self-Diagnose
            </button>
          </div>
        </motion.div>
      )}

      <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-8", !isSubscribed && "blur-sm pointer-events-none select-none")}>
        {/* Input Section */}
        <section className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-emerald-500" />
              Diagnosis Configuration
            </h2>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Select Disease Category</label>
              <select 
                value={disease}
                disabled={triageStep > 0}
                onChange={(e) => {
                  setDisease(e.target.value);
                  resetTriage();
                }}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {DISEASE_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Smart Triage Toggle Card */}
            <div className="p-4 bg-emerald-50/50 border border-emerald-100/60 rounded-xl flex items-center justify-between">
              <div className="space-y-0.5 pr-2">
                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600 animate-pulse" /> RECOMMENDED
                </span>
                <p className="text-sm font-bold text-slate-800 mt-1">Smart Triage Mode</p>
                <p className="text-xs text-slate-500 leading-normal">Solve dynamic sequence of questions generated in real-time by AI to pinpoint symptoms accurately.</p>
              </div>
              <button
                type="button"
                disabled={triageStep > 0}
                onClick={() => {
                  setIsSmartTriage(!isSmartTriage);
                  resetTriage();
                }}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50",
                  isSmartTriage ? "bg-emerald-600" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                    isSmartTriage ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>

          {isSmartTriage && triageStep > 0 ? (
            /* ACTIVE SMART TRIAGE INTERACTIVE WIZARD SCREEN */
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full -mr-6 -mt-6" />
              
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg uppercase tracking-wide">
                      Triage Active
                    </span>
                    <span className="text-xs text-slate-500 font-semibold font-mono">
                      Step {triageStep} of {totalTriageSteps}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">Interactive Assessment</h3>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-emerald-600 font-mono">
                    {Math.round((triageStep / totalTriageSteps) * 100)}% Complete
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(triageStep / totalTriageSteps) * 100}%` }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                />
              </div>

              {triageError && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-rose-700 text-xs leading-normal">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <div>{triageError}</div>
                </div>
              )}

              {isTriageLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
                    <Sparkles className="w-6 h-6 text-emerald-500 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-extrabold text-slate-800">Consulting AI Assistant...</p>
                    <p className="text-xs text-slate-400 max-w-xs leading-normal mx-auto">Gemini is evaluating symptom history to compose targeted clinic-level questions.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Dynamic Question Display */}
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 relative">
                    <div className="absolute top-4 left-4 w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <div className="pl-11 space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Question {triageStep}</p>
                      <h4 className="text-base font-black text-slate-800 leading-snug">
                        {currentTriageQuestion?.question || "Could you describe this symptom in more detail?"}
                      </h4>
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1">Select an answer:</p>
                    <div className="grid grid-cols-1 gap-2.5">
                      {currentTriageQuestion?.options?.map((option: string, index: number) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => submitTriageAnswer(option)}
                          className="w-full p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 text-left font-bold text-sm text-slate-700 shadow-sm hover:shadow-md transition-all flex items-center justify-between group bg-white"
                        >
                          <span className="flex-1 pr-2 leading-relaxed">{option}</span>
                          <span className="w-6 h-6 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 border border-slate-100 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                            <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-all" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Input Field */}
                  {currentTriageQuestion?.canDescribe && (
                    <div className="space-y-2.5 border-t border-slate-100 pt-5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 block">
                        Or specify custom details:
                      </label>
                      <div className="flex gap-2.5">
                        <input
                          type="text"
                          value={triageCustomAnswer}
                          onChange={(e) => setTriageCustomAnswer(e.target.value)}
                          placeholder="Type your custom response here..."
                          className="flex-1 p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-medium"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitTriageAnswer(triageCustomAnswer);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => submitTriageAnswer(triageCustomAnswer)}
                          disabled={!triageCustomAnswer.trim()}
                          className="px-5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Summary of Answered Questions */}
                  {triageHistory.length > 0 && (
                    <div className="border-t border-slate-100 pt-5 space-y-3">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Symptoms Summary so far:</p>
                      <div className="max-h-36 overflow-y-auto space-y-2.5 pr-1 divide-y divide-slate-100/60">
                        {triageHistory.map((h, i) => (
                          <div key={i} className="pt-2 text-[12px] leading-relaxed">
                            <p className="text-slate-500 font-semibold">Q: {h.question}</p>
                            <p className="text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                              <Check className="w-3 h-3 block" /> {h.answer}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Wizard Footer Navigation */}
                  <div className="flex items-center justify-between pt-5 border-t border-slate-100 mt-6">
                    <button
                      type="button"
                      onClick={resetTriage}
                      className="text-xs font-black text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" /> Restart Triage
                    </button>
                    <button
                      type="button"
                      onClick={() => runFinalTriageAnalysis()}
                      disabled={isAnalyzing}
                      className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all shadow-md flex items-center gap-1.5"
                    >
                      {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                      Diagnose Now ({triageHistory.length} Answered)
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* STANDARD INPUT MODE OR INITIAL SMART TRIAGE STATE */
            <>
              {triageError && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-rose-700 text-xs shadow-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <div>{triageError}</div>
                </div>
              )}

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <h2 className="text-base font-bold flex items-center gap-2 text-slate-800">
                    <FileText className="w-4.5 h-4.5 text-emerald-500" />
                    {isSmartTriage ? "What Symptoms are You Experiencing?" : "Describe Symptoms or OCR"}
                  </h2>
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border outline-none cursor-pointer self-start sm:self-auto",
                      isListening
                        ? "bg-rose-50 text-rose-600 border-rose-200 shadow-sm animate-pulse"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    )}
                  >
                    {isListening ? (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                        </span>
                        <Mic className="w-3.5 h-3.5 text-rose-600 animate-bounce" />
                        <span>Stop listening</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-slate-500" />
                        <span>Voice-to-Text</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder={
                      isSmartTriage 
                        ? "Describe your main complaint in detail to initiate custom triage follow-up questions... (e.g., 'Severe abdominal cramps since yesterday')" 
                        : disease === 'General' ? "e.g. I have a persistent cough..." : `Specific symptoms related to ${disease}...`
                    }
                    className="w-full h-40 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none outline-none pr-28 text-sm font-medium leading-relaxed shadow-inner"
                  />
                  {isListening && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-rose-50/90 backdrop-blur-sm rounded-lg border border-rose-200 text-[9px] font-black tracking-wider text-rose-600 uppercase animate-pulse select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                      Speak now...
                    </div>
                  )}
                </div>
              </div>

              {/* Medical Test Values (Only in standard mode) */}
              {!isSmartTriage && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-500" />
                    Medical Test Values
                  </h2>
                  <p className="text-sm text-slate-500">Enter values from your latest medical report for more accurate analysis.</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {disease === 'General' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Body Temp (°C)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            placeholder="e.g. 37.0"
                            value={testValues.temp || ''}
                            onChange={(e) => setTestValues({...testValues, temp: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Heart Rate (BPM)</label>
                          <input 
                            type="number" 
                            placeholder="e.g. 72"
                            value={testValues.hr || ''}
                            onChange={(e) => setTestValues({...testValues, hr: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Oxygen (SpO2 %)</label>
                          <input 
                            type="number" 
                            placeholder="e.g. 98"
                            value={testValues.spo2 || ''}
                            onChange={(e) => setTestValues({...testValues, spo2: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                      </>
                    )}

                    {disease === 'Diabetes' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Fasting Sugar (mg/dL)</label>
                          <input 
                            type="number" 
                            placeholder="e.g. 95"
                            value={testValues.fastingSugar || ''}
                            onChange={(e) => setTestValues({...testValues, fastingSugar: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">HbA1c (%)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            placeholder="e.g. 5.7"
                            value={testValues.hba1c || ''}
                            onChange={(e) => setTestValues({...testValues, hba1c: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Postprandial (mg/dL)</label>
                          <input 
                            type="number" 
                            placeholder="e.g. 140"
                            value={testValues.ppSugar || ''}
                            onChange={(e) => setTestValues({...testValues, ppSugar: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">BMI (kg/m²)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            placeholder="e.g. 24.5"
                            value={testValues.bmi || ''}
                            onChange={(e) => setTestValues({...testValues, bmi: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                      </>
                    )}

                    {disease === 'Breast Cancer' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Tumor Size (mm)</label>
                          <input 
                            type="number" 
                            placeholder="e.g. 15"
                            value={testValues.tumorSize || ''}
                            onChange={(e) => setTestValues({...testValues, tumorSize: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Mitotic Count (1-10)</label>
                          <input 
                            type="number" 
                            placeholder="e.g. 3"
                            value={testValues.mitoticCount || ''}
                            onChange={(e) => setTestValues({...testValues, mitoticCount: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Lymph Nodes (+/-)</label>
                          <select 
                            value={testValues.lymphNodes || ''}
                            onChange={(e) => setTestValues({...testValues, lymphNodes: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          >
                            <option value="">Select</option>
                            <option value="Positive">Positive</option>
                            <option value="Negative">Negative</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">HER2 Status</label>
                          <select 
                            value={testValues.her2 || ''}
                            onChange={(e) => setTestValues({...testValues, her2: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          >
                            <option value="">Select</option>
                            <option value="Positive">Positive</option>
                            <option value="Negative">Negative</option>
                          </select>
                        </div>
                      </>
                    )}

                    {disease === 'Heart Disease' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">BP (Systolic)</label>
                          <input 
                            type="number" 
                            placeholder="e.g. 120"
                            value={testValues.bpSystolic || ''}
                            onChange={(e) => setTestValues({...testValues, bpSystolic: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">BP (Diastolic)</label>
                          <input 
                            type="number" 
                            placeholder="e.g. 80"
                            value={testValues.bpDiastolic || ''}
                            onChange={(e) => setTestValues({...testValues, bpDiastolic: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">LDL (mg/dL)</label>
                          <input 
                            type="number" 
                            placeholder="e.g. 100"
                            value={testValues.ldl || ''}
                            onChange={(e) => setTestValues({...testValues, ldl: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">HDL (mg/dL)</label>
                          <input 
                            type="number" 
                            placeholder="e.g. 50"
                            value={testValues.hdl || ''}
                            onChange={(e) => setTestValues({...testValues, hdl: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Triglycerides</label>
                          <input 
                            type="number" 
                            placeholder="e.g. 150"
                            value={testValues.triglycerides || ''}
                            onChange={(e) => setTestValues({...testValues, triglycerides: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                      </>
                    )}

                    {disease === 'Skin Condition' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Lesion Size (mm)</label>
                          <input 
                            type="number" 
                            placeholder="e.g. 5"
                            value={testValues.lesionSize || ''}
                            onChange={(e) => setTestValues({...testValues, lesionSize: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Duration (Days)</label>
                          <input 
                            type="number" 
                            placeholder="e.g. 7"
                            value={testValues.duration || ''}
                            onChange={(e) => setTestValues({...testValues, duration: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Itchiness (1-10)</label>
                          <input 
                            type="number" 
                            min="1"
                            max="10"
                            placeholder="e.g. 4"
                            value={testValues.itchiness || ''}
                            onChange={(e) => setTestValues({...testValues, itchiness: e.target.value})}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Upload Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Camera className="w-5 h-5 text-emerald-500" />
                  Image Scanning (New)
                </h2>
                <p className="text-sm text-slate-500">Upload a photo of the affected area or medical report for OCR extraction and context.</p>
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="relative aspect-video rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all cursor-pointer flex items-center justify-center overflow-hidden group"
                >
                  {image ? (
                    <>
                      <img src={image} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleOCR(); }}
                          disabled={isScanning}
                          className="p-3 bg-white text-emerald-600 rounded-xl hover:bg-emerald-50 transition-all flex items-center gap-2 font-bold text-sm"
                        >
                          {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                          Scan Report
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setImage(null); }}
                          className="p-3 bg-white text-rose-500 rounded-xl hover:bg-rose-50 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center space-y-2">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto group-hover:text-emerald-500 transition-colors" />
                      <p className="text-sm font-medium text-slate-600">Click to upload or drag and drop</p>
                      <p className="text-xs text-slate-400">PNG, JPG up to 10MB</p>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  className="hidden" 
                  accept="image/*" 
                />
              </div>

              {/* Submit / Trigger Button */}
              {isSmartTriage ? (
                <button
                  onClick={startTriageSession}
                  disabled={isAnalyzing || isTriageLoading || !symptoms.trim()}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-200 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  {isTriageLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Initializing Smart Triage assistant...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                      Start Interactive Smart Triage
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || (!symptoms && !image && Object.keys(testValues).length === 0)}
                  className="w-full py-4 bg-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing with Gemini AI...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Start Standard Analysis
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </section>

        {/* Results Section */}
        <section className="relative min-h-[400px]">
          <AnimatePresence mode="wait">
            {!result && !isAnalyzing ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-3xl"
              >
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Activity className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-800">No Analysis Yet</h3>
                <p className="text-slate-500 max-w-xs mx-auto mt-2">
                  Enter your symptoms or upload an image to receive an AI-powered preliminary diagnosis.
                </p>
              </motion.div>
            ) : isAnalyzing ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border border-slate-200 shadow-sm"
              >
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mt-6">Processing Data</h3>
                <p className="text-slate-500 mt-2">Our AI is cross-referencing medical databases...</p>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Download PDF Action Bar */}
                <div className="flex items-center justify-between pb-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Your Diagnostic Report</h3>
                    <p className="text-xs text-slate-400 font-medium">Generated via intelligent clinical assessment</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={handleDownloadPDF}
                      className="flex items-center gap-2 px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-100 transition-all hover:scale-[1.02]"
                    >
                      <FileText className="w-4 h-4" />
                      Download Report
                    </button>
                    <button
                      onClick={() => {
                        setIsShareModalOpen(true);
                        setGeneratedShareLink('');
                        setShareError(null);
                      }}
                      className="flex items-center gap-2 px-4.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-800 border border-slate-200 text-xs font-bold rounded-xl shadow-sm transition-all hover:scale-[1.02]"
                    >
                      <Share2 className="w-4 h-4 text-emerald-600" />
                      Share Findings
                    </button>
                  </div>
                </div>

                {/* 1. Condition Prediction Card */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -mr-8 -mt-8 blur-2xl" />
                  <div className="flex items-center gap-3 text-emerald-600 font-bold text-xs uppercase tracking-[0.2em]">
                    <Activity className="w-4 h-4" />
                    AI Assessment
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                    {result.condition || "Potential Condition Detected"}
                  </h3>
                  <p className="text-slate-600 text-lg font-medium leading-relaxed">
                    {result.explanation}
                  </p>
                </div>

                {/* 2. Confidence Score Card */}
                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-slate-200 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-bl-[8rem] -mr-16 -mt-16 blur-3xl" />
                  <div className="relative z-10 space-y-6">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-emerald-400 font-black text-xs uppercase tracking-[0.2em]">AI Confidence Level</p>
                        <h4 className="text-4xl font-black">{result.confidence_score}%</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Reliability</p>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                          result.confidence_score > 80 ? "bg-emerald-500 text-white" : 
                          result.confidence_score > 50 ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
                        )}>
                          {result.confidence_score > 80 ? 'High' : result.confidence_score > 50 ? 'Moderate' : 'Low'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-white/10 rounded-full overflow-hidden border border-white/5 p-1">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${result.confidence_score}%` }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className={cn(
                            "h-full rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]",
                            result.confidence_score > 80 ? "bg-emerald-500" : 
                            result.confidence_score > 50 ? "bg-amber-500" : "bg-rose-500"
                          )}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium italic">
                        * This score represents how certain the AI is based on the provided symptoms and data.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Actionable Recommendations Card */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Recommended Next Steps
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {result.recommendations?.map((rec: string, i: number) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-emerald-50 hover:border-emerald-100 transition-all"
                      >
                        <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all font-black text-xs">
                          {i + 1}
                        </div>
                        <p className="text-slate-700 font-bold text-sm leading-relaxed pt-1.5">
                          {rec}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* 4. Medical Disclaimer */}
                <div className="bg-amber-50/50 p-8 rounded-[2.5rem] border border-amber-100/50 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-amber-200/20 rounded-br-full -ml-8 -mt-8 blur-xl" />
                  <div className="relative z-10 flex gap-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-black text-amber-900 text-sm uppercase tracking-widest">Medical Disclaimer</h4>
                      <p className="text-xs text-amber-800/70 leading-relaxed font-medium">
                        This analysis is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Secure Diagnostic Link Share Modal */}
          <AnimatePresence>
            {isShareModalOpen && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl max-w-lg w-full p-8 space-y-6 relative overflow-hidden"
                >
                  <button 
                    onClick={() => setIsShareModalOpen(false)}
                    className="absolute top-6 right-6 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <Lock className="w-4 h-4 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest">HiPAA Encrypted Link</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Secure Report Share</h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Generate a time-limited secure URL to let physical medical professionals decrypt and view this diagnostic assessment directly.
                    </p>
                  </div>

                  {!generatedShareLink ? (
                    <div className="space-y-5">
                      {/* Select Duration */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-emerald-600" />
                          Link Active Duration
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {(['1_hour', '24_hours', '3_days', '7_days'] as const).map((duration) => (
                            <button
                              key={duration}
                              type="button"
                              onClick={() => setShareDuration(duration)}
                              className={cn(
                                "py-2.5 px-2 text-[10px] font-bold rounded-xl border transition-all cursor-pointer text-center capitalize",
                                shareDuration === duration 
                                  ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm shadow-emerald-50"
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                              )}
                            >
                              {duration.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Select Doctor */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600 flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-emerald-600" />
                          Associate with Primary Physician (Optional)
                        </label>
                        <select
                          value={selectedPhysicianEmail}
                          onChange={(e) => setSelectedPhysicianEmail(e.target.value)}
                          className="w-full text-xs font-bold bg-slate-50 hover:bg-slate-100/70 border border-slate-200 text-slate-700 rounded-xl p-3 outline-none transition-all cursor-pointer"
                        >
                          <option value="">Do not associate (Link share only)</option>
                          {doctorsList.map((doc: any) => (
                            <option key={doc.id} value={doc.email}>
                              Dr. {doc.name || doc.email.split('@')[0]} ({doc.specialty || 'General Practitioner'})
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-400 font-medium italic">
                          * Selecting a physician securely assigns this diagnosis history entry to their patient records workspace automatically.
                        </p>
                      </div>

                      {shareError && (
                        <div className="p-3.5 bg-rose-50 rounded-xl text-rose-600 text-[10px] font-bold border border-rose-100 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {shareError}
                        </div>
                      )}

                      <button
                        onClick={handleGenerateShareLink}
                        disabled={isSharing}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-250 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-100/40 transition-all flex items-center justify-center gap-2"
                      >
                        {isSharing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Locking down payload keys...
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            Generate Secure Link
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 text-emerald-800 text-xs font-semibold flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-emerald-950 mb-1">Link Encrypted Successfully!</p>
                          <p className="text-[11px] text-emerald-700 leading-relaxed font-semibold">
                            Your temporary secure physician portal link is generated and ready. Copy the link below and share it directly with your primary medical doctor.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500">Secure Direct Access Link</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={generatedShareLink}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 outline-none font-mono"
                          />
                          <button
                            onClick={handleCopyLink}
                            className={cn(
                              "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0",
                              isCopied 
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                                : "bg-slate-900 hover:bg-slate-800 text-white"
                            )}
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {isCopied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-slate-500 leading-relaxed">
                        <div className="flex items-center gap-2 text-slate-700 text-xs font-bold">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          Compliance Metrics
                        </div>
                        <p className="text-[10px] font-semibold">
                          • Automatic link expiry will trigger after the requested duration.
                        </p>
                        <p className="text-[10px] font-semibold">
                          • Record keys remain completely encrypted on our compliant document storage servers.
                        </p>
                      </div>

                      <button
                        onClick={() => setIsShareModalOpen(false)}
                        className="w-full py-4.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-all cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}

function Stethoscope(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

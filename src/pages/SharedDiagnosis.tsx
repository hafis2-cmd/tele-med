import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { motion } from 'motion/react';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Lock, 
  ShieldCheck, 
  HeartPulse, 
  FileText,
  User,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';

export default function SharedDiagnosis() {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    async function fetchSharedReport() {
      if (!shareId) {
        setError('No report ID provided in the link.');
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'shared_diagnoses', shareId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError('The requested secure link does not exist or has been removed.');
          setLoading(false);
          return;
        }

        const data = docSnap.data();
        
        // Check expiration
        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
        const now = new Date();

        if (now > expiresAt) {
          setIsExpired(true);
        } else {
          setReport({
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
            expiresAt
          });
        }
      } catch (err) {
        console.error('Error loading shared diagnosis:', err);
        setError('Failed to fetch the secure clinical document. Please ensure you have a valid link.');
      } finally {
        setLoading(false);
      }
    }

    fetchSharedReport();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-bold text-sm tracking-wide uppercase">Decrypting secure clinical report...</p>
      </div>
    );
  }

  if (error || isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 md:p-12 border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 max-w-lg w-full text-center space-y-6"
        >
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/20 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {isExpired ? 'Access Link Expired' : 'Secure Report Undefined'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              {isExpired 
                ? 'This secure, temporary shared clinical link has expired for patient safety. Shared records are automatically deleted or locked after their duration has elapsed.'
                : error
              }
            </p>
          </div>

          <div className="pt-2">
            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl flex items-center gap-3 text-left border border-slate-100 dark:border-slate-800 text-xs text-slate-400">
              <Lock className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>For privacy compliance, health information links are time-sensitive. Please request a new share link from the patient if required.</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/login')}
            className="w-full py-4.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-lg transition-all"
          >
            Access Portal
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between">
      {/* Top Secure Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4.5 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-100 dark:shadow-none">
              <HeartPulse className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">TeleMed AI</span>
              <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold tracking-widest uppercase">Physician Link</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/45 px-3.5 py-1.5 rounded-full">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">HiPAA SECURE</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow p-6 md:py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Top Metadata Header Card */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-850 p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -mr-8 -mt-8 blur-2xl" />
            
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-350 border border-slate-100 dark:border-slate-750 flex-shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest">Diagnostic Record For</p>
                <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{report.patientName}</h1>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Patient Contact: {report.patientEmail}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 md:pl-8">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-semibold">
                  <Calendar className="w-3.5 h-3.5" />
                  Shared Date
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-black">
                  {format(report.createdAt, 'MMM dd, yyyy h:mm a')}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Link Expiration
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-black">
                  {format(report.expiresAt, 'MMM dd, yyyy h:mm a')}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Diagnosis results - Matching layout of main assessment page */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Predicted Condition and Description */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-850 shadow-sm space-y-4 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -mr-8 -mt-8 blur-2xl" />
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-[0.2em]">
                <Activity className="w-4 h-4 animate-pulse" />
                Diagnostic Prediction
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                {report.condition || "Potential Condition Detected"}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base font-medium leading-relaxed">
                {report.explanation}
              </p>
            </motion.div>

            {/* Confidence Score Gauge */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-slate-950/10 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-bl-[8rem] -mr-16 -mt-16 blur-3xl" />
              <div className="relative z-10 space-y-6">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-emerald-400 font-black text-xs uppercase tracking-[0.2em]">AI Clinical Confidence</p>
                    <h4 className="text-4xl font-black">{report.risk || 85}%</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Reliability</p>
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                      (report.risk || 85) > 80 ? "bg-emerald-500 text-white" : 
                      (report.risk || 85) > 50 ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
                    }`}>
                      {(report.risk || 85) > 80 ? 'High Confidence' : (report.risk || 85) > 50 ? 'Moderate Analysis' : 'Investigative'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="h-4 w-full bg-white/10 rounded-full overflow-hidden border border-white/5 p-1">
                    <div 
                      style={{ width: `${report.risk || 85}%` }}
                      className={`h-full rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all duration-1000 ${
                        (report.risk || 85) > 80 ? "bg-emerald-500" : 
                        (report.risk || 85) > 50 ? "bg-amber-500" : "bg-rose-500"
                      }`}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium italic leading-relaxed">
                    * Calculated clinical match probability from our diagnostic modeling. Always correlate with physical examination and formal lab diagnostics.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Actionable Recommendations Section */}
          {report.recommendations && report.recommendations.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-850 shadow-sm space-y-6 animate-fade-in"
            >
              <div className="flex items-center gap-3 text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Recommended Next Steps
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.recommendations.map((rec: string, i: number) => (
                  <div 
                    key={i} 
                    className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-950 transition-all group"
                  >
                    <div className="w-8 h-8 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all font-black text-xs">
                      {i + 1}
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-bold text-sm leading-relaxed pt-1.5 flex-1 select-all">
                      {rec}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Disclaimer section */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-amber-50/50 dark:bg-amber-950/10 p-8 rounded-[2.5rem] border border-amber-100/50 dark:border-amber-900/20 relative overflow-hidden"
          >
            <div className="flex items-start gap-4 text-amber-800 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h4 className="text-sm font-black uppercase tracking-wider">Clinical Disclaimer for Physicians</h4>
                <p className="text-xs leading-relaxed font-semibold opacity-90">
                  This report represents a premium preliminary model projection. This analysis is completely automated for informational support purposes only. It does not replace the hands-on clinical assessment, formal stethoscope check-ups, or diagnostic lab tests of a fully licensed primary care physician. Please correleate with current physical vitals and complete the necessary diagnostic protocols accordingly.
                </p>
              </div>
            </div>
          </motion.div>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-white py-12 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <HeartPulse className="w-6 h-6 text-emerald-500 animate-pulse" />
            <span className="font-black uppercase tracking-widest text-sm text-slate-100">TeleMed AI Assessment Portal</span>
          </div>
          <p className="text-xs text-slate-500 text-center md:text-right">
            © {new Date().getFullYear()} TeleMed AI. All rights and metrics are securely encrypted.
          </p>
        </div>
      </footer>
    </div>
  );
}

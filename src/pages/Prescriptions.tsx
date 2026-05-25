import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Plus, 
  Search, 
  Calendar, 
  User, 
  Stethoscope, 
  Pill, 
  Clock, 
  Info, 
  Download, 
  ChevronRight,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
  Image as ImageIcon,
  Upload,
  Type
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface Prescription {
  id: string;
  patientEmail: string;
  patientName: string;
  doctorName: string;
  doctorEmail: string;
  date: string;
  medications: Medication[];
  notes: string;
  prescriptionImage?: string;
  timestamp: any;
}

export default function Prescriptions() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (location.state?.patientEmail) {
      setShowAddModal(true);
    }
  }, [location.state]);

  useEffect(() => {
    if (!user || !profile) return;

    let q;
    if (profile.role === 'Doctor') {
      q = query(
        collection(db, 'prescriptions'),
        where('doctorEmail', '==', user.email),
        orderBy('timestamp', 'desc')
      );
    } else if (profile.role === 'Admin') {
      q = query(
        collection(db, 'prescriptions'),
        orderBy('timestamp', 'desc')
      );
    } else {
      q = query(
        collection(db, 'prescriptions'),
        where('patientEmail', '==', user.email),
        orderBy('timestamp', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Prescription[];
      setPrescriptions(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'prescriptions');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, profile]);

  const filteredPrescriptions = prescriptions.filter(p => 
    p.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.medications.some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">Prescriptions</h1>
          <p className="text-slate-500 font-medium">View and manage medical prescriptions and medication schedules.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search prescriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all w-64 shadow-sm"
            />
          </div>
          
          {profile?.role === 'Doctor' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            >
              <Plus className="w-4 h-4" />
              New Prescription
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
          <p className="text-slate-500 font-medium">Loading prescriptions...</p>
        </div>
      ) : filteredPrescriptions.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-12 text-center space-y-4 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
            <FileText className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-800">No prescriptions found</h3>
            <p className="text-slate-500 max-w-xs mx-auto">
              {searchQuery ? "No prescriptions match your search criteria." : "You don't have any prescriptions yet."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrescriptions.map((prescription) => (
            <motion.div
              layoutId={prescription.id}
              key={prescription.id}
              onClick={() => setSelectedPrescription(prescription)}
              className="group bg-white p-6 rounded-[2rem] border border-slate-200 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-50/50 transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-[3rem] -mr-8 -mt-8 transition-all group-hover:bg-emerald-100" />
              
              <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 line-clamp-1">
                      {profile?.role === 'Doctor' ? prescription.patientName : `Dr. ${prescription.doctorName}`}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <Calendar className="w-3 h-3" />
                      {prescription.date}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Medications</p>
                  <div className="flex flex-wrap gap-2">
                    {prescription.medications.slice(0, 2).map((med, idx) => (
                      <span key={idx} className="px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-[10px] font-bold border border-slate-100">
                        {med.name}
                      </span>
                    ))}
                    {prescription.medications.length > 2 && (
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold border border-emerald-100">
                        +{prescription.medications.length - 2} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-slate-50">
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    View Details
                    <ChevronRight className="w-3 h-3" />
                  </span>
                  <Download className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedPrescription && (
          <PrescriptionDetailModal 
            prescription={selectedPrescription} 
            onClose={() => setSelectedPrescription(null)} 
          />
        )}
        {showAddModal && (
          <AddPrescriptionModal 
            onClose={() => setShowAddModal(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PrescriptionDetailModal({ prescription, onClose }: { prescription: Prescription, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Prescription Details</h2>
              <p className="text-sm text-slate-500 font-medium">Issued on {prescription.date}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-200">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
              <div className="flex items-center gap-3 text-emerald-600">
                <User className="w-5 h-5" />
                <h3 className="font-bold uppercase text-xs tracking-widest">Patient Information</h3>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{prescription.patientName}</p>
                <p className="text-sm text-slate-500">{prescription.patientEmail}</p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
              <div className="flex items-center gap-3 text-emerald-600">
                <Stethoscope className="w-5 h-5" />
                <h3 className="font-bold uppercase text-xs tracking-widest">Doctor Information</h3>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">Dr. {prescription.doctorName}</p>
                <p className="text-sm text-slate-500">{prescription.doctorEmail}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Pill className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-800">Medications</h3>
            </div>
            {prescription.medications && prescription.medications.length > 0 ? (
              <div className="space-y-4">
                {prescription.medications.map((med, idx) => (
                  <div key={idx} className="p-6 bg-white rounded-[2rem] border border-slate-200 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-bold text-slate-800">{med.name}</h4>
                      <span className="px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black uppercase tracking-wider">
                        {med.dosage}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Frequency</p>
                          <p className="text-sm font-bold text-slate-700">{med.frequency}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</p>
                          <p className="text-sm font-bold text-slate-700">{med.duration}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Instructions</p>
                      <p className="text-sm text-slate-600 font-medium italic">"{med.instructions}"</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 text-center">
                <p className="text-sm text-slate-400 font-medium">No structured medication data provided.</p>
              </div>
            )}
          </div>

          {prescription.prescriptionImage && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-800">Prescription Image</h3>
              </div>
              <div className="rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm">
                <img 
                  src={prescription.prescriptionImage} 
                  alt="Prescription" 
                  className="w-full h-auto object-contain max-h-[500px]"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}

          {prescription.notes && (
            <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100 space-y-3">
              <div className="flex items-center gap-3 text-indigo-600">
                <Info className="w-5 h-5" />
                <h3 className="font-bold uppercase text-xs tracking-widest">Doctor's Notes</h3>
              </div>
              <p className="text-sm text-indigo-900 leading-relaxed font-medium">
                {prescription.notes}
              </p>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
          <button className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200">
            <Download className="w-5 h-5" />
            Download PDF
          </button>
          <button 
            onClick={onClose}
            className="px-8 py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AddPrescriptionModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const location = useLocation();
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'write' | 'upload'>('write');

  const [formData, setFormData] = useState({
    patientEmail: location.state?.patientEmail || '',
    patientName: location.state?.patientName || '',
    notes: '',
    prescriptionImage: '',
    medications: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for Firestore document
        setError('Image size must be less than 1MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, prescriptionImage: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const addMedication = () => {
    setFormData({
      ...formData,
      medications: [...formData.medications, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
    });
  };

  const removeMedication = (index: number) => {
    if (formData.medications.length === 1) return;
    const newMeds = formData.medications.filter((_, i) => i !== index);
    setFormData({ ...formData, medications: newMeds });
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const newMeds = [...formData.medications];
    newMeds[index] = { ...newMeds[index], [field]: value };
    setFormData({ ...formData, medications: newMeds });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setError('');

    try {
      const prescriptionData = {
        patientEmail: formData.patientEmail,
        patientName: formData.patientName,
        notes: formData.notes,
        doctorName: user.displayName || 'Doctor',
        doctorEmail: user.email,
        date: new Date().toISOString().split('T')[0],
        timestamp: serverTimestamp()
      };

      if (mode === 'write') {
        Object.assign(prescriptionData, { medications: formData.medications });
      } else {
        Object.assign(prescriptionData, { prescriptionImage: formData.prescriptionImage });
      }

      await addDoc(collection(db, 'prescriptions'), prescriptionData);

      setSuccess(true);
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save prescription');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
              <Plus className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">New Prescription</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {success ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">Prescription Issued!</h3>
              <p className="text-slate-500">The patient will be notified immediately.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <div className="p-4 bg-rose-50 text-rose-600 text-sm font-medium rounded-2xl border border-rose-100 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Patient Name</label>
                  <input
                    type="text"
                    required
                    value={formData.patientName}
                    onChange={(e) => setFormData({...formData, patientName: e.target.value})}
                    placeholder="Full Name"
                    className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Patient Email</label>
                  <input
                    type="email"
                    required
                    value={formData.patientEmail}
                    onChange={(e) => setFormData({...formData, patientEmail: e.target.value})}
                    placeholder="email@example.com"
                    className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setMode('write')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                    mode === 'write' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <Type className="w-4 h-4" />
                  Write Prescription
                </button>
                <button
                  type="button"
                  onClick={() => setMode('upload')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                    mode === 'upload' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <ImageIcon className="w-4 h-4" />
                  Upload Image
                </button>
              </div>

              {mode === 'write' ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Pill className="w-5 h-5 text-emerald-500" />
                      Medications
                    </h3>
                    <button
                      type="button"
                      onClick={addMedication}
                      className="text-xs font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors"
                    >
                      + Add Medication
                    </button>
                  </div>

                  <div className="space-y-6">
                    {formData.medications.map((med, idx) => (
                      <div key={idx} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4 relative">
                        {formData.medications.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMedication(idx)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Medicine Name</label>
                            <input
                              type="text"
                              required
                              value={med.name}
                              onChange={(e) => updateMedication(idx, 'name', e.target.value)}
                              className="w-full p-3 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dosage</label>
                            <input
                              type="text"
                              required
                              value={med.dosage}
                              onChange={(e) => updateMedication(idx, 'dosage', e.target.value)}
                              placeholder="e.g. 500mg"
                              className="w-full p-3 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Frequency</label>
                            <input
                              type="text"
                              required
                              value={med.frequency}
                              placeholder="e.g. Twice a day"
                              onChange={(e) => updateMedication(idx, 'frequency', e.target.value)}
                              className="w-full p-3 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Duration</label>
                            <input
                              type="text"
                              required
                              value={med.duration}
                              placeholder="e.g. 7 days"
                              onChange={(e) => updateMedication(idx, 'duration', e.target.value)}
                              className="w-full p-3 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Instructions</label>
                          <input
                            type="text"
                            value={med.instructions}
                            placeholder="e.g. Take after meals"
                            onChange={(e) => updateMedication(idx, 'instructions', e.target.value)}
                            className="w-full p-3 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-emerald-500" />
                    Upload Prescription Image
                  </h3>
                  
                  <div className="relative group">
                    {formData.prescriptionImage ? (
                      <div className="relative rounded-[2rem] overflow-hidden border-2 border-emerald-500 shadow-lg">
                        <img 
                          src={formData.prescriptionImage} 
                          alt="Preview" 
                          className="w-full h-64 object-contain bg-slate-50"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, prescriptionImage: '' })}
                          className="absolute top-4 right-4 p-2 bg-rose-500 text-white rounded-full shadow-lg hover:bg-rose-600 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50 hover:bg-slate-100 hover:border-emerald-300 transition-all cursor-pointer group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-emerald-500 shadow-sm transition-all mb-4">
                            <Upload className="w-8 h-8" />
                          </div>
                          <p className="mb-2 text-sm text-slate-700 font-bold">Click to upload prescription</p>
                          <p className="text-xs text-slate-400 font-medium">PNG, JPG or PDF (MAX. 1MB)</p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleImageUpload}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Additional Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Any additional advice or instructions..."
                  className="w-full h-32 p-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {isSaving ? 'Issuing Prescription...' : 'Issue Prescription'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

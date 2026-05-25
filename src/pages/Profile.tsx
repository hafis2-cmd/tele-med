import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  Mail, 
  Calendar, 
  Activity, 
  Droplet, 
  AlertTriangle, 
  FileText, 
  Save, 
  Loader2,
  CheckCircle2,
  Edit3,
  X,
  Shield,
  Lock,
  ChevronDown,
  ChevronUp,
  Info,
  BrainCircuit,
  Bell,
  Stethoscope,
  Award,
  MapPin,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { getProfileExplanation, ProfileExplanation } from '../services/explanationService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider 
} from 'firebase/auth';
import { AnimatePresence } from 'motion/react';

export default function Profile() {
  const { user, profile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [explanation, setExplanation] = useState<ProfileExplanation | null>(null);
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: '',
    bloodGroup: '',
    allergies: '',
    medicalHistory: '',
    newsletter: false,
    role: '',
    specialty: '',
    bio: '',
    location: '',
    experience: '',
    image: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        age: profile.age?.toString() || '',
        gender: profile.gender || '',
        bloodGroup: profile.bloodGroup || '',
        allergies: profile.allergies || '',
        medicalHistory: profile.medicalHistory || '',
        newsletter: profile.newsletter || false,
        role: profile.role || '',
        specialty: profile.specialty || '',
        bio: profile.bio || '',
        location: profile.location || '',
        experience: profile.experience?.toString() || '',
        image: profile.image || profile.photoURL || ''
      });
    }
  }, [profile]);

  const handleNewsletterToggle = async () => {
    if (!user) return;
    const newValue = !formData.newsletter;
    
    // Update local state immediately for responsiveness
    setFormData(prev => ({ ...prev, newsletter: newValue }));
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { newsletter: newValue });
    } catch (error) {
      console.error('Error updating newsletter status:', error);
      // Revert local state if DB update fails
      setFormData(prev => ({ ...prev, newsletter: !newValue }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const { serverTimestamp: serverTs } = await import('firebase/firestore');
      const updateData: any = {
        ...formData,
        age: formData.age ? parseInt(formData.age) : null,
        experience: formData.experience ? parseInt(formData.experience) : null,
        photoURL: formData.image,
        updatedAt: serverTs()
      };
      
      // Only include role if it's actually changed and user has permission
      // The firestore rules will enforce this anyway
      if (formData.role === profile?.role) {
        delete updateData.role;
      }

      await updateDoc(userRef, updateData);
      setSaveSuccess(true);
      setIsEditing(false);
      
      // Generate explanation after save
      setIsGeneratingExplanation(true);
      try {
        const exp = await getProfileExplanation(formData);
        setExplanation(exp);
        setShowExplanation(true);
      } catch (err) {
        console.error('Failed to generate explanation:', err);
      } finally {
        setIsGeneratingExplanation(false);
      }

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">{profile?.role || 'User'} Profile</h1>
          <p className="text-slate-500 font-medium">Manage your personal information and account settings.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${
              isEditing 
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100'
            }`}
          >
            {isEditing ? (
              <>
                <X className="w-4 h-4" />
                Cancel Editing
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4" />
                Edit Profile
              </>
            )}
          </button>
          
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-bold border border-emerald-100">
            <Shield className="w-4 h-4" />
            Securely Stored
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-4">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-black text-3xl border-4 border-white shadow-inner overflow-hidden">
              {formData.image ? (
                <img src={formData.image} alt={formData.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                profile?.email?.[0].toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{formData.name || 'Anonymous User'}</h2>
              <p className="text-sm text-slate-500">{profile?.email}</p>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              You are Online
            </div>

            <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider">
              {profile?.role}
            </div>
            
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 p-3 text-sm font-bold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all border border-slate-100"
            >
              <Lock className="w-4 h-4" />
              Change Password
            </button>
          </div>

          <div className="bg-emerald-600 p-6 rounded-[2rem] text-white space-y-4 shadow-xl shadow-emerald-100">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6" />
              <h3 className="font-bold">Health Summary</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-emerald-100">Blood Group</span>
                <span className="font-bold">{formData.bloodGroup || 'Not Set'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-emerald-100">Age</span>
                <span className="font-bold">{formData.age || 'Not Set'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-emerald-100">Gender</span>
                <span className="font-bold">{formData.gender || 'Not Set'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-500" />
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  disabled={!isEditing}
                  placeholder="Enter your full name"
                  className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  Age
                </label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                  disabled={!isEditing}
                  placeholder="Years"
                  className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-emerald-500" />
                  Blood Group
                </label>
                <select
                  value={formData.bloodGroup}
                  onChange={(e) => setFormData({...formData, bloodGroup: e.target.value})}
                  disabled={!isEditing}
                  className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                  disabled={!isEditing}
                  className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-500" />
                  Profile Image URL
                </label>
                <input
                  type="url"
                  value={formData.image}
                  onChange={(e) => setFormData({...formData, image: e.target.value})}
                  disabled={!isEditing}
                  placeholder="https://example.com/your-image.jpg"
                  className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Allergies
              </label>
              <textarea
                value={formData.allergies}
                onChange={(e) => setFormData({...formData, allergies: e.target.value})}
                disabled={!isEditing}
                placeholder="List any allergies (e.g. Penicillin, Peanuts)"
                className="w-full h-24 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                Medical History
              </label>
              <textarea
                value={formData.medicalHistory}
                onChange={(e) => setFormData({...formData, medicalHistory: e.target.value})}
                disabled={!isEditing}
                placeholder="Briefly describe your medical history, past surgeries, or chronic conditions."
                className="w-full h-32 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {profile?.role === 'Doctor' && (
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <h3 className="text-lg font-black text-slate-800">Professional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-emerald-500" />
                      Specialty
                    </label>
                    <input
                      type="text"
                      value={formData.specialty}
                      onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                      disabled={!isEditing}
                      placeholder="e.g. Cardiologist"
                      className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-500" />
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      value={formData.experience}
                      onChange={(e) => setFormData({...formData, experience: e.target.value})}
                      disabled={!isEditing}
                      placeholder="Years"
                      className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                    Clinic Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    disabled={!isEditing}
                    placeholder="e.g. Central City Medical Center"
                    className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-500" />
                    Professional Biography
                  </label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({...formData, bio: e.target.value})}
                    disabled={!isEditing}
                    placeholder="Describe your professional background and expertise..."
                    className="w-full h-32 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            )}

            {/* Role Management */}
            <div className="pt-4 border-t border-slate-100">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">Account Role</h4>
                      <p className="text-xs text-slate-500">Your current access level: <span className="font-bold text-emerald-600">{profile?.role}</span></p>
                    </div>
                  </div>
                  
                  {profile?.role === 'Admin' && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Privileges</span>
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    </div>
                  )}
                </div>

                {profile?.role === 'Admin' && isEditing ? (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Change Role</p>
                    <div className="grid grid-cols-3 gap-3">
                      {['Patient', 'Doctor', 'Admin'].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setFormData({ ...formData, role: r })}
                          className={cn(
                            "py-3 rounded-xl border font-bold text-xs transition-all flex flex-col items-center gap-1",
                            formData.role === r 
                              ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                          )}
                        >
                          {r}
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            formData.role === r ? "bg-emerald-400" : "bg-transparent"
                          )} />
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-amber-600 font-medium italic">
                      Warning: Changing your role to Patient or Doctor will remove your Admin privileges.
                    </p>
                  </div>
                ) : profile?.role !== 'Admin' && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <p className="text-xs text-slate-500 font-medium">Role changes are restricted to administrators.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Newsletter Subscription */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">Newsletter Subscription</h4>
                    <p className="text-xs text-slate-500">Receive health tips and platform updates</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleNewsletterToggle}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    formData.newsletter ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      formData.newsletter ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>

            {isEditing && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                type="submit"
                disabled={isSaving || isGeneratingExplanation}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200 disabled:opacity-50"
              >
                {isSaving || isGeneratingExplanation ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : saveSuccess ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {isSaving ? 'Saving Changes...' : isGeneratingExplanation ? 'Analyzing Health Data...' : saveSuccess ? 'Profile Updated!' : 'Save Profile Details'}
              </motion.button>
            )}

            {explanation && (
              <div className="mt-8 border-t border-slate-100 pt-8">
                <button
                  type="button"
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                      <BrainCircuit className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-slate-800">Health Data Insights</h3>
                      <p className="text-xs text-slate-500">AI-powered analysis of your profile factors</p>
                    </div>
                  </div>
                  {showExplanation ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                <AnimatePresence>
                  {showExplanation && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 space-y-6">
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-3">
                          <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          <p className="text-sm text-emerald-800 leading-relaxed">
                            {explanation.summary}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          {explanation.features.map((feat, idx) => (
                            <div key={idx} className="p-4 rounded-2xl border border-slate-100 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-700">{feat.feature}</span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  feat.impact === 'Positive' ? 'bg-emerald-100 text-emerald-700' :
                                  feat.impact === 'Negative' ? 'bg-rose-100 text-rose-700' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {feat.impact} Impact
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-1000 ${
                                    feat.impact === 'Positive' ? 'bg-emerald-500' :
                                    feat.impact === 'Negative' ? 'bg-rose-500' :
                                    'bg-slate-400'
                                  }`}
                                  style={{ width: `${Math.abs(feat.score) * 100}%` }}
                                />
                              </div>
                              <p className="text-xs text-slate-500 leading-relaxed italic">
                                {feat.reasoning}
                              </p>
                            </div>
                          ))}
                        </div>
                        
                        <p className="text-[10px] text-slate-400 text-center italic">
                          Disclaimer: This analysis is for informational purposes only and does not constitute medical advice.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </form>
        </div>
      </div>

      <AnimatePresence>
        {showPasswordModal && (
          <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return "Password must be at least 8 characters long";
    if (!/[A-Z]/.test(pass)) return "Password must contain at least one uppercase letter";
    if (!/[0-9]/.test(pass)) return "Password must contain at least one number";
    if (!/[!@#$%^&*]/.test(pass)) return "Password must contain at least one special character (!@#$%^&*)";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const complexityError = validatePassword(newPassword);
    if (complexityError) {
      setError(complexityError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("No user logged in");

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      
      setSuccess(true);
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password') {
        setError("Current password is incorrect");
      } else if (err.code === 'auth/requires-recent-login') {
        setError("Please log out and log back in to change your password");
      } else {
        setError(err.message || "Failed to update password. Note: This feature requires an email/password account.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Change Password</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {success ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="text-emerald-600 font-bold">Password updated successfully!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-4 bg-rose-50 text-rose-600 text-sm font-medium rounded-2xl border border-rose-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {isLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Star, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  MessageSquare, 
  Award, 
  BookOpen, 
  Clock,
  ChevronRight,
  X,
  Loader2,
  Stethoscope,
  Heart,
  ShieldCheck,
  CheckCircle2,
  Video
} from 'lucide-react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DoctorProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  specialty?: string;
  bio?: string;
  location?: string;
  experience?: number;
  rating?: number;
  reviews?: number;
  image?: string;
  education?: string[];
  languages?: string[];
  availability?: string;
  isOnline?: boolean;
  lastSeen?: any;
}

export default function Doctors() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'Doctor');
        
        if (error) throw error;
        setDoctors((data || []).map((d: any) => ({ id: d.id, ...d })));
      } catch (err) {
        console.error("Error fetching doctors:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();

    const channel = supabase
      .channel('doctors-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: 'role=eq.Doctor' }, () => {
        fetchDoctors();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredDoctors = doctors.filter(doc => {
    const matchesSearch = (doc.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                         (doc.specialty?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'All' || doc.specialty === filter;
    return matchesSearch && matchesFilter;
  });

  const specialties = ['All', ...new Set(doctors.map(d => d.specialty).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="text-slate-500 font-medium">Loading medical professionals...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-5xl font-black text-slate-800 tracking-tight">Doctor Profiles</h1>
          <p className="text-slate-500 text-lg font-medium">Connect with our network of certified specialists and healthcare providers.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl w-full sm:w-80 focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-12 pr-10 py-4 bg-white border border-slate-200 rounded-2xl appearance-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm font-bold text-slate-700"
            >
              {specialties.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Doctors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredDoctors.length > 0 ? (
          filteredDoctors.map((doctor) => (
            <div
              key={doctor.id}
              onClick={() => setSelectedDoctor(doctor)}
              className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl shadow-slate-100 cursor-pointer group"
            >
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div className="relative">
                    <div className="w-20 h-20 bg-slate-100 rounded-3xl overflow-hidden border-4 border-white shadow-lg flex items-center justify-center text-slate-400 font-black text-2xl">
                      {doctor.image ? (
                        <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        (doctor.name || 'D').charAt(0).toUpperCase()
                      )}
                    </div>
                    {doctor.isOnline && (
                      <div className="absolute top-0 right-0 w-5 h-5 bg-emerald-500 rounded-full border-4 border-white shadow-sm animate-pulse z-10" />
                    )}
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center text-white border-2 border-white shadow-lg">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50 px-3 py-1.5 rounded-full">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="text-sm font-black text-amber-700">{doctor.rating || '5.0'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight group-hover:text-emerald-600 transition-colors">
                    Dr. {doctor.name || 'Specialist'}
                  </h3>
                  <p className="text-emerald-600 font-bold text-sm uppercase tracking-widest">
                    {doctor.specialty || 'General Practitioner'}
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-3 text-slate-500">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-medium">{doctor.location || 'TeleMed Virtual Clinic'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">{doctor.experience || '10+'} Years Experience</span>
                  </div>
                </div>

                <button className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold group-hover:bg-emerald-600 group-hover:text-white transition-all flex items-center justify-center gap-2">
                  View Profile
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">No doctors found</h3>
            <p className="text-slate-500">Try adjusting your search or filters to find what you're looking for.</p>
          </div>
        )}
      </div>

      {/* Doctor Detail Modal */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div
            className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
              <div className="relative h-48 bg-emerald-600 overflow-hidden shrink-0">
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -mr-32 -mt-32" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full -ml-24 -mb-24" />
                </div>
                <button 
                  onClick={() => setSelectedDoctor(null)}
                  className="absolute top-6 right-6 p-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl backdrop-blur-md transition-all z-10"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="px-12 pb-12 -mt-20 relative flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col md:flex-row gap-10">
                  <div className="w-48 h-48 bg-white rounded-[2.5rem] p-2 shadow-2xl shrink-0">
                    <div className="w-full h-full bg-slate-100 rounded-[2rem] overflow-hidden flex items-center justify-center text-slate-400 text-4xl font-black">
                      {selectedDoctor.image ? (
                        <img src={selectedDoctor.image} alt={selectedDoctor.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        (selectedDoctor.name || 'D').charAt(0).toUpperCase()
                      )}
                    </div>
                  </div>

                  <div className="pt-24 md:pt-24 space-y-6 flex-1">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h2 className="text-4xl font-black text-slate-800 tracking-tight">Dr. {selectedDoctor.name}</h2>
                        {selectedDoctor.isOnline ? (
                          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Online
                          </div>
                        ) : selectedDoctor.lastSeen && (
                          <div className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-wider">
                            Last seen: {new Date(selectedDoctor.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        <ShieldCheck className="w-8 h-8 text-emerald-500" />
                      </div>
                      <p className="text-xl text-emerald-600 font-bold uppercase tracking-widest">{selectedDoctor.specialty || 'General Practitioner'}</p>
                    </div>

                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-full border border-amber-100">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-black text-amber-700">{selectedDoctor.rating || '5.0'} ({selectedDoctor.reviews || '120+'} Reviews)</span>
                      </div>
                      <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                        <Clock className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-black text-emerald-700">{selectedDoctor.experience || '10+'} Years Exp.</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mt-12">
                  <div className="lg:col-span-2 space-y-10">
                    <section className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800">Biography</h3>
                      </div>
                      <p className="text-slate-600 leading-relaxed font-medium">
                        {selectedDoctor.bio || `Dr. ${selectedDoctor.name} is a highly skilled medical professional with over ${selectedDoctor.experience || '10'} years of experience in ${selectedDoctor.specialty || 'general medicine'}. They are dedicated to providing compassionate care and utilizing the latest medical advancements to ensure the best outcomes for their patients.`}
                      </p>
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                          <Award className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800">Education & Certifications</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(selectedDoctor.education || ['Medical Doctorate (MD)', 'Board Certified Specialist', 'Residency in Internal Medicine']).map((edu, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-bold text-slate-700">{edu}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-8">
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl shadow-slate-200">
                      <h3 className="text-xl font-black">Contact Information</h3>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                            <Mail className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Email Address</p>
                            <p className="text-sm font-bold">{selectedDoctor.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                            <Phone className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Phone Number</p>
                            <p className="text-sm font-bold">+1 (555) 000-0000</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Location</p>
                            <p className="text-sm font-bold">{selectedDoctor.location || 'TeleMed Virtual Clinic'}</p>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => navigate('/consultation', { state: { targetEmail: selectedDoctor.email, targetName: `Dr. ${selectedDoctor.name}` }})}
                        className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                      >
                        <Video className="w-5 h-5" />
                        Call Now
                      </button>
                      <button className="w-full py-4 bg-white/10 text-white border border-white/20 rounded-2xl font-bold hover:bg-white/20 transition-all flex items-center justify-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Book Appointment
                      </button>
                    </div>

                    <div className="bg-emerald-50 rounded-[2.5rem] p-8 border border-emerald-100 space-y-4">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="w-5 h-5 text-emerald-600" />
                        <h4 className="font-bold text-slate-800">Direct Message</h4>
                      </div>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Have a quick question? Start a secure chat with Dr. {(selectedDoctor.name || 'Specialist').split(' ')[0]}.
                      </p>
                      <button 
                        onClick={() => navigate(`/messages?with=${selectedDoctor.email}`)}
                        className="w-full py-3 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-bold hover:bg-emerald-100 transition-all"
                      >
                        Start Chat
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  Clock, 
  Calendar, 
  Search, 
  Filter,
  MoreVertical,
  Video,
  ChevronRight,
  User,
  History,
  X,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useNavigate } from 'react-router-dom';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function CallHistory() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing' | 'missed'>('all');

  useEffect(() => {
    if (!profile?.email) return;

    const fetchCalls = async () => {
      try {
        const { data, error } = await supabase
          .from('call_history')
          .select('*')
          .contains('participants', [profile.email])
          .order('start_time', { ascending: false })
          .limit(50);
        
        if (error) throw error;
        setCalls((data || []).map((d: any) => ({ id: d.id, callerEmail: d.caller_email, callerName: d.caller_name, receiverEmail: d.receiver_email, receiverName: d.receiver_name, startTime: d.start_time, duration: d.duration, status: d.status, participants: d.participants, ...d })));
      } catch (err) {
        console.error('Error fetching call history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCalls();

    const channel = supabase
      .channel('call-history-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_history' }, () => {
        fetchCalls();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.email]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown Date';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Unknown Time';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredCalls = calls.filter(call => {
    const isCaller = call.callerEmail === profile?.email;
    const matchesSearch = (isCaller ? call.receiverName : call.callerName)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (isCaller ? call.receiverEmail : call.callerEmail)?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'all') return matchesSearch;
    if (filter === 'incoming') return matchesSearch && !isCaller && call.status !== 'missed';
    if (filter === 'outgoing') return matchesSearch && isCaller;
    if (filter === 'missed') return matchesSearch && call.status === 'missed';
    return matchesSearch;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">Call History</h1>
          <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-xs flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-500" />
            Your past consultations and calls
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/consultation')}
            className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
          >
            <Video className="w-4 h-4" />
            New Consultation
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-slate-700"
            />
          </div>
          
          <div className="flex p-1 bg-slate-100 rounded-2xl w-full md:w-auto">
            {['all', 'incoming', 'outgoing', 'missed'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={cn(
                  "flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                  filter === f ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-200 animate-pulse flex items-center gap-4">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-100 rounded w-1/4" />
                <div className="h-3 bg-slate-100 rounded w-1/6" />
              </div>
            </div>
          ))
        ) : filteredCalls.length > 0 ? (
          <div className="grid gap-4">
            {filteredCalls.map((call) => {
              const isCaller = call.callerEmail === profile?.email;
              const otherName = isCaller ? call.receiverName : call.callerName;
              const otherEmail = isCaller ? call.receiverEmail : call.callerEmail;
              const isMissed = call.status === 'missed';
              const isDoctorRole = profile?.role === 'Doctor';
              
              return (
                <motion.div 
                  key={call.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center relative",
                        isMissed ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-600"
                      )}>
                        {isMissed ? (
                          <PhoneIncoming className="w-7 h-7" />
                        ) : isCaller ? (
                          <PhoneOutgoing className="w-7 h-7" />
                        ) : (
                          <PhoneIncoming className="w-7 h-7" />
                        )}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-black text-slate-800 tracking-tight">{otherName}</h3>
                          {isMissed && (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[8px] font-black rounded-md uppercase tracking-widest">
                              Missed
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(call.startTime)}
                          </span>
                          <span className="w-1 h-1 bg-slate-200 rounded-full" />
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(call.startTime)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <div className="text-xs font-black text-slate-800 mb-1">
                          {isMissed ? '-- : --' : formatDuration(call.duration)}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          Duration
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => navigate('/consultation', { state: { targetEmail: otherEmail, targetName: otherName }})}
                          className="p-3 bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all"
                          title="Call back"
                        >
                          <Video className="w-5 h-5" />
                        </button>
                        {isDoctorRole && (
                          <button 
                            onClick={() => navigate('/prescriptions')}
                            className="p-3 bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all"
                            title="Write Prescription"
                          >
                            <FileText className="w-5 h-5" />
                          </button>
                        )}
                        <button className="p-3 bg-slate-50 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white py-20 px-8 rounded-[3rem] border-2 border-dashed border-slate-100 text-center space-y-6">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
              <History className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">No Call History</h3>
              <p className="text-slate-400 font-medium max-w-sm mx-auto">
                Consultations you've completed or missed will appear here. Start your first consultation today.
              </p>
            </div>
            <button 
              onClick={() => navigate('/doctors')}
              className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 mx-auto shadow-xl shadow-slate-200"
            >
              Find a Doctor
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

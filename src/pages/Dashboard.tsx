import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Activity, 
  Users, 
  Calendar, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Stethoscope, 
  Store, 
  Loader2, 
  ClipboardList, 
  UserPlus, 
  Video,
  Crown,
  ShieldCheck,
  CreditCard,
  Bell,
  Trash2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirmation } from '../context/ConfirmationContext';
import { supabase } from '../supabase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Dashboard() {
  const { profile, user, updateRole } = useAuth();
  const { confirm } = useConfirmation();
  const [recentDiagnoses, setRecentDiagnoses] = useState<any[]>([]);
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);

  const handleToggleConsultationAvailability = async () => {
    if (!user || profile?.role !== 'Doctor' || !profile?.email) return;
    
    setIsTogglingAvailability(true);
    const newStatus = !profile.isOnline;
    
    try {
      // 1. Update isOnline status in public.users
      const { error: userErr } = await supabase
        .from('users')
        .update({
          is_online: newStatus,
          last_seen: new Date().toISOString()
        })
        .eq('id', user.id);

      if (userErr) throw userErr;

      // Update local profile directly to keep UI responsive
      profile.isOnline = newStatus;

      // 2. Real-time slot management:
      const todayStr = new Date().toISOString().split('T')[0];
      
      if (newStatus) {
        // Find existing slots for today
        const { data: slotsSnap, error: slotsErr } = await supabase
          .from('slots')
          .select('*')
          .eq('doctor_email', profile.email)
          .eq('slot_date', todayStr);

        if (slotsErr) throw slotsErr;
        
        if (!slotsSnap || slotsSnap.length === 0) {
          // If no slots exist for today, automatically register 3 consult hours from next hour onwards!
          const now = new Date();
          const currentHour = now.getHours();
          
          for (let i = 1; i <= 3; i++) {
            const nextHour = (currentHour + i) % 24;
            const ampm = nextHour >= 12 ? 'PM' : 'AM';
            const h12 = nextHour % 12 || 12;
            const formattedTime = `${h12.toString().padStart(2, '0')}:00 ${ampm}`;
            
            await supabase
              .from('slots')
              .insert({
                doctor_email: profile.email,
                doctor_name: profile.name || profile.email.split('@')[0],
                slot_date: todayStr,
                slot_time: formattedTime,
                is_available: true
              });
          }
        } else {
          // Toggle existing today's slots to is_available: true
          for (const s of slotsSnap) {
            await supabase
              .from('slots')
              .update({ is_available: true })
              .eq('id', s.id);
          }
        }
      } else {
        // Toggled OFF: Mark available slots as unavailable or delete unoccupied ones
        const { data: slotsSnap, error: slotsErr } = await supabase
          .from('slots')
          .select('*')
          .eq('doctor_email', profile.email)
          .eq('slot_date', todayStr)
          .eq('is_available', true);

        if (slotsErr) throw slotsErr;

        if (slotsSnap) {
          for (const s of slotsSnap) {
            await supabase
              .from('slots')
              .delete()
              .eq('id', s.id);
          }
        }
      }
    } catch (error) {
      console.error("Error setting availability:", error);
    } finally {
      setIsTogglingAvailability(false);
    }
  };

  useEffect(() => {
    if (!profile?.email) return;

    let notifChannel: any;
    let apptChannel: any;

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_email', profile.email)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setNotifications(data || []);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };

    const fetchRecentAppointments = async () => {
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('doctor_email', profile.email)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        // Map slot dates and times into compatible structures
        const mapped = (data || []).map(a => ({
          id: a.id,
          patientEmail: a.patient_email,
          patientName: a.patient_name,
          date: a.appointment_date,
          time: a.appointment_time,
          status: a.status
        }));
        setRecentAppointments(mapped);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching doctor appointments:", err);
        setIsLoading(false);
      }
    };

    const fetchRecentDiagnoses = async () => {
      try {
        const { data, error } = await supabase
          .from('diagnoses')
          .select('*')
          .eq('patient_email', profile.email)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        // Deduplicate to ensure only one unique diagnosis entry per condition per patient is shown (keeping the latest)
        const uniqueData: any[] = [];
        const seenKeys = new Set<string>();
        
        for (const item of (data || [])) {
          const patientKey = (item.patient_email || profile.email || '').toLowerCase().trim();
          const conditionKey = (item.condition || '').toLowerCase().trim();
          const compositeKey = `${patientKey}|${conditionKey}`;
          
          if (conditionKey && !seenKeys.has(compositeKey)) {
            seenKeys.add(compositeKey);
            uniqueData.push({
              id: item.id,
              condition: item.condition,
              risk: item.risk,
              explanation: item.explanation,
              created_at: item.created_at
            });
          }
        }
        
        setRecentDiagnoses(uniqueData.slice(0, 5));
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching patient diagnoses:", err);
        setIsLoading(false);
      }
    };

    // Initial loads
    fetchNotifications();

    if (profile.role === 'Doctor') {
      fetchRecentAppointments();
      
      apptChannel = supabase
        .channel('doctor-appts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `doctor_email=eq.${profile.email}` }, () => {
          fetchRecentAppointments();
        })
        .subscribe();
    } else {
      fetchRecentDiagnoses();

      apptChannel = supabase
        .channel('patient-diagnoses')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'diagnoses', filter: `patient_email=eq.${profile.email}` }, () => {
          fetchRecentDiagnoses();
        })
        .subscribe();
    }

    notifChannel = supabase
      .channel('recipient-notifs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_email=eq.${profile.email}` }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      notifChannel?.unsubscribe();
      apptChannel?.unsubscribe();
    };
  }, [profile?.email, profile?.role]);

  const handleDeleteDiagnosis = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Diagnosis Record',
      message: 'Are you sure you want to delete this diagnosis record? This will permanently remove it from your medical assessment history.',
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Keep Record',
      severity: 'danger'
    });
    if (!isConfirmed) return;

    try {
      const { error } = await supabase
        .from('diagnoses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setRecentDiagnoses(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error("Error deleting diagnosis:", error);
    }
  };

  const stats = profile?.role === 'Doctor' ? [
    { label: 'Total Patients', value: '48', icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Today\'s Appts', value: '6', icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Pending Reports', value: '3', icon: ClipboardList, color: 'text-amber-500', bg: 'bg-amber-50' },
  ] : [
    { label: 'Health Score', value: '92%', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Consultations', value: '12', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Next Appt', value: 'Tomorrow', icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-50' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="relative bg-emerald-600 rounded-3xl p-8 overflow-hidden text-white shadow-2xl shadow-emerald-100">
        <div className="relative z-10 max-w-lg space-y-4">
          <h2 className="text-3xl font-bold">Welcome back, {profile?.name || (profile?.email || 'User').split('@')[0]}!</h2>
          <p className="text-emerald-50/80 leading-relaxed">
            {profile?.role === 'Doctor' 
              ? "Manage your appointments, view patient records, and provide expert medical consultations through our secure platform."
              : "Your health is our priority. Use our AI-powered tools to diagnose symptoms, find nearby pharmacies, or book a consultation with top specialists."}
          </p>
          <div className="flex gap-3 pt-2">
            {profile?.role === 'Doctor' ? (
              <Link to="/appointments" className="px-6 py-2.5 bg-white text-emerald-600 rounded-xl font-semibold hover:bg-emerald-50 transition-all flex items-center gap-2">
                View Schedule
                <Calendar className="w-4 h-4" />
              </Link>
            ) : (
              <Link to="/diagnosis" className="px-6 py-2.5 bg-white text-emerald-600 rounded-xl font-semibold hover:bg-emerald-50 transition-all flex items-center gap-2">
                Start AI Diagnosis
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 right-20 w-32 h-32 bg-emerald-400/20 rounded-full translate-y-1/2 blur-2xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4"
          >
            <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold text-slate-800">
                {profile?.role === 'Doctor' ? 'Upcoming Appointments' : 'Recent AI Diagnoses'}
              </h3>
              <Link to={profile?.role === 'Doctor' ? '/appointments' : '/diagnosis'} className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">View All</Link>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[200px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-8 h-8 text-slate-200 animate-spin" />
                </div>
              ) : profile?.role === 'Doctor' ? (
                recentAppointments.length > 0 ? (
                  recentAppointments.map((app, i) => (
                    <div 
                      key={app.id} 
                      className={`p-5 flex items-center justify-between hover:bg-slate-50 transition-all ${i !== recentAppointments.length - 1 ? 'border-b border-slate-100' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{(app.patientEmail || 'Patient').split('@')[0]}</p>
                          <p className="text-xs text-slate-500">{app.date} • {app.time}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${app.status === 'booked' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {app.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                    <Calendar className="w-12 h-12 mb-2 opacity-20" />
                    <p>No upcoming appointments.</p>
                  </div>
                )
              ) : recentDiagnoses.length > 0 ? (
                recentDiagnoses.map((activity, i) => (
                  <div 
                    key={activity.id} 
                    className={`p-5 flex items-center justify-between hover:bg-slate-50 transition-all ${i !== recentDiagnoses.length - 1 ? 'border-b border-slate-100' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                        <Stethoscope className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{activity.condition}</p>
                        <p className="text-xs text-slate-500">AI Diagnosis • {activity.created_at ? new Date(activity.created_at).toLocaleDateString() : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700`}>
                        {activity.risk}% Confidence
                      </span>
                      <button
                        onClick={() => handleDeleteDiagnosis(activity.id)}
                        className="p-1.5 border border-slate-100 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-all cursor-pointer"
                        title="Delete Diagnosis Record"
                        id={`delete-diag-${activity.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <Stethoscope className="w-12 h-12 mb-2 opacity-20" />
                  <p>No recent diagnoses found.</p>
                </div>
              )}
            </div>
          </div>

          {/* Notifications Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold text-slate-800">Recent Notifications</h3>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Reminders & Alerts</span>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              {notifications.length > 0 ? (
                notifications.map((notif, i) => (
                  <div 
                    key={notif.id} 
                    className={`p-5 flex items-start gap-4 hover:bg-slate-50 transition-all ${i !== notifications.length - 1 ? 'border-b border-slate-100' : ''}`}
                  >
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800">{notif.message}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-[10px] text-slate-400 font-medium">{notif.created_at ? new Date(notif.created_at).toLocaleString() : ''}</p>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">
                          {notif.sent_via?.join(' & ')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                  <Bell className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">No recent notifications.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Health Tips / Quick Actions */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-800 px-2">
            {profile?.role === 'Doctor' ? 'Quick Actions' : 'Daily Health Tip'}
          </h3>
          
          {/* Subscription Status Card */}
          <div className="bg-slate-900 p-6 rounded-3xl text-white relative overflow-hidden shadow-xl shadow-slate-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -mr-8 -mt-8 blur-2xl" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <Crown className={cn("w-5 h-5", profile?.subscribed ? "text-amber-400" : "text-slate-400")} />
                </div>
                {profile?.subscribed ? (
                  <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Active</span>
                ) : (
                  <span className="text-[10px] font-black bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full uppercase tracking-widest">Free Plan</span>
                )}
              </div>
              <div>
                <h4 className="font-bold text-lg">
                  {profile?.subscribed ? 'Premium Member' : 'Upgrade to Premium'}
                </h4>
                <p className="text-xs text-slate-400 font-medium">
                  {profile?.subscribed 
                    ? 'You have full access to all AI features.' 
                    : 'Unlock AI diagnosis & video calls.'}
                </p>
              </div>
              <Link 
                to="/subscription" 
                className={cn(
                  "w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all",
                  profile?.subscribed 
                    ? "bg-white/10 text-white hover:bg-white/20" 
                    : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-900/20"
                )}
              >
                {profile?.subscribed ? 'Manage Plan' : 'View Plans'}
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {profile?.role === 'Doctor' ? (
            <div className="space-y-6">
              {/* Availability Quick Toggle Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Consultation Status</h4>
                    <p className="text-[11px] text-slate-400 font-medium">Toggle quick availability status</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      profile?.isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                    )} />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      {profile?.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex-1 pr-2">
                    <span className="text-xs font-bold text-slate-700 block">Available instantly</span>
                    <span className="text-[10px] text-slate-400 block font-medium leading-relaxed">
                      {profile?.isOnline ? "Hourly slots registered for today" : "No active consultation slots"}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isTogglingAvailability}
                    onClick={handleToggleConsultationAvailability}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
                      profile?.isOnline ? "bg-emerald-500" : "bg-slate-200",
                      isTogglingAvailability ? "opacity-50 cursor-not-allowed" : ""
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center",
                        profile?.isOnline ? "translate-x-5" : "translate-x-0"
                      )}
                    >
                      {isTogglingAvailability && (
                        <Loader2 className="w-2.5 h-2.5 text-emerald-500 animate-spin" />
                      )}
                    </span>
                  </button>
                </div>
              </div>

              {/* Standard Quick Links */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <Link to="/prescriptions" className="w-full py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-100 transition-all">
                  <ClipboardList className="w-5 h-5" />
                  Write Prescription
                </Link>
                <Link to="/patients" className="w-full py-4 bg-indigo-50 text-indigo-700 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-100 transition-all">
                  <Users className="w-5 h-5" />
                  Manage Patients
                </Link>
                <Link to="/consultation" className="w-full py-4 bg-blue-50 text-blue-700 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-blue-100 transition-all">
                  <Video className="w-5 h-5" />
                  Start Video Call
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <Link to="/consultation" className="w-full py-4 bg-blue-50 text-blue-700 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-blue-100 transition-all">
                <Video className="w-5 h-5" />
                Consult with Doctor
              </Link>
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-slate-800">Stay Hydrated!</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Drinking at least 8 glasses of water a day helps maintain your energy levels and improves brain function.
              </p>
              <button className="w-full py-3 bg-slate-50 text-slate-600 rounded-xl font-semibold hover:bg-slate-100 transition-all">
                Learn More
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  MapPin, 
  Star,
  Search,
  Filter,
  X,
  Plus,
  ChevronLeft,
  LayoutList,
  CalendarDays,
  Video,
  Bell,
  CalendarPlus,
  Check
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO
} from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirmation } from '../context/ConfirmationContext';
import { supabase } from '../supabase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Mock Doctors Data
const DOCTORS = [
  {
    id: '1',
    name: 'Dr. Sarah Johnson',
    specialty: 'Cardiologist',
    rating: 4.9,
    reviews: 124,
    location: 'Central Heart Institute',
    image: 'https://picsum.photos/seed/doc1/200/200',
    availability: ['09:00 AM', '10:30 AM', '02:00 PM', '04:30 PM']
  },
  {
    id: '2',
    name: 'Dr. Michael Chen',
    specialty: 'Dermatologist',
    rating: 4.8,
    reviews: 89,
    location: 'Skin & Wellness Center',
    image: 'https://picsum.photos/seed/doc2/200/200',
    availability: ['11:00 AM', '01:30 PM', '03:00 PM', '05:00 PM']
  },
  {
    id: '3',
    name: 'Dr. Emily White',
    specialty: 'Pediatrician',
    rating: 5.0,
    reviews: 210,
    location: 'Children\'s Care Hospital',
    image: 'https://picsum.photos/seed/doc3/200/200',
    availability: ['08:30 AM', '10:00 AM', '12:30 PM', '03:30 PM']
  },
  {
    id: '4',
    name: 'Dr. James Wilson',
    specialty: 'Neurologist',
    rating: 4.7,
    reviews: 56,
    location: 'NeuroScience Clinic',
    image: 'https://picsum.photos/seed/doc4/200/200',
    availability: ['09:30 AM', '11:30 AM', '02:30 PM', '04:00 PM']
  }
];

export default function Appointments() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { confirm } = useConfirmation();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showSuccess, setShowSuccess] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [isCheckingSlots, setIsCheckingSlots] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState('09:00');
  const [newSlotDate, setNewSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAddingSlot, setIsAddingSlot] = useState(false);
  const [doctorSlots, setDoctorSlots] = useState<any[]>([]);

  const { googleToken, connectGoogleCalendar } = useAuth();
  const [syncingApptId, setSyncingApptId] = useState<string | null>(null);
  const [creatingMeetId, setCreatingMeetId] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{ [key: string]: { status: 'success' | 'error', message?: string } }>({});

  const parseAppointmentDateTime = (dateStr: string, timeStr: string): Date => {
    try {
      const [hoursMin, ampm] = timeStr.trim().split(' ');
      const [hoursStr, minutesStr] = hoursMin.split(':');
      let hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      
      if (ampm === 'PM' && hours < 12) {
        hours += 12;
      } else if (ampm === 'AM' && hours === 12) {
        hours = 0;
      }
      
      const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
      const parsedDate = new Date();
      parsedDate.setFullYear(year, month - 1, day);
      parsedDate.setHours(hours, minutes, 0, 0);
      return parsedDate;
    } catch (error) {
      console.error("Error parsing appointment date/time:", error);
      return new Date();
    }
  };

  const handleSyncToGoogleCalendar = async (app: any) => {
    let token = googleToken;
    
    if (!token) {
      const confirmAuth = window.confirm("To sync this appointment to your Google Calendar, we need your permission. Connect your Google account?");
      if (!confirmAuth) return;
      
      try {
        token = await connectGoogleCalendar();
        if (!token) {
          alert("Authentication failed. Please try again.");
          return;
        }
      } catch (authErr) {
        console.error("Auth error:", authErr);
        alert("Failed to connect your Google account.");
        return;
      }
    }

    setSyncingApptId(app.id);
    try {
      const startDateTime = parseAppointmentDateTime(app.date, app.time);
      const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000); // 30 mins later
      
      const isDoc = profile?.role === 'Doctor';
      const otherPersonName = isDoc ? app.patientName || app.patientEmail.split('@')[0] : app.doctorName;
      
      const summary = isDoc 
        ? `TeleMed Appointment: ${otherPersonName}` 
        : `Telehealth Consultation: Dr. ${otherPersonName}`;
        
      const description = `Your telehealth consultation session.\n\n` +
        `Patient: ${app.patientName || app.patientEmail}\n` +
        `Physician: Dr. ${app.doctorName} (${app.doctorSpecialty || ''})\n` +
        `Clinical Location: ${app.location || 'TeleMed Virtual Clinic'}\n\n` +
        `💬 JOIN CONSULTATION portal: ${window.location.origin}/consultation\n\n` +
        `* Please ensure you are logged strictly into your TeleMed dashboard prior to joining the video room.`;

      const eventPayload = {
        summary: summary,
        location: app.location || 'TeleMed Clinic',
        description: description,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'email', minutes: 60 }
          ]
        }
      };

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventPayload)
      });

      if (!response.ok) {
        throw new Error(`Google Calendar API responded with status ${response.status}`);
      }

      const eventData = await response.json();
      
      await supabase
        .from('appointments')
        .update({
          google_calendar_event_id: eventData.id,
          is_synced_to_calendar: true
        })
        .eq('id', app.id);

      setSyncFeedback(prev => ({
        ...prev,
        [app.id]: { status: 'success' }
      }));
    } catch (err: any) {
      console.error("Sync error:", err);
      setSyncFeedback(prev => ({
        ...prev,
        [app.id]: { status: 'error', message: err.message || "Failed to add to calendar." }
      }));
    } finally {
      setSyncingApptId(null);
    }
  };

  const handleCreateGoogleMeetSpace = async (app: any) => {
    let token = googleToken;
    
    if (!token) {
      const confirmAuth = window.confirm("To generate a Google Meet space, we need your permission. Connect your Google account?");
      if (!confirmAuth) return;
      
      try {
        token = await connectGoogleCalendar();
        if (!token) {
          alert("Authentication failed. Please try again.");
          return;
        }
      } catch (authErr) {
        console.error("Auth error:", authErr);
        alert("Failed to connect your Google account.");
        return;
      }
    }

    setCreatingMeetId(app.id);
    try {
      const res = await fetch('https://meet.googleapis.com/v2/spaces', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`Google Meet API responded with status ${res.status}`);
      }

      const data = await res.json();
      const meetingUri = data.meetingUri;
      if (!meetingUri) {
        throw new Error("No meetingUri returned from Google Meet API.");
      }

      await supabase
        .from('appointments')
        .update({
          google_meet_link: meetingUri
        })
        .eq('id', app.id);

      setSyncFeedback(prev => ({
        ...prev,
        [app.id]: { status: 'success' }
      }));
    } catch (err: any) {
      console.error("Error creating Google Meet space:", err);
      setSyncFeedback(prev => ({
        ...prev,
        [app.id]: { status: 'error', message: err.message || "Failed to generate Google Meet link." }
      }));
    } finally {
      setCreatingMeetId(null);
    }
  };

  useEffect(() => {
    if (profile?.role !== 'Doctor' || !profile?.email) return;

    const fetchDoctorSlots = async () => {
      try {
        const { data, error } = await supabase
          .from('slots')
          .select('*')
          .eq('doctor_email', profile.email)
          .order('slot_date', { ascending: true })
          .order('slot_time', { ascending: true });

        if (error) throw error;
        setDoctorSlots((data || []).map(s => ({
          id: s.id,
          doctorEmail: s.doctor_email,
          doctorName: s.doctor_name,
          date: s.slot_date,
          time: s.slot_time,
          isAvailable: s.is_available
        })));
      } catch (err) {
        console.error("Error fetching doctor slots:", err);
      }
    };

    fetchDoctorSlots();

    const channel = supabase
      .channel('doctor-slots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots', filter: `doctor_email=eq.${profile.email}` }, () => {
        fetchDoctorSlots();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profile?.email, profile?.role]);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'Doctor');

        if (error) throw error;
        setDoctors(data || []);
      } catch (err) {
        console.error("Error fetching doctors list:", err);
      }
    };

    fetchDoctors();

    const channel = supabase
      .channel('doctors-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `role=eq.Doctor` }, () => {
        fetchDoctors();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!profile?.email) return;

    const fetchAppointments = async () => {
      try {
        const field = profile.role === 'Doctor' ? 'doctor_email' : 'patient_email';
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq(field, profile.email)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        const mapped = (data || []).map(a => ({
          id: a.id,
          patientEmail: a.patient_email,
          patientName: a.patient_name,
          doctorEmail: a.doctor_email,
          doctorName: a.doctor_name,
          doctorSpecialty: a.doctor_specialty,
          doctorImage: a.doctor_image,
          location: a.location,
          date: a.appointment_date,
          time: a.appointment_time,
          status: a.status,
          googleCalendarEventId: a.google_calendar_event_id,
          isSyncedToCalendar: a.is_synced_to_calendar,
          googleMeetLink: a.google_meet_link
        }));

        setAppointments(mapped);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching appointments:", err);
        setIsLoading(false);
      }
    };

    fetchAppointments();

    const filterField = profile.role === 'Doctor' ? 'doctor_email' : 'patient_email';
    const channel = supabase
      .channel('user-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `${filterField}=eq.${profile.email}` }, () => {
        fetchAppointments();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profile?.email, profile?.role]);

  useEffect(() => {
    if (!selectedDoctor || !selectedDate || !showBookingModal) {
      setBookedSlots([]);
      return;
    }

    const fetchBookedSlots = async () => {
      if (!selectedDoctor?.email) {
        setBookedSlots([]);
        return;
      }

      setIsCheckingSlots(true);
      try {
        // Fetch doctor's defined slots
        const { data: slotsData, error: slotsErr } = await supabase
          .from('slots')
          .select('*')
          .eq('doctor_email', selectedDoctor.email)
          .eq('slot_date', selectedDate);

        if (slotsErr) throw slotsErr;

        const slots = (slotsData || []).map(s => ({
          id: s.id,
          doctorEmail: s.doctor_email,
          doctorName: s.doctor_name,
          date: s.slot_date,
          time: s.slot_time,
          isAvailable: s.is_available
        }));
        setAvailableSlots(slots);

        // The sources of truth for booked slots should be both the is_available flag in slots
        // AND the appointments collection (to ensure consistency if one fails)
        const bookedFromSlots = slots.filter((s: any) => !s.isAvailable).map((s: any) => s.time);
        
        // Fetch booked appointments
        let bookedFromApps: string[] = [];
        try {
          const { data: appData, error: appErr } = await supabase
            .from('appointments')
            .select('appointment_time')
            .eq('doctor_email', selectedDoctor.email)
            .eq('appointment_date', selectedDate)
            .eq('status', 'booked');

          if (appErr) throw appErr;
          bookedFromApps = (appData || []).map((doc: any) => doc.appointment_time);
        } catch (appError) {
          // If we can't read appointments (e.g. permission restriction), we'll rely only on slots
          console.warn("Could not fetch appointments for slot check, relying on slots only:", appError);
        }
        
        const allBooked = Array.from(new Set([...bookedFromSlots, ...bookedFromApps]));
        setBookedSlots(allBooked);
      } catch (error: any) {
        console.error("Error fetching slots:", error);
      } finally {
        setIsCheckingSlots(false);
      }
    };

    fetchBookedSlots();
  }, [selectedDoctor, selectedDate, showBookingModal]);

  const handleBookAppointment = async () => {
    // Ensure we have the critical data. Use user.email as a secondary source for patientEmail
    const patientEmail = profile?.email || user?.email;
    if (!patientEmail || !selectedDoctor || !selectedDate || !selectedTime) return;

    setIsBooking(true);
    try {
      const doctorEmail = selectedDoctor.email || '';
      const doctorName = selectedDoctor.name || (doctorEmail ? doctorEmail.split('@')[0] : 'Unknown Doctor');
      const patientName = profile?.name || (patientEmail ? patientEmail.split('@')[0] : 'Unknown Patient');

      // Create the appointment
      await supabase
        .from('appointments')
        .insert({
          patient_email: patientEmail,
          patient_name: patientName,
          doctor_email: doctorEmail,
          doctor_name: doctorName,
          doctor_specialty: selectedDoctor.specialty || 'General Practitioner',
          doctor_image: selectedDoctor.image || null,
          location: selectedDoctor.location || 'TeleMed Clinic',
          appointment_date: selectedDate,
          appointment_time: selectedTime,
          status: 'booked'
        });

      // Also try to mark the slot as unavailable if it exists
      try {
        const slot = availableSlots.find((s: any) => s.time === selectedTime);
        if (slot) {
          await supabase
            .from('slots')
            .update({
              is_available: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', slot.id);
        }
      } catch (slotError) {
        console.warn("Failed to mark slot as unavailable:", slotError);
        // We don't fail the whole booking if just the slot update fails
      }

      setShowBookingModal(false);
      setSelectedDoctor(null);
      setSelectedTime('');
      setShowSuccess(true);
    } catch (error) {
      console.error("Error booking appointment:", error);
    } finally {
      setIsBooking(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'completed' | 'cancelled') => {
    if (status === 'cancelled') {
      const isConfirmed = await confirm({
        title: 'Cancel Appointment',
        message: 'Are you sure you want to cancel this appointment? This action is permanent and cannot be undone.',
        confirmLabel: 'Yes, Cancel',
        cancelLabel: 'Keep Appointment',
        severity: 'danger'
      });
      if (!isConfirmed) return;
    }

    try {
      await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);
    } catch (error) {
      console.error("Error updating appointment status:", error);
    }
  };

  const handleAddSlot = async () => {
    if (!profile?.email || !newSlotTime || !newSlotDate) return;
    
    // Format time to AM/PM for consistency if needed, or keep as 24h
    // Let's convert 24h to AM/PM for the UI consistency
    const [hours, minutes] = newSlotTime.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const formattedTime = `${h12.toString().padStart(2, '0')}:${minutes} ${ampm}`;

    setIsAddingSlot(true);
    try {
      await supabase
        .from('slots')
        .insert({
          doctor_email: profile.email,
          doctor_name: profile.name || profile.email.split('@')[0],
          slot_date: newSlotDate,
          slot_time: formattedTime,
          is_available: true
        });
    } catch (error) {
      console.error("Error adding slot:", error);
    } finally {
      setIsAddingSlot(false);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Appointment Slot',
      message: 'Are you sure you want to delete this available appointment slot? Patients will no longer be able to book this time.',
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Keep Slot',
      severity: 'danger'
    });
    if (!isConfirmed) return;

    try {
      await supabase
        .from('slots')
        .delete()
        .eq('id', id);
    } catch (error) {
      console.error("Error deleting slot:", error);
    }
  };

  const filteredDoctors = doctors.filter(doc => 
    (doc.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.specialty || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const upcomingAppointments = appointments.filter(app => app.status === 'booked');
  const pastAppointments = appointments.filter(app => app.status === 'completed' || app.status === 'cancelled');

  // Calendar Logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter(app => {
      try {
        const appDate = parseISO(app.date);
        return isSameDay(appDate, day);
      } catch (e) {
        return false;
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">Appointments</h1>
          <p className="text-slate-500 font-medium">Schedule and manage your visits with our top medical specialists.</p>
        </div>

        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl flex items-center gap-2 text-emerald-700 text-sm font-bold"
            >
              <CheckCircle2 className="w-4 h-4" />
              Appointment booked successfully!
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              viewMode === 'list' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <LayoutList className="w-4 h-4" />
            List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              viewMode === 'calendar' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <CalendarDays className="w-4 h-4" />
            Calendar
          </button>
        </div>

        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'upcoming' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'history' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            History
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-bottom border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-black text-slate-800">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <button 
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all"
                >
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>
            <button 
              onClick={() => setCurrentMonth(new Date())}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
            >
              Today
            </button>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <div className="min-w-[700px] md:min-w-0">
              <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-3 text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  const dayAppointments = getAppointmentsForDay(day);
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div 
                      key={day.toString()} 
                      className={cn(
                        "min-h-[120px] p-2 border-r border-b border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-50/30",
                        !isCurrentMonth && "bg-slate-50/50 dark:bg-slate-900/20 opacity-40 dark:opacity-25",
                        idx % 7 === 6 && "border-r-0"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn(
                          "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                          isToday ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-400"
                        )}>
                          {format(day, 'd')}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {dayAppointments.slice(0, 3).map(app => (
                          <div 
                            key={app.id}
                            className={cn(
                              "text-[9px] p-1.5 rounded-lg border truncate font-bold",
                              app.status === 'booked' ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/45 text-emerald-700 dark:text-emerald-400" :
                              app.status === 'completed' ? "bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-750 text-slate-600 dark:text-slate-400" :
                              "bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/45 text-rose-700 dark:text-rose-450"
                            )}
                          >
                            {app.time} - {app.doctorName}
                          </div>
                        ))}
                        {dayAppointments.length > 3 && (
                          <div className="text-[8px] text-slate-400 dark:text-slate-500 font-bold pl-1">
                            + {dayAppointments.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Appointments List */}
        <div className="lg:col-span-1 space-y-6">
          {profile?.role === 'Doctor' && (
            <div className="bg-emerald-600 p-6 rounded-[2.5rem] text-white space-y-4 shadow-xl shadow-emerald-100">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add Availability
              </h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-70">Date</label>
                  <input 
                    type="date" 
                    value={newSlotDate}
                    onChange={(e) => setNewSlotDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm outline-none focus:bg-white/20 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-70">Time</label>
                  <input 
                    type="time" 
                    value={newSlotTime}
                    onChange={(e) => setNewSlotTime(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm outline-none focus:bg-white/20 transition-all"
                  />
                </div>
                <button 
                  onClick={handleAddSlot}
                  disabled={isAddingSlot}
                  className="w-full py-2.5 bg-white text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isAddingSlot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Slot
                </button>
              </div>
            </div>
          )}

          {profile?.role === 'Doctor' && doctorSlots.length > 0 && (
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500" />
                Your Slots
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {doctorSlots.map(slot => (
                  <div key={slot.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-700">{slot.date}</p>
                      <p className="text-[10px] text-slate-500">{slot.time}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-emerald-500" />
            Your Schedule
          </h3>
          
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 bg-white rounded-3xl border border-slate-100">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                <p className="text-sm text-slate-400">Loading appointments...</p>
              </div>
            ) : (activeTab === 'upcoming' ? upcomingAppointments : pastAppointments).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 bg-white rounded-3xl border border-slate-100 text-center space-y-3">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                  <CalendarIcon className="w-6 h-6" />
                </div>
                <p className="text-slate-500 font-medium">No {activeTab} appointments found.</p>
                {activeTab === 'upcoming' && (
                  <p className="text-xs text-slate-400">Book your first appointment with one of our specialists.</p>
                )}
              </div>
            ) : (
              (activeTab === 'upcoming' ? upcomingAppointments : pastAppointments).map((app) => (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={app.id}
                  className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex gap-4">
                    <img 
                      src={app.doctorImage} 
                      alt={app.doctorName}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-50"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 truncate">
                        {profile?.role === 'Doctor' ? app.patientEmail.split('@')[0] : app.doctorName}
                      </h4>
                      <p className="text-xs text-emerald-600 font-bold">
                        {profile?.role === 'Doctor' ? 'Patient' : app.doctorSpecialty}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          {app.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {app.time}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">{app.location}</span>
                    </div>
                    <span className={cn(
                      "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider",
                      app.status === 'booked' ? "bg-emerald-50 text-emerald-600" :
                      app.status === 'completed' ? "bg-slate-100 text-slate-600" :
                      "bg-rose-50 text-rose-600"
                    )}>
                      {app.status}
                    </span>
                    {(app.reminder24hSent || app.reminder1hSent) && (
                      <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Bell className="w-2.5 h-2.5" />
                        {app.reminder1hSent ? "1h Reminder Sent" : "24h Reminder Sent"}
                      </div>
                    )}
                    {app.status === 'booked' && (
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 ml-2">
                        {/* Google Meet Connection */}
                        {app.googleMeetLink ? (
                          <a
                            href={app.googleMeetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg transition-all shadow-sm cursor-pointer"
                            title="Join Google Meet Room"
                          >
                            <Video className="w-3 h-3 text-white" />
                            <span>Join Meet</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => handleCreateGoogleMeetSpace(app)}
                            disabled={creatingMeetId === app.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 hover:text-blue-800 text-[10px] font-black rounded-lg transition-all"
                            title="Generate a Google Meet link"
                          >
                            {creatingMeetId === app.id ? (
                              <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                            ) : (
                              <Video className="w-3 h-3 text-blue-500" />
                            )}
                            <span>Meet Link</span>
                          </button>
                        )}

                        {app.isSyncedToCalendar || app.googleCalendarEventId ? (
                          <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg border border-emerald-100" title="Successfully synced to your Google Calendar">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span>Synced</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSyncToGoogleCalendar(app)}
                            disabled={syncingApptId === app.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-850 text-[10px] font-black rounded-lg transition-all"
                            title="Sync Invitation to your Google Calendar"
                          >
                            {syncingApptId === app.id ? (
                              <Loader2 className="w-3 h-3 text-slate-500 animate-spin" />
                            ) : (
                              <CalendarPlus className="w-3 h-3 text-emerald-600" />
                            )}
                            <span>{syncingApptId === app.id ? 'Syncing...' : 'Sync'}</span>
                          </button>
                        )}
                        {syncFeedback[app.id]?.status === 'error' && (
                          <span className="text-[8px] text-rose-550 font-bold block" title={syncFeedback[app.id]?.message}>
                            Error
                          </span>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate('/consultation', { 
                              state: { 
                                targetEmail: profile?.role === 'Doctor' ? app.patientEmail : app.doctorEmail,
                                targetName: profile?.role === 'Doctor' ? app.patientEmail.split('@')[0] : app.doctorName
                              } 
                            })}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                            title="Start Video Call"
                          >
                            <Video className="w-3 h-3" />
                          </button>
                          {profile?.role === 'Doctor' && (
                            <button
                              onClick={() => handleUpdateStatus(app.id, 'completed')}
                              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                            >
                              Complete
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateStatus(app.id, 'cancelled')}
                            className="text-[10px] font-bold text-rose-500 hover:text-rose-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Doctor Search & Booking (Only for Patients) */}
        {profile?.role !== 'Doctor' && (
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by doctor name or specialty..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredDoctors.map((doc) => (
                <motion.div
                  layoutId={doc.id}
                  key={doc.id}
                  className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-100 transition-all group"
                >
                  <div className="flex gap-5">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xl border-4 border-white shadow-md overflow-hidden">
                        {doc.image ? (
                          <img src={doc.image} alt={doc.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          doc.name?.[0].toUpperCase()
                        )}
                      </div>
                      <div className="absolute -bottom-2 -right-2 bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-100 flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-[10px] font-black text-slate-700">{doc.rating || '5.0'}</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <h4 className="text-lg font-bold text-slate-800">{doc.name}</h4>
                      <p className="text-sm font-bold text-emerald-600">{doc.specialty || 'General Practitioner'}</p>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <MapPin className="w-3 h-3" />
                        <span className="text-xs font-medium">{doc.location || 'TeleMed Clinic'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="text-xs text-slate-400 font-medium">
                      <span className="font-bold text-slate-700">{doc.experience || '10+'}</span> Years Exp.
                    </div>
                    <button
                      onClick={() => {
                        setSelectedDoctor(doc);
                        setShowBookingModal(true);
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-100"
                    >
                      Book Visit
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    )}

      {/* Booking Modal */}
      <AnimatePresence>
        {showBookingModal && selectedDoctor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 md:p-12 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                      <Plus className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-800">Schedule Appointment</h3>
                      <p className="text-sm text-slate-500 font-medium">Confirm your visit with {selectedDoctor.name}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowBookingModal(false);
                      setSelectedTime('');
                    }} 
                    className="p-3 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Select Date</label>
                      <div className="relative">
                        <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-slate-700"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Available Slots</label>
                      {isCheckingSlots ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                        </div>
                      ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {availableSlots.length > 0 ? (
                          availableSlots.map((slot: any) => {
                            const isBooked = bookedSlots.includes(slot.time);
                            return (
                              <button
                                key={slot.id}
                                disabled={isBooked}
                                onClick={() => setSelectedTime(slot.time)}
                                className={cn(
                                  "p-4 rounded-2xl border font-bold text-sm transition-all flex items-center justify-center gap-2",
                                  selectedTime === slot.time 
                                    ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100" 
                                    : isBooked
                                      ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                      : "bg-white border-slate-100 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50"
                                )}
                              >
                                <Clock className="w-4 h-4" />
                                {slot.time}
                                {isBooked && <span className="text-[8px] ml-1 opacity-60">(Booked)</span>}
                              </button>
                            );
                          })
                        ) : (
                          <div className="col-span-2 py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <p className="text-xs text-slate-400 font-medium">No slots defined by doctor for this date.</p>
                          </div>
                        )}
                      </div>
                      )}
                      {!isCheckingSlots && availableSlots.length > 0 && availableSlots.every((slot: any) => bookedSlots.includes(slot.time)) && (
                        <p className="text-xs text-rose-500 font-bold text-center mt-2">
                          All slots are booked for this date.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-8 rounded-[2.5rem] space-y-6 border border-slate-100">
                    <h4 className="font-bold text-slate-800">Appointment Summary</h4>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        {selectedDoctor.image ? (
                          <img 
                            src={selectedDoctor.image} 
                            alt={selectedDoctor.name}
                            className="w-12 h-12 rounded-xl object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                            {selectedDoctor.name?.[0]}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-slate-800">{selectedDoctor.name}</p>
                          <p className="text-xs text-emerald-600 font-bold">{selectedDoctor.specialty}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Date</span>
                          <span className="font-bold text-slate-700">{selectedDate}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Time</span>
                          <span className="font-bold text-slate-700">{selectedTime || 'Not selected'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Location</span>
                          <span className="font-bold text-slate-700 text-right max-w-[150px]">{selectedDoctor.location}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleBookAppointment}
                      disabled={!selectedTime || isBooking}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200 disabled:opacity-50"
                    >
                      {isBooking ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5" />
                      )}
                      {isBooking ? 'Confirming...' : 'Confirm Booking'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

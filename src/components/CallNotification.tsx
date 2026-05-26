import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, PhoneOff, User, Video } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function CallNotification() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [incomingCall, setIncomingCall] = useState<any>(null);

  useEffect(() => {
    if (!profile?.email || location.pathname === '/consultation') return;

    const fetchActiveCall = async () => {
      try {
        const { data, error } = await supabase
          .from('calls')
          .select('*')
          .eq('receiver_email', profile.email)
          .eq('status', 'calling')
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error fetching active call:", error);
          return;
        }

        if (data) {
          setIncomingCall({
            id: data.id,
            callerEmail: data.caller_email,
            callerName: data.caller_name,
            receiverEmail: data.receiver_email,
            receiverName: data.receiver_name,
            status: data.status,
          });
        } else {
          setIncomingCall(null);
        }
      } catch (err) {
        console.error("Exception fetching call status:", err);
      }
    };

    fetchActiveCall();

    const channel = supabase
      .channel(`calls-notification-${profile.email}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `receiver_email=eq.${profile.email}`
        },
        () => {
          fetchActiveCall();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profile?.email, location.pathname]);

  const handleAccept = () => {
    if (incomingCall) {
      navigate('/consultation', { state: { incomingCallId: incomingCall.id, autoAccept: true } });
      setIncomingCall(null);
    }
  };

  const handleDecline = async () => {
    if (incomingCall) {
      try {
        await supabase
          .from('calls')
          .update({ status: 'ended' })
          .eq('id', incomingCall.id);
      } catch (err) {
        console.error("Error declining call:", err);
      }
      setIncomingCall(null);
    }
  };

  return (
    <AnimatePresence>
      {incomingCall && (
        <motion.div 
          initial={{ opacity: 0, y: -50, x: '-50%' }}
          animate={{ opacity: 1, y: 20, x: '-50%' }}
          exit={{ opacity: 0, y: -50, x: '-50%' }}
          className="fixed top-0 left-1/2 z-[100] w-[90%] max-w-md"
        >
          <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[2.5rem] shadow-2xl p-6 flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                <User className="w-10 h-10" />
              </div>
              <div className="absolute inset-0 border-4 border-emerald-500 rounded-full animate-ping opacity-20" />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Incoming Video Call</h3>
              <p className="text-slate-500 font-bold text-sm tracking-tight">
                {incomingCall.callerName} is requesting a consultation
              </p>
            </div>

            <div className="flex gap-4 w-full">
              <button 
                onClick={handleDecline}
                className="flex-1 py-4 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
              >
                <PhoneOff className="w-4 h-4" />
                Decline
              </button>
              <button 
                onClick={handleAccept}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-200 flex items-center justify-center gap-2"
              >
                <Video className="w-4 h-4" />
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

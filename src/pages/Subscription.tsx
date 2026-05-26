import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Zap, 
  Star, 
  Crown, 
  Clock, 
  CreditCard, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  X,
  Check,
  Calendar,
  Wallet,
  Stethoscope,
  Database,
  Activity,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SubscriptionRecord {
  id: string;
  userEmail: string;
  plan: string;
  status: 'active' | 'expired' | 'cancelled';
  amount: number;
  startDate: any;
  endDate: any;
  timestamp: any;
}

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly Plan',
    price: 29.99,
    duration: 'month',
    description: 'Perfect for short-term medical needs and consultations.',
    features: [
      'Unlimited AI Diagnoses',
      '24/7 Video Consultations',
      'Digital Prescriptions',
      'Medical Store Discounts (10%)',
      'Priority Support'
    ],
    icon: Zap,
    color: 'emerald',
    role: 'Patient'
  },
  {
    id: 'yearly',
    name: 'Yearly Plan',
    price: 299.99,
    duration: 'year',
    description: 'Best value for long-term health monitoring and family care.',
    features: [
      'Everything in Monthly',
      'Medical Store Discounts (25%)',
      'Family Sharing (up to 4 members)',
      'Personal Health Concierge',
      'Annual Health Report AI'
    ],
    icon: Crown,
    color: 'indigo',
    popular: true,
    role: 'Patient'
  },
  {
    id: 'doctor_pro',
    name: 'Doctor Professional',
    price: 49.99,
    duration: 'month',
    description: 'Essential tools for modern medical practitioners.',
    features: [
      'Unlimited Patient Consultations',
      'Advanced Prescription Management',
      'Patient Medical History Access',
      'Priority Listing in Doctor Search',
      'Professional Profile Analytics'
    ],
    icon: Stethoscope,
    color: 'emerald',
    role: 'Doctor'
  },
  {
    id: 'doctor_annual',
    name: 'Doctor Annual',
    price: 499.99,
    duration: 'year',
    description: 'Full professional suite with significant savings.',
    features: [
      'Everything in Doctor Professional',
      'Verified Practitioner Badge',
      'Multi-clinic Management',
      'Custom Consultation Fees',
      '24/7 Professional Support'
    ],
    icon: ShieldCheck,
    color: 'indigo',
    popular: true,
    role: 'Doctor'
  }
];

export default function Subscription() {
  const { user, profile } = useAuth();
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[0] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredPlans = PLANS.filter(plan => plan.role === (profile?.role === 'Doctor' ? 'Doctor' : 'Patient'));

  const formatDate = (dateVal: any) => {
    if (!dateVal) return 'Next Month';
    if (typeof dateVal === 'string') {
      const parsed = Date.parse(dateVal);
      if (!isNaN(parsed)) {
        return new Date(parsed).toLocaleDateString();
      }
    }
    if (typeof dateVal.toDate === 'function') {
      return dateVal.toDate().toLocaleDateString();
    }
    if (dateVal instanceof Date) {
      return dateVal.toLocaleDateString();
    }
    if (dateVal.seconds) {
      return new Date(dateVal.seconds * 1000).toLocaleDateString();
    }
    return 'Next Month';
  };

  useEffect(() => {
    if (!user) return;

    const fetchSub = async () => {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_email', user.email)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) throw error;
        if (data && data.length > 0) {
          const d = data[0];
          setCurrentSubscription({
            id: d.id,
            userEmail: d.user_email,
            plan: d.plan,
            status: d.status,
            amount: d.amount,
            startDate: d.start_date,
            endDate: d.end_date,
            timestamp: d.created_at
          });
        } else {
          setCurrentSubscription(null);
        }
      } catch (err) {
        console.error('Error fetching subscription:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSub();

    const channel = supabase
      .channel('subscription-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => {
        fetchSub();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleCancelSubscription = async () => {
    if (!user || !currentSubscription) return;
    
    setIsProcessing(true);
    try {
      // 1. Update subscription status
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('id', currentSubscription.id);

      // 2. Update user profile to unsubscribed
      await supabase
        .from('users')
        .update({ subscribed: false })
        .eq('email', user.email);

      setCurrentSubscription(null);
    } catch (error) {
      console.error('Cancel subscription error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubscribe = async (plan: typeof PLANS[0]) => {
    if (!user || !profile) return;
    
    setIsProcessing(true);
    // Simulate payment delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const now = new Date();
      const endDate = new Date();
      if (plan.duration === 'month') {
        endDate.setMonth(now.getMonth() + 1);
      } else {
        endDate.setFullYear(now.getFullYear() + 1);
      }

      // 1. Create subscription record
      await supabase.from('subscriptions').insert({
        user_email: user.email,
        plan: plan.id,
        status: 'active',
        amount: plan.price,
        start_date: now.toISOString(),
        end_date: endDate.toISOString()
      });

      // 2. Update user profile
      await supabase
        .from('users')
        .update({ subscribed: true })
        .eq('email', user.email);

      // 3. Create payment record
      await supabase.from('payments').insert({
        patient_email: user.email,
        patient_name: profile.name || user.displayName || 'User',
        amount: plan.price,
        currency: 'USD',
        status: 'completed',
        description: `Subscription: ${plan.name}`,
        method: 'Visa •••• 4242'
      });

      setSelectedPlan(null);
    } catch (error) {
      console.error('Subscription error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="text-slate-500 font-medium">Checking subscription status...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black text-slate-800 tracking-tight">
          {currentSubscription ? 'Your Subscription' : profile?.role === 'Doctor' ? 'Professional Practitioner License' : 'Upgrade Your Health'}
        </h1>
        <p className="text-slate-500 text-lg font-medium max-w-2xl mx-auto">
          {currentSubscription 
            ? 'Manage your active plan and view your benefits.' 
            : profile?.role === 'Doctor'
              ? 'To access the TeleMed AI professional suite and start consulting with patients, please activate your practitioner license.'
              : 'Unlock the full potential of TeleMed AI with our premium plans designed for your well-being.'}
        </p>
      </div>

      {currentSubscription ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-bl-[8rem] -mr-16 -mt-16 blur-3xl" />
              
              <div className="relative space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center">
                      <ShieldCheck className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tight">Active {PLANS.find(p => p.id === currentSubscription.plan)?.name || 'Premium'}</h2>
                      <p className="text-slate-400 font-medium">Subscription ID: {currentSubscription.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                  </div>
                  <span className="px-6 py-2 bg-emerald-500 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">
                    Active
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-8 pt-8 border-t border-white/10">
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Renewal Date</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold">
                        {formatDate(currentSubscription.endDate)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Billing Amount</p>
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold">${currentSubscription.amount.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Payment Method</p>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold">Visa •••• 4242</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[3rem] p-10 border border-slate-200 space-y-6 shadow-sm">
              <h3 className="text-xl font-black text-slate-800">Your Premium Benefits</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PLANS.find(p => p.id === currentSubscription.plan)?.features?.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                      <Check className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-indigo-50 rounded-[3rem] p-8 border border-indigo-100 space-y-6">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                <Star className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">Need more?</h3>
                <p className="text-sm text-slate-600 font-medium">
                  {profile?.role === 'Doctor' 
                    ? 'Switch to our Annual plan to save on licensing fees and get the Verified Practitioner Badge.'
                    : 'Switch to our Yearly plan to save 20% and get exclusive benefits.'}
                </p>
              </div>
              <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2">
                View Plans
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white rounded-[3rem] p-8 border border-slate-200 space-y-4 shadow-sm">
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Danger Zone</h4>
              <button 
                onClick={handleCancelSubscription}
                disabled={isProcessing}
                className="w-full py-4 bg-white text-rose-500 border border-rose-100 rounded-2xl font-bold hover:bg-rose-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />
                    Cancelling...
                  </>
                ) : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {filteredPlans.map((plan) => (
            <motion.div
              key={plan.id}
              whileHover={{ y: -10 }}
              className={cn(
                "relative bg-white rounded-[3.5rem] p-10 border-2 transition-all shadow-xl",
                plan.popular ? "border-emerald-500 shadow-emerald-100" : "border-slate-100 shadow-slate-100"
              )}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-500 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200">
                  Most Popular
                </div>
              )}

              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "w-16 h-16 rounded-3xl flex items-center justify-center",
                    plan.color === 'emerald' ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600"
                  )}>
                    <plan.icon className="w-8 h-8" />
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-slate-800">${plan.price}</p>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">per {plan.duration}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">{plan.name}</h3>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed">{plan.description}</p>
                </div>

                <div className="space-y-4">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-slate-50 rounded-full flex items-center justify-center text-emerald-500">
                        <Check className="w-3 h-3" />
                      </div>
                      <span className="text-sm font-bold text-slate-600">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedPlan(plan)}
                  className={cn(
                    "w-full py-5 rounded-[2rem] font-black uppercase tracking-widest text-sm transition-all shadow-xl",
                    plan.popular 
                      ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100" 
                      : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200"
                  )}
                >
                  Get Started
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Payment Modal */}
      <AnimatePresence>
        {selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Checkout</h2>
                    <p className="text-xs text-slate-500 font-medium">Secure Subscription</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPlan(null)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Plan</span>
                    <span className="text-sm font-bold text-slate-800">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Due</span>
                    <span className="text-2xl font-black text-slate-900">${selectedPlan.price}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Payment Method</p>
                  <div className="p-4 border-2 border-emerald-500 bg-emerald-50/30 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-6 bg-slate-800 rounded flex items-center justify-center text-[8px] text-white font-bold">VISA</div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Visa •••• 4242</p>
                        <p className="text-[10px] text-slate-500 font-medium">Expires 12/26</p>
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>

                <button
                  onClick={() => handleSubscribe(selectedPlan)}
                  disabled={isProcessing}
                  className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-sm hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `Subscribe Now`}
                </button>
                
                <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Secure 256-bit SSL Encrypted Payment
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

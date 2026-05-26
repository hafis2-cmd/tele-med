import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  X,
  Wallet,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Payment {
  id: string;
  patientEmail: string;
  patientName: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  method?: string;
  timestamp: any;
}

export default function Payments() {
  const { user, profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');

  useEffect(() => {
    if (!user || !profile) return;

    const fetchPayments = async () => {
      try {
        let query = supabase.from('payments').select('*');
        
        if (profile.role !== 'Admin') {
          query = query.eq('patient_email', user.email);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        setPayments((data || []).map((d: any) => ({
          id: d.id,
          patientEmail: d.patient_email,
          patientName: d.patient_name,
          amount: d.amount,
          currency: d.currency,
          status: d.status,
          description: d.description,
          method: d.method,
          timestamp: d.created_at
        })));
      } catch (err) {
        console.error('Error fetching payments:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();

    const channel = supabase
      .channel('payments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        fetchPayments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, profile]);

  const filteredPayments = payments.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const totalSpent = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingAmount = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">Payments</h1>
          <p className="text-slate-500 font-medium">Manage your medical bills, insurance claims, and transaction history.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            {(['all', 'completed', 'pending'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize",
                  filter === f ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-800"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          
          {profile?.role === 'Patient' && (
            <button
              onClick={() => setShowPayModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
            >
              <Plus className="w-4 h-4" />
              Make Payment
            </button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-4 relative overflow-hidden shadow-2xl shadow-slate-200">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-[4rem] -mr-8 -mt-8" />
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
            <Wallet className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Total Expenses</p>
            <h3 className="text-3xl font-black tracking-tight mt-1">${totalSpent.toFixed(2)}</h3>
          </div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
            <ArrowUpRight className="w-4 h-4" />
            <span>+12% from last month</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Pending Bills</p>
            <h3 className="text-3xl font-black tracking-tight text-slate-800 mt-1">${pendingAmount.toFixed(2)}</h3>
          </div>
          <p className="text-slate-500 text-xs font-medium">
            {payments.filter(p => p.status === 'pending').length} items awaiting payment
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Insurance Status</p>
            <h3 className="text-3xl font-black tracking-tight text-slate-800 mt-1">Active</h3>
          </div>
          <p className="text-slate-500 text-xs font-medium">Policy #TM-8829-X1</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
          <p className="text-slate-500 font-medium">Loading transactions...</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-12 text-center space-y-4 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
            <CreditCard className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-800">No transactions found</h3>
            <p className="text-slate-500 max-w-xs mx-auto">
              You haven't made any payments yet.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          payment.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                        )}>
                          {payment.status === 'completed' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{payment.description}</p>
                          <p className="text-xs text-slate-500 font-medium">{payment.method || 'Direct Payment'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {payment.timestamp ? new Date(payment.timestamp).toLocaleDateString() : 'Recent'}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="font-black text-slate-800">${payment.amount.toFixed(2)}</p>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5",
                        payment.status === 'completed' ? "bg-emerald-50 text-emerald-700" : 
                        payment.status === 'pending' ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                      )}>
                        <div className={cn(
                          "w-1 h-1 rounded-full",
                          payment.status === 'completed' ? "bg-emerald-500" : 
                          payment.status === 'pending' ? "bg-amber-500" : "bg-rose-500"
                        )} />
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        {payment.status === 'pending' ? (
                          <button 
                            onClick={() => setSelectedPayment(payment)}
                            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-100"
                          >
                            Pay Now
                          </button>
                        ) : (
                          <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedPayment && (
          <PaymentModal 
            payment={selectedPayment} 
            onClose={() => setSelectedPayment(null)} 
          />
        )}
        {showPayModal && (
          <CreatePaymentModal 
            onClose={() => setShowPayModal(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PaymentModal({ payment, onClose }: { payment: Payment, onClose: () => void }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePayment = async () => {
    setIsProcessing(true);
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      await supabase
        .from('payments')
        .update({ status: 'completed', method: 'Visa •••• 4242' })
        .eq('id', payment.id);
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
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
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Checkout</h2>
              <p className="text-xs text-slate-500 font-medium">Secure Payment Gateway</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-all">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {success ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">Payment Successful!</h3>
              <p className="text-slate-500">Your transaction has been processed.</p>
            </div>
          ) : (
            <>
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Description</span>
                  <span className="text-sm font-bold text-slate-800">{payment.description}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</span>
                  <span className="text-xl font-black text-slate-900">${payment.amount.toFixed(2)}</span>
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
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
                {isProcessing ? 'Processing...' : `Pay $${payment.amount.toFixed(2)}`}
              </button>
              
              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <ShieldCheck className="w-3 h-3" />
                256-bit SSL Encrypted
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function CreatePaymentModal({ onClose }: { onClose: () => void }) {
  const { user, profile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    amount: '',
    description: 'Consultation Fee',
    method: 'Visa •••• 4242'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setIsSaving(true);
    try {
      await supabase.from('payments').insert({
        patient_email: user.email,
        patient_name: profile.name || user.displayName || 'Patient',
        amount: parseFloat(formData.amount),
        currency: 'USD',
        status: 'completed',
        description: formData.description,
        method: formData.method
      });
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error(error);
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
        className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Make Payment</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="p-8">
          {success ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">Payment Successful!</h3>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Amount ($)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  placeholder="0.00"
                  className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Description</label>
                <select
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                >
                  <option>Consultation Fee</option>
                  <option>Medicine Purchase</option>
                  <option>Lab Test Fee</option>
                  <option>Insurance Premium</option>
                  <option>Other</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
                {isSaving ? 'Processing...' : 'Complete Payment'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

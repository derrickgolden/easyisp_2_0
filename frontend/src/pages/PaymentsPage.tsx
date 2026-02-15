
import React, { useState, useEffect } from 'react';
import { Card, Badge } from '../components/UI';
import { Payment } from '../types';
import { paymentsApi } from '../services/apiService';
import { ResolveMpesaModal } from '../components/modals/ResolveMpesaModal';
import { STORAGE_KEYS } from '../constants/storage';
import { toast } from 'sonner';

export const PaymentsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'completed' | 'pending'>('completed');
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [reconcilingPayment, setReconcilingPayment] = useState<Payment | null>(null);
  const [payments, setPayments] = useState<Payment[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYMENTS) || '[]'));
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, [ ]);
  
  const fetchPayments = async (isToast: boolean = false) => {
    setIsSyncing(true);
    try {
      const res = await paymentsApi.getAll();
      const paymentsList = Array.isArray(res?.data) ? res.data : res?.data?.data || [];
      setPayments(paymentsList as Payment[]);
      if (isToast) {
        toast.success('Ledger synced successfully!');
      }
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(paymentsList));
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to sync ledger. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const completedPayments = payments.filter(p => p.status === 'completed' && (
    p.mpesaCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.subscriberId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const pendingPayments = payments.filter(p => p.status === 'pending' && (
    p.mpesaCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone.includes(searchTerm)
  ));

  const onExport = () => {
    // For demo, we'll just trigger a download of the current payments as CSV
    const csvContent = [
      ['Subscriber ID', 'M-Pesa Code', 'Amount', 'Bill Ref', 'Sender Name', 'Phone', 'Status', 'Timestamp'],
      ...payments.map(p => [p.subscriberId, p.mpesaCode, p.amount, p.billRef, `${p.firstName} ${p.lastName}`, p.phone, p.status, p.timestamp])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `payments_${new Date().toISOString()}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };  

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Financial Ledger</h2>
          <p className="text-sm text-gray-500">Revenue tracking and transaction reconciliation center.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => fetchPayments(true)}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            title="Sync Ledger"
            disabled={isSyncing}
          >
            <svg className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button 
            onClick={onExport}
            className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* VIEW TOGGLE AND SEARCH */}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
        <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl w-fit shadow-inner">
          <button 
            onClick={() => setActiveTab('completed')} 
            className={`px-6 py-2.5 text-sm font-black rounded-xl transition-all flex items-center gap-2 ${activeTab === 'completed' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Completed
          </button>
          <button 
            onClick={() => setActiveTab('pending')} 
            className={`px-6 py-2.5 text-sm font-black rounded-xl transition-all flex items-center gap-2 ${activeTab === 'pending' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-md' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Pending
            {pendingPayments.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] rounded-full animate-bounce">
                {pendingPayments.length}
              </span>
            )}
          </button>
        </div>

        <div className="relative w-full lg:w-96">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input 
            type="text" 
            placeholder={`Search ${activeTab} records...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl text-sm shadow-sm focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {activeTab === 'pending' ? (
        /* PENDING / UNRECONCILED TABLE */
        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
            <h3 className="text-sm font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">Unlinked M-Pesa Receipts</h3>
          </div>
          <Card title="Background Recon Queue" className="border-none shadow-xl shadow-amber-500/5 dark:shadow-none overflow-hidden bg-amber-50/10 dark:bg-amber-900/5 border-amber-100 dark:border-amber-900/20">
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead className="text-left text-amber-600 dark:text-amber-500 uppercase text-[10px] tracking-widest bg-amber-50/50 dark:bg-amber-900/10">
                  <tr>
                    <th className="py-4 px-6">M-Pesa Code</th>
                    <th className="py-4 px-6">Amount</th>
                    <th className="py-4 px-6">Reference Input</th>
                    <th className="py-4 px-6">Sender Phone</th>
                    <th className="py-4 px-6">Time Received</th>
                    <th className="py-4 px-6 text-right">Resolve</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-t border-amber-100 dark:border-amber-900/20">
                  {pendingPayments.length > 0 ? pendingPayments.map((payment) => (
                    <tr key={payment.id} className="group hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all">
                      <td className="py-5 px-6">
                        <span className="font-mono font-black text-gray-900 dark:text-white tracking-tight">{payment.mpesaCode}</span>
                      </td>
                      <td className="py-5 px-6">
                        <span className="text-amber-600 dark:text-amber-400 font-black">
                          KSH {payment.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-5 px-6">
                        <span className="text-[11px] bg-white dark:bg-slate-800 px-2 py-1 rounded border border-amber-100 dark:border-amber-900/30 text-gray-600 dark:text-gray-300 font-mono">
                          {payment.lastName}
                        </span>
                      </td>
                      <td className="py-5 px-6">
                        <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">{payment.phone}</span>
                      </td>
                      <td className="py-5 px-6">
                        <p className="text-gray-500 dark:text-gray-400 font-medium text-xs truncate w-32">{payment.timestamp}</p>
                      </td>
                      <td className="py-5 px-6 text-right">
                        <button 
                          onClick={() => {
                            setReconcilingPayment(payment);
                            setIsResolveModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase rounded-lg shadow-lg shadow-amber-600/20 transition-all active:scale-95"
                        >
                          Link Account
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <div className="flex flex-col items-center opacity-40">
                          <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <p className="font-medium italic">Reconciliation queue is empty.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        /* COMPLETED TRANSACTIONS TABLE */
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Successfully Processed</h3>
          </div>
          <Card title="Completed Ledger" className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest bg-gray-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800">
                  <tr>
                    <th className="py-4 px-6">Subscriber</th>
                    <th className="py-4 px-6">M-Pesa Code</th>
                    <th className="py-4 px-6">Amount</th>
                    <th className="py-4 px-6">Bill ID/Ref</th>
                    <th className="py-4 px-6">Sender Name</th>
                    <th className="py-4 px-6">Date & Time</th>
                    <th className="py-4 px-6 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {completedPayments.length > 0 ? completedPayments.map((payment) => (
                    <tr key={payment.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all">
                      <td className="py-5 px-6">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-[11px] font-black uppercase font-mono">
                          {payment.subscriberId}
                        </span>
                      </td>
                      <td className="py-5 px-6">
                        <span className="font-mono font-bold text-gray-900 dark:text-white tracking-tight">{payment.mpesaCode}</span>
                      </td>
                      <td className="py-5 px-6">
                        <span className="text-green-600 dark:text-green-400 font-black">
                          KSH {payment.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-5 px-6">
                        <span className="text-gray-500 dark:text-gray-400 font-medium">{payment.billRef}</span>
                      </td>
                      <td className="py-5 px-6">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white leading-none mb-1">{payment.firstName}</p>
                          <p className="text-[10px] text-gray-400 font-mono tracking-tighter truncate w-24">{payment.phone}</p>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <p className="text-gray-500 dark:text-gray-400 font-medium text-xs truncate w-32">{new Date(payment.timestamp).toLocaleString()}</p>
                      </td>
                      <td className="py-5 px-6 text-right">
                        <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-gray-400 italic text-xs">No matching completed transactions found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
      <ResolveMpesaModal
        isResolveModalOpen={isResolveModalOpen}
        setIsResolveModalOpen={setIsResolveModalOpen}
        reconcilingPayment={reconcilingPayment}
        setReconcilingPayment={setReconcilingPayment}
        onResolved={() => { fetchPayments(); setIsResolveModalOpen(false); }}
      />
    </div>
  );
};

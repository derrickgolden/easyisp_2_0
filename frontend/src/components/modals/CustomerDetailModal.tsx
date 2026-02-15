
import React from 'react';
import { Modal, Badge } from '../UI';
import { Customer, Package } from '../../types';

interface CustomerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  packages: Package[];
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  isOpen, onClose, customer, packages
}) => {
  if (!customer) return null;

  const pkg = packages.find(p => p.id === customer.packageId);
  
  const calculateDaysRemaining = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const daysLeft = calculateDaysRemaining(customer.expiryDate);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Subscriber Intelligence"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Profile Header */}
        <div className="flex items-center gap-6 p-6 bg-slate-900 dark:bg-slate-950 rounded-3xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
             <Badge variant={customer.status}>{customer.status.toUpperCase()}</Badge>
          </div>
          <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl font-black shadow-2xl shadow-blue-500/20 z-10">
            {customer.firstName.charAt(0)}{customer.lastName.charAt(0)}
          </div>
          <div className="z-10">
            <h3 className="text-2xl font-black tracking-tight">{customer.firstName} {customer.lastName}</h3>
            <p className="text-blue-400 font-medium text-sm">Account ID: {customer.id}</p>
            <div className="flex gap-4 mt-2">
               <div className="flex items-center gap-1.5 text-xs text-slate-400">
                 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                 {customer.phone}
               </div>
               {customer.email && (
                 <div className="flex items-center gap-1.5 text-xs text-slate-400">
                   <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                   {customer.email}
                 </div>
               )}
            </div>
          </div>
          <div className="absolute bottom-[-20%] right-[-5%] w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Location & Address</label>
            <div className="space-y-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{customer.apartment || 'Not Specified'}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">House: {customer.houseNo || 'N/A'}</p>
              <p className="text-xs text-blue-600 font-bold">{customer.location}</p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Connection Metadata</label>
            <div className="space-y-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter">{customer.connectionType}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">RADIUS Sync: <span className="text-green-500 font-bold">ACTIVE</span></p>
              <p className="text-xs text-gray-500 italic">Created: {customer.createdAt}</p>
            </div>
          </div>
        </div>

        {/* Subscription Card */}
        <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <label className="text-[10px] font-black uppercase text-blue-500 tracking-widest block mb-1">Active Subscription</label>
              <h4 className="text-xl font-black text-gray-900 dark:text-white">{pkg?.name || 'Legacy Plan'}</h4>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400">KSH {pkg?.price?.toLocaleString() || '0'}</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase">Auto-Renew Status: <span className="text-blue-500">OFF</span></p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 border-t border-blue-100 dark:border-blue-900/20 pt-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Down/Up</p>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{pkg?.speed_down} / {pkg?.speed_up}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Expires On</p>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{customer.expiryDate}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
              <p className={`text-sm font-black ${daysLeft < 3 ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>
                {daysLeft} Days Left
              </p>
            </div>
          </div>
        </div>

        {/* Financial Overview */}
        <div className="p-4 border border-gray-100 dark:border-slate-800 rounded-2xl flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             <div>
               <p className="text-[10px] font-black text-gray-400 uppercase">Current Balance</p>
               <p className="text-base font-black text-gray-900 dark:text-white">KSH {customer.balance.toLocaleString()}</p>
             </div>
           </div>
           <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all">
             Deposit Credit
           </button>
        </div>
      </div>
    </Modal>
  );
};

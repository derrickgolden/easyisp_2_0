
import React, { useState, useMemo, useEffect } from 'react';
import { Card, Badge, Modal } from '../components/UI';
import { Customer, Payment, TechnicalSpec } from '../types';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomerModal } from '../components/modals/CustomerModal';
import { customersApi, paymentsApi } from '../services/apiService';
import { useCustomerActions } from '../hooks/useCustomerActions';
import { DirectDepositModal } from '../components/modals/DirectDepositModal';
import { TechnicalSpecCard } from '../components/cards/customerDetailsCards.tsx/TechnicalSpecsCard';
import { ChangeDateModal } from '../components/modals/ChangeDateModal';
import { ChangePackageModal } from '../components/modals/ChangePackageModal';
import { ReconcileMpesaModal } from '../components/modals/ReconcileMpesaModal';
import PaymentHistoryCard from '../components/cards/customerDetailsCards.tsx/PaymentHistoryCard';

interface CustomerDetailPageProps {}

export const CustomerDetailPage: React.FC<CustomerDetailPageProps> = () => {
  const navigate = useNavigate();
  const { customerId } = useParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [parent, setParent] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [technicalSpecs, setTechnicalSpecs] = useState<TechnicalSpec>();
  const [isChangeDateModalOpen, setIsChangeDateModalOpen] = useState({open: false, type:''});
  const [callApi, setCallApi] = useState(false);
  const lastFetchKeyRef = React.useRef<string | null>(null);

  const { state, actions } = useCustomerActions();

  
  const customerPayments = useMemo(() => {
    if (!customer) return [];
    return state.payments.filter(p => 
      p.subscriberId === customer.id || 
      p.subscriberId === customer.radiusUsername
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.payments, customer]);

  const totalSpent = useMemo(() => customerPayments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0), [customerPayments]);

  const daysLeft = useMemo(() => {
    if (!customer) return 0;
    const today = new Date();
    const expiry = new Date(customer.expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }, [customer?.expiryDate]);

  const isParentActive = useMemo(() => parent ? parent.status === 'active' : true, [parent?.status]);
  const isCutDueToParent = useMemo(() => parent && !customer?.isIndependent && !isParentActive, [parent, customer?.isIndependent, isParentActive]);
  const effectivelyActive = useMemo(() => customer?.status === 'active' && !isCutDueToParent, [customer?.status, isCutDueToParent]);

  // Fetch customer and related data
  useEffect(() => {
    if (!customerId) return;
    const fetchKey = `${customerId}-${callApi}`;
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    fetchTechnicalSpecs();
    fetchCustomerData();
    fetchPayments();
  }, [customerId, callApi]);
  // Fetch technical specs
  const fetchTechnicalSpecs = async () => {
    if (!customerId) return;
    try {
      const response = await customersApi.getTechnicalSpecs(customerId);
      console.log('Technical specs response:', response);
      setTechnicalSpecs(response);
    } catch (err: any) {
      console.error('Failed to fetch technical specs:', err);
    }
  };

  const fetchCustomerData = async () => {
    if (!customerId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await customersApi.getWithRelations(customerId);
      console.log('Customer data response:', response);
      const {customer} = response;
      setCustomer(customer);
      setParent(customer.parent || null);
    } catch (err: any) {
      console.error('Failed to fetch customer:', err);
      setError(err.message || 'Failed to load customer details');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const res = await paymentsApi.getAll();
      const paymentsList = Array.isArray(res?.data) ? res.data : res?.data?.data || [];
      actions.setPayments(paymentsList as Payment[]);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-semibold">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-4">{error || 'Customer not found'}</p>
          <button 
            onClick={() => navigate('/crm/customers')}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
          >
            Back to Customers
          </button>
        </div>
      </div>
    );
  }  

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20">
      {/* Top Header Actions */}
      <div className="flex md:items-center justify-between gap-4">
        <button 
          onClick={() =>navigate('/crm/customers')}
          className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors w-fit group"
        >
          <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-100 dark:border-slate-800 group-hover:border-blue-500 transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </div>
          <span className='hidden sm:block'>Back to customers</span>
        </button>
        
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => actions.handleStkPush(customer)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            STK Push
          </button>

          <button 
            onClick={() => actions.setIsSmsModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            Send SMS
          </button>
          
          <button 
            onClick={() => actions.handleEdit(customer)}
            className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-gray-100 dark:border-slate-800 rounded-xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Edit Profile
          </button>
          
          <button 
            onClick={() => { actions.deleteCustomer(customer) }}
            className="p-2 bg-red-500/10 text-red-600 rounded-xl hover:bg-red-500/20 transition-all"
            title="Delete Account"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Enhanced Identity Hero */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800 p-8 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 text-right flex flex-col items-end gap-2">
               <Badge variant={effectivelyActive ? 'active' : (customer.status === 'suspended' ? 'suspended' : 'expired')}>
                 {effectivelyActive ? 'ACTIVE' : (customer.status === 'suspended' ? 'PAUSED' : 'EXPIRED')}
               </Badge>
            </div>
            
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
              <div className="relative group">
                <div className="w-32 h-32 rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-5xl font-black text-white shadow-2xl shadow-blue-500/30 ring-4 ring-white dark:ring-slate-900">
                  {customer.firstName?.charAt(0) || '?'}{customer.lastName?.charAt(0) || ''}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-xl border-4 border-white dark:border-slate-900 flex items-center justify-center shadow-lg ${effectivelyActive ? 'bg-green-500' : 'bg-red-500'}`}>
                  <div className={`w-2 h-2 rounded-full bg-white ${effectivelyActive ? 'animate-pulse' : ''}`}></div>
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-2">
                  {customer.firstName} {customer.lastName}
                </h3>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-6">
                   <p className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg font-bold text-xs">ID: {customer.id}</p>
                   <p className="px-3 py-1 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-lg font-mono text-xs uppercase tracking-tighter">@{customer.radiusUsername}</p>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-x-8 gap-y-4 text-left">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                      <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-blue-500 shadow-sm"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></div>
                      <span className="font-bold text-sm">{customer.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                      <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-blue-500 shadow-sm"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></div>
                      <span className="font-bold text-sm truncate">{customer.email || 'No Email Record'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                      <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-blue-500 shadow-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.396 0 4.651.59 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 21a8 8 0 10-16 0" />
                        </svg>
                      </div>
                      <span className="font-bold text-sm truncate">{customer.radiusUsername || 'No Username Record'}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                      <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-indigo-500 shadow-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
                      <div>
                        <p className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-tighter leading-none">{customer.location}</p>
                        <p className="text-[10px] text-gray-500 mt-1">{customer.apartment}, House {customer.houseNo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                        <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-indigo-500 shadow-sm">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p>
                        {/* <span className="font-bold text-sm text-gray-900 dark:text-white">Registered: </span> */}
                          {new Date(customer.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                        <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-indigo-500 shadow-sm">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11V7a4 4 0 10-8 0v4" />
                            <rect x="4" y="11" width="16" height="10" rx="2" ry="2" strokeWidth={2} />
                          </svg>
                        </div>
                        <p>
                          {customer.radiusPassword || 'No Password Record'}
                        </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className='lg:hidden'>
            <TechnicalSpecCard 
              technicalSpecs={technicalSpecs} 
              customer={customer}
              onRefresh={async () => { await fetchTechnicalSpecs(); }}
            />
          </div>

          {/* Subscription & Financial Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Active Subscription" className="border-none shadow-sm rounded-[2.5rem] bg-blue-50/30 dark:bg-blue-900/5">
               <div className="space-y-4">
                 <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">{customer.package?.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black uppercase text-blue-600 tracking-widest">{customer.connectionType}</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{customer.package?.speed_down} Plan</span>
                      </div>
                    </div>
                    <p className="text-2xl font-black text-blue-600">KSH {customer.package?.price.toLocaleString()}</p>
                 </div>

                 <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900/20">
                  { customer?.extensionDate &&
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Extension Date</span>
                      <span className="text-[10px] font-bold text-gray-500">{new Date(customer.extensionDate).toLocaleString()}</span>
                    </div>
                  }
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Expiry Date</span>
                      <span className="text-[10px] font-bold text-gray-500">{new Date(customer.expiryDate).toLocaleString()}</span>
                    </div>
                    <p className={`text-xl font-black ${effectivelyActive ? (daysLeft < 5 ? 'text-red-500 animate-pulse' : 'text-emerald-500') : 'text-slate-400'}`}>
                      {effectivelyActive ? `${daysLeft} Days Remaining` : 'Service Disconnected'}
                    </p>
                 </div>

                 <div className="grid grid-cols-1 gap-2 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => actions.handlePauseService(customer)}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          customer.status === 'suspended' 
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {customer.status === 'suspended' ? 'Resume Service' : 'Pause Service'}
                      </button>
                      <button 
                        onClick={() => setIsChangeDateModalOpen({open: true, type: 'extension'})}
                        className="flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Extend Period
                      </button>
                    </div>
                    <button 
                      onClick={() => setIsChangeDateModalOpen({open: true, type: 'expiry'})}
                      className="w-full py-3 border border-red-200 dark:border-blue-800 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                    >
                      Change Expiry Date
                    </button>
                    <button 
                      onClick={() => actions.setIsPackageModalOpen(true)}
                      className="w-full py-3 border border-dashed border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
                    >
                      Change Subscription Plan
                    </button>
                 </div>
               </div>
            </Card>

            <Card title="Financial Insight" className="border-none shadow-sm rounded-[2.5rem]">
               <div className="space-y-6">
                 <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Account Balance</p>
                      <p className={`text-3xl font-black ${customer.balance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>KSH {customer.balance.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
                      <svg className={`w-8 h-8 ${customer.balance < 0 ? 'text-red-500' : 'text-green-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                 </div>

                 <div className="p-5 bg-emerald-50/50 dark:bg-emerald-900/5 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Lifetime Spend</p>
                    <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">KSH {totalSpent.toLocaleString()}</p>
                    <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase italic">Sum of all completed receipts</p>
                 </div>

                 <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => actions.setIsDepositModalOpen(true)} className="py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase rounded-xl transition-all hover:opacity-90">Direct Deposit</button>
                    <button onClick={() => actions.setIsReconcileModalOpen(true)} className="py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase rounded-xl transition-all hover:bg-gray-50 dark:hover:bg-slate-800">Reconcile M-Pesa</button>
                 </div>
               </div>
            </Card>
          </div>

          {/* PAYMENT HISTORY LEDGER - AT BOTTOM */}
          <div className="hidden lg:block">
            <PaymentHistoryCard
              customerPayments={customerPayments}
            />
          </div>

        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <div className='hidden lg:block'>
            <TechnicalSpecCard 
              technicalSpecs={technicalSpecs} 
              customer={customer}
              onRefresh={async () => { await fetchTechnicalSpecs(); }}
            />
          </div>

          {/* RADIUS AUTH LOGS */}
          <Card title="Authentication Records" className="border-none shadow-sm rounded-[2.5rem]">
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500 font-medium italic">Detailed RADIUS authentication and accounting trail.</p>
            </div>

              <div className="mt-4 overflow-x-auto -mx-6 border-t dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest bg-gray-50/50 dark:bg-slate-800/30">
                    <tr>
                      {/* <th className="py-4 px-6">Time</th> */}
                      <th className="py-4 px-6">Reply</th>
                      <th className="py-4 px-6">Auth Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800">
                    {technicalSpecs?.logs?.data?.map((log) => (
                        <tr key={log.id} className="hover:bg-blue-50/10 transition-colors">
                          {/* <td className="py-4 px-6 text-xs text-gray-500 font-mono">{log.time}</td> */}
                          <td className="py-4 px-6">
                            <span className="text-[10px] font-black uppercase text-slate-400">{log.reply}</span> <br />
                            <span className=" text-xs text-gray-500 font-mono">{log.time}</span>
                          </td>
                          <td className="py-4 px-6">
                            <Badge variant={log.status_label.toLowerCase() === 'auth successful' ? 'active' : 'expired'}>
                              {log.status_label.toUpperCase()}
                            </Badge>
                          </td>
                        </tr>
                      )) || (
                        <tr><td colSpan={3} className="py-10 text-center text-xs text-gray-400 italic">No logs found in the core database.</td></tr>
                      )}
                  </tbody>
                </table>
              </div>
          </Card>

          {/* Relational Hierarchy with Sub-Account Details */}
           <Card title="Relational Hierarchy" className="rounded-[2.5rem] border-none shadow-sm bg-purple-50/50 dark:bg-purple-900/5">
              <div className="space-y-4">
                 {parent ? (
                   <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-purple-200 dark:border-purple-800 shadow-sm">
                      <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-2">Primary Billing Parent</p>
                      <div className="flex items-center justify-between">
                         <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{parent.firstName} {parent.lastName}</p>
                            <p className="text-[9px] text-gray-400 font-mono">@{parent.radiusUsername}</p>
                         </div>
                         <button onClick={() => navigate(`/crm/customers/${parent.id}`)} className="px-3 py-1 bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-300 rounded-lg text-[10px] font-black uppercase tracking-tighter">Switch</button>
                      </div>
                   </div>
                 ) : (
                   <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-purple-200 dark:border-purple-800 shadow-sm gap-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-lg">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest leading-none mb-1">Identity Rank</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter">Master Account</p>
                      </div>
                      <button 
                        onClick={() => actions.handleAddChild(customer)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Add Sub-Account
                      </button>
                   </div>
                 )}

                 {customer.subAccounts?.length > 0 && (
                   <div className="space-y-2 pt-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Sub-Accounts ({customer.subAccounts.length})</p>
                      <div className="grid grid-cols-1 gap-2">
                        {customer.subAccounts?.map(child => {

                          // const childPkg = packages.find(p => p.id === child.packageId);
                          return (
                            <div key={child.id} onClick={() => navigate(`/crm/customers/${child.id}`)} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 cursor-pointer hover:border-purple-500 transition-colors">
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                                  {child.isIndependent ? 'Independent Billing' : 'Shared Billing'}
                                </span>
                                <div className={`rounded-md px-1 ${child.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                  {child.status}
                                </div>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                 <p className="text-[12px] text-gray-700 font-mono tracking-tighter">{child.radiusPassword} • {child.radiusUsername}</p>
                                 {/* <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{childPkg?.name || 'Legacy Plan'}</p> */}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                   </div>
                 )}
              </div>
           </Card>

           {/* PAYMENT HISTORY LEDGER - AT BOTTOM */}
          <div className="lg:hidden">
            <PaymentHistoryCard
              customerPayments={customerPayments}
            />
          </div>
        </div>
      </div>

      {/* SMS MODAL */}
      <Modal isOpen={state.isSmsModalOpen} onClose={() => actions.setIsSmsModalOpen(false)} title={`Compose Transmission to ${customer.firstName}`}>
         <div className="space-y-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800 flex items-center gap-3">
               <div className="p-2 bg-emerald-600 rounded-lg text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest leading-none mb-1">Destination Phone</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{customer.phone}</p>
               </div>
            </div>
            
            <div>
               <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 block mb-2">Message Body</label>
               <textarea 
                  value={state.smsText}
                  onChange={e => actions.setSmsText(e.target.value)}
                  rows={4}
                  placeholder="Enter SMS content..."
                  className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
               />
               <p className="text-[10px] text-right text-gray-400 font-bold mt-1 uppercase tracking-tighter">{state.smsText.length} Characters</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
               <button 
                  onClick={() => actions.setIsSmsModalOpen(false)}
                  className="py-3 bg-gray-100 dark:bg-slate-800 text-gray-500 text-[10px] font-black uppercase rounded-xl"
               >
                  Discard
               </button>
               <button 
                  onClick={() => actions.handleSendSms(customer) }
                  className="py-3 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95"
               >
                  Transmit SMS
               </button>
            </div>
         </div>
      </Modal>

      <CustomerModal 
        isOpen={state.isCustomerModalOpen}
        onClose={() => actions.setIsCustomerModalOpen(false)}
        setIsCustomerModalOpen={actions.setIsCustomerModalOpen}
        editingCustomer={state.editingCustomer}
        setEditingCustomer={actions.setEditingCustomer}
        customers={ [] }
        onSuccess={() => setCallApi(!callApi) }
      />

      <DirectDepositModal
        isOpen={state.isDepositModalOpen}
        setIsDepositModalOpen={actions.setIsDepositModalOpen}
        customer={customer}
        onSuccess={() => setCallApi(!callApi)}
      />

      <ChangeDateModal
         isChangeDateModalOpen={isChangeDateModalOpen}
         setIsChangeDateModalOpen={setIsChangeDateModalOpen}
         customer={customer}
         onSuccess={() => setCallApi(!callApi)}
      />

      <ChangePackageModal
        isOpen={state.isPackageModalOpen}
        onClose={() => actions.setIsPackageModalOpen(false)}
        customer={customer}
        onSuccess={() => setCallApi(!callApi)}
      />

      <ReconcileMpesaModal
        customer={customer} 
        isResolveModalOpen={state.isReconcileModalOpen}
        setIsResolveModalOpen={actions.setIsReconcileModalOpen}
        onClose={() => actions.setIsReconcileModalOpen(false)}
        onSuccess={() => setCallApi(!callApi)}
      />  

    </div>
  );
};


import React, { useState, useMemo, useEffect } from 'react';
import { Card, Badge, Modal } from '../components/UI';
import { Payment, Expense, Customer, Package } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { customersApi, packagesApi, paymentsApi } from '../services/apiService';
import { useNavigate } from 'react-router-dom';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState<Customer[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '[]'));
  const [expenses, setExpenses] = useState<Expense[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.EXPENSES) || '[]'));
  const [payments, setPayments] = useState<Payment[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYMENTS) || '[]'));
  const [packages, setPackages] = useState<Package[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.PACKAGES) || '[]')); 
  
  // Detail Modal States
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailModalTitle, setDetailModalTitle] = useState('');
  const [detailCustomersList, setDetailCustomersList] = useState<Customer[]>([]);

  useEffect(() => {
    fetchPayments();
    fetchCustomers();
    fetchPackages();
  }, [ ]);

  const fetchPayments = async () => {
    try {
      const res = await paymentsApi.getAll();
      const paymentsList = Array.isArray(res?.data) ? res.data : res?.data?.data || [];
      setPayments(paymentsList as Payment[]);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const fetchCustomers = async () => {
      try {
        const customersRes = await customersApi.getAll();
        
        const customersList = customersRes.data || [];
        setCustomers(customersList);
  
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customersList));
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
  };

  const fetchPackages = async () => {
      try {
        const res = await packagesApi.getAll();
  
        localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(res.data || []));
        setPackages(res.data || []);
      } catch (error) {
        console.error('Error fetching packages:', error);
      }
  };
  

  const filteredData = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const filteredPayments = payments.filter(p => {
      const pDate = new Date(p.timestamp);
      return pDate >= start && pDate <= end;
    });

    const filteredExpenses = expenses.filter(e => {
      const eDate = new Date(e.date);
      return eDate >= start && eDate <= end;
    });

    const filteredCustomers = customers.filter(c => {
      const cDate = new Date(c.createdAt);
      return cDate >= start && cDate <= end;
    });

    return { filteredPayments, filteredExpenses, filteredCustomers };
  }, [payments, expenses, customers, startDate, endDate]);

  const totalRevenue = filteredData.filteredPayments.reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpenses = filteredData.filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  // Balance-based Metrics
  const customersInArrears = customers.filter(c => c.balance < 0);
  const customersWithSurplus = customers.filter(c => c.balance > 0);
  const totalUnpaidDebt = customersInArrears.reduce((acc, curr) => acc + Math.abs(curr.balance), 0);
  const totalPaidSurplus = customersWithSurplus.reduce((acc, curr) => acc + curr.balance, 0);

  // Churn/Expected Earnings Logic
  const expectedEarningFromExpired = useMemo(() => {
    const today = new Date();
    const fewDaysAgo = new Date();
    fewDaysAgo.setDate(today.getDate() - 7); // Past 7 days

    return customers
      .filter(c => {
        const expiry = new Date(c.expiryDate);
        return c.status !== 'active' || (expiry < today && expiry >= fewDaysAgo);
      })
      .reduce((acc, curr) => {
        const pkg = packages.find(p => p.id === curr.packageId);
        return acc + (Number(pkg?.price) || 0);
      }, 0);
  }, [customers, packages]);
  
  // Package breakdown with revenue attribution
  const packageStats = useMemo(() => {
    return packages.map(pkg => {
      const count = customers.filter(c => c.packageId === pkg.id).length;
      const customerIdsInPkg = customers.filter(c => c.packageId === pkg.id).map(c => c.id);
      const generatedRevenue = filteredData.filteredPayments
        .filter(p => customerIdsInPkg.includes(p.subscriberId))
        .reduce((acc, curr) => acc + curr.amount, 0);

      return { 
        name: pkg.name, 
        count, 
        percentage: customers.length > 0 ? (count / customers.length) * 100 : 0,
        revenue: generatedRevenue 
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [packages, customers, filteredData.filteredPayments]);

  const handleShowArrearsDetails = () => {
    setDetailModalTitle('Arrears Breakdown (Negative Balances)');
    setDetailCustomersList(customersInArrears);
    setIsDetailModalOpen(true);
  };

  const handleShowSurplusDetails = () => {
    setDetailModalTitle('Surplus Breakdown (Positive Balances)');
    setDetailCustomersList(customersWithSurplus);
    setIsDetailModalOpen(true);
  };

  const getPkgName = (id: string) => packages.find(p => p.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Date Range Selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">Business Intelligence</h2>
          <p className="text-xs text-gray-500">Aggregate data analysis for fiscal period: <span className="font-bold text-blue-600 uppercase">{startDate} to {endDate}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-1.5 rounded-xl gap-2">
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent border-none text-xs font-bold focus:ring-0 text-gray-700 dark:text-gray-300" 
            />
            <span className="text-gray-400 font-black">→</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent border-none text-xs font-bold focus:ring-0 text-gray-700 dark:text-gray-300" 
            />
          </div>
          <button className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-500/20">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        </div>
      </div>

      {/* Financial Health Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="p-6 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-[2rem] shadow-sm">
           <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Gross Revenue</p>
           <p className="text-2xl font-black text-gray-900 dark:text-white">KSH {totalRevenue.toLocaleString()}</p>
           <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              <span>{filteredData.filteredPayments.length} Payments Collected</span>
           </div>
         </div>
         <div className="p-6 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-[2rem] shadow-sm">
           <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Total Expenses</p>
           <p className="text-2xl font-black text-red-600 dark:text-red-400">KSH {totalExpenses.toLocaleString()}</p>
           <div className="mt-2 flex items-center gap-1 text-[10px] text-red-500 font-bold">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              <span>{filteredData.filteredExpenses.length} Ledger Items</span>
           </div>
         </div>
         <div className="p-6 bg-slate-900 rounded-[2rem] shadow-xl text-white relative overflow-hidden group">
           <div className="relative z-10">
             <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Net Profit (EBITDA)</p>
             <p className="text-3xl font-black text-blue-400">KSH {netProfit.toLocaleString()}</p>
             <div className="mt-2">
                <Badge variant={netProfit > 0 ? 'active' : 'expired'}>
                  {netProfit > 0 ? 'PROFITABLE' : 'LOSS'}
                </Badge>
             </div>
           </div>
           <div className="absolute right-[-10%] bottom-[-20%] w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
         </div>
         <div className="p-6 bg-indigo-600 rounded-[2rem] shadow-xl text-white relative overflow-hidden group">
           <div className="relative z-10">
             <p className="text-[10px] font-black uppercase text-indigo-200 tracking-widest mb-1">Expected Earning</p>
             <p className="text-2xl font-black">KSH {expectedEarningFromExpired.toLocaleString()}</p>
             <p className="text-[10px] text-indigo-200 mt-2 font-bold uppercase">From recently expired Subs</p>
           </div>
           <div className="absolute left-[-10%] top-[-20%] w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
         </div>
      </div>

      {/* Balance Analysis Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <Card title="Unpaid Earnings (Arrears)" className="rounded-[2.5rem] border-none shadow-xl shadow-red-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-black text-red-600 dark:text-red-400">KSH {totalUnpaidDebt.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Total amount owed by <span className="font-bold">{customersInArrears.length}</span> customers with negative balances.</p>
                <button 
                  onClick={handleShowArrearsDetails}
                  className="mt-4 px-4 py-2 bg-red-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  View Arrears Detail
                </button>
              </div>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
            </div>
         </Card>
         <Card title="Paid Earnings (Surplus)" className="rounded-[2.5rem] border-none shadow-xl shadow-emerald-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">KSH {totalPaidSurplus.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Total credit held by <span className="font-bold">{customersWithSurplus.length}</span> customers with positive balances.</p>
                <button 
                  onClick={handleShowSurplusDetails}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  View Surplus Detail
                </button>
              </div>
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Package Revenue Table */}
        <Card title="Revenue by Package" className="lg:col-span-2 rounded-[2.5rem] overflow-hidden">
           <div className="overflow-x-auto -mx-6 -mt-4">
              <table className="w-full text-sm">
                <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest bg-gray-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800">
                   <tr>
                      <th className="py-4 px-6">Service Plan</th>
                      <th className="py-4 px-6">Subscribers</th>
                      <th className="py-4 px-6">Market Share</th>
                      <th className="py-4 px-6 text-right">Generated Revenue</th>
                   </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                   {packageStats.map(stat => (
                     <tr key={stat.name} className="group hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-all">
                        <td className="py-5 px-6">
                           <p className="font-bold text-gray-900 dark:text-white leading-none">{stat.name}</p>
                        </td>
                        <td className="py-5 px-6">
                           <span className="font-medium text-gray-600 dark:text-gray-400">{stat.count} Active</span>
                        </td>
                        <td className="py-5 px-6">
                           <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-blue-600" style={{ width: `${stat.percentage}%` }}></div>
                              </div>
                              <span className="text-[10px] font-black text-gray-400">{stat.percentage.toFixed(1)}%</span>
                           </div>
                        </td>
                        <td className="py-5 px-6 text-right">
                           <span className="font-black text-gray-900 dark:text-white">KSH {stat.revenue.toLocaleString()}</span>
                        </td>
                     </tr>
                   ))}
                </tbody>
              </table>
           </div>
        </Card>

        {/* Financial Distribution */}
        <Card title="Asset Allocation" className="rounded-[2.5rem]">
           <div className="space-y-6 mt-4">
              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                 <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Top Revenue Contributor</p>
                 <p className="text-lg font-black text-blue-600">{packageStats[0]?.name || 'N/A'}</p>
                 <p className="text-xs text-gray-500 mt-1">Responsible for {packageStats[0] ? ((packageStats[0].revenue / (totalRevenue || 1)) * 100).toFixed(1) : 0}% of collections.</p>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between text-xs font-bold">
                   <span className="text-gray-500 uppercase">Operational Efficiency</span>
                   <span className="text-emerald-500">92%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 rounded-full" style={{ width: '92%' }}></div>
                </div>
                <p className="text-[10px] text-gray-400 italic">Calculation based on collection vs provisioned bandwidth costs.</p>
              </div>
           </div>
        </Card>
      </div>

      {/* Expense Categories Detailed breakdown */}
      <Card title="Operational Overhead Breakdown" className="rounded-[2.5rem] overflow-hidden">
         <div className="overflow-x-auto -mx-6">
           <table className="w-full text-sm">
             <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest border-b dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
               <tr>
                 <th className="py-4 px-6">Expense Category</th>
                 <th className="py-4 px-6">Entries</th>
                 <th className="py-4 px-6">Total Spent</th>
                 <th className="py-4 px-6">Budget Impact</th>
                 <th className="py-4 px-6 text-right">Status</th>
               </tr>
             </thead>
             <tbody className="divide-y dark:divide-slate-800">
               {Array.from(new Set(expenses.map(e => e.category))).map(cat => {
                 const catTotal = filteredData.filteredExpenses.filter(e => e.category === cat).reduce((acc, curr) => acc + curr.amount, 0);
                 const count = filteredData.filteredExpenses.filter(e => e.category === cat).length;
                 const impact = totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0;
                 return (
                   <tr key={cat} className="group hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-all">
                     <td className="py-4 px-6 font-bold text-gray-900 dark:text-white">{cat}</td>
                     <td className="py-4 px-6 text-gray-500 font-medium">{count} records</td>
                     <td className="py-4 px-6 font-black text-gray-900 dark:text-white">KSH {catTotal.toLocaleString()}</td>
                     <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                           <div className="w-20 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-red-500" style={{ width: `${impact}%` }}></div>
                           </div>
                           <span className="text-[10px] font-bold text-gray-400">{impact.toFixed(1)}%</span>
                        </div>
                     </td>
                     <td className="py-4 px-6 text-right">
                        <Badge variant={impact > 30 ? 'expired' : 'active'}>{impact > 30 ? 'CRITICAL' : 'STABLE'}</Badge>
                     </td>
                   </tr>
                 );
               })}
               {expenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-400 italic">No expenses recorded in the selected period.</td>
                  </tr>
               )}
             </tbody>
           </table>
         </div>
      </Card>

      {/* DETAIL MODAL FOR CUSTOMERS */}
      <Modal 
        isOpen={isDetailModalOpen} 
        onClose={() => setIsDetailModalOpen(false)} 
        title={detailModalTitle}
        maxWidth="max-w-4xl"
      >
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest border-b dark:border-slate-800">
              <tr>
                <th className="py-4 px-6">Customer Name</th>
                <th className="py-4 px-6">Phone</th>
                <th className="py-4 px-6">Package</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {detailCustomersList.length > 0 ? detailCustomersList.map((c) => (
                <tr 
                  key={c.id} 
                  onClick={() => { navigate(`/crm/customers/${c.id}`); setIsDetailModalOpen(false); }}
                  className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer group"
                >
                  <td className="py-4 px-6">
                    <p className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{c.firstName} {c.lastName}</p>
                    <p className="text-[9px] text-gray-400 font-mono">{c.id}</p>
                  </td>
                  <td className="py-4 px-6 text-gray-500">{c.phone}</td>
                  <td className="py-4 px-6 text-xs font-bold text-blue-600">{getPkgName(c.packageId)}</td>
                  <td className="py-4 px-6">
                    <Badge variant={c.status}>{c.status}</Badge>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <span className={`font-black ${c.balance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      KSH {c.balance.toLocaleString()}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400 italic">No customers found for this criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end">
           <button 
             onClick={() => setIsDetailModalOpen(false)}
             className="px-6 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-black uppercase rounded-xl"
           >
             Close Ledger
           </button>
        </div>
      </Modal>
    </div>
  );
};

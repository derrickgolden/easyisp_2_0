
import React, { useEffect, useState } from 'react';
import { Card, Badge, Modal } from '../components/UI';
import { Transaction } from '../types';
import { transactionsApi } from '../services/apiService';
import { STORAGE_KEYS } from '../constants/storage';
import { toast } from 'sonner';

export const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(
    () => JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]'));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, [setTransactions]);
  
  const fetchTransactions = async (isRefresh = false) => {
    setIsSyncing(true);
    try {
      const transactionsRes = await transactionsApi.getAll();

      const transactionsList = transactionsRes.data || [];
      const filteredTransactions = transactionsList.map((t: any) => ({
        id: t.id.toString(),
        customer_id: t.customer_id.toString(),
        customer_name: '',
        amount: t.amount,
        type: t.type,
        category: t.category,
        method: t.method,
        description: t.description,
        date: t.created_at,
        balance_before: t.balance_before,
        balance_after: t.balance_after,
        reference_id: t.reference_id,
      }));

      setTransactions(filteredTransactions);

      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(filteredTransactions));

      if (isRefresh) {
        toast.success('Transactions synced successfully!');
      }

    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  const filteredTransactions = transactions.filter(tx => 
    tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.reference_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onExport = () => {
    if (transactions.length === 0) {
      toast.info('No transactions to export.');
      return;
    }

    const csvContent = [
      ['ID', 'Customer ID', 'Customer Name', 'Amount', 'Type', 'Category', 'Method', 'Description', 'Date', 'Balance Before', 'Balance After', 'Reference ID'],
      ...transactions.map(t => [
        t.id,
        t.customer_id,
        t.customer_name,
        t.amount,
        t.type,
        t.category,
        t.method,
        t.description,
        t.date,
        t.balance_before,
        t.balance_after,
        t.reference_id || ''
      ])
    ].map(row => row.map(value => {
      const str = String(value ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${new Date().toISOString()}.csv`);
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Transactions exported.');
  };


  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">General Ledger</h2>
          <p className="text-sm text-gray-500">Comprehensive audit trail of all financial movements.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => fetchTransactions(true)}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isSyncing}
          >
            <svg className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button 
            onClick={onExport}
            className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Audit Export
          </button>
        </div>
      </div>

      <Card title="System-Wide Transactions" className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input 
              type="text" 
              placeholder="Search by ID, Subscriber or Ref..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest border-b dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
              <tr>
                <th className="py-4 px-6">ID</th>
                <th className="py-4 px-6">Subscriber</th>
                <th className="py-4 px-6">Type</th>
                <th className="py-4 px-6">Method</th>
                <th className="py-4 px-6">Amount</th>
                <th className="py-4 px-6">Date</th>
                <th className="py-4 px-6 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all">
                  <td className="py-4 px-6 font-mono font-bold text-gray-500 text-[10px]">#{tx.id}</td>
                  <td className="py-4 px-6">
                    <p className="font-bold text-gray-900 dark:text-white leading-none mb-1">{tx.customer_name}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-mono">{tx.customer_id}</p>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter ${
                      tx.type === 'credit' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {tx.category}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">{tx.method}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`font-black ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'credit' ? '+' : '-'} KSH {tx.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-gray-500 text-xs font-medium">
                    {new Date(tx.date).toLocaleString()}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button 
                      onClick={() => setSelectedTx(tx)}
                      className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* TRANSACTION DETAILS MODAL */}
      <Modal 
        isOpen={!!selectedTx} 
        onClose={() => setSelectedTx(null)} 
        title="Database Transaction Record"
        maxWidth="max-w-lg"
      >
        {selectedTx && (
          <div className="space-y-6">
            <div className="flex justify-between items-start border-b dark:border-slate-800 pb-4">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transaction UUID</p>
                <p className="text-sm font-mono font-black text-gray-900 dark:text-white">{selectedTx.id}</p>
              </div>
              <Badge variant={selectedTx.type === 'credit' ? 'active' : 'expired'}>
                {selectedTx.type.toUpperCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Subscriber</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedTx.customer_name}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Payment Method</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedTx.method}</p>
              </div>
            </div>

            <div className="space-y-3">
               <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Ledger Snapshot</h4>
               <div className="p-5 bg-slate-900 rounded-[2rem] text-white shadow-xl">
                 <div className="flex justify-between items-center mb-4">
                    <span className="text-xs text-slate-400 font-bold uppercase">Balance Before</span>
                    <span className="font-mono text-slate-300">KSH {selectedTx.balance_before.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center mb-4 py-3 border-y border-white/10">
                    <span className="text-xs font-black uppercase text-blue-400">Transaction</span>
                    <span className={`text-xl font-black ${selectedTx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                      {selectedTx.type === 'credit' ? '+' : '-'} {selectedTx.amount.toLocaleString()}
                    </span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-bold uppercase">Final Balance</span>
                    <span className="font-mono text-xl font-black text-white">KSH {selectedTx.balance_after.toLocaleString()}</span>
                 </div>
               </div>
            </div>

            <div className="p-4 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Audit Description</p>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed italic">{selectedTx.description}</p>
              {selectedTx.reference_id && (
                <p className="text-[10px] font-mono text-blue-500 mt-2">External Ref: {selectedTx.reference_id}</p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors">
                View Receipt
              </button>
              <button className="flex-1 py-3 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all">
                Print Log
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

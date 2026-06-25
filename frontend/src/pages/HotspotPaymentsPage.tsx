import React, { useEffect, useState } from 'react';
import { Card } from '../components/UI';
import TableScrollModal from '../components/modals/TableScrollModal';
import { formatPhone } from './PaymentsPage';
import { hotspotPaymentsApi } from '../services/apiService';
import { toast } from 'sonner';

interface HotspotPayment {
  id: string;
  phone: string;
  mac_address?: string | null;
  ip_address?: string | null;
  amount: number;
  account_reference?: string | null;
  checkout_request_id?: string | null;
  mpesa_receipt?: string | null;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  created_at?: string | null;
  updated_at?: string | null;
  expires_at?: string | null;
}

const formatTimestamp = (value: string | null | undefined): string => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const HotspotPaymentsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'completed' | 'pending'>('completed');
  const [payments, setPayments] = useState<HotspotPayment[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [completedCurrentPage, setCompletedCurrentPage] = useState(1);
  const [completedRowsPerPage, setCompletedRowsPerPage] = useState(10);
  const [pendingCurrentPage, setPendingCurrentPage] = useState(1);
  const [pendingRowsPerPage, setPendingRowsPerPage] = useState(10);

  const extractPaymentsList = (payload: any): HotspotPayment[] => {
    if (Array.isArray(payload?.data)) {
      return payload.data as HotspotPayment[];
    }

    if (Array.isArray(payload?.data?.data)) {
      return payload.data.data as HotspotPayment[];
    }

    if (Array.isArray(payload)) {
      return payload as HotspotPayment[];
    }

    return [];
  };

  const extractLastPage = (payload: any): number => {
    const candidate = payload?.meta?.last_page ?? payload?.last_page ?? payload?.data?.last_page ?? 1;
    const page = Number(candidate);
    return Number.isFinite(page) && page > 0 ? page : 1;
  };

  const fetchPayments = async (isToastMessage = false) => {
    setIsSyncing(true);
    try {
      const firstPage = await hotspotPaymentsApi.getAll(1);
      const paymentsList = [...extractPaymentsList(firstPage)];
      const lastPage = extractLastPage(firstPage);

      if (lastPage > 1) {
        const remainingRequests: Array<Promise<any>> = [];

        for (let page = 2; page <= lastPage; page++) {
          remainingRequests.push(hotspotPaymentsApi.getAll(page));
        }

        const remainingResults = await Promise.all(remainingRequests);
        for (const result of remainingResults) {
          paymentsList.push(...extractPaymentsList(result));
        }
      }

      setPayments(paymentsList);
      if (isToastMessage) {
        toast.success('Hotspot ledger synced successfully!');
      }
    } catch (error) {
      console.error('Error fetching hotspot payments:', error);
      toast.error('Failed to sync hotspot ledger. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const completedPayments = payments.filter((payment) =>
    payment.status === 'paid' && (
      payment.mpesa_receipt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.account_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.mac_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.phone.includes(searchTerm)
    )
  );

  const pendingPayments = payments.filter((payment) =>
    payment.status === 'pending' && (
      payment.account_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.mpesa_receipt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.mac_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.phone.includes(searchTerm)
    )
  );

  const completedTotalPages = Math.max(1, Math.ceil(completedPayments.length / completedRowsPerPage));
  const pendingTotalPages = Math.max(1, Math.ceil(pendingPayments.length / pendingRowsPerPage));

  const completedStartIndex = (completedCurrentPage - 1) * completedRowsPerPage;
  const pendingStartIndex = (pendingCurrentPage - 1) * pendingRowsPerPage;

  const pagedCompletedPayments = completedPayments.slice(
    completedStartIndex,
    completedStartIndex + completedRowsPerPage
  );
  const pagedPendingPayments = pendingPayments.slice(
    pendingStartIndex,
    pendingStartIndex + pendingRowsPerPage
  );

  useEffect(() => {
    setCompletedCurrentPage(1);
    setPendingCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (completedCurrentPage > completedTotalPages) {
      setCompletedCurrentPage(completedTotalPages);
    }
  }, [completedCurrentPage, completedTotalPages]);

  useEffect(() => {
    if (pendingCurrentPage > pendingTotalPages) {
      setPendingCurrentPage(pendingTotalPages);
    }
  }, [pendingCurrentPage, pendingTotalPages]);

  const onExport = () => {
    const csvContent = [
      ['Phone', 'MAC Address', 'IP Address', 'Amount', 'Reference', 'Receipt', 'Status', 'Created At'],
      ...payments.map((payment) => [
        payment.phone,
        payment.mac_address || '',
        payment.ip_address || '',
        payment.amount,
        payment.account_reference || '',
        payment.mpesa_receipt || '',
        payment.status,
        payment.created_at || '',
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hotspot_payments_${new Date().toISOString()}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Hotspot Revenue Ledger</h2>
          <p className="text-sm text-gray-500">Payments for hotspot access and package renewals.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPayments(true)}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            title="Sync Hotspot Ledger"
            disabled={isSyncing}
          >
            <svg className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={onExport}
            className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
        <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl w-fit shadow-inner">
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-6 py-2.5 text-sm font-black rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'completed'
                ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-md'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Completed
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-2.5 text-sm font-black rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-md'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
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
        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
            <h3 className="text-sm font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">Awaiting Payment Confirmation</h3>
          </div>
          <Card title="Pending Hotspot Receipts" className="border-none shadow-xl shadow-amber-500/5 dark:shadow-none overflow-hidden bg-amber-50/10 dark:bg-amber-900/5 border-amber-100 dark:border-amber-900/20">
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead className="text-left text-amber-600 dark:text-amber-500 uppercase text-[10px] tracking-widest bg-amber-50/50 dark:bg-amber-900/10">
                  <tr>
                    <th className="py-4 px-6">Receipt</th>
                    <th className="py-4 px-6">Amount</th>
                    <th className="py-4 px-6">Device / MAC</th>
                    <th className="py-4 px-6">Phone</th>
                    <th className="py-4 px-6">Reference</th>
                    <th className="py-4 px-6">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-t border-amber-100 dark:border-amber-900/20">
                  {pagedPendingPayments.length > 0 ? (
                    pagedPendingPayments.map((payment) => (
                      <tr key={payment.id} className="group hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all">
                        <td className="py-5 px-6">
                          <span className="font-mono font-black text-gray-900 dark:text-white tracking-tight">
                            {payment.mpesa_receipt || payment.checkout_request_id || '-'}
                          </span>
                        </td>
                        <td className="py-5 px-6">
                          <span className="text-amber-600 dark:text-amber-400 font-black">KSH {payment.amount.toLocaleString()}</span>
                        </td>
                        <td className="py-5 px-6">
                          <div>
                            <p className="font-mono text-xs font-semibold text-gray-900 dark:text-white">{payment.mac_address || '-'}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{payment.ip_address || '-'}</p>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">{formatPhone(payment.phone)}</span>
                        </td>
                        <td className="py-5 px-6">
                          <span className="text-[11px] bg-white dark:bg-slate-800 px-2 py-1 rounded border border-amber-100 dark:border-amber-900/30 text-gray-600 dark:text-gray-300 font-mono">
                            {payment.account_reference || '-'}
                          </span>
                        </td>
                        <td className="py-5 px-6">
                          <p className="text-gray-500 dark:text-gray-400 font-medium text-xs truncate w-32">{formatTimestamp(payment.created_at)}</p>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <div className="flex flex-col items-center opacity-40">
                          <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="font-medium italic">No pending hotspot payments found.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <TableScrollModal
              currentPage={pendingCurrentPage}
              setCurrentPage={setPendingCurrentPage}
              totalPages={pendingTotalPages}
              rowsPerPage={pendingRowsPerPage}
              setRowsPerPage={setPendingRowsPerPage}
            />
          </Card>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Successfully Processed</h3>
          </div>
          <Card title="Completed Hotspot Ledger" className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest bg-gray-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800">
                  <tr>
                    <th className="py-4 px-6">Receipt</th>
                    <th className="py-4 px-6">Amount</th>
                    <th className="py-4 px-6">Device / MAC</th>
                    <th className="py-4 px-6">Phone</th>
                    <th className="py-4 px-6">Reference</th>
                    <th className="py-4 px-6">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {pagedCompletedPayments.length > 0 ? (
                    pagedCompletedPayments.map((payment) => (
                      <tr key={payment.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all">
                        <td className="py-5 px-6">
                          <span className="font-mono font-bold text-gray-900 dark:text-white tracking-tight">
                            {payment.mpesa_receipt || payment.checkout_request_id || '-'}
                          </span>
                        </td>
                        <td className="py-5 px-6">
                          <span className="text-green-600 dark:text-green-400 font-black">KSH {payment.amount.toLocaleString()}</span>
                        </td>
                        <td className="py-5 px-6">
                          <div>
                            <p className="font-mono text-xs font-semibold text-gray-900 dark:text-white">{payment.mac_address || '-'}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{payment.ip_address || '-'}</p>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">{formatPhone(payment.phone)}</span>
                        </td>
                        <td className="py-5 px-6">
                          <span className="text-gray-500 dark:text-gray-400 font-medium text-xs truncate w-40">
                            {payment.account_reference || '-'}
                          </span>
                        </td>
                        <td className="py-5 px-6">
                          <p className="text-gray-500 dark:text-gray-400 font-medium text-xs truncate w-32">
                            {formatTimestamp(payment.updated_at || payment.created_at)}
                          </p>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-gray-400 italic text-xs">No matching completed hotspot transactions found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <TableScrollModal
              currentPage={completedCurrentPage}
              setCurrentPage={setCompletedCurrentPage}
              totalPages={completedTotalPages}
              rowsPerPage={completedRowsPerPage}
              setRowsPerPage={setCompletedRowsPerPage}
            />
          </Card>
        </div>
      )}
    </div>
  );
};
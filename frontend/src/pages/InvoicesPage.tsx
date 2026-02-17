
import React, { useState, useEffect } from 'react';
import { Card, Badge, Modal } from '../components/UI';
import { Invoice } from '../types';
import { InvoiceModal } from '../components/modals/InvoiceModal';
import { invoicesApi, organizationApi } from '../services/apiService';
import { toast } from 'sonner';

export const InvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrintInv, setSelectedPrintInv] = useState<Invoice | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Partial<Invoice> | null>(null);
  const [loading, setLoading] = useState(false);
  const [orgLogo, setOrgLogo] = useState('');
  const [orgInitials, setOrgInitials] = useState('ET');
  const [orgName, setOrgName] = useState('');
  const [orgPaybill, setOrgPaybill] = useState('');
  const [orgSupportHotline, setOrgSupportHotline] = useState('');
  const [orgBusinessAddress, setOrgBusinessAddress] = useState('');

  useEffect(() => {
    fetchInvoices();
    fetchOrganizationBranding();
  }, []);

  useEffect(() => {
    if (!isInvoiceModalOpen) {
      fetchInvoices();
    }
  }, [isInvoiceModalOpen]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await invoicesApi.getAll();
      const invoicesList = response.data || [];
      const formatted = invoicesList.map((inv: any) => ({
        id: inv.id?.toString() ?? '',
        invoice_number: inv.invoice_number,
        customer_id: inv.customer_id?.toString() ?? '',
        customer_name: inv.customer_name,
        items: inv.items || [],
        subtotal: Number(inv.subtotal) || 0,
        tax: Number(inv.tax) || 0,
        total: Number(inv.total) || 0,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        status: inv.status,
      }));
      setInvoices(formatted);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to fetch invoices');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizationBranding = async () => {
    try {
      const response = await organizationApi.get();
      const settings = response?.settings || {};
      const general = settings.general || {};
      const paymentGateway = settings['payment-gateway'] || {};
      const logo = general.business_logo || '';
      const acronym = response?.acronym || general.acronym || '';
      const legalName = general.isp_legal_name || response?.name || '';

      const initialsSource = acronym || legalName;
      const initials = initialsSource
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((word: string) => word[0])
        .join('')
        .toUpperCase() || 'ET';

      setOrgLogo(logo);
      setOrgInitials(initials);
      setOrgName(legalName);
      setOrgPaybill(paymentGateway.paybill || paymentGateway.paybill_short_code || '');
      setOrgSupportHotline(general.support_hotline || '');
      setOrgBusinessAddress(general.business_address || '');
    } catch (error) {
      console.error('Error fetching organization branding:', error);
    }
  };
  
  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOutstanding = invoices.filter(i => i.status !== 'paid').reduce((acc, curr) => acc + curr.total, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((acc, curr) => acc + curr.total, 0);

  const handlePrint = (invoice: Invoice) => {
    setSelectedPrintInv(invoice);
    // Give state time to update before calling print
    setTimeout(() => {
      window.print();
      setSelectedPrintInv(null);
    }, 500);
  };

  const handleAdd = () => {
    setEditingInvoice(null);
    setIsInvoiceModalOpen(true);
  };

  const handleEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    setIsInvoiceModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await invoicesApi.delete(id);
      toast.success('Invoice deleted successfully');
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Failed to delete invoice');
    }
  };

  const handleRefresh = () => {
    fetchInvoices();
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* PRINT-ONLY CONTAINER */}
      {selectedPrintInv && (
        <div className="fixed inset-0 z-[100] bg-white text-black p-12 print:block hidden" id="printable-invoice">
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
            <div>
              <div className="w-12 h-12 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-xl mb-4 overflow-hidden">
                {orgLogo ? (
                  <img src={orgLogo} alt="Company Logo" className="w-full h-full object-contain" />
                ) : (
                  orgInitials
                )}
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tighter">{orgName || 'Company Name'}</h1>
              <p className="text-sm font-medium text-slate-500">Official Service Invoice</p>
              {(orgBusinessAddress || orgSupportHotline) && (
                <div className="mt-2 text-xs text-slate-500 space-y-1">
                  {orgBusinessAddress && <p>{orgBusinessAddress}</p>}
                  {orgSupportHotline && <p>Support: {orgSupportHotline}</p>}
                </div>
              )}
            </div>
            <div className="text-right">
              <h2 className="text-5xl font-black text-slate-900 mb-2">INVOICE</h2>
              <p className="font-mono font-bold text-lg">{selectedPrintInv.invoice_number}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-20 mb-12">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Billed To:</p>
              <p className="text-xl font-black">{selectedPrintInv.customer_name}</p>
              <p className="text-slate-600">Subscriber ID: {selectedPrintInv.customer_id}</p>
            </div>
            <div className="text-right">
              <div className="space-y-1">
                <p className="text-slate-500 text-sm">Issue Date: <span className="font-bold text-slate-900">{new Date(selectedPrintInv.issue_date).toLocaleDateString()}</span></p>
                <p className="text-slate-500 text-sm">Due Date: <span className="font-bold text-slate-900">{new Date(selectedPrintInv.due_date).toLocaleDateString()}</span></p>
                <p className="text-slate-500 text-sm">Status: <span className="font-bold text-slate-900 uppercase">{selectedPrintInv.status}</span></p>
              </div>
            </div>
          </div>

          <table className="w-full mb-12">
            <thead className="border-b-2 border-slate-900">
              <tr>
                <th className="py-4 text-left font-black uppercase text-xs">Description of Service</th>
                <th className="py-4 text-right font-black uppercase text-xs">Amount (KSH)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {selectedPrintInv.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-5 font-medium">{item.description}</td>
                  <td className="py-5 text-right font-bold">{item.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-72 space-y-3">
              <div className="flex justify-between text-slate-500">
                <span className="font-bold uppercase text-[10px]">Subtotal</span>
                <span className="font-bold">KSH {selectedPrintInv.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-500 border-b pb-3">
                <span className="font-bold uppercase text-[10px]">Tax (VAT 16%)</span>
                <span className="font-bold">KSH {selectedPrintInv.tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="font-black uppercase text-sm">Amount Due</span>
                <span className="text-2xl font-black">KSH {selectedPrintInv.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="mt-20 pt-8 border-t border-slate-200 text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Payment Methods</p>
            <p className="text-sm font-medium">Pay via M-PESA Paybill: <span className="font-black">{orgPaybill || 'N/A'}</span> | Account: <span className="font-black">{selectedPrintInv.customer_id}</span></p>
            <p className="text-[10px] text-slate-400 mt-6 italic">Thank you for your business. Terms apply.</p>
          </div>
        </div>
      )}

      {/* DASHBOARD VIEW */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Billing & Invoices</h2>
          <p className="text-sm text-gray-500">Manage subscription cycles and manual billing entries.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button 
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Create Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
         <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-3xl">
           <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest mb-1">Total Paid</p>
           <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">KSH {totalPaid.toLocaleString()}</p>
         </div>
         <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-3xl">
           <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-1">Total Outstanding</p>
           <p className="text-2xl font-black text-amber-700 dark:text-amber-400">KSH {totalOutstanding.toLocaleString()}</p>
         </div>
         <div className="col-span-2 sm:col-span-1 p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-3xl">
           <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-1">Invoice Count</p>
           <p className="text-2xl font-black text-blue-700 dark:text-blue-400">{invoices.length} Documents</p>
         </div>
      </div>

      <Card title="Billing History" className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input 
              type="text" 
              placeholder="Search by Invoice # or Customer..." 
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
                <th className="py-4 px-6">Invoice #</th>
                <th className="py-4 px-6">Subscriber</th>
                <th className="py-4 px-6">Total Billed</th>
                <th className="py-4 px-6">Issue Date</th>
                <th className="py-4 px-6">Due Date</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all">
                  <td className="py-5 px-6 font-mono font-black text-gray-900 dark:text-white">{inv.invoice_number}</td>
                  <td className="py-5 px-6">
                    <p className="font-bold text-gray-900 dark:text-white leading-none mb-1">{inv.customer_name}</p>
                    <p className="text-[10px] text-gray-400 font-mono uppercase tracking-tighter">{inv.customer_id}</p>
                  </td>
                  <td className="py-5 px-6">
                    <span className="font-black text-gray-900 dark:text-white">KSH {inv.total.toLocaleString()}</span>
                  </td>
                  <td className="py-5 px-6 text-gray-500 text-xs">{new Date(inv.issue_date).toLocaleString()}</td>
                  <td className="py-5 px-6 text-gray-500 text-xs">{new Date(inv.due_date).toLocaleString()}</td>
                  <td className="py-5 px-6">
                    <Badge variant={inv.status}>{inv.status.toUpperCase()}</Badge>
                  </td>
                  <td className="py-5 px-6 text-right">
                    <div className="flex justify-end items-center gap-1 transition-all">
                      <button 
                         onClick={() => handleEdit(inv)}
                         className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                         title="Edit"
                      >
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button 
                         onClick={() => handlePrint(inv)}
                         className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                         title="Download / Print"
                      >
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      </button>
                      <button 
                         onClick={() => handleDelete(inv.id)}
                         className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                         title="Delete"
                      >
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <InvoiceModal 
        isOpen={isInvoiceModalOpen} 
        onClose={() => setIsInvoiceModalOpen(false)} 
        editingInvoice={editingInvoice} 
      />
    </div>
  );
};


import React, { useState, useMemo, useEffect } from 'react';
import { Lead } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { Card } from '../components/UI';
import { LeadModal } from '../components/modals/LeadModal';
import TableScrollModal from '../components/modals/TableScrollModal';

interface LeadsPageProps {}

const INITIAL_LEADS: Lead[] = [
  { id: 'l1', name: 'Robert Kamau', phone: '0711223344', address: 'Kahawa Sukari, Near Quickmart', status: 'new', created_at: '2025-01-20' },
  { id: 'l2', name: 'Sarah Wanjiku', phone: '0755667788', address: 'Zimmerman, Sawa Sawa Apt', status: 'survey', created_at: '2025-01-21' },
    { id: 'l3', name: 'Sarah Wanjiku', phone: '0755667788', address: 'Zimmerman, Sawa Sawa Apt', status: 'survey', created_at: '2025-01-21' },
  { id: 'l4', name: 'Sarah Wanjiku', phone: '0755667788', address: 'Zimmerman, Sawa Sawa Apt', status: 'survey', created_at: '2025-01-21' },
  { id: 'l5', name: 'Sarah Wanjiku', phone: '0755667788', address: 'Zimmerman, Sawa Sawa Apt', status: 'survey', created_at: '2025-01-21' },
  { id: 'l6', name: 'Sarah Wanjiku', phone: '0755667788', address: 'Zimmerman, Sawa Sawa Apt', status: 'survey', created_at: '2025-01-21' },
  { id: 'l7', name: 'Sarah Wanjiku', phone: '0755667788', address: 'Zimmerman, Sawa Sawa Apt', status: 'survey', created_at: '2025-01-21' },
  { id: 'l8', name: 'Sarah Wanjiku', phone: '0755667788', address: 'Zimmerman, Sawa Sawa Apt', status: 'survey', created_at: '2025-01-21' },
  { id: 'l9', name: 'Sarah Wanjiku', phone: '0755667788', address: 'Zimmerman, Sawa Sawa Apt', status: 'survey', created_at: '2025-01-21' },
  { id: 'l10', name: 'Sarah Wanjiku', phone: '0755667788', address: 'Zimmerman, Sawa Sawa Apt', status: 'survey', created_at: '2025-01-21' },
  { id: 'l11', name: 'Sarah Wanjiku', phone: '0755667788', address: 'Zimmerman, Sawa Sawa Apt', status: 'survey', created_at: '2025-01-21' },
  { id: 'l12', name: 'Sarah Wanjiku', phone: '0755667788', address: 'Zimmerman, Sawa Sawa Apt', status: 'survey', created_at: '2025-01-21' },
  { id: 'l13', name: 'Sarah Wanjiku', phone: '0755667788', address: 'Zimmerman, Sawa Sawa Apt', status: 'survey', created_at: '2025-01-21' },
  { id: 'l14', name: 'Sarah Wanjiku', phone: '0755667788', address: 'Zimmerman, Sawa Sawa Apt', status: 'survey', created_at: '2025-01-21' },
  { id: 'l15', name: 'Sarah Wanjiku', phone: '0755667788', address: 'Zimmerman, Sawa Sawa Apt', status: 'survey', created_at: '2025-01-21' },

];


export const LeadsPage: React.FC<LeadsPageProps> = ({}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Lead['status'] | 'all'>('all');
  const [leads, setLeads] = useState<Lead[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADS) || JSON.stringify(INITIAL_LEADS)));
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Partial<Lead> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          l.phone.includes(searchTerm) || 
                          l.address.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const pagedLeads = filteredLeads.slice(startIndex, startIndex + rowsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    survey: leads.filter(l => l.status === 'survey').length,
    converted: leads.filter(l => l.status === 'converted').length
  };

  const onAdd = () => { setEditingLead(null); setIsLeadModalOpen(true); };
  const onEdit = (l: Lead) => { setEditingLead(l); setIsLeadModalOpen(true); };
  const onDelete = (id: string) => setLeads(prev => prev.filter(l => l.id !== id));
  // const onConvert = (lead: Lead) => { setEditingCustomer({ firstName: lead.name.split(' ')[0], lastName: lead.name.split(' ').slice(1).join(' '), phone: lead.phone, location: lead.address, installationFee: 0 }); setIsCustomerModalOpen(true); };
  const onConvert = (lead: Lead) => {
    // For demo, we'll just mark as converted. In real app, you'd create a customer record and maybe an order.
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'converted' } : l));
  }
  const onStatusChange = (id: string, status: Lead['status']) => setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Leads & Prospects</h2>
          <p className="text-sm text-gray-500">Track and convert potential subscribers into the network.</p>
        </div>
        <button 
          onClick={onAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Prospect
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-6 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-sm">
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Total Pipeline</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-3xl">
          <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-1">New Inquiries</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{stats.new}</p>
        </div>
        <div className="p-6 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-3xl">
          <p className="text-[10px] font-black uppercase text-purple-500 tracking-widest mb-1">Field Surveys</p>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{stats.survey}</p>
        </div>
        <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-3xl">
          <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest mb-1">Converted</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.converted}</p>
        </div>
      </div>

      <Card title="Prospect Database" className="border-none shadow-xl overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input 
              type="text" 
              placeholder="Search prospects..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'new', 'contacted', 'survey', 'lost'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  statusFilter === status 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-500'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest border-b dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
              <tr>
                <th className="py-4 px-6">Name</th>
                <th className="py-4 px-6">Contact</th>
                <th className="py-4 px-6">Service Address</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Created</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {pagedLeads.length > 0 ? pagedLeads.map((lead) => (
                <tr key={lead.id} className="group hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-all">
                  <td className="py-5 px-6">
                    <p className="font-bold text-gray-900 dark:text-white leading-none">{lead.name}</p>
                  </td>
                  <td className="py-5 px-6">
                    <p className="text-xs font-mono text-blue-600 dark:text-blue-400">{lead.phone}</p>
                  </td>
                  <td className="py-5 px-6">
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{lead.address}</p>
                  </td>
                  <td className="py-5 px-6">
                    <select 
                      value={lead.status}
                      onChange={(e) => onStatusChange(lead.id, e.target.value as Lead['status'])}
                      className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-blue-600 focus:ring-0 cursor-pointer p-0"
                    >
                      <option value="new">NEW</option>
                      <option value="contacted">CONTACTED</option>
                      <option value="survey">SURVEY</option>
                      <option value="converted">CONVERTED</option>
                      <option value="lost">LOST</option>
                    </select>
                  </td>
                  <td className="py-5 px-6 text-xs text-gray-400">{lead.created_at}</td>
                  <td className="py-5 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      {lead.status !== 'converted' && lead.status !== 'lost' && (
                        <button 
                          onClick={() => onConvert(lead)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                        >
                          Convert
                        </button>
                      )}
                      <button 
                        onClick={() => onEdit(lead)}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button 
                        onClick={() => onDelete(lead.id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-gray-400 italic">No prospects found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TableScrollModal
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          setRowsPerPage={setRowsPerPage}
        />
      </Card>

      <LeadModal 
        isOpen={isLeadModalOpen} 
        onClose={() => setIsLeadModalOpen(false)} 
        editingLead={editingLead} 
        onSave={() => setIsLeadModalOpen(false)} 
      />
    </div>
  );
};

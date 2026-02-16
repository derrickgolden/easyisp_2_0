
import React, { useState, useMemo, useEffect } from 'react';
import { Card, Badge } from '../components/UI';
import { Ticket, TicketStatus, Priority } from '../types';
import { ticketsApi } from '../services/apiService';
import { STORAGE_KEYS } from '../constants/storage';
import { TicketModal } from '../components/modals/TicketModal';
import TableScrollModal from '../components/modals/TableScrollModal';

export const TicketsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [tickets, setTickets] = useState<Ticket[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.TICKETS) || '[]'));
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Partial<Ticket> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const ticketsRes = await ticketsApi.getAll();
        // Backend returns array directly, not { data: [] }
        const ticketsList = Array.isArray(ticketsRes) ? ticketsRes : (ticketsRes.data || []);
        const data = ticketsList.map((t: any) => ({
          id: t.id.toString(),
          customer_id: t.customer_id?.toString(),
          customer_name: t.customer?.first_name && t.customer?.last_name 
            ? `${t.customer.first_name} ${t.customer.last_name}` 
            : '',
          subject: t.subject,
          description: t.description,
          priority: t.priority as any,
          status: t.status as any,
          created_at: t.created_at,
        }));
        setTickets(data);
        localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(data));
      } catch (error) {
        console.error('Error fetching tickets:', error);
      }
    };

    fetchTickets();
  }, []);
  
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
                          t.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tickets, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const pagedTickets = filteredTickets.slice(startIndex, startIndex + rowsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === TicketStatus.OPEN).length,
    critical: tickets.filter(t => t.priority === Priority.CRITICAL && t.status !== TicketStatus.CLOSED).length,
    resolved: tickets.filter(t => t.status === TicketStatus.CLOSED).length
  };

  const handleStatusChange = async (id: string, status: TicketStatus) => {
    try {
      await ticketsApi.update(id, status);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets.map(t => t.id === id ? { ...t, status } : t)));
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await ticketsApi.delete(id);
      setTickets(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting ticket:', error);
    }
  };

  const getPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case Priority.CRITICAL: return <span className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-full animate-pulse uppercase shadow-sm">Critical</span>;
      case Priority.HIGH: return <span className="px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[9px] font-black rounded-full uppercase">High</span>;
      case Priority.MEDIUM: return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[9px] font-black rounded-full uppercase">Medium</span>;
      default: return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400 text-[9px] font-black rounded-full uppercase">Low</span>;
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case TicketStatus.OPEN: return <Badge variant="expired">Open</Badge>;
      case TicketStatus.IN_PROGRESS: return <Badge variant="suspended">In Progress</Badge>;
      case TicketStatus.CLOSED: return <Badge variant="active">Closed</Badge>;
    }
  };

  const onAdd = () => { setEditingTicket(null); setIsTicketModalOpen(true); };
  const onEdit = (t: Ticket) => { setEditingTicket(t); setIsTicketModalOpen(true); };

  const handleModalSave = async () => {
    setIsTicketModalOpen(false);
    // Refetch tickets to get updated list
    try {
      const ticketsRes = await ticketsApi.getAll();
      // Backend returns array directly, not { data: [] }
      const ticketsList = Array.isArray(ticketsRes) ? ticketsRes : (ticketsRes.data || []);
      const data = ticketsList.map((t: any) => ({
        id: t.id.toString(),
        customer_id: t.customer_id?.toString(),
        customer_name: t.customer?.first_name && t.customer?.last_name 
          ? `${t.customer.first_name} ${t.customer.last_name}` 
          : '',
        subject: t.subject,
        description: t.description,
        priority: t.priority as any,
        status: t.status as any,
        created_at: t.created_at,
      }));

      setTickets(data);
      localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(data));
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Operations Queue</h2>
          <p className="text-sm text-gray-500">Task management for field technicians and system admins.</p>
        </div>
        <button 
          onClick={onAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Entry
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-6 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-sm">
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Active Backlog</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-3xl">
          <p className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-1">Open Tickets</p>
          <p className="text-2xl font-black text-red-600 dark:text-red-400">{stats.open}</p>
        </div>
        <div className="p-6 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-3xl">
          <p className="text-[10px] font-black uppercase text-purple-500 tracking-widest mb-1">High Severity</p>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{stats.critical}</p>
        </div>
        <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-3xl">
          <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest mb-1">Work Done</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.resolved}</p>
        </div>
      </div>

      <Card title="Task Inventory" className="border-none shadow-xl overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input 
              type="text" 
              placeholder="Filter by Subject, ID or User..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            {(['all', TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.CLOSED] as const).map(status => (
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

        <div className=" overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest border-b dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
              <tr>
                <th className="py-4 px-6">ID</th>
                <th className="py-4 px-6">Association</th>
                <th className="py-4 px-6">Issue / Subject</th>
                <th className="py-4 px-6">Priority</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {pagedTickets.length > 0 ? pagedTickets.map((ticket) => (
                <tr key={ticket.id} className="group hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-all">
                  <td className="py-5 px-6">
                    <p className="font-mono text-xs font-bold text-gray-400 uppercase tracking-tight">#{ticket.id}</p>
                  </td>
                  <td className="py-5 px-6">
                    {ticket.customer_id ? (
                      <div>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          <p className="font-bold text-gray-900 dark:text-white leading-none">{ticket.customer_name}</p>
                        </div>
                        <p className="text-[9px] text-gray-400 uppercase mt-1 font-mono">{ticket.customer_id}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">General System</span>
                      </div>
                    )}
                  </td>
                  <td className="py-5 px-6">
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate max-w-xs">{ticket.subject}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Created: {new Date(ticket.created_at).toLocaleString()}</p>
                  </td>
                  <td className="py-5 px-6">
                    {getPriorityBadge(ticket.priority)}
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-2">
                       {getStatusBadge(ticket.status)}
                    </div>
                  </td>
                  <td className="py-5 px-6 text-right">
                    <div className="flex justify-end gap-1">
                      {ticket.status !== TicketStatus.CLOSED && (
                        <button 
                          onClick={() => handleStatusChange(ticket.id, TicketStatus.CLOSED)}
                          className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                          title="Quick Close"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                      )}
                      <button 
                        onClick={() => onEdit(ticket)}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button 
                        onClick={() => handleDelete(ticket.id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="py-24 text-center text-gray-400 italic">No activity entries found matching your filters.</td>
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
      <TicketModal 
        isOpen={isTicketModalOpen} 
        onClose={() => setIsTicketModalOpen(false)} 
        onSave={handleModalSave}
        editingTicket={editingTicket} 
      />
    </div>
  );
};


import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../UI';
import { Ticket, Customer, Priority, TicketStatus } from '../../types';
import { customersApi, ticketsApi } from '@/src/services/apiService';
import { STORAGE_KEYS } from '@/src/constants/storage';
import { toast } from 'sonner';

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingTicket: Partial<Ticket> | null;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  isOpen, onClose, onSave, editingTicket
}) => {
  const [ticketType, setTicketType] = useState<'customer' | 'general'>('customer');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [status, setStatus] = useState<TicketStatus>(TicketStatus.OPEN);
  const [customers, setCustomers] = useState<Customer[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '[]'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
        // Load initial data if needed
        try {
          const fetchCustomers = async () => {
            const customersRes = await customersApi.getAll();
            
            const customersList = customersRes.data || [];
    
            setCustomers(customersList);
    
            localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customersList));
          };
          fetchCustomers();
    
        } catch (error) {
          console.error('Error loading initial data:', error);
        }
      }, []);

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const search = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.firstName.toLowerCase().includes(search) || 
      c.lastName.toLowerCase().includes(search) || 
      c.radiusUsername?.toLowerCase().includes(search) ||
      c.phone.includes(search)
    ).slice(0, 5); // Limit results for speed
  }, [customerSearch, customers]);

  useEffect(() => {
    if (editingTicket) {
      if (editingTicket.customer_id) {
        setTicketType('customer');
        const cust = customers.find(c => c.id === editingTicket.customer_id);
        setSelectedCustomer(cust || null);
        setCustomerSearch(editingTicket.customer_name || '');
      } else {
        setTicketType('general');
        setSelectedCustomer(null);
        setCustomerSearch('');
      }
      setSubject(editingTicket.subject || '');
      setDescription(editingTicket.description || '');
      setPriority(editingTicket.priority || Priority.MEDIUM);
      setStatus(editingTicket.status || TicketStatus.OPEN);
    } else {
      setTicketType('customer');
      setSelectedCustomer(null);
      setCustomerSearch('');
      setSubject('');
      setDescription('');
      setPriority(Priority.MEDIUM);
      setStatus(TicketStatus.OPEN);
    }
  }, [editingTicket, isOpen, customers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (ticketType === 'customer' && !selectedCustomer) {
      toast.error("Please select a customer or switch to General ticket mode.");
      return;
    }

    setLoading(true);
    
    try {
      const ticketData = {
        customer_id: ticketType === 'customer' ? selectedCustomer?.id : undefined,
        subject,
        description,
        priority,
        status,
      };

      if (editingTicket?.id) {
        await ticketsApi.update(editingTicket.id, ticketData);
        toast.success('Ticket updated successfully');
      } else {
        await ticketsApi.create(ticketData);
        toast.success('Service ticket created successfully');
      }
      
      onSave();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editingTicket?.id ? "Modify Activity Log" : "New Service Request"}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Ticket Type Toggle */}
        <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-xl w-full border border-gray-200 dark:border-slate-700">
          <button 
            type="button"
            onClick={() => setTicketType('customer')}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${ticketType === 'customer' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Subscriber Issue
          </button>
          <button 
            type="button"
            onClick={() => { setTicketType('general'); setSelectedCustomer(null); setCustomerSearch(''); }}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${ticketType === 'general' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            General / Internal
          </button>
        </div>

        {ticketType === 'customer' && (
          <div className="relative animate-in fade-in slide-in-from-top-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 block mb-1">Search Subscriber</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input 
                type="text" 
                value={customerSearch}
                onFocus={() => setIsSearchFocused(true)}
                onChange={e => {
                  setCustomerSearch(e.target.value);
                  if (selectedCustomer && e.target.value !== `${selectedCustomer.firstName} ${selectedCustomer.lastName}`) {
                    setSelectedCustomer(null);
                  }
                }}
                placeholder="Type name, phone or username..."
                className={`w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-10 pr-10 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold transition-all ${selectedCustomer ? 'ring-2 ring-emerald-500' : ''}`}
              />
              {selectedCustomer && (
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-emerald-500">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
              )}
            </div>

            {/* Search Results Dropdown */}
            {isSearchFocused && filteredCustomers.length > 0 && !selectedCustomer && (
              <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-top-2">
                {filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerSearch(`${c.firstName} ${c.lastName}`);
                      setIsSearchFocused(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-between group border-b last:border-0 dark:border-slate-800"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{c.firstName} {c.lastName}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{c.radiusUsername} | {c.phone}</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Subject / Issue Summary</label>
            <input 
              required
              type="text" 
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
              placeholder={ticketType === 'customer' ? "e.g. Broken Drop Fiber" : "e.g. Site Maintenance: West Hub"}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Priority</label>
              <select 
                value={priority}
                onChange={e => setPriority(e.target.value as Priority)}
                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold appearance-none"
              >
                <option value={Priority.LOW}>LOW</option>
                <option value={Priority.MEDIUM}>MEDIUM</option>
                <option value={Priority.HIGH}>HIGH</option>
                <option value={Priority.CRITICAL}>CRITICAL</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Status</label>
              <select 
                value={status}
                onChange={e => setStatus(e.target.value as TicketStatus)}
                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold appearance-none"
              >
                <option value={TicketStatus.OPEN}>OPEN</option>
                <option value={TicketStatus.IN_PROGRESS}>IN PROGRESS</option>
                <option value={TicketStatus.CLOSED}>CLOSED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Technical Description</label>
            <textarea 
              required
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm" 
              placeholder="Describe the nature of the issue or the task requirements in detail..."
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : editingTicket?.id ? "Update Action Item" : "Create Service Ticket"}
        </button>
      </form>
    </Modal>
  );
};

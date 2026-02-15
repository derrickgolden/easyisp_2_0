
import React, { useState, useEffect } from 'react';
import { Modal } from '../UI';
import { Invoice, Customer, InvoiceItem } from '../../types';
import { STORAGE_KEYS } from '@/src/constants/storage';
import { customersApi } from '@/src/services/apiService';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (invoice: Partial<Invoice>) => void;
  editingInvoice: Partial<Invoice> | null;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen, onClose, onSave,  editingInvoice
}) => {
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([{ description: '', amount: 0 }]);
  const [dueDate, setDueDate] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState<Customer[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '[]'));

  useEffect(() => {
    if (editingInvoice) {
      setCustomerId(editingInvoice.customer_id || '');
      setItems(editingInvoice.items || [{ description: '', amount: 0 }]);
      setDueDate(editingInvoice.due_date || '');
      setIssueDate(editingInvoice.issue_date || new Date().toISOString().split('T')[0]);
    } else {
      setCustomerId('');
      setItems([{ description: 'Internet Service Fee', amount: 0 }]);
      setDueDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      setIssueDate(new Date().toISOString().split('T')[0]);
    }
  }, [editingInvoice, isOpen]);

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

  const handleAddItem = () => {
    setItems([...items, { description: '', amount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const tax = subtotal * 0.16; // 16% VAT Example
  const total = subtotal + tax;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    onSave({
      ...editingInvoice,
      customer_id: customerId,
      customer_name: `${customer.firstName} ${customer.lastName}`,
      items,
      subtotal,
      tax,
      total,
      issue_date: issueDate,
      due_date: dueDate,
      status: editingInvoice?.status || 'unpaid'
    });
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editingInvoice?.id ? "Modify Invoice" : "Generate Official Invoice"}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Subscriber</label>
            <select 
              required
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold"
            >
              <option value="">Choose Subscriber...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.radiusUsername})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Due Date</label>
            <input 
              required
              type="date" 
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
             <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Line Items</label>
             <button 
                type="button" 
                onClick={handleAddItem}
                className="text-xs font-black text-blue-600 hover:text-blue-700"
              >
                + Add Item
             </button>
          </div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex gap-2 items-start animate-in slide-in-from-left-2 duration-200">
                <input 
                  required
                  type="text" 
                  placeholder="Service Description"
                  value={item.description}
                  onChange={e => handleItemChange(index, 'description', e.target.value)}
                  className="flex-1 bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-medium text-gray-900 dark:text-white"
                />
                <div className="w-32 relative">
                  <span className="absolute left-3 inset-y-0 flex items-center text-gray-400 text-[10px] font-bold">KSH</span>
                  <input 
                    required
                    type="number" 
                    placeholder="0.00"
                    value={item.amount || ''}
                    onChange={e => handleItemChange(index, 'amount', e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 pl-10 text-sm font-bold text-gray-900 dark:text-white text-right"
                  />
                </div>
                {items.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => handleRemoveItem(index)}
                    className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl space-y-4">
          <div className="flex justify-between items-center text-xs opacity-60 font-bold uppercase tracking-widest">
            <span>Subtotal</span>
            <span>KSH {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-xs opacity-60 font-bold uppercase tracking-widest border-b border-white/10 pb-4">
            <span>VAT (16%)</span>
            <span>KSH {tax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-black uppercase tracking-widest text-blue-400">Total Billed</span>
            <span className="text-3xl font-black text-white">KSH {total.toLocaleString()}</span>
          </div>
        </div>

        <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-500 transition-all active:scale-95">
          {editingInvoice?.id ? "Update Invoice Ledger" : "Commit Official Invoice"}
        </button>
      </form>
    </Modal>
  );
};

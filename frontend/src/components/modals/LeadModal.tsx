
import React, { useState, useEffect } from 'react';
import { Modal } from '../UI';
import { Lead } from '../../types';
import { leadsApi } from '../../services/apiService';
import { toast } from 'sonner';

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingLead: Partial<Lead> | null;
}

export const LeadModal: React.FC<LeadModalProps> = ({
  isOpen, onClose, onSave, editingLead
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<Lead['status']>('new');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingLead) {
      setName(editingLead.name || '');
      setPhone(editingLead.phone || '');
      setEmail(editingLead.email || '');
      setAddress(editingLead.address || '');
      setStatus(editingLead.status || 'new');
      setNotes(editingLead.notes || '');
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setStatus('new');
      setNotes('');
    }
    setError(null);
  }, [editingLead, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const leadData = {
        name,
        phone,
        email: email || undefined,
        address: address || undefined,
        status,
        notes: notes || undefined,
      };

      if (editingLead?.id) {
        await leadsApi.update(editingLead.id, leadData);
        toast.success('Prospect updated successfully');
      } else {
        await leadsApi.create(leadData);
        toast.success('New sales opportunity created');
      }
      
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editingLead?.id ? "Update Prospect" : "New Sales Opportunity"}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-3 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Prospect Name</label>
          <input 
            required
            type="text" 
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
            placeholder="e.g. John Doe"
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Phone Number</label>
          <input 
            required
            type="tel" 
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono" 
            placeholder="+254 7XX XXX XXX"
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Email (Optional)</label>
          <input 
            type="email" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" 
            placeholder="email@example.com"
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Service Address / Landmark</label>
          <textarea 
            rows={3}
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm" 
            placeholder="e.g. Githurai 45, Near Shell Petrol Station"
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Initial Status</label>
          <select 
            value={status}
            onChange={e => setStatus(e.target.value as any)}
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 appearance-none text-gray-900 dark:text-white font-black"
          >
            <option value="new">NEW INQUIRY</option>
            <option value="contacted">CONTACTED</option>
            <option value="survey">FIELD SURVEY REQUIRED</option>
            <option value="lost">NOT INTERESTED / LOST</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Notes (Optional)</label>
          <textarea 
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm" 
            placeholder="Any additional information..."
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : editingLead?.id ? "Update Prospect Profile" : "Create Opportunity"}
        </button>
      </form>
    </Modal>
  );
};

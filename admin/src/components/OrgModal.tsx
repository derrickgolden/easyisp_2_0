import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Organization, OrgStatus, SubscriptionTier } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { organizationsApi, ApiError } from '../services/apiService';

interface OrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Organization | null;
  editingOrg?: Organization | null;
}

export const OrgModal: React.FC<OrgModalProps> = ({ isOpen, onClose, initialData, editingOrg }) => {
  const [formData, setFormData] = useState<Partial<Organization>>({
    name: '',
    acronym: '',
    subscription_tier: SubscriptionTier.LITE,
    status: OrgStatus.ACTIVE
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        name: '',
        acronym: '',
        subscription_tier: SubscriptionTier.LITE,
        status: OrgStatus.ACTIVE
      });
    }
  }, [initialData, isOpen]);

  const handleCreateOrUpdate = async (data: Partial<Organization>) => {
    try {
      if (editingOrg) {
        await organizationsApi.update(editingOrg.id, {
          name: data.name || '',
          acronym: data.acronym || '',
          subscription_tier: (data.subscription_tier || SubscriptionTier.LITE),
          status: data.status || OrgStatus.ACTIVE,
        });
      } else {
        await organizationsApi.create({
          name: data.name || '',
          acronym: data.acronym || '',
          subscription_tier: (data.subscription_tier || SubscriptionTier.LITE),
          status: data.status || OrgStatus.ACTIVE,
        });
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        console.error('Error saving organization:', error.message);
      } else {
        console.error('Error saving organization:', error);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {initialData ? 'Edit Organization' : 'Register New Organization'}
            </h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            handleCreateOrUpdate(formData);
          }} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Organization Name</label>
              <input 
                required
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="e.g. Easy Tech Solutions"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Acronym</label>
              <input 
                required
                type="text"
                maxLength={5}
                value={formData.acronym || ''}
                onChange={(e) => setFormData({ ...formData, acronym: e.target.value.toUpperCase().slice(0, 5) })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="e.g. ETS"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Subscription Tier</label>
              <select 
                value={formData.subscription_tier || SubscriptionTier.LITE}
                onChange={(e) => setFormData({ ...formData, subscription_tier: e.target.value as SubscriptionTier })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              >
                <option value={SubscriptionTier.LITE}>Lite</option>
                <option value={SubscriptionTier.PRO}>Pro</option>
                <option value={SubscriptionTier.ENTERPRISE}>Enterprise</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
              <select 
                value={formData.status || OrgStatus.ACTIVE}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as OrgStatus })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              >
                <option value={OrgStatus.ACTIVE}>Active</option>
                <option value={OrgStatus.SUSPENDED}>Suspended</option>
              </select>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors"
              >
                {initialData ? 'Save Changes' : 'Register'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

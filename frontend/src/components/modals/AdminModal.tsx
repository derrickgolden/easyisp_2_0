
import React, { useState } from 'react';
import { Modal } from '../UI';
import { AdminUser, Role } from '../../types';
import { usersApi } from '../../services/apiService';
import { toast } from 'sonner';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAdmin: Partial<AdminUser> | null;
  setEditingAdmin: (admin: Partial<AdminUser> | null) => void;
  roles: Role[];
  onSuccess?: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen, onClose, editingAdmin, setEditingAdmin, roles, onSuccess
}) => {
  const [isLoading, setIsLoading] = useState(false);
console.log(roles);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin?.name || !editingAdmin?.email || !editingAdmin?.phone) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsLoading(true);
    try {
      const roleId = editingAdmin.role_id || roles[0]?.id;

      if (!roleId) {
        toast.error('Please select a role.');
        return;
      }

      if (editingAdmin.id) {
        const payload: Record<string, any> = {
          name: editingAdmin.name,
          phone: editingAdmin.phone,
          role_id: roleId,
          status: editingAdmin.status || 'Active',
        };

        if (editingAdmin.password && editingAdmin.password.trim().length > 0) {
          payload.password = editingAdmin.password;
        }

        await usersApi.update(String(editingAdmin.id), payload);
        toast.success('Administrator updated successfully.');
        onSuccess && onSuccess();
      } else {
        if (!editingAdmin.password || editingAdmin.password.trim().length < 6) {
          toast.error('Password must be at least 6 characters.');
          return;
        }

        await usersApi.create({
          name: editingAdmin.name,
          email: editingAdmin.email,
          phone: editingAdmin.phone,
          password: editingAdmin.password,
          role_id: roleId,
          status: editingAdmin.status || 'Active',
        });
        toast.success('Administrator created successfully.');
        onSuccess && onSuccess();
      }

      setEditingAdmin(null);
      onClose();
    } catch (error: any) {
      const message = error?.message || 'Failed to save administrator.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editingAdmin?.id ? "Update Administrator" : "Provision New Administrator"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-tighter ml-1">Full Name</label>
          <input 
            required
            type="text" 
            value={editingAdmin?.name || ''} 
            onChange={e => setEditingAdmin({...editingAdmin, name: e.target.value})}
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" 
            placeholder="e.g. Robert Smith"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-tighter ml-1">System Email</label>
            <input 
              required
              type="email" 
              value={editingAdmin?.email || ''} 
              onChange={e => setEditingAdmin({...editingAdmin, email: e.target.value})}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" 
              placeholder="e.g. robert@easytech.com"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-tighter ml-1">Phone Number</label>
            <input 
              required
              type="tel" 
              value={editingAdmin?.phone || ''} 
              onChange={e => setEditingAdmin({...editingAdmin, phone: e.target.value})}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" 
              placeholder="e.g. +1 555-000-0000"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-tighter ml-1">
            {editingAdmin?.id ? "New Password (Optional)" : "Account Password"}
          </label>
          <input 
            required={!editingAdmin?.id}
            type="password" 
            value={editingAdmin?.password || ''} 
            onChange={e => setEditingAdmin({...editingAdmin, password: e.target.value})}
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" 
            placeholder={editingAdmin?.id ? "Leave blank to keep current" : "Minimum 8 characters"}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-tighter ml-1">Access Role</label>
          <div className="relative">
            <select 
              value={editingAdmin?.role_id || 'r4'}
              onChange={e => setEditingAdmin({...editingAdmin, role_id: e.target.value})}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 appearance-none text-gray-900 dark:text-white"
            >
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-4 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-60"
        >
          {isLoading ? 'Saving...' : editingAdmin?.id ? "Update Credentials" : "Provision Account"}
        </button>
      </form>
    </Modal>
  );
};

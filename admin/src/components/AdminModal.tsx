import React, { useState, useEffect } from 'react';
import { X, UserPlus, Shield, Trash2, Mail } from 'lucide-react';
import { AdminUser, Organization, Role } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { usersApi, rolesApi, ApiError } from '../services/apiService';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: Organization | null;
}

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose, organization }) => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role_id: 0,
    status: 'Active' as 'Active' | 'Inactive',
    is_super_admin: false,
    parent_id: null as number | null,
  });
  const [error, setError] = useState('');

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const data = await usersApi.getAll(1, organization?.id);
      const list = Array.isArray(data) ? data : data?.data ?? [];
      setAdmins(list);
    } catch (err) {
      if (err instanceof ApiError) {
        console.error('Error fetching admins:', err.message);
      } else {
        console.error('Error fetching admins:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && organization) {
      fetchAdmins();
      setNewAdmin({
        name: '',
        email: '',
        phone: '',
        password: '',
        role_id: 1,
        status: 'Active',
        is_super_admin: false,
        parent_id: null,
      });
      setError('');
    }
  }, [isOpen, organization]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    setError('');

    try {
      if (!newAdmin.role_id) {
        setError('Please select a role');
        return;
      }

      await usersApi.create({
        name: newAdmin.name,
        email: newAdmin.email,
        phone: newAdmin.phone || undefined,
        password: newAdmin.password,
        role_id: newAdmin.role_id,
        organization_id: organization.id,
        parent_id: newAdmin.parent_id,
        status: newAdmin.status,
        is_super_admin: newAdmin.is_super_admin,
      });

      setNewAdmin({
        name: '',
        email: '',
        phone: '',
        password: '',
        role_id: 1,
        status: 'Active',
        is_super_admin: true,
        parent_id: null,
      });
      fetchAdmins();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to add admin');
      } else {
        setError('Connection error');
      }
    }
  };

  const handleDeleteAdmin = async (id: number) => {
    if (!confirm('Are you sure you want to remove this admin?')) return;
    try {
      await usersApi.delete(id);
      fetchAdmins();
    } catch (err) {
      console.error('Error deleting admin:', err);
    }
  };

  if (!isOpen || !organization) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Manage Admins</h2>
              <p className="text-xs text-slate-500">{organization.name}</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Add Admin Form */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                Add New Admin
              </h3>
              <form onSubmit={handleAddAdmin} className="space-y-3">
                {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input 
                    required
                    type="text"
                    value={newAdmin.name}
                    onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input 
                    required
                    type="email"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="admin@org.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input 
                    type="tel"
                    value={newAdmin.phone}
                    onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="+1 555 000 0000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                  <input 
                    required
                    type="password"
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Admin</label>
                  <select 
                    value={newAdmin.parent_id ?? ''}
                    onChange={(e) => setNewAdmin({ ...newAdmin, parent_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="">None</option>
                    {admins.map((admin) => (
                      <option key={admin.id} value={admin.id}>{admin.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select 
                    value={newAdmin.status}
                    onChange={(e) => setNewAdmin({ ...newAdmin, status: e.target.value as 'Active' | 'Inactive' })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={newAdmin.is_super_admin}
                    onChange={(e) => setNewAdmin({ ...newAdmin, is_super_admin: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Super Admin
                </label>
                <button 
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all text-sm"
                >
                  Add Admin
                </button>
              </form>
            </div>

            {/* Admin List */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                Current Admins
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {loading ? (
                  <div className="py-8 text-center text-slate-400 text-sm">Loading...</div>
                ) : admins.length > 0 ? (
                  admins.map((admin) => (
                    <div key={admin.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 font-bold text-xs">
                          {admin.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-none">{admin.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {/* <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{getRoleName(admin)}</span> */}
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Mail className="w-2.5 h-2.5" />
                              {admin.email}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteAdmin(admin.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-400 text-sm italic">No admins registered yet.</div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

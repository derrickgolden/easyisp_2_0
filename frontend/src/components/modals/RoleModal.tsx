
import React from 'react';
import { Modal } from '../UI';
import { Role } from '@/src/types';
import { toast } from 'sonner';
import { rolesApi } from '../../services/apiService';
import { STORAGE_KEYS } from '../../constants/storage';

interface RoleModalProps {
  isOpen: boolean;
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  setEditingRole: React.Dispatch<React.SetStateAction<Role | null>>;
  setIsPermMatrixOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRoleModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const RoleModal: React.FC<RoleModalProps> = ({
  isOpen, setRoles, setEditingRole, setIsPermMatrixOpen, setIsRoleModalOpen
}) => {
  const [newRoleName, setNewRoleName] = React.useState('');

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newRoleName.trim();
    if (!trimmedName) return;

    const newRole = {
      name: trimmedName,
      permissions: []
    };

    // submit the new role to the backend and update state
    try {
      const response = await rolesApi.create(newRole);
      const created = response?.data ?? response;

      const createdRole: Role = {
        id: created?.id?.toString?.() ?? created?.id ?? `${Date.now()}`,
        name: created?.name ?? newRole.name,
        permissions: created?.permissions ?? [],
      };

      setRoles(prev => {
        const updated = [...prev, createdRole];
        localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(updated));
        return updated;
      });

      setIsRoleModalOpen(false);
      setNewRoleName('');

      // Automatically open the permission matrix for the new role to complete setup
      setEditingRole(createdRole);
      setIsPermMatrixOpen(true);
      toast(`Role "${createdRole.name}" initialized. Please define its permissions.`);
    } catch (error) {
      console.error('Error creating role:', error);
      toast.error('Error creating role. Please try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setNewRoleName('');
        setIsRoleModalOpen(false);
      }}
      title="Define New System Role"
    >
      <form onSubmit={handleSaveRole} className="space-y-4">
        <p className="text-xs text-gray-500 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/20">
          Define a semantic role name. You can configure precise permissions in the next step.
        </p>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-tighter ml-1">Role Identifier</label>
          <input 
            required
            autoFocus
            type="text" 
            value={newRoleName} 
            onChange={e => setNewRoleName(e.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" 
            placeholder="e.g. Billing Manager"
          />
        </div>
        <button type="submit" className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold py-3 rounded-xl mt-4 hover:opacity-90 transition-all">
          Initialize Role Profile
        </button>
      </form>
    </Modal>
  );
};

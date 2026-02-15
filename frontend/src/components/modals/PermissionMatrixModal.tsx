
import React from 'react';
import { Modal } from '../UI';
import { Role, Permission } from '../../types';

interface PermissionMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingRole: Role | null;
  permissions: Permission[];
  onTogglePermission: (roleId: string, permId: string) => void;
  onCommit: () => void;
}

export const PermissionMatrixModal: React.FC<PermissionMatrixModalProps> = ({
  isOpen, onClose, editingRole, permissions, onTogglePermission, onCommit
}) => {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Capabilities: ${editingRole?.name}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        <p className="text-xs text-gray-500 bg-gray-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
          Configure specific functional permissions. These mapping synchronize directly with the backend ACL.
        </p>
        
        {['network', 'billing', 'crm', 'system'].map(group => (
          <div key={group}>
            <h4 className="text-[10px] font-black uppercase text-gray-400 dark:text-slate-500 mb-3 tracking-widest pl-1">{group} Module</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {permissions.filter(p => p.group === group).map(perm => (
                <label 
                  key={perm.id} 
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    editingRole?.permissions.includes(perm.id) 
                      ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' 
                      : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800'
                  }`}
                >
                  <div className="pr-2">
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{perm.name}</p>
                    <p className="text-[9px] text-gray-500 leading-tight mt-0.5">{perm.description}</p>
                  </div>
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500" 
                    checked={editingRole?.permissions.includes(perm.id) || false}
                    onChange={() => onTogglePermission(editingRole!.id, perm.id)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        
        <button 
          onClick={onCommit}
          className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold py-3 rounded-xl mt-4"
        >
          Commit Matrix Updates
        </button>
      </div>
    </Modal>
  );
};

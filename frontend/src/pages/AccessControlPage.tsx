
import React, { useEffect, useState } from 'react';
import { Card, Badge } from '../components/UI';
import { AdminUser, Role, Permission } from '../types';
import { rolesApi, usersApi } from '../services/apiService';
import { STORAGE_KEYS } from '../constants/storage';
import { AdminModal } from '../components/modals/AdminModal';
import { toast } from 'sonner';
import { confirmAction } from '../utils/alerts';
import { PermissionMatrixModal } from '../components/modals/PermissionMatrixModal';
import { RoleModal } from '../components/modals/RoleModal';

interface AccessControlPageProps {
  canManageAdmins: boolean;
  canManageRoles: boolean;
}

export const AccessControlPage: React.FC<AccessControlPageProps> = ({ canManageAdmins, canManageRoles }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Partial<AdminUser> | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.ADMINS) || '[]'));
  const [roles, setRoles] = useState<Role[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.ROLES) || '[]'));
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [accessTab, setAccessTab] = useState<'admins' | 'roles'>('admins');
  const [isPermMatrixOpen, setIsPermMatrixOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  useEffect(() => {
    if (accessTab === 'admins' && !canManageAdmins && canManageRoles) {
      setAccessTab('roles');
    }
    if (accessTab === 'roles' && !canManageRoles && canManageAdmins) {
      setAccessTab('admins');
    }
  }, [accessTab, canManageAdmins, canManageRoles, setAccessTab]);

  useEffect(() => {
    fetchAdmins();
    fetchRoles();
    fetchPermissions();
  }, []);

  const normalizeRolePermissionNames = (rawPermissions: any[] = []): string[] => {
    const names = rawPermissions
      .map((permission) => {
        if (typeof permission === 'string') return permission;

        if (typeof permission === 'number') {
          const matchedById = permissions.find(p => p.id === permission.toString());
          return matchedById?.name ?? '';
        }

        if (permission && typeof permission === 'object') {
          if (typeof permission.name === 'string') {
            return permission.name;
          }

          if (permission.id !== undefined && permission.id !== null) {
            const matchedById = permissions.find(p => p.id === permission.id.toString());
            return matchedById?.name ?? '';
          }
        }

        return '';
      })
      .filter((permissionName): permissionName is string => Boolean(permissionName));

    return Array.from(new Set(names));
  };

  const fetchPermissions = async () => {
    try {
      const res = await rolesApi.getPermissions();
      const rawPermissions = res.data || {};
      const flattenedPermissions = Array.isArray(rawPermissions)
        ? rawPermissions
        : Object.values(rawPermissions).flat();

      const normalizedPermissions: Permission[] = (flattenedPermissions as any[]).map((permission) => ({
        id: permission.id?.toString?.() ?? '',
        name: permission.name,
        description: permission.description,
        group: permission.group,
      }));

      setPermissions(normalizedPermissions);

    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const fetchAdmins = async () => {
    try {      
      // Load users
      const usersRes = await usersApi.getAll();
      const usersList = usersRes.data || [];

      const adminsData = usersList.map((u: any) => ({
        id: u.id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone || '',
        role_id: u.role_id.toString(),
        status: u.status,
        last_login: u.last_login || '',
        password: '',
        isSuperAdmin: u.is_super_admin || false,
      }));

      setAdmins(adminsData);
      localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(adminsData));

    } catch (error) {
      console.error('Error loading administrators:', error);
      toast.error('Error loading administrators. Please try again later.');
    }
  };

  const fetchRoles = async () => {
    try {
      const rolesRes = await rolesApi.getAll();
      const rolesList = rolesRes.data || [];
      const data = rolesList.map((r: any) => ({
        id: r.id.toString(),
        name: r.name,
        permissions: normalizeRolePermissionNames(r.permissions || []),
      }));
      setRoles(data);
      localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(data));

    } catch (error) {
      console.error('Error fetching roles:', error);
    } 
  };

  const filteredAdmins = admins.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.phone && a.phone.includes(searchTerm))
  );

  const AddAdmin = () => { setEditingAdmin({}); setIsAdminModalOpen(true); };
  const EditAdmin = (a: AdminUser) => { setEditingAdmin(a); setIsAdminModalOpen(true); };

  const onEditRole = (r: Role) => { setEditingRole(r); setIsPermMatrixOpen(true); }

  const onTogglePermission = (roleId: string, permissionName: string) => {
    if (!editingRole || editingRole.id !== roleId) return;

    const hasPerm = editingRole.permissions.includes(permissionName);
    const updatedPerms = hasPerm
      ? editingRole.permissions.filter(p => p !== permissionName)
      : [...editingRole.permissions, permissionName];

    setEditingRole({
      ...editingRole,
      permissions: updatedPerms,
    });
  };

  const onCommitPermissions = async () => {
    if (!editingRole) return;

    try {
      console.log('Updating role with permissions:', editingRole);
      const response = await rolesApi.update(editingRole.id, {
        name: editingRole.name,
        permissions: editingRole.permissions,
      });

      const updated = response?.role ?? response?.data ?? response;
      console.log('Updated role response:', updated);
      const updatedRole: Role = {
        id: updated?.id?.toString?.() ?? editingRole.id,
        name: updated?.name ?? editingRole.name,
        permissions: normalizeRolePermissionNames(updated?.permissions ?? editingRole.permissions),
      };

      setRoles(prev => {
        const next = prev.map(r => (r.id === updatedRole.id ? updatedRole : r));
        localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(next));
        return next;
      });

      setEditingRole(updatedRole);
      setIsPermMatrixOpen(false);
      toast.success('Permissions updated successfully.');
    } catch (error) {
      console.error('Error updating role permissions:', error);
      toast.error('Error updating permissions. Please try again.');
    }
  };

  const onDeleteAdmin = async (admin: AdminUser) => {
    const result = await confirmAction(
      `Delete administrator "${admin.name}"?`,
      'This action cannot be undone.',
      { confirmButtonText: 'Delete' }
    );
    if (!result.isConfirmed) return;

    try {
      await usersApi.delete(admin.id);
      toast.success('Administrator deleted successfully.');
      fetchAdmins();
    } catch (error) {
      console.error('Error deleting administrator:', error);
      toast.error('Error deleting administrator. Please try again later.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header with Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-xl w-fit">
          {canManageAdmins && (
            <button 
              type="button"
              onClick={() => setAccessTab('admins')} 
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${accessTab === 'admins' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Administrators
            </button>
          )}
          {canManageRoles && (
            <button 
              type="button"
              onClick={() => setAccessTab('roles')} 
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${accessTab === 'roles' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Roles & Permissions
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {accessTab === 'admins' && canManageAdmins ? (
            <button 
              type="button"
              onClick={AddAdmin} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Create Administrator
            </button>
          ) : null}
          {accessTab === 'roles' && canManageRoles ? (
            <button 
              type="button"
              onClick={() => setIsRoleModalOpen(true)} 
              className="bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Define New Role
            </button>
          ) : null}
        </div>
      </div>

      {!canManageAdmins && !canManageRoles ? (
        <Card title="Access Restricted" className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none">
          <p className="text-sm text-gray-500">You do not have permission to manage administrators or roles.</p>
        </Card>
      ) : accessTab === 'admins' ? (
        <Card title="Management Access" className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="relative w-full md:w-96">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input 
                type="text" 
                placeholder="Search by name, email or phone..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white"
              />
            </div>
            <p className="text-xs text-gray-400 italic">Total Administrators: {admins.length}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest border-b dark:border-slate-800">
                <tr>
                  <th className="pb-3 px-2">Administrator</th>
                  <th className="pb-3 px-2">Contact</th>
                  <th className="pb-3 px-2">Access Role</th>
                  <th className="pb-3 px-2">Status</th>
                  <th className="pb-3 px-2">Last Activity</th>
                  <th className="pb-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {filteredAdmins.map(admin => {
                  const role = roles.find(r => r.id === admin.role_id);
                  return (
                    <tr key={admin.id} className="group hover:bg-gray-50 dark:hover:bg-slate-800/20 transition-all">
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-bold text-base">
                            {admin.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-gray-100">{admin.name}</p>
                            <p className="text-xs text-gray-500">{admin.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">{admin.phone || 'N/A'}</p>
                      </td>
                      <td className="py-4 px-2">
                        <span className={`px-2 py-1 rounded-lg text-[10px] uppercase font-black tracking-tighter ${
                          role?.name === 'Super Admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40'
                        }`}>
                          {role?.name}
                        </span>
                      </td>
                      <td className="py-4 px-2">
                        <Badge variant={admin.status}>{admin.status}</Badge>
                      </td>
                      <td className="py-4 px-2 text-gray-500 text-xs">
                        {new Date(admin.last_login).toLocaleString()}
                      </td>
                      <td className="py-4 px-2 text-right">
                        <div className="flex justify-end gap-2 transition-opacity">
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); EditAdmin(admin); }}
                            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 rounded-lg transition-all"
                            title="Edit Admin"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          {!admin.isSuperAdmin && (
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onDeleteAdmin(admin); }}
                              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-all"
                              title="Delete Admin"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )})}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
          {roles.map(role => (
            <Card key={role.id} title={role.name} className="relative overflow-hidden group border-none shadow-lg hover:shadow-xl transition-all">
              <div className={`absolute top-0 right-0 p-1.5 rounded-bl-xl text-[10px] font-bold text-white ${role.name === 'Super Admin' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                {role.permissions.length} PERMS
              </div>
              <div className="space-y-4 pt-2">
                <div className="flex flex-wrap gap-1.5 h-20 overflow-hidden relative">
                  {role.permissions.map((permName) => (
                    <span key={permName} className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-md font-medium">
                      {permissions.find(p => p.name === permName)?.name ?? permName}
                    </span>
                  ))}
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-slate-900 to-transparent"></div>
                </div>
                <button 
                  type="button"
                  onClick={() => onEditRole(role)} 
                  className="w-full text-sm font-bold bg-gray-50 dark:bg-slate-800 hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:text-gray-300 py-2.5 rounded-xl transition-all"
                >
                  Configure Permissions
                </button>
              </div>
            </Card>
          ))}
          
          <button 
            type="button"
            onClick={() => setIsRoleModalOpen(true)}
            className="border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all min-h-[180px]"
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-3 group-hover:bg-white transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </div>
            <span className="font-bold">New Role Definition</span>
            <p className="text-[10px] mt-1 text-center">Define a new set of capabilities for team members</p>
          </button>
        </div>
      )}
      {/* Admin Modal */}
      <AdminModal 
        isOpen={isAdminModalOpen} 
        onClose={() => setIsAdminModalOpen(false)} 
        roles={roles} 
        editingAdmin={editingAdmin} 
        setEditingAdmin={setEditingAdmin} 
        onSuccess={() => { fetchAdmins(); setIsAdminModalOpen(false); }}
      />

      {/* Permissions Matrix Modal */}
      <PermissionMatrixModal 
        isOpen={isPermMatrixOpen} 
        onClose={() => setIsPermMatrixOpen(false)} 
        editingRole={editingRole} 
        permissions={permissions} 
        onTogglePermission={onTogglePermission} 
        onCommit={onCommitPermissions} 
      />   

      {/* Role modal */}
      <RoleModal 
        isOpen={isRoleModalOpen} 
        setRoles={setRoles}
        setEditingRole={setEditingRole}
        setIsPermMatrixOpen={setIsPermMatrixOpen}
        setIsRoleModalOpen={setIsRoleModalOpen}
      />  
         
    </div>
  );
};

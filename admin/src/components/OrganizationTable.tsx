import React, { useState } from 'react';
import { Organization, OrgStatus } from '../types';
import { Globe, Users, Edit2, Trash2, CheckCircle, AlertCircle, Clock, Shield } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AdminModal } from './AdminModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface OrganizationTableProps {
  organizations: Organization[];
  onEdit: (org: Organization) => void;
  onDelete: (id: number) => void;
}

export const OrganizationTable: React.FC<OrganizationTableProps> = ({ organizations, onEdit, onDelete }) => {
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [selectedOrgForAdmins, setSelectedOrgForAdmins] = useState<Organization | null>(null);

  const getStatusIcon = (status: OrgStatus) => {
    switch (status) {
      case OrgStatus.ACTIVE: return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case OrgStatus.SUSPENDED: return <AlertCircle className="w-4 h-4 text-rose-500" />;
        default: return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusClass = (status: OrgStatus) => {
    switch (status) {
      case OrgStatus.ACTIVE: return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case OrgStatus.SUSPENDED: return "bg-rose-50 text-rose-700 border-rose-100";
        default: return "bg-amber-50 text-amber-700 border-amber-100";
    }
  };

  const onManageAdmins = (org: Organization) => {
    setSelectedOrgForAdmins(org);
    setIsAdminModalOpen(true);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Organization</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Sites</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Customers</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Details</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {organizations.map((org) => (
            <tr key={org.id} className="hover:bg-slate-50/50 transition-colors group">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                    {org.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{org.name}</p>
                    <p className="text-xs text-slate-500">ID: #{org.id}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                  getStatusClass(org.status)
                )}>
                  {getStatusIcon(org.status)}
                  {org.status.charAt(0).toUpperCase() + org.status.slice(1)}
                </span>
              </td>
              <td className="px-6 py-4 text-center">
                <div className="inline-flex items-center gap-1 text-slate-600">
                  <Globe className="w-4 h-4 opacity-40" />
                  <span className="font-medium">{org.sites_count ?? 0}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-center">
                <div className="inline-flex items-center gap-1 text-slate-600">
                  <Users className="w-4 h-4 opacity-40" />
                  <span className="font-medium">{org.customers_count ?? 0}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm">
                  <p className="text-slate-900">{org.acronym}</p>
                  <p className="text-slate-500 text-xs">Tier: {org.subscription_tier}</p>
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onManageAdmins(org)}
                    title="Manage Admins"
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onEdit(org)}
                    title="Edit Organization"
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onDelete(org.id)}
                    title="Delete Organization"
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <AdminModal 
        isOpen={isAdminModalOpen}
        onClose={() => {
          setIsAdminModalOpen(false);
          setSelectedOrgForAdmins(null);
        }}
        organization={selectedOrgForAdmins}
      />
    </div>
  );
};

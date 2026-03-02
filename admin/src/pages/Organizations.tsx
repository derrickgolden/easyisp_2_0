import React, { useState, useEffect } from 'react';
import { Plus } from "lucide-react";
import { Organization, OrganizationLicenseBillingResponse } from "../types";
import { OrganizationTable } from "../components/OrganizationTable";
import { OrgModal } from '../components/OrgModal';
import { organizationsApi, ApiError } from '../services/apiService';

const Organizations: React.FC<{ handleDelete?: (id: number) => void }> = ({ handleDelete }) => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
    const [licenseBilling, setLicenseBilling] = useState<OrganizationLicenseBillingResponse | null>(null);
    const [billingLoading, setBillingLoading] = useState(false);
    const [billingError, setBillingError] = useState<string | null>(null);

    const formatDate = (value?: string | null) => {
      if (!value) return 'N/A';
      const datePart = value.split('T')[0];
      const parsed = new Date(`${datePart}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return datePart;
      return parsed.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
    };

    const loadOrganizations = async () => {
      setLoading(true);
      try {
        const data = await organizationsApi.getAll();
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setOrganizations(list);
        if (list.length && !selectedOrgId) {
          const withGeneratedBills = list.find((org) => !!org.latest_license_snapshot);
          setSelectedOrgId(withGeneratedBills?.id ?? list[0].id);
        }
      } catch (error) {
        if (error instanceof ApiError) {
          console.error('Error fetching organizations:', error.message);
        } else {
          console.error('Error fetching organizations:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    const loadLicenseBillingHistory = async (orgId: number) => {
      setBillingLoading(true);
      setBillingError(null);
      try {
        const response = await organizationsApi.getLicenseBillingHistory(orgId);
        setLicenseBilling(response);
      } catch (error) {
        setLicenseBilling(null);
        if (error instanceof ApiError) {
          setBillingError(error.message || 'Failed to fetch billing history');
          console.error('Error fetching license billing history:', error.message);
        } else {
          setBillingError('Failed to fetch billing history');
          console.error('Error fetching license billing history:', error);
        }
      } finally {
        setBillingLoading(false);
      }
    };

    useEffect(() => {
      loadOrganizations();
    }, []);

    useEffect(() => {
      if (selectedOrgId) {
        loadLicenseBillingHistory(selectedOrgId);
      }
    }, [selectedOrgId]);

    const filteredOrgs = organizations.filter(org => 
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.acronym.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    return (
        <div className="max-w-7xl mx-auto space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h1 className="text-2xl font-bold text-slate-900">Organizations</h1>
                        <p className="text-slate-500 mt-1">Detailed view of all registered ISP organizations.</p>
                      </div>
                      <button 
                        onClick={() => {
                          setEditingOrg(null);
                          setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all active:scale-95"
                      >
                        <Plus className="w-5 h-5" />
                        Add Organization
                      </button>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      {loading ? (
                        <div className="p-12 text-center text-slate-500">Loading organizations...</div>
                      ) : (
                        <OrganizationTable 
                          organizations={filteredOrgs} 
                          onEdit={(org) => {
                            setEditingOrg(org);
                            setIsModalOpen(true);
                          }}
                          onDelete={async (id) => {
                            if (!confirm('Are you sure you want to delete this organization?')) return;
                            try {
                              if (handleDelete) {
                                await handleDelete(id);
                              } else {
                                await organizationsApi.delete(id);
                              }
                              await loadOrganizations();
                            } catch (error) {
                              if (error instanceof ApiError) {
                                console.error('Error deleting organization:', error.message);
                              } else {
                                console.error('Error deleting organization:', error);
                              }
                            }
                          }}
                        />
                      )}
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">Billing History</h2>
                          <p className="text-xs text-slate-500">Previous generated bills and payment status</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Organization</span>
                          <select
                            value={selectedOrgId ?? ''}
                            onChange={(e) => {
                              const next = e.target.value;
                              setSelectedOrgId(next ? Number(next) : null);
                            }}
                            className="min-w-[220px] px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white shadow-sm"
                          >
                            {!organizations.length && <option value="">No organizations found</option>}
                            {!!organizations.length && <option value="">Choose organization</option>}
                            {organizations.map((org) => (
                              <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {billingLoading ? (
                        <div className="text-sm text-slate-500">Loading bill history...</div>
                      ) : billingError ? (
                        <div className="text-sm text-rose-500">{billingError}</div>
                      ) : licenseBilling?.history?.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100">
                                <th className="py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Month</th>
                                <th className="py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                                <th className="py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Users</th>
                                <th className="py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {licenseBilling.history.map((item) => (
                                <tr key={item.id}>
                                  <td className="py-2 text-sm text-slate-700">{formatDate(item.snapshot_month)}</td>
                                  <td className="py-2 text-sm font-semibold text-slate-900">
                                    KSH {Number(item.total_amount || 0).toLocaleString()}
                                  </td>
                                  <td className="py-2 text-sm text-slate-700">{item.active_users_count}</td>
                                  <td className="py-2">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${item.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                      {item.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400">No billing history available for selected organization.</div>
                      )}
                    </div>
            {/* Modals */}
        <OrgModal 
            isOpen={isModalOpen}
            onClose={() => {
            setIsModalOpen(false);
            setEditingOrg(null);
            loadOrganizations();
            }}
            editingOrg={editingOrg}
            initialData={editingOrg}
        />
        </div>
    );
};

export default Organizations;
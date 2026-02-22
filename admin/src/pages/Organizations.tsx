import React, { useState, useEffect } from 'react';
import { Plus } from "lucide-react";
import { Organization } from "../types";
import { OrganizationTable } from "../components/OrganizationTable";
import { OrgModal } from '../components/OrgModal';
import { organizationsApi, ApiError } from '../services/apiService';

const Organizations: React.FC<{ handleDelete?: (id: number) => void }> = ({ handleDelete }) => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

    const loadOrganizations = async () => {
      setLoading(true);
      try {
        const data = await organizationsApi.getAll();
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setOrganizations(list);
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

    useEffect(() => {
      loadOrganizations();
    }, []);

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
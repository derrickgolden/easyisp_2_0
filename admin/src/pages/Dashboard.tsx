import React, { useState, useEffect } from 'react';

import { StatCard } from "../components/StatCard";
import { motion } from 'motion/react';
import { Building2, Globe, Users, LayoutDashboard, Plus, ChevronRight, Search } from 'lucide-react';
import { OrganizationTable } from "../components/OrganizationTable";
import { DashboardStats, Organization } from "../types";
import { OrgModal } from '../components/OrgModal';
import { organizationsApi, ApiError } from '../services/apiService';

const Dashboard: React.FC<{ isAuthenticated: boolean }> = ({ isAuthenticated }) => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

    const fetchData = async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
          const orgsData = await organizationsApi.getAll();
          const orgsList = Array.isArray(orgsData) ? orgsData : orgsData?.data ?? [];
          setOrganizations(orgsList);

          const totalOrganizations = orgsList.length;
          const activeOrganizations = orgsList.filter((org: Organization) => org.status === 'active').length;
          const totalSites = orgsList.reduce((sum: number, org: Organization) => sum + (org.sites_count ?? 0), 0);
          const totalCustomers = orgsList.reduce((sum: number, org: Organization) => sum + (org.customers_count ?? 0), 0);

          setStats({
            totalOrganizations,
            activeOrganizations,
            totalSites,
            totalCustomers,
          });
        } catch (error) {
          if (error instanceof ApiError) {
            console.error('Error fetching data:', error.message);
          } else {
            console.error('Error fetching data:', error);
          }
        } finally {
          setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
        fetchData();
        }
    }, [isAuthenticated]);

    const filteredOrgs = organizations?.filter(org => 
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.acronym.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = async (orgId: number) => {
        if (!window.confirm('Are you sure you want to delete this organization?')) return;
        try {
          await organizationsApi.delete(orgId);
          await fetchData();
        } catch (error) {
          if (error instanceof ApiError) {
            console.error('Error deleting organization:', error.message);
          } else {
            console.error('Error deleting organization:', error);
          }
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Page Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">ISP Management Dashboard</h1>
                <p className="text-slate-500 mt-1">Manage your organizations, network sites, and customer base.</p>
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

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                title="Total Organizations" 
                value={stats?.totalOrganizations || 0} 
                icon={Building2} 
                color="bg-indigo-600"
                trend="+2 this month"
              />
              <StatCard 
                title="Active Sites" 
                value={stats?.totalSites || 0} 
                icon={Globe} 
                color="bg-emerald-600"
                trend="All systems online"
              />
              <StatCard 
                title="Total Customers" 
                value={stats?.totalCustomers || 0} 
                icon={Users} 
                color="bg-amber-600"
                trend="+12% growth"
              />
              <StatCard 
                title="Active Status" 
                value={`${stats?.activeOrganizations || 0}/${stats?.totalOrganizations || 0}`} 
                icon={LayoutDashboard} 
                color="bg-violet-600"
              />
            </div>

            {/* Organizations Table Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Registered Organizations</h2>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span>Showing {filteredOrgs.length} results</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
              
              {loading ? (
                <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-4">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="font-medium">Loading organizations...</p>
                </div>
              ) : filteredOrgs.length > 0 ? (
                <OrganizationTable 
                  organizations={filteredOrgs} 
                  onEdit={(org) => {
                    setEditingOrg(org);
                    setIsModalOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">No organizations found</h3>
                  <p className="text-slate-500 mt-1">Try adjusting your search or add a new organization.</p>
                </div>
              )}
            </motion.div>
            {/* Modals */}
        <OrgModal 
            isOpen={isModalOpen}
            onClose={() => {
            setIsModalOpen(false);
            setEditingOrg(null);
            fetchData();
            }}
            editingOrg={editingOrg}
            initialData={editingOrg}
        />
        </div>
    );
};

export default Dashboard;
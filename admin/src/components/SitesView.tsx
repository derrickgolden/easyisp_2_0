import React, { useState, useEffect } from 'react';
import { Globe, Search, Plus, MoreVertical, CheckCircle, XCircle } from 'lucide-react';
import { Site } from '../types';
import { sitesApi, ApiError } from '../services/apiService';
import { motion } from 'motion/react';

export const SitesView: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadSites = async () => {
      setLoading(true);
      try {
        const data = await sitesApi.getAll();
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setSites(list);
      } catch (error) {
        if (error instanceof ApiError) {
          console.error('Error fetching sites:', error.message);
        } else {
          console.error('Error fetching sites:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    loadSites();
  }, []);

  const filteredSites = sites.filter(site => 
    site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (site.organization_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusLabel = (status: Site['status']) => (status === 'online' ? 'Online' : 'Offline');

  const getStatusClass = (status: Site['status']) =>
    status === 'online'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : 'bg-rose-50 text-rose-700 border-rose-100';

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Network Sites</h1>
          <p className="text-slate-500 mt-1">Monitor and manage all ISP network hubs and branches.</p>
        </div>
        <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all active:scale-95">
          <Plus className="w-5 h-5" />
          Add Site
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search sites or organizations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Site Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSites.map((site) => (
                  <tr key={site.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                          <Globe className="w-5 h-5 text-emerald-600" />
                        </div>
                        <span className="font-semibold text-slate-900">{site.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{site.organization_name || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusClass(site.status)}`}>
                        {site.status === 'online' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {getStatusLabel(site.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Globe, Search, Plus, CheckCircle, XCircle, Edit2, X } from 'lucide-react';
import { Site } from '../types';
import { sitesApi, ApiError } from '../services/apiService';

export const SitesView: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    ip_address: '',
    notify_on_down: false,
  });

  useEffect(() => {
    const loadSites = async () => {
      setLoading(true);
      try {
        const data = await sitesApi.getAll();
        const list = Array.isArray(data) ? data : data?.data ?? [];
        console.log('Fetched sites data:', list);
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

  const openEditModal = (site: Site) => {
    setEditingSite(site);
    setFormData({
      name: site.name ?? '',
      location: site.location ?? '',
      ip_address: site.ip_address ?? '',
      notify_on_down: !!site.notify_on_down,
    });
    setFormError(null);
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditingSite(null);
    setFormError(null);
  };

  const handleUpdateSite = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!editingSite) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        location: formData.location.trim(),
        ip_address: formData.ip_address.trim(),
        notify_on_down: formData.notify_on_down,
      };

      const response = await sitesApi.update(editingSite.id, payload);
      const updatedSite = response?.site?.data ?? response?.site ?? null;

      setSites((prevSites) =>
        prevSites.map((site) =>
          String(site.id) === String(editingSite.id)
            ? {
                ...site,
                ...payload,
                ...(updatedSite || {}),
              }
            : site
        )
      );

      closeEditModal();
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError('Failed to update site details. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

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
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ip</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last seen</th>
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
                    <td className="px-6 py-4 text-slate-600">{site.ip_address || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusClass(site.status)}`}>
                        {site.status === 'online' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {getStatusLabel(site.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{site.last_seen ? new Date(site.last_seen).toLocaleString() : '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(site)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-100 hover:border-indigo-200 bg-indigo-50/60 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isEditOpen && editingSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Edit Site</h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Site Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">IP Address</label>
                <input
                  type="text"
                  value={formData.ip_address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, ip_address: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl outline-none transition-all text-sm"
                  required
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.notify_on_down}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notify_on_down: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Notify when site is down
              </label>

              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 text-sm font-medium border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

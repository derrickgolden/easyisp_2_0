
import React, { useEffect, useState } from 'react';
import { Card, Badge, ToggleSwitch } from '../components/UI';
import { Site } from '../types';
import { sitesApi } from '../services/apiService';
import { STORAGE_KEYS } from '../constants/storage';
import { ConfigModal, IPAMModal, SiteProvisionModal } from '../components/modals/SiteModals';
import { toast } from 'sonner';
import { usePermissions } from '../hooks/usePermissions';

export const SitesPage: React.FC = () => {
  const [sites, setSites] = useState<Site[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.SITES) || '[]'));
  const [isSiteProvisionOpen, setIsSiteProvisionOpen] = useState(false);
  const [isIPAMOpen, setIsIPAMOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const { can } = usePermissions();

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    try {
      const res = await sitesApi.getAll();
      const sitesList = res.data || [];

      setSites(sitesList);
      localStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(sitesList));
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const handleToggleNotify = async (id: string) => {
    const target = sites.find(s => s.id === id);
    if (!target) return;

    const nextValue = !target.notify_on_down;

    try {
      const res = await sitesApi.update(id, { notify_on_down: nextValue });
      const updatedSite = res?.site || res?.data || { ...target, notify_on_down: nextValue };

      setSites(prev => {
        const next = prev.map(s => (s.id === id ? { ...s, ...updatedSite } : s));
        localStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(next));
        return next;
      });

      localStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(sites.map(s => s.id === id ? { ...s, notify_on_down: nextValue } : s)));
      toast.success(`Downtime alert turned ${nextValue ? "ON" : "OFF"}`);
    } catch (error) {
      console.error('Error updating site notification setting:', error);
      toast.error('Failed to update downtime alert setting');
    }
  };
  
  const onAdd = () => setIsSiteProvisionOpen(true);
  const onOpenIPAM = (s: Site) => { setSelectedSite(s); setIsIPAMOpen(true); };
  const onOpenConfig = (s: Site) => { setSelectedSite(s); setIsConfigOpen(true); };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Network Sites</h2>
        {
          can('manage-sites') && (
            <button 
              type="button"
              onClick={onAdd}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
            >
              Add Site
            </button>
          )
        }
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sites.map(site => (
          <Card key={site.id} title={site.location}>
            <div className="flex justify-between items-start mb-4">
              <div className="truncate pr-2">
                <h4 className="text-lg font-bold">{site.name}</h4>
                <p className="text-xs font-mono text-blue-600">{site.ip_address}</p>
                {site.last_seen && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                    Last seen: {new Date(site.last_seen).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end space-y-2">
                <Badge variant={site.status}>{site.status}</Badge>
                {/* <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(site.id); }} 
                  className="text-red-500 hover:bg-red-50 p-1 rounded"
                  title="Delete Site"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button> */}
              </div>
            </div>
            
            <div className="mb-4 flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span className="text-xs">Downtime Alert</span>
              <ToggleSwitch
                disabled={!can('manage-sites')} 
                checked={site.notify_on_down} 
                onChange={() => handleToggleNotify(site.id)} 
                label={site.notify_on_down ? "ON" : "OFF"} 
              />
            </div>

            <div className="flex space-x-2">
              <button type="button" 
                onClick={() => onOpenIPAM(site)} 
                className="flex-1 text-xs border border-gray-200 dark:border-slate-700 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800">
                  IPAM
              </button>
              <button type="button" 
                onClick={() => onOpenConfig(site)} 
                className="flex-1 text-xs border border-gray-200 dark:border-slate-700 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800">
                  Config
              </button>
            </div>
          </Card>
        ))}
      </div>

      <SiteProvisionModal 
        isOpen={isSiteProvisionOpen} 
        onClose={() => setIsSiteProvisionOpen(false)} 
        onSuccess={() => fetchSites()}
       />
      <IPAMModal 
        isOpen={isIPAMOpen} 
        onClose={() => setIsIPAMOpen(false)} 
        selectedSite={selectedSite} 
      />
      <ConfigModal 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} selectedSite={selectedSite} 
        onCopy={() => toast.message("Copied")} 
      />
    </div>
  );
};

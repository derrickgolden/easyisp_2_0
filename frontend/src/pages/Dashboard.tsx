
import React, { useEffect, useState } from 'react';
import { Card, StatCard, Badge } from '../components/UI';
import { COLORS, ICONS } from '../constants';
import { Site } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { sitesApi } from '../services/apiService';

export const Dashboard: React.FC = () => {
  const [sites, setSites] = useState<Site[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.SITES) || '[]'));
    const [insight, setInsight] = useState('Initializing AI heuristics engine...');
  
  
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
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Active Users" value="1,245" subValue="+12%" icon={<ICONS.CRM />} color={COLORS.primary} />
        <StatCard label="Online Now" value="842" icon={<ICONS.Management />} color={COLORS.success} />
        <StatCard label="Monthly Revenue" value="KSH 42,500" subValue="+5.4%" icon={<ICONS.Revenue />} color={COLORS.warning} />
        <StatCard label="System Alerts" value={sites.filter(s => s.status === 'offline').length} icon={<ICONS.Settings />} color={COLORS.danger} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="System Insights (AI)" className="lg:col-span-2">
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-r-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300 italic leading-relaxed">"{insight}"</p>
          </div>
        </Card>
        <Card title="MikroTik Router Status">
          <div className="space-y-4">
            {sites.map(site => (
              <div key={site.id} className="flex items-center justify-between border-b dark:border-slate-800 pb-2 last:border-0">
                <div>
                  <p className="text-sm font-medium">{site.name}</p>
                  <p className="text-xs text-gray-500">{site.routers_count} Routers</p>
                </div>
                <Badge variant={site.status}>{site.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

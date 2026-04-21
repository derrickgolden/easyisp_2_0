
import React, { useEffect, useMemo, useState } from 'react';
import { Card, StatCard, Badge, RevenueChart } from '../components/UI';
import { COLORS, ICONS } from '../constants';
import { Site } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { sitesApi, dashboardApi } from '../services/apiService';

interface DashboardStats {
  total_users: number;
  active_users: number;
  online_users: number;
  daily_revenue: number;
  offline_routers: number;
  clients_gained: number;
  clients_lost: number;
  window_days?: number;
  lost_mode?: 'expired' | 'offline' | 'either' | 'both';
}

interface RevenueChartData {
  data: { label: string; value: number }[];
  total: number;
  growth: number;
}

export const Dashboard: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [statsWindowDays, setStatsWindowDays] = useState(30);
  const [lostMode, setLostMode] = useState<'expired' | 'offline' | 'either' | 'both'>('both');
  const [stats, setStats] = useState<DashboardStats>({
    total_users: 0,
    active_users: 0,
    online_users: 0,
    daily_revenue: 0,
    offline_routers: 0,
    clients_gained: 0,
    clients_lost: 0,
    window_days: 30,
    lost_mode: 'either',
  });
  const [revenueChartData, setRevenueChartData] = useState<RevenueChartData>({
    data: [],
    total: 0,
    growth: 0,
  });
  const [insight, setInsight] = useState('Initializing AI heuristics engine...');
  
  
    useEffect(() => {
    const refreshDashboard = async () => {
      try {
        // 🚀 FIRE ALL AT ONCE
        const [sitesRes, statsRes, chartRes] = await Promise.all([
          sitesApi.getAll(),
          dashboardApi.getStats({
            days: statsWindowDays,
            lostMode,
          }),
          dashboardApi.getRevenueChart()
        ]);

        // Batch updates together
        if (sitesRes.data) {
          setSites(sitesRes.data);
        }
        console.log('Stats response:', statsRes);
        setStats(statsRes);
        setRevenueChartData(chartRes);
      } catch (error) {
        console.error('Dashboard sync error:', error);
      }
    };

    refreshDashboard();
  }, [statsWindowDays, lostMode]);
  
    // Format currency
    const formatCurrency = useMemo(() => (amount: number) => {
      return amount.toLocaleString('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    }, []);

    const formattedTotal = formatCurrency(revenueChartData.total);
    const formattedDailyRevenue = formatCurrency(stats.daily_revenue);
    const netMomentum = stats.clients_gained - stats.clients_lost;
    const lostModeLabelMap = {
      expired: 'Expired only',
      offline: 'Offline only',
      either: 'Expired OR Offline',
      both: 'Expired AND Offline',
    } as const;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <StatCard label="Daily Revenue" value={formattedDailyRevenue} icon={<ICONS.Revenue />} color={COLORS.warning} />
        </div>
        <StatCard label="Total Users" value={stats.total_users} icon={<ICONS.CRM />} color={COLORS.primary} />
        <StatCard label="Active Users" value={stats.active_users} icon={<ICONS.CRM />} color={COLORS.primary} />
        <StatCard label="Online Now" value={stats.online_users} icon={<ICONS.Management />} color={COLORS.success} />
        {/* <StatCard label="System Alerts" value={stats.offline_routers} icon={<ICONS.Settings />} color={COLORS.danger} /> */}
      </div>

      <Card title="Customer Momentum" className="overflow-hidden">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-black">Net Change ({statsWindowDays} days)</p>
              <p className={`text-3xl font-black ${netMomentum >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {netMomentum >= 0 ? '+' : ''}{netMomentum}
              </p>
              <p className="text-xs text-slate-500">Gained by registration date, lost by selected criteria</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[7, 14, 30, 60, 90].map((value) => (
                <button
                  key={value}
                  onClick={() => setStatsWindowDays(value)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                    statsWindowDays === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {value}d
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Gained</p>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">+{stats.clients_gained}</p>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-200/70 mt-1">Customers registered in the last {statsWindowDays} days</p>
            </div>

            <div className="rounded-2xl border border-red-200/70 bg-red-50/70 dark:border-red-500/20 dark:bg-red-500/10 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-widest text-red-700 dark:text-red-300">Lost</p>
                <select
                  value={lostMode}
                  onChange={(event) => setLostMode(event.target.value as 'expired' | 'offline' | 'either' | 'both')}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg border border-red-200 bg-white text-red-700 dark:bg-slate-900 dark:border-red-400/30 dark:text-red-300"
                >
                  <option value="expired">Expired only</option>
                  <option value="offline">Offline only</option>
                  <option value="either">Expired OR Offline</option>
                  <option value="both">Expired AND Offline</option>
                </select>
              </div>
              <p className="text-3xl font-black text-red-600 dark:text-red-400">-{stats.clients_lost}</p>
              <p className="text-xs text-red-800/80 dark:text-red-200/70">
                Mode: {lostModeLabelMap[lostMode]}. Expiry checks use the last {statsWindowDays} days.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <Card title="Revenue Trend (12M)" className="lg:col-span-2 overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-3xl font-black text-gray-900 dark:text-white">{formattedTotal}</p>
              <p className={`text-xs font-bold flex items-center gap-1 mt-1 ${revenueChartData.growth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d={revenueChartData.growth >= 0 ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                </svg>
                {Math.abs(revenueChartData.growth)}% {revenueChartData.growth >= 0 ? 'growth' : 'decline'} (last 6 months vs previous)
              </p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg text-[10px] font-black uppercase">Last 12 Months</span>
            </div>
          </div>
          <RevenueChart data={revenueChartData.data} />
        </Card>

        <div className="space-y-6">
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

          <Card title="System Insights (AI)" className="lg:col-span-2">
            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-r-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300 italic leading-relaxed">"{insight}"</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

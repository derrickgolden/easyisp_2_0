
import React, { useEffect, useMemo, useState } from 'react';
import { Card, StatCard, Badge, RevenueChart } from '../components/UI';
import { COLORS, ICONS } from '../constants';
import { Site } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { sitesApi, dashboardApi } from '../services/apiService';

interface DashboardStats {
  active_users: number;
  online_users: number;
  daily_revenue: number;
  offline_routers: number;
  clients_gained: number;
  clients_lost: number;
}

interface RevenueChartData {
  data: { label: string; value: number }[];
  total: number;
  growth: number;
}

export const Dashboard: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    active_users: 0,
    online_users: 0,
    daily_revenue: 0,
    offline_routers: 0,
    clients_gained: 0,
    clients_lost: 0,
  });
  const [revenueChartData, setRevenueChartData] = useState<RevenueChartData>({
    data: [],
    total: 0,
    growth: 0,
  });
  const [insight, setInsight] = useState('Initializing AI heuristics engine...');
  const [isLoading, setIsLoading] = useState(true);
  
  
    useEffect(() => {
    const refreshDashboard = async () => {
      setIsLoading(true);
      try {
        // 🚀 FIRE ALL AT ONCE
        const [sitesRes, statsRes, chartRes] = await Promise.all([
          sitesApi.getAll(),
          dashboardApi.getStats(),
          dashboardApi.getRevenueChart()
        ]);
console.log('Dashboard data fetched:', { sitesRes, statsRes, chartRes });
        // Batch updates together
        if (sitesRes.data) {
          setSites(sitesRes.data);
        }
        setStats(statsRes);
        setRevenueChartData(chartRes);
      } catch (error) {
        console.error('Dashboard sync error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    refreshDashboard();
  }, []);
  
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <StatCard label="Daily Revenue" value={formattedDailyRevenue} icon={<ICONS.Revenue />} color={COLORS.warning} />
        </div>
        <StatCard label="Active Users" value={stats.active_users} icon={<ICONS.CRM />} color={COLORS.primary} />
        <StatCard label="Online Now" value={stats.online_users} icon={<ICONS.Management />} color={COLORS.success} />
        <StatCard label="System Alerts" value={stats.offline_routers} icon={<ICONS.Settings />} color={COLORS.danger} />
        <StatCard label="Gained (30d)" value={`+${stats.clients_gained}`} icon={<ICONS.CRM />} color={COLORS.success} />
        <StatCard label="Lost (30d)" value={`-${stats.clients_lost}`} icon={<ICONS.CRM />} color={COLORS.danger} />
      </div>

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

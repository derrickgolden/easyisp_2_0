import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Card } from '../components/UI';
import { Package, Site } from '../types';
import { hotspotCustomersApi, hotspotPackagesApi, sitesApi } from '../services/apiService';
import { STORAGE_KEYS } from '../constants/storage';

type HotspotCustomerRecord = {
    id: string;
    macAddress: string;
    phoneNumber: string;
    status: 'active' | 'expired' | 'blacklisted';
    siteId: string;
    siteName: string;
    packageId: string;
    packageName: string;
    lastIpAddress: string;
    activatedAt?: string | null;
    expiresAt?: string | null;
    lastSeenAt?: string | null;
};

const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
};

export const HotspotCustomersPage: React.FC = () => {
    const [showFilters, setShowFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [isPolling, setIsPolling] = useState(false);

    const [filters, setFilters] = useState(() => ({
        siteFilter: '',
        statusFilter: '',
        packageFilter: '',
        searchTerm: '',
    }));

    const [customers, setCustomers] = useState<HotspotCustomerRecord[]>([]);
    const [sites, setSites] = useState<Site[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.SITES) || '[]'));
    const [hotspotPackages, setHotspotPackages] = useState<Package[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.HOTSPOT_PACKAGES) || '[]'));

    useEffect(() => {
        fetchHotspotCustomers();
        fetchSites();
        fetchHotspotPackages();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    const fetchHotspotCustomers = async () => {
        try {
            setIsPolling(true);
            const response = await hotspotCustomersApi.getAll(1, 300);
            const raw = Array.isArray(response?.data) ? response.data : [];

            const records: HotspotCustomerRecord[] = raw.map((item: any) => ({
                id: String(item.id),
                macAddress: String(item.mac_address || ''),
                phoneNumber: String(item.phone_number || ''),
                status: item.status || 'expired',
                siteId: String(item.site_id || ''),
                siteName: String(item.site?.name || ''),
                packageId: String(item.current_package_id || ''),
                packageName: String(item.current_package?.name || ''),
                lastIpAddress: String(item.last_ip_address || ''),
                activatedAt: item.activated_at,
                expiresAt: item.expires_at,
                lastSeenAt: item.last_seen_at,
            }));

            setCustomers(records);
            localStorage.setItem(STORAGE_KEYS.HOTSPOT_CUSTOMERS, JSON.stringify(records));
        } catch (error) {
            console.error('Error fetching hotspot customers:', error);
        } finally {
            setIsPolling(false);
        }
    };

    const fetchSites = async () => {
        try {
            const res = await sitesApi.getAll();
            const list = res.data || [];
            setSites(list);
            localStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(list));
        } catch (error) {
            console.error('Error fetching sites:', error);
        }
    };

    const fetchHotspotPackages = async () => {
        try {
            const res = await hotspotPackagesApi.getAll();
            const list = Array.isArray(res) ? res : (res.data || []);
            setHotspotPackages(list);
            localStorage.setItem(STORAGE_KEYS.HOTSPOT_PACKAGES, JSON.stringify(list));
        } catch (error) {
            console.error('Error fetching hotspot packages:', error);
        }
    };

    const stats = useMemo(() => {
        const total = customers.length;
        const active = customers.filter(c => c.status === 'active').length;
        const expired = customers.filter(c => c.status === 'expired').length;
        const blacklisted = customers.filter(c => c.status === 'blacklisted').length;
        return { total, active, expired, blacklisted };
    }, [customers]);

    const filteredCustomers = useMemo(() => {
        return customers.filter(customer => {
            const fullText = [
                customer.macAddress,
                customer.phoneNumber,
                customer.packageName,
                customer.siteName,
                customer.lastIpAddress,
            ].join(' ').toLowerCase();

            const matchesSearch = fullText.includes(filters.searchTerm.toLowerCase());
            const matchesStatus = !filters.statusFilter || customer.status === filters.statusFilter;
            const matchesSite = !filters.siteFilter || customer.siteId === filters.siteFilter;
            const matchesPackage = !filters.packageFilter || customer.packageId === filters.packageFilter;

            return matchesSearch && matchesStatus && matchesSite && matchesPackage;
        });
    }, [customers, filters]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredCustomers.slice(start, start + rowsPerPage);
    }, [filteredCustomers, currentPage, rowsPerPage]);

    const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / rowsPerPage));
    const activeFilterCount = [filters.siteFilter, filters.statusFilter, filters.packageFilter].filter(Boolean).length;

    const resetFilters = () => {
        setFilters({
            siteFilter: '',
            statusFilter: '',
            packageFilter: '',
            searchTerm: '',
        });
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest text-center mb-2">Total Users</p>
                    <p className="text-3xl font-black text-center text-blue-900 dark:text-blue-400 leading-none">{stats.total}</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-lime-700 dark:text-lime-400 tracking-widest text-center mb-2">Active Users</p>
                    <p className="text-3xl font-black text-center text-lime-600 dark:text-lime-400 leading-none">{stats.active}</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-red-500 tracking-widest text-center mb-2">Expired Users</p>
                    <p className="text-3xl font-black text-center text-red-600 dark:text-red-400 leading-none">{stats.expired}</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest text-center mb-2">Blacklisted</p>
                    <p className="text-3xl font-black text-center text-gray-700 dark:text-gray-300 leading-none">{stats.blacklisted}</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-1">
                <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Hotspot Customer Database</h2>
                    <p className="text-sm text-slate-500 font-medium">Live hotspot sessions and subscription lifecycle state.</p>
                </div>

                <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    className={`relative px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border ${
                        showFilters || activeFilterCount > 0
                            ? 'bg-yellow-600 border-yellow-600 text-white shadow-md shadow-yellow-500/20'
                            : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-600 hover:border-yellow-400'
                    }`}
                >
                    Filters
                    {activeFilterCount > 0 && (
                        <span className={`flex items-center justify-center w-5 h-5 text-[10px] rounded-full ${showFilters ? 'bg-white text-yellow-600' : 'bg-yellow-600 text-white'}`}>
                            {activeFilterCount}
                        </span>
                    )}
                </button>
            </div>

            {showFilters && (
                <Card title="Advanced Parameters" className="animate-in slide-in-from-top-4 duration-300 border-none shadow-xl bg-gray-50/50 dark:bg-slate-900/50">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Network Site</label>
                            <select
                                value={filters.siteFilter}
                                onChange={e => setFilters(prev => ({ ...prev, siteFilter: e.target.value }))}
                                className="w-full bg-white dark:bg-slate-800 border-none rounded-xl text-xs p-2.5 focus:ring-2 focus:ring-yellow-500 text-gray-900 dark:text-white appearance-none font-bold"
                            >
                                <option value="">All Sites</option>
                                {sites.map(site => (
                                    <option key={site.id} value={site.id}>{site.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Account Status</label>
                            <select
                                value={filters.statusFilter}
                                onChange={e => setFilters(prev => ({ ...prev, statusFilter: e.target.value }))}
                                className="w-full bg-white dark:bg-slate-800 border-none rounded-xl text-xs p-2.5 focus:ring-2 focus:ring-yellow-500 text-gray-900 dark:text-white appearance-none font-bold"
                            >
                                <option value="">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="expired">Expired</option>
                                <option value="blacklisted">Blacklisted</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Internet Package</label>
                            <select
                                value={filters.packageFilter}
                                onChange={e => setFilters(prev => ({ ...prev, packageFilter: e.target.value }))}
                                className="w-full bg-white dark:bg-slate-800 border-none rounded-xl text-xs p-2.5 focus:ring-2 focus:ring-yellow-500 text-gray-900 dark:text-white appearance-none font-bold"
                            >
                                <option value="">All Packages</option>
                                {hotspotPackages.map(pkg => (
                                    <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-end">
                            <button
                                onClick={resetFilters}
                                className="w-full py-2.5 text-xs font-black text-red-500 hover:text-red-600 transition-colors uppercase tracking-widest"
                            >
                                Clear All Filters
                            </button>
                        </div>
                    </div>
                </Card>
            )}

            <Card title="Hotspot Subscribers" className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <div className="relative w-full md:w-96">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </span>
                        <input
                            type="text"
                            placeholder="Search by MAC, phone, package, site or IP..."
                            value={filters.searchTerm}
                            onChange={e => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-200 dark:bg-slate-700 border border-gray-500 dark:border-transparent rounded-xl text-sm focus:border-none focus:ring-2 focus:ring-yellow-500 transition-all text-gray-900 dark:text-white"
                        />
                    </div>
                    <p className="text-xs text-gray-400 italic">Showing {filteredCustomers.length} of {customers.length} subscribers</p>
                </div>

                <div className="overflow-x-auto -mx-6">
                    <table className="w-full text-sm whitespace-nowrap sm:whitespace-normal">
                        <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest border-b dark:border-slate-800">
                            <tr>
                                <th className="pb-3 px-6">Device / Contact</th>
                                <th className="pb-3 px-6">Status</th>
                                <th className="pb-3 px-6">Site</th>
                                <th className="pb-3 px-6">Package</th>
                                <th className="pb-3 px-6">Network</th>
                                <th className="pb-3 px-6">Activated</th>
                                <th className="pb-3 px-6">Expires</th>
                                <th className="pb-3 px-6">Last Seen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-800">
                            {paginatedData.length > 0 ? paginatedData.map((customer, index) => (
                                <tr
                                    key={customer.id}
                                    className={`hover:bg-gray-100 dark:hover:bg-slate-800/40 transition-all ${index % 2 === 0 ? 'bg-gray-50 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-900'}`}
                                >
                                    <td className="py-4 px-6">
                                        <div>
                                            <p className="font-mono text-xs font-bold text-gray-900 dark:text-white">{customer.macAddress || '-'}</p>
                                            <p className="text-[10px] text-gray-400">{customer.phoneNumber || 'No phone'}</p>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <Badge variant={customer.status}>{customer.status.toUpperCase()}</Badge>
                                    </td>
                                    <td className="py-4 px-6 text-xs text-gray-700 dark:text-gray-300">{customer.siteName || '-'}</td>
                                    <td className="py-4 px-6 text-xs text-gray-700 dark:text-gray-300">{customer.packageName || '-'}</td>
                                    <td className="py-4 px-6">
                                        <div>
                                            <p className="font-mono text-xs text-gray-700 dark:text-gray-300">{customer.lastIpAddress || '-'}</p>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-xs text-gray-500">{formatDateTime(customer.activatedAt)}</td>
                                    <td className="py-4 px-6 text-xs text-gray-500">{formatDateTime(customer.expiresAt)}</td>
                                    <td className="py-4 px-6 text-xs text-gray-500">
                                        {isPolling ? 'Refreshing...' : formatDateTime(customer.lastSeenAt)}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-gray-400 italic">
                                        No hotspot customers found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                    <p className="text-xs text-gray-400">Page {currentPage} of {totalPages}</p>
                    <div className="flex items-center gap-2">
                        <select
                            value={rowsPerPage}
                            onChange={(e) => {
                                setRowsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs p-2 text-gray-900 dark:text-white"
                        >
                            {[10, 20, 50].map(size => <option key={size} value={size}>{size}/page</option>)}
                        </select>

                        <button
                            type="button"
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40"
                        >
                            Prev
                        </button>
                        <button
                            type="button"
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className="px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
};
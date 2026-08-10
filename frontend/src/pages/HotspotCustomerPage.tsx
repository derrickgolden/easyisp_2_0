import React, { useEffect, useRef, useState } from 'react';
import { Badge, Card } from '../components/UI';
import { Customer, Package, Site } from '../types';
import { useNavigate } from 'react-router-dom';
import { hotspotCustomersApi, hotspotPackagesApi, sitesApi } from '../services/apiService';
import { STORAGE_KEYS } from '../constants/storage';
import TableScrollModal from '../components/modals/TableScrollModal';
import { usePermissions } from '../hooks/usePermissions';
import { HotspotCustomerModal } from '../components/modals/HotspotCustomerModal';

const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
};

export const HotspotCustomersPage: React.FC = () => {
    const navigate = useNavigate();
    const [showFilters, setShowFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [isPolling, setIsPolling] = useState(false);
    const didInitialCustomerLoad = useRef(false);
    const { can } = usePermissions();

    const [filters, setFilters] = useState(() => ({
        siteFilter: '',
        statusFilter: '',
        connectivityFilter: '',
        packageFilter: '',
        searchTerm: '',
    }));
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        online: 0,
        expired: 0,
    });
    const [sites, setSites] = useState<Site[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.SITES) || '[]'));
    const [hotspotPackages, setHotspotPackages] = useState<Package[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.HOTSPOT_PACKAGES) || '[]'));
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [editingHotspotCustomer, setEditingHotspotCustomer] = useState< Partial<Customer> | null>(null);

    useEffect(() => {
        fetchSites();
        fetchHotspotPackages();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(filters.searchTerm);
        }, 350);

        return () => clearTimeout(timer);
    }, [filters.searchTerm]);

    useEffect(() => {
        if (currentPage !== 1) {
            setCurrentPage(1);
            return;
        }

        fetchHotspotCustomers();
    }, [filters.siteFilter, filters.statusFilter, filters.connectivityFilter, filters.packageFilter, debouncedSearchTerm, rowsPerPage]);

    useEffect(() => {
        if (!didInitialCustomerLoad.current) {
            didInitialCustomerLoad.current = true;
            return;
        }

        fetchHotspotCustomers();
    }, [currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const fetchHotspotCustomers = async () => {
        try {
            setIsPolling(true);
            const response = await hotspotCustomersApi.getAll({
                page: currentPage,
                perPage: rowsPerPage,
                search: debouncedSearchTerm,
                status: filters.statusFilter,
                onlineStatus: filters.connectivityFilter,
                siteId: filters.siteFilter,
                packageId: filters.packageFilter,
            });

            const list = Array.isArray(response?.data) ? response.data : [];
            const apiTotalPages = Number(response?.meta?.last_page || 1);
            const apiTotal = Number(response?.meta?.total || 0);
            const apiStats = response?.stats || {};

            setCustomers(list);
            setTotalPages(apiTotalPages > 0 ? apiTotalPages : 1);
            setTotalCustomers(apiTotal >= 0 ? apiTotal : 0);
            setStats({
                total: Number(apiStats.total || 0),
                active: Number(apiStats.active || 0),
                online: Number(apiStats.online || 0),
                expired: Number(apiStats.expired || 0),
            });

            localStorage.setItem(STORAGE_KEYS.HOTSPOT_CUSTOMERS, JSON.stringify(list));
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

    const activeFilterCount = [filters.siteFilter, filters.statusFilter, filters.connectivityFilter, filters.packageFilter].filter(Boolean).length;

    const resetFilters = () => {
        setFilters({
            siteFilter: '',
            statusFilter: '',
            connectivityFilter: '',
            packageFilter: '',
            searchTerm: '',
        });
    };

    const onAdd=() => { 
        // setEditingCustomer({ connectionType: 'PPPoE', installationFee: 0 }); 
        setIsCustomerModalOpen(true); 
    }

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
                    <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest text-center mb-2">Online Users</p>
                    <p className="text-3xl font-black text-center text-emerald-600 dark:text-emerald-400 leading-none">{stats.online}</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-red-500 tracking-widest text-center mb-2">Expired Users</p>
                    <p className="text-3xl font-black text-center text-red-600 dark:text-red-400 leading-none">{stats.expired}</p>
                </div>

            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-1">
                <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Hotspot Customer Database</h2>
                    <p className="text-sm text-slate-500 font-medium">Live hotspot sessions and subscription lifecycle state.</p>
                </div>

                <div className="flex items-center gap-2 justify-end">
                    <button
                        type="button"
                        onClick={() => setShowFilters(!showFilters)}
                        className={`relative px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border text-center ${
                            showFilters || activeFilterCount > 0
                                ? 'bg-yellow-600 border-yellow-600 text-white shadow-md shadow-yellow-500/20'
                                : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-600 hover:border-yellow-400'
                        }`}
                    >
                        <span>Filters</span>
                        {activeFilterCount > 0 && (
                            <span className={`flex items-center justify-center w-5 h-5 text-[10px] rounded-full ${showFilters ? 'bg-white text-yellow-600' : 'bg-yellow-600 text-white'}`}>
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    {
                        can('create-customers') && (
                        <button 
                            type="button"
                            onClick={onAdd}
                            className="bg-blue-600 hover:bg-blue-700 justify-self-end active:scale-95 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
                        >
                            <div className="bg-white/20 rounded-lg p-0.5">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            </div>
                            Create Voucher
                        </button>
                        )
                    }
                </div>
            </div>

            {showFilters && (
                <Card title="Advanced Parameters" className="animate-in slide-in-from-top-4 duration-300 border-none shadow-xl bg-gray-50/50 dark:bg-slate-900/50">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Live Connectivity</label>
                            <select
                                value={filters.connectivityFilter}
                                onChange={e => setFilters(prev => ({ ...prev, connectivityFilter: e.target.value }))}
                                className="w-full bg-white dark:bg-slate-800 border-none rounded-xl text-xs p-2.5 focus:ring-2 focus:ring-yellow-500 text-gray-900 dark:text-white appearance-none font-bold"
                            >
                                <option value="">All Sessions</option>
                                <option value="online">Online</option>
                                <option value="offline">Offline</option>
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
                    <p className="text-xs text-gray-400 italic">Showing {customers.length} of {totalCustomers} subscribers</p>
                </div>

                <div className="overflow-x-auto -mx-6">
                    <table className="w-full text-sm whitespace-nowrap sm:whitespace-normal">
                        <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest border-b dark:border-slate-800">
                            <tr>
                                <th className="pb-3 px-6">Device / Contact</th>
                                <th className="pb-3 px-6">Status</th>
                                <th className="pb-3 px-6">Connectivity</th>
                                <th className="pb-3 px-6">Site</th>
                                <th className="pb-3 px-6">Package</th>
                                <th className="pb-3 px-6">Activated</th>
                                <th className="pb-3 px-6">Expires</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-800">
                            {customers.length > 0 ? customers.map((customer, index) => (
                                <tr
                                    onClick={() => navigate(`/crm/hotspot-customers/${customer.id}`)}
                                    key={customer.id}
                                    className={`hover:bg-gray-100 dark:hover:bg-slate-800/40 transition-all cursor-pointer ${index % 2 === 0 ? 'bg-gray-50 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-900'}`}
                                >
                                    <td className="py-4 px-6">
                                        <div>
                                            <p className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                                                {[customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || customer.hostName || customer.macAddress || '-'}
                                            </p>
                                            <p className="text-[10px] text-gray-400">{customer.phone || 'No phone'}</p>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <Badge variant={customer.status}>{customer.status.toUpperCase()}</Badge>
                                    </td>
                                    {/* <td className="py-4 px-6">
                                        <Badge variant={customer.isOnline ? 'online' : 'offline'}>
                                            {(customer.onlineStatus || (customer.isOnline ? 'online' : 'offline')).toUpperCase()}
                                        </Badge>
                                    </td> */}
                                    <td className="py-4 px-6">
                                        <div className="flex flex-col">
                                            { customer.isOnline ? (
                                            <span className="text-[10px] text-green-500 font-bold flex items-center gap-1">
                                                <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
                                                Online
                                            </span>
                                            ) : (
                                            <span className="text-[10px] text-red-400 font-medium italic">Offline</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-xs text-gray-700 dark:text-gray-300">{customer?.site?.name || '-'}</td>
                                    <td className="py-4 px-6 text-xs text-gray-700 dark:text-gray-300">{customer?.package?.name || '-'}</td>
                                    <td className="py-4 px-6 text-xs text-gray-500">{formatDateTime(customer.activatedAt)}</td>
                                    <td className="py-4 px-6 text-xs text-gray-500">{formatDateTime(customer.expiryDate)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={9} className="py-16 text-center text-gray-400 italic">
                                        No hotspot customers found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <TableScrollModal 
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    totalPages={totalPages}
                    rowsPerPage={rowsPerPage}
                    setRowsPerPage={setRowsPerPage}
                />
            </Card>

            <HotspotCustomerModal
                isOpen={isCustomerModalOpen}
                onClose={() => setIsCustomerModalOpen(false)}
                setIsCustomerModalOpen={setIsCustomerModalOpen}
                editingHotspotCustomer={editingHotspotCustomer}
                setEditingHotspotCustomer={setEditingHotspotCustomer}
                customers={ customers}
            />
        </div>
    );
};
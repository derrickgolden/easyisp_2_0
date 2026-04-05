
import React, { useState, useMemo, useEffect } from 'react';
import { Card, Badge, Modal } from '../components/UI';
import { Customer, Package, Site } from '../types';
import { customersApi, packagesApi, sitesApi } from '../services/apiService';
import { CustomerModal } from '../components/modals/CustomerModal';
import { STORAGE_KEYS } from '../constants/storage';
import { useNavigate } from 'react-router-dom';
import TableScrollModal from '../components/modals/TableScrollModal';
import BulkSmsModal from '../components/modals/BulkSmsModal';
import { toast } from 'sonner';
import { usePermissions } from '../hooks/usePermissions';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isPolling, setIsPolling] = useState(false);
  
  // Filter States
  const [siteFilter, setSiteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [connectivityFilter, setConnectivityFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [packageFilter, setPackageFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [apartmentFilter, setApartmentFilter] = useState('');
  const [houseNoFilter, setHouseNoFilter] = useState('');

  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [packages, setPackages] = useState<Package[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.PACKAGES) || '[]'));
  const [customers, setCustomers] = useState<Customer[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '[]'));
  const [sites, setSites] = useState<Site[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.SITES) || '[]'));
  const [isBulkSmsOpen, setIsBulkSmsOpen] = useState(false);
  const { can } = usePermissions();

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Delete all state
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteAllProgress, setDeleteAllProgress] = useState(0);

  useEffect(() => {
    fetchSites();
    fetchPackages();
    fetchCustomers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, siteFilter, statusFilter, packageFilter]);

  const fetchPackages = async () => {
    try {
      const res = await packagesApi.getAll();

      setPackages(res.data || []);
      localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(res.data || []));
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      setIsPolling(true);
      const customersRes = await customersApi.getAll();
      const customersList = customersRes.data || [];
      setCustomers(customersList);

      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customersList));
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsPolling(false);
    }
  };

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

  // Stats Calculations
  const stats = useMemo(() => {
    return {
      total: customers.length,
      active: customers.filter(c => c.status === 'active').length,
      expired: customers.filter(c => c.status === 'expired').length,
      online: customers.filter(c => c.isOnline).length,
    };
  }, [customers]);

  const getLocationText = (value: unknown) => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'name' in value) {
      return String((value as { name?: unknown }).name ?? '');
    }
    return '';
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // Basic Search
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                            c.phone.includes(searchTerm) ||
                            c.radiusUsername.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            c.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // Advanced Filters
      const matchesSite = !siteFilter || c.nasIpAddress === siteFilter;
      const matchesStatus = !statusFilter || c.status === statusFilter;
      const matchesPackage = !packageFilter || c.packageId === packageFilter;
      const locationText = getLocationText(c.location);
      const matchesLocation = !locationFilter || locationText.toLowerCase().includes(locationFilter.toLowerCase());
      const matchesApartment = !apartmentFilter || c.apartment.toLowerCase().includes(apartmentFilter.toLowerCase());
      const matchesHouseNo = !houseNoFilter || c.houseNo.toLowerCase().includes(houseNoFilter.toLowerCase());
      
      const isOnline = !!c.isOnline;
      const matchesConnectivity = connectivityFilter === 'all' || 
                                (connectivityFilter === 'online' ? isOnline : !isOnline);

      return matchesSite && matchesStatus && matchesPackage && matchesLocation && 
             matchesApartment && matchesHouseNo && matchesConnectivity;
    });
  }, [
    customers, searchTerm, siteFilter, statusFilter, connectivityFilter, 
    packageFilter, locationFilter, apartmentFilter, houseNoFilter
  ]);

  // 3. PAGINATE LAST (slice only what the eye can see)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredCustomers.slice(start, start + rowsPerPage);
  }, [filteredCustomers, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredCustomers.length / rowsPerPage);

  const resetFilters = () => {
    setSiteFilter('');
    setStatusFilter('');
    setConnectivityFilter('all');
    setPackageFilter('');
    setLocationFilter('');
    setApartmentFilter('');
    setHouseNoFilter('');
    setSearchTerm('');
  };

  const activeFilterCount = [
    siteFilter, statusFilter, packageFilter, locationFilter, apartmentFilter, houseNoFilter
  ].filter(Boolean).length + (connectivityFilter !== 'all' ? 1 : 0);

  const onAdd=() => { 
    setEditingCustomer({ connectionType: 'PPPoE', installationFee: 0 }); 
    setIsCustomerModalOpen(true); 
  }

  const handleUploadCustomers = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsUploading(true);
      setUploadProgress(0);

      try {
        const text = await file.text();
        const lines = text.trim().split('\n');
        
        if (lines.length < 2) {
          toast.error('CSV file must contain at least a header row and one data row');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const expectedHeaders = ['Email', 'House No', 'Apartment', 'Location', 'Ip', 'Mac', 'Expiry Date', 'Name', 'Account', 'Radius Username', 'Radius Password', 'Phone'];
        
        // Check if headers match (case insensitive)
        const normalizedHeaders = headers.map(h => h.toLowerCase());
        const normalizedExpected = expectedHeaders.map(h => h.toLowerCase());
        
        const headersMatch = normalizedExpected.every(expected => 
          normalizedHeaders.includes(expected)
        );

        if (!headersMatch) {
          toast.error('CSV headers do not match expected format. Expected: ' + expectedHeaders.join(', '));
          return;
        }

        const dataRows = lines.slice(1);
        const customersToCreate = [];
        
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i].split(',').map(cell => cell.trim());
          
          // Parse name into first and last name
          const nameParts = row[7].split(' '); // Name is at index 7
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          // Get default package and site
          const defaultPackage = packages[0];
          const defaultSite = sites[0];

          if (!defaultPackage) {
            toast.error('No packages available. Please create a package first.');
            return;
          }

          if (!defaultSite) {
            toast.error('No sites available. Please create a site first.');
            return;
          }

          const customer = {
            first_name: firstName,
            last_name: lastName,
            email: row[0] || undefined, // Email
            phone: row[11], // Phone
            house_no: row[1] || undefined, // House No
            apartment: row[2] || undefined, // Apartment
            location: row[3] || undefined, // Location
            ip_address: row[4] || undefined, // Ip
            mac_address: row[5] || undefined, // Mac
            expiry_date: row[6], // Expiry Date
            radius_username: row[9], // Radius Username
            radius_password: row[10], // Radius Password
            connection_type: 'PPPoE',
            package_id: defaultPackage.id,
            site_id: defaultSite.id,
            installation_fee: 0,
            status: 'active',
            balance: 0,
            created_at: new Date().toISOString(),
          };

          customersToCreate.push(customer);
        }

        // Helper function to create customer with retry and delay
        const createCustomerWithRetry = async (customer: any, attempt = 1): Promise<boolean> => {
          const maxAttempts = 3;
          const baseDelay = 500; // 500ms initial delay
          
          try {
            await customersApi.create(customer);
            return true;
          } catch (error: any) {
            // Check if it's a rate limit error (429)
            if (error.status === 429 && attempt < maxAttempts) {
              // Exponential backoff: 500ms, 1500ms, 3500ms
              const delay = baseDelay * (2 ** (attempt - 1));
              console.log(`Rate limited. Retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              return createCustomerWithRetry(customer, attempt + 1);
            }
            throw error;
          }
        };

        // Create customers with rate limiting
        let successCount = 0;
        let errorCount = 0;
        console.log('Starting customer upload:', customersToCreate);
        
        for (let i = 0; i < customersToCreate.length; i++) {
          try {
            await createCustomerWithRetry(customersToCreate[i]);
            successCount++;
          } catch (error) {
            console.error(`Failed to create customer ${i + 1}:`, error);
            errorCount++;
          }
          
          // Add delay between requests to avoid rate limiting (500ms)
          if (i < customersToCreate.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          setUploadProgress(Math.round(((i + 1) / customersToCreate.length) * 100));
        }

        // Refresh customers list
        await fetchCustomers();

        if (successCount > 0) {
          toast.success(`Successfully uploaded ${successCount} customer${successCount > 1 ? 's' : ''}`);
        }
        
        if (errorCount > 0) {
          toast.error(`Failed to upload ${errorCount} customer${errorCount > 1 ? 's' : ''}`);
        }

      } catch (error) {
        console.error('Error uploading customers:', error);
        toast.error('Failed to upload customers. Please check the file format.');
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    };
    input.click();
  };

  const handleDownloadCustomers = () => {
    // Prepare CSV data from filtered customers
    const headers = [
      'First Name',
      'Last Name',
      'Phone',
      'Email',
      'Status',
      'Package',
      'Expiry Date',
      'Radius Username',
      'Radius Password',
      'Location',
      'Apartment',
      'House No',
      'Connection Type',
      'Site',
      'Balance',
      'Is Online'
    ];

    const csvRows = [
      headers.join(','),
      ...filteredCustomers.map(customer => {
        const site = sites.find(s => s.id === customer.siteId);
        return [
          `"${customer.firstName}"`,
          `"${customer.lastName}"`,
          `"${customer.phone}"`,
          `"${customer.email || ''}"`,
          `"${customer.status}"`,
          `"${customer.package?.name || ''}"`,
          `"${new Date(customer.expiryDate).toISOString().split('T')[0]}"`,
          `"${customer.radiusUsername}"`,
          `"${customer.radiusPassword}"`,
          `"${getLocationText(customer.location)}"`,
          `"${customer.apartment || ''}"`,
          `"${customer.houseNo || ''}"`,
          `"${customer.connectionType || ''}"`,
          `"${site?.name || ''}"`,
          `"${customer.balance || 0}"`,
          `"${customer.isOnline ? 'Yes' : 'No'}"`
        ].join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `customers_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkSms = () => {
    setIsBulkSmsOpen(true);
  };

  const handleDeleteAllCustomers = async () => {
    setIsDeletingAll(true);
    setDeleteAllProgress(0);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < customers.length; i++) {
        try {
          await customersApi.delete(customers[i].id);
          successCount++;
        } catch (error) {
          console.error(`Failed to delete customer ${customers[i].id}:`, error);
          errorCount++;
        }

        setDeleteAllProgress(Math.round(((i + 1) / customers.length) * 100));
      }

      // Refresh customers list
      await fetchCustomers();

      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} customer${successCount > 1 ? 's' : ''}`);
      }

      if (errorCount > 0) {
        toast.error(`Failed to delete ${errorCount} customer${errorCount > 1 ? 's' : ''}`);
      }

      setIsDeleteAllModalOpen(false);
    } catch (error) {
      console.error('Error deleting customers:', error);
      toast.error('Failed to delete customers.');
    } finally {
      setIsDeletingAll(false);
      setDeleteAllProgress(0);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Top Stats Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Total Users</span>
          </div>
          <p className="text-3xl font-black text-center text-gray-900 dark:text-white leading-none">{stats.total}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Active Users</span>
          </div>
          <p className="text-3xl font-black text-center text-emerald-600 dark:text-emerald-400 leading-none">{stats.active}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="text-[10px] font-black uppercase text-red-500 tracking-widest">Expired Users</span>
          </div>
          <p className="text-3xl font-black text-center text-red-600 dark:text-red-400 leading-none">{stats.expired}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Online Users</span>
          </div>
          <p className="text-3xl font-black text-center text-emerald-600 dark:text-emerald-400 leading-none">{stats.online}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-1">
        {/* Left: Title & Subtitle */}
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Customer Database
          </h2>
          <p className="text-sm text-slate-500 font-medium">Manage subscribers, connections, and billing status.</p>
        </div>

        {/* Right: Action Group */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          
          {/* Filter Button */}
          <button 
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`relative px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border ${
              showFilters || activeFilterCount > 0 
              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20' 
              : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-600 hover:border-blue-400 dark:hover:border-blue-500'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className={`flex items-center justify-center w-5 h-5 text-[10px] rounded-full ${showFilters ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Utilities Group (Import/Export/SMS) */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl items-center">
            <button 
              title={isUploading ? `Uploading... ${uploadProgress}%` : "Upload Customers"}
              onClick={handleUploadCustomers}
              disabled={isUploading}
              className={`p-2 rounded-lg transition-all ${
                isUploading 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 cursor-not-allowed' 
                  : 'hover:bg-white dark:hover:bg-slate-700 text-slate-500'
              }`}
            >
              {isUploading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
            </button>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />
            <button 
              title="Download CSV"
              onClick={handleDownloadCustomers}
              className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </button>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />
            {can('send-bulk-messages') && (
              <button 
                title="Send Bulk SMS"
                className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-all"
                onClick={handleBulkSms}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              </button>
            )}
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />
            {can('delete-customers') && (
              <button 
                title="Delete All Customers"
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500 transition-all"
                onClick={() => setIsDeleteAllModalOpen(true)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            )}
          </div>

          {/* Primary Action */}
          {
            can('create-customers') && (
              <button 
                type="button"
                onClick={onAdd}
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
              >
                <div className="bg-white/20 rounded-lg p-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </div>
                Register <span className="">Customer</span>
              </button>
            )
          }
        </div>
      </div>

      {/* Advanced Filter Panel */}
      {showFilters && (
        <Card title="Advanced Parameters" className="animate-in slide-in-from-top-4 duration-300 border-none shadow-xl bg-gray-50/50 dark:bg-slate-900/50">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Network Site</label>
              <select 
                value={siteFilter}
                onChange={e => setSiteFilter(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border-none rounded-xl text-xs p-2.5 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white appearance-none font-bold"
              >
                <option value="">All Sites</option>
                {sites.map(s => <option key={s.id} value={s.ip_address}>{s.name}</option>)}
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Account Status</label>
              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border-none rounded-xl text-xs p-2.5 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white appearance-none font-bold"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="suspended">Paused</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Live Connectivity</label>
              <div className="flex bg-white dark:bg-slate-800 rounded-xl p-1 gap-1 border border-transparent focus-within:ring-2 focus-within:ring-blue-500">
                {(['all', 'online', 'offline'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setConnectivityFilter(mode)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${
                      connectivityFilter === mode 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Internet Package</label>
              <select 
                value={packageFilter}
                onChange={e => setPackageFilter(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border-none rounded-xl text-xs p-2.5 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white appearance-none font-bold"
              >
                <option value="">All Packages</option>
                {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Area Location</label>
              <input 
                type="text" 
                placeholder="e.g. Githurai" 
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border-none rounded-xl text-xs p-2.5 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Apartment / Bldg</label>
              <input 
                type="text" 
                placeholder="e.g. Hadasa" 
                value={apartmentFilter}
                onChange={e => setApartmentFilter(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border-none rounded-xl text-xs p-2.5 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Hse / Unit No</label>
              <input 
                type="text" 
                placeholder="e.g. A4" 
                value={houseNoFilter}
                onChange={e => setHouseNoFilter(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border-none rounded-xl text-xs p-2.5 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
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

      <Card title="Subscribers" className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input 
              type="text" 
              placeholder="Search by name, username, phone or email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xs text-gray-400 italic">Showing {filteredCustomers.length} of {customers.length} subscribers</p>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm whitespace-nowrap sm:whitespace-normal">
            <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest border-b dark:border-slate-800">
              <tr>
                <th className="pb-3 px-6">Customer</th>
                <th className="pb-3 px-6">Status</th>
                <th className="pb-3 px-6">Connectivity</th>
                <th className="pb-3 px-6">Radius</th>
                <th className="pb-3 px-6">Service Plan</th>
                <th className="pb-3 px-6">Physical Address</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {paginatedData.length > 0 ? paginatedData.map(customer => {
                const isOnline = !!customer.isOnline;
                return (
                  <tr 
                    key={customer.id} 
                    onClick={() => navigate(`/crm/customers/${customer.id}`)}
                    className="group hover:bg-gray-50 dark:hover:bg-slate-800/20 transition-all cursor-pointer"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-bold text-base flex-shrink-0">
                            {customer.firstName?.charAt(0) || '?'}
                          </div>
                          {
                            isPolling ? (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></span>
                            ) : (
                              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${isOnline ? 'bg-green-500' : 'bg-red-300'}`}></div>
                            )
                          }
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                             <p className="font-bold text-gray-900 dark:text-gray-100">{customer.firstName} {customer.lastName}</p>
                             {customer.parentId && (
                                <span className="text-[9px] bg-purple-100 text-purple-600 dark:bg-purple-900/30 px-2 py-0.5 rounded-full font-black uppercase">Child</span>
                             )}
                          </div>
                          <p className="text-xs text-gray-500">{customer.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Badge variant={customer.status}>{customer.status}</Badge>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        { isPolling ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></span>
                            <span className="text-[10px] text-blue-400 font-medium">Syncing...</span>
                          </div>
                        ) : isOnline ? (
                          <span className="text-[10px] text-green-500 font-bold flex items-center gap-1">
                            <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
                            Online
                          </span>
                        ) : (
                          <span className="text-[10px] text-red-400 font-medium italic">Offline</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-gray-400 uppercase">User:</span>
                          <code className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300">{customer.radiusUsername}</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-gray-400 uppercase">Pass:</span>
                          <code className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300">{customer.radiusPassword}</code>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{customer.package?.name}</p>
                        <p className="text-[10px] text-gray-400">Exp: {new Date(customer.expiryDate).toDateString()}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                        {customer.houseNo && `${customer.houseNo}, `}{customer.apartment}
                        <br  />
                        <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">{getLocationText(customer.location)}</span>
                      </p>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-gray-400 italic">No subscribers found matching your criteria. Try adjusting your filters.</td>
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

      <CustomerModal 
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        setIsCustomerModalOpen={setIsCustomerModalOpen}
        editingCustomer={editingCustomer}
        setEditingCustomer={setEditingCustomer}
        customers={ customers}
      />

      <BulkSmsModal
        isBulkSmsOpen={isBulkSmsOpen}
        setIsBulkSmsOpen={setIsBulkSmsOpen}
        filteredCustomers={filteredCustomers}
        totalCustomers={customers.length}
        activeFilters={{
          searchTerm,
          siteFilter,
          statusFilter,
          packageFilter,
          locationFilter,
          apartmentFilter,
          houseNoFilter,
          connectivityFilter
        }}
        packages={packages}
        sites={sites}
      />

      {/* Delete All Customers Modal */}
      <Modal
        isOpen={isDeleteAllModalOpen}
        onClose={() => !isDeletingAll && setIsDeleteAllModalOpen(false)}
        title="Delete All Customers"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          {isDeletingAll ? (
            <>
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Deleting {customers.length} customer{customers.length !== 1 ? 's' : ''}...
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${deleteAllProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">{deleteAllProgress}%</p>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You are about to <span className="font-bold text-red-600">permanently delete</span> all {customers.length} customer{customers.length !== 1 ? 's' : ''} in your organization.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                This action cannot be undone.
              </p>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsDeleteAllModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAllCustomers}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all active:scale-95"
                >
                  Delete All
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

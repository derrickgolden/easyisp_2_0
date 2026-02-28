
import React, { use, useEffect, useState } from 'react';
import { Card, Badge } from '../components/UI';
import { Customer, Package } from '../types';
import { packagesApi } from '../services/apiService';
import { STORAGE_KEYS } from '../constants/storage';
import { PackageModal } from '../components/modals/PackageModal';
import { toast } from 'sonner';
import { confirmAction } from '../utils/alerts';
import { usePermissions } from '../hooks/usePermissions';

export const PackagesPage: React.FC = () => {

  const [packages, setPackages] = useState<Package[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.PACKAGES) || '[]'));
  const [editingPackage, setEditingPackage] = useState<Partial<Package> | null>(null);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { can } = usePermissions();

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const res = await packagesApi.getAll();

      localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(res.data || []));
      setPackages(res.data || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  const handleSavePackage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!editingPackage || !editingPackage.name) {
      setSaveError('Package name is required');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const existingIndex = packages.findIndex(p => p.id === editingPackage.id);

      if (existingIndex >= 0 && editingPackage.id) {
        // Update existing package
        await packagesApi.update(editingPackage.id, editingPackage);
        fetchPackages();
        toast.success('Package updated successfully');
      } else {
        // Create new package
        const response = await packagesApi.create(editingPackage);
        fetchPackages();
        toast.success('Package created successfully');
      }

      setIsPackageModalOpen(false);
      setEditingPackage(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save package';
      setSaveError(errorMessage);
      console.error('Error saving package:', error);
      toast.error('Error saving package: ' + errorMessage);
    } finally {
      setIsSaving(false);
    }
  }

  const handleDelete = async (id: string) => {
    const customers: Customer[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '[]');
    const isAssigned = customers.some(customer => customer.packageId === id || customer.package?.id === id);

    if (isAssigned) {
      await confirmAction(
        'Cannot delete package',
        'This package is assigned to one or more customers. Reassign them before deleting.',
        {
          icon: 'info',
          confirmButtonText: 'OK',
          cancelButtonText: 'Close',
          confirmButtonColor: '#2563eb',
        }
      );
      return;
    }

    const result = await confirmAction(
      'Delete this package?',
      'This action cannot be undone.',
      { confirmButtonText: 'Delete' }
    );

    if (!result.isConfirmed) return;

    try {
      await packagesApi.delete(id);
      fetchPackages();
      toast.success('Package deleted successfully');
    } catch (error) {
      console.error('Error deleting package:', error);
      toast.error('Error deleting package: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };


  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Internet Service Packages</h2>
          <p className="text-sm text-gray-500">Define bandwidth limits and billing cycles for customers.</p>
        </div>
        {
          can('manage-packages') && (
            <button 
              onClick={() => { setEditingPackage({}); setIsPackageModalOpen(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Create Package
            </button>
          )
        }
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map(pkg => (
          <Card key={pkg.id} title={pkg?.type?.toUpperCase()} className="relative group border-none shadow-xl hover:shadow-2xl transition-all">
            {
              can('manage-packages') && (
                <div className="absolute top-4 right-4 flex space-x-1 z-10">
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditingPackage(pkg); setIsPackageModalOpen(true); }}
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                    title="Edit Package"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(pkg.id); }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    title="Delete Package"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              )
            }

            <div className="mb-6">
              <h4 className="text-xl font-black text-gray-900 dark:text-white leading-tight mb-1">{pkg.name}</h4>
              <p className="text-3xl font-black text-blue-600 dark:text-blue-400">
                <span className="text-sm font-medium mr-1 uppercase">KSH</span>
                {pkg.price.toLocaleString()}
                <span className="text-sm text-gray-400 font-medium ml-1">/ {pkg.validity_days} Days</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-2xl border border-gray-100 dark:border-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Base DL</span>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{pkg.speed_down}</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-2xl border border-gray-100 dark:border-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Base UL</span>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{pkg.speed_up}</p>
              </div>
            </div>

            {pkg.burst_limit_down && (
              <div className="mb-6 px-3 py-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase text-blue-500 block leading-none mb-1">Burst Peak</span>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{pkg.burst_limit_down} DL / {pkg.burst_limit_up} UL</p>
                </div>
                <div className="flex flex-col items-end">
                   <Badge variant="active">Burst ON</Badge>
                   <span className="text-[8px] text-gray-400 mt-0.5">{pkg.burst_time} interval</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-4 border-t border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span className="font-bold">Radius Sync Enabled</span>
              </div>
              <Badge variant="active">Production</Badge>
            </div>
          </Card>
        ))}
        
        {
          can('manage-packages') && (
            <button 
              onClick={() => { setEditingPackage({}); setIsPackageModalOpen(true); }}
              className="border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all min-h-[220px] group"
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </div>
              <span className="font-bold">Add Service Package</span>
              <p className="text-[10px] mt-1 text-center max-w-[150px]">Define a new tier of internet service for your subscribers</p>
            </button>
          )
        }
      </div>
                  
      <PackageModal 
        isOpen={isPackageModalOpen} 
        onClose={() => setIsPackageModalOpen(false)} 
        editingPackage={editingPackage} 
        setEditingPackage={setEditingPackage} 
        onSave={handleSavePackage}
        isSaving={isSaving}
        saveError={saveError}
      />  
    </div>
  );
};

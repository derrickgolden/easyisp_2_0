
import React, { useState, useRef, useEffect } from 'react';
import { Modal, ToggleSwitch } from '../UI';
import { Customer, Package } from '../../types';
import { hotspotCustomersApi, hotspotPackagesApi } from '../../services/apiService';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { STORAGE_KEYS } from '@/src/constants/storage';
import { usePermissions } from '@/src/hooks/usePermissions';

interface HotspotCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  setIsCustomerModalOpen: (isOpen: boolean) => void;
  editingHotspotCustomer: Partial<Customer> | null;
  setEditingHotspotCustomer: (customer: Partial<Customer> | null) => void;
  customers: Customer[];
  onSuccess?: () => void;
}

export const HotspotCustomerModal: React.FC<HotspotCustomerModalProps> = ({
  isOpen, onClose, setIsCustomerModalOpen, editingHotspotCustomer, setEditingHotspotCustomer, customers, onSuccess,
}) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastValidStateRef = useRef<Partial<Customer> | null>(null);
  const [packages, setPackages] = useState<Package[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.HOTSPOT_PACKAGES) || '[]'));
  const { can } = usePermissions();
  const isSubAccount = !!editingHotspotCustomer?.parentId;
  const potentialParents = customers.filter(c => c.id !== editingHotspotCustomer?.id && !c.parentId);
  const labelClassName = 'text-[10px] font-black uppercase text-gray-600 dark:text-gray-200 tracking-widest ml-1';
  const inputClassName = 'w-full border border-gray-300 dark:border-gray-700 focus:border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 placeholder:font-normal placeholder:text-gray-300 dark:placeholder:text-gray-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white';
  const readOnlyInputClassName = 'w-full border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 placeholder:font-normal placeholder:text-gray-300 dark:placeholder:text-gray-600 bg-slate-200 dark:bg-slate-700 text-gray-500 cursor-not-allowed';
  const selectClassName = 'w-full border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 appearance-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white';

  useEffect(() => {
    if (!isOpen) return;
    const fetchPackages = async () => {
      try {
        const res = await hotspotPackagesApi.getAll();
        const packagesList = Array.isArray(res) ? res : (res.data || []);

        localStorage.setItem(STORAGE_KEYS.HOTSPOT_PACKAGES, JSON.stringify(packagesList));
        setPackages(packagesList);
      } catch (error) {
        console.error('Error fetching packages:', error);
      }
    };

    fetchPackages();
  }, [isOpen]);

  const handleCustomerSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload = {
        first_name: editingHotspotCustomer?.firstName,
        last_name: editingHotspotCustomer?.lastName,
        phone: editingHotspotCustomer?.phone,
        location: editingHotspotCustomer?.location,
        parent_id: editingHotspotCustomer?.parentId ?? null,
        is_independent: editingHotspotCustomer?.isIndependent ?? true,
        ip_address: editingHotspotCustomer?.ipAddress || null,
        mac_address: editingHotspotCustomer?.macAddress || null,
        radius_username: editingHotspotCustomer?.radiusUsername || null,
        radius_password: editingHotspotCustomer?.radiusPassword || null,
        connection_type: editingHotspotCustomer?.connectionType || 'Hotspot',
        package_id: editingHotspotCustomer?.packageId,
      };

      if (editingHotspotCustomer?.id) {
        // Update existing customer
        const response = await hotspotCustomersApi.update(String(editingHotspotCustomer.id), payload);
        setEditingHotspotCustomer(response.customer); // Update form with latest data
        onSuccess && onSuccess(); // Trigger any success callbacks
        toast.success("Customer updated successfully!");
        
        // Notify if username was modified due to conflicts
        if (response.username_modified) {
          toast.info(response.username_message || "RADIUS username was modified to avoid conflicts");
        }
      } else {
        // Create new customer
        const response = await hotspotCustomersApi.create(payload);

        setEditingHotspotCustomer({}); // Reset form for potential new entry
        navigate(`/crm/hotspot-customers/${response.customer.id}`); // Redirect to new customer detail page
        toast.success("Customer created successfully!");
        
        // Notify if username was modified due to conflicts
        if (response.username_modified) {
          toast.info(response.username_message || "RADIUS username was modified to avoid conflicts");
        }
      }

      // Save successful state
      lastValidStateRef.current = { ...editingHotspotCustomer };
      
      // Close modal and reset
      setIsCustomerModalOpen(false);
      setEditingHotspotCustomer(null);
      
      // Call success callback if provided
      // navigate(`/crm/hotspot-customers/${editingHotspotCustomer?.id}`); // Redirect to customerid after creation
    } catch (err: any) {

      console.error('Error saving customer:', err);
      const errorMessage = err.message || 'Failed to save customer. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editingHotspotCustomer?.id ? "Update Subscriber" : (isSubAccount ? "Add New Sub-Account" : "New Customer Registration")}
      maxWidth="max-w-xl"
    >
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      <form onSubmit={handleCustomerSave} className="space-y-4">
        {isSubAccount && (
          <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-xl border border-purple-200 dark:border-purple-800 mb-2">
            <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">Sub-Account Mode</p>
            <p className="text-[9px] text-purple-500 mt-0.5 leading-tight italic">
              Name and phone details are inherited from the main account.
            </p>
          </div>
        )}

        <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>First Name</label>
              <input 
                readOnly={isSubAccount}
                type="text" 
                value={editingHotspotCustomer?.firstName || ''} 
                onChange={e => setEditingHotspotCustomer({...editingHotspotCustomer, firstName: e.target.value})}
                className={isSubAccount ? readOnlyInputClassName : inputClassName}
                placeholder="John"
              />              
            </div>
            <div>
              <label className={labelClassName}>Last Name</label>
              <input 
                readOnly={isSubAccount}
                type="text" 
                value={editingHotspotCustomer?.lastName || ''} 
                onChange={e => setEditingHotspotCustomer({...editingHotspotCustomer, lastName: e.target.value})}
                className={isSubAccount ? readOnlyInputClassName : inputClassName}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>Phone*</label>
              <input 
                required
                readOnly={isSubAccount}
                type="tel" 
                value={editingHotspotCustomer?.phone || ''} 
                onChange={e => setEditingHotspotCustomer({...editingHotspotCustomer, phone: e.target.value})}
                className={isSubAccount ? readOnlyInputClassName : inputClassName}
                placeholder="+2547XXXXXXXX"
              />
            </div>
            <div>
              <label className={labelClassName}>Area / Location</label>
              <input 
                type="text" 
                value={editingHotspotCustomer?.location || ''} 
                onChange={e => setEditingHotspotCustomer({...editingHotspotCustomer, location: e.target.value})}
                className={inputClassName}
                placeholder="e.g. Githurai 45"
              />
            </div>
          </div>
        </div>

        {/* Physical Address Section */}
        {/* <div className="p-4 bg-gray-100 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
          <h5 className="text-[11px] font-black uppercase text-gray-800 dark:text-gray-50 tracking-widest ml-1">Physical Address</h5>
          <div className="grid grid-cols-2 gap-4">
            
            <div>
              <label className={labelClassName}>Apartment / Building</label>
              <input 
                type="text" 
                value={editingHotspotCustomer?.apartment || ''} 
                onChange={e => setEditingHotspotCustomer({...editingHotspotCustomer, apartment: e.target.value})}
                className={inputClassName}
                placeholder="e.g. Hadasa Apt"
              />
            </div>
            <div>
              <label className={labelClassName}>House / Unit No</label>
              <input 
                type="text" 
                value={editingHotspotCustomer?.houseNo || ''} 
                onChange={e => setEditingHotspotCustomer({...editingHotspotCustomer, houseNo: e.target.value})}
                className={inputClassName}
                placeholder="e.g. A4"
              />
            </div>
          </div>
        </div> */}

        {/* Account Hierarchy Section */}
        <div className="p-4 bg-purple-50/50 dark:bg-purple-900/5 rounded-2xl border border-purple-100 dark:border-purple-900/20 space-y-3">
          <h5 className="text-[10px] font-black uppercase text-purple-600 tracking-widest ml-1">Account Hierarchy</h5>
          <div>
            <label className={labelClassName}>Linked Main Account</label>
            <select 
              disabled={isSubAccount && !editingHotspotCustomer?.id}
              value={editingHotspotCustomer?.parentId || ''}
              onChange={e => setEditingHotspotCustomer({...editingHotspotCustomer, parentId: e.target.value || undefined})}
              className={selectClassName}
            >
              <option value="">Standalone / Main Account</option>
              {potentialParents.map(parent => (
                <option key={parent.id} value={parent.id}>{parent.firstName} {parent.lastName} ({parent.radiusUsername})</option>
              ))}
            </select>
          </div>
          
          {editingHotspotCustomer?.parentId && (
            <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-purple-100 dark:border-purple-800">
               <div>
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-200">Independent Billing?</p>
                  <p className="text-[9px] text-gray-400 italic">If OFF, internet cuts when Main Account expires.</p>
               </div>
               <ToggleSwitch 
                  checked={editingHotspotCustomer.isIndependent || false} 
                  onChange={() => setEditingHotspotCustomer({...editingHotspotCustomer, isIndependent: !editingHotspotCustomer.isIndependent})} 
               />
            </div>
          )}
        </div>

        {/* <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
          <h5 className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Live Network Parameters</h5>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>Static IP</label>
              <input 
                type="text" 
                value={editingHotspotCustomer?.ipAddress || ''} 
                onChange={e => setEditingHotspotCustomer({...editingHotspotCustomer, ipAddress: e.target.value})}
                className={inputClassName}
                placeholder="15.15.15.226"
              />
            </div>
            <div>
              <label className={labelClassName}>MAC Address</label>
              <input 
                type="text" 
                value={editingHotspotCustomer?.macAddress || ''} 
                onChange={e => setEditingHotspotCustomer({...editingHotspotCustomer, macAddress: e.target.value})}
                className={inputClassName}
                placeholder="B0:95:..."
              />
            </div>
          </div>
        </div> */}

        <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/5 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 space-y-4">
          <h5 className="text-[10px] font-black uppercase text-indigo-500 tracking-widest ml-1">RADIUS Credentials</h5>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>Radius Username</label>
              <input 
                type="text" 
                value={editingHotspotCustomer?.radiusUsername || ''} 
                onChange={e => setEditingHotspotCustomer({...editingHotspotCustomer, radiusUsername: e.target.value, radiusPassword: e.target.value})}
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>Radius Password</label>
              <input 
                type="text"
                readOnly={true} 
                value={editingHotspotCustomer?.radiusPassword || ''} 
                className={inputClassName}
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-blue-50/50 dark:bg-blue-900/5 rounded-2xl border border-blue-100 dark:border-blue-900/20 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>Connection Type*</label>
              <select 
                required
                value={editingHotspotCustomer?.connectionType || 'PPPoE'}
                onChange={e => setEditingHotspotCustomer({...editingHotspotCustomer, connectionType: e.target.value as any})}
                className={selectClassName}
              >
                <option value="PPPoE">Hotspot</option>
                <option value="Static IP">Static IP</option>
              </select>
            </div>
            <div>
              <label className={labelClassName}>Package*</label>
              <select 
                required
                value={editingHotspotCustomer?.packageId || ''}
                onChange={e => setEditingHotspotCustomer({...editingHotspotCustomer, packageId: e.target.value})}
                className={selectClassName}
              >
                <option value="">Select...</option>
                {packages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={!can('manage-customers') || !can('create-customers') || isLoading}
          className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl mt-4 hover:bg-blue-500 shadow-xl shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Processing...
            </span>
          ) : (
            editingHotspotCustomer?.id ? "Update Subscriber" : (isSubAccount ? "Activate Sub-Account" : "Register and Activate")
          )}
        </button>
      </form>
    </Modal>
  );
};

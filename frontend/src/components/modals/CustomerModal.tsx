
import React, { useState, useRef, useEffect } from 'react';
import { Modal, ToggleSwitch } from '../UI';
import { Customer, Package } from '../../types';
import { customersApi, packagesApi } from '../../services/apiService';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { STORAGE_KEYS } from '@/src/constants/storage';
import { usePermissions } from '@/src/hooks/usePermissions';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  setIsCustomerModalOpen: (isOpen: boolean) => void;
  editingCustomer: Partial<Customer> | null;
  setEditingCustomer: (customer: Partial<Customer> | null) => void;
  customers: Customer[];
  onSuccess?: () => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen, onClose, setIsCustomerModalOpen, editingCustomer, setEditingCustomer, customers, onSuccess,
}) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastValidStateRef = useRef<Partial<Customer> | null>(null);
  const [packages, setPackages] = useState<Package[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.PACKAGES) || '[]'));
  const { can } = usePermissions();
  const isSubAccount = !!editingCustomer?.parentId;
  const potentialParents = customers.filter(c => c.id !== editingCustomer?.id && !c.parentId);
  const labelClassName = 'text-[10px] font-black uppercase text-gray-600 dark:text-gray-200 tracking-widest ml-1';
  const inputClassName = 'w-full border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 placeholder:font-normal placeholder:text-gray-300 dark:placeholder:text-gray-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white';
  const readOnlyInputClassName = 'w-full border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 placeholder:font-normal placeholder:text-gray-300 dark:placeholder:text-gray-600 bg-slate-200 dark:bg-slate-700 text-gray-500 cursor-not-allowed';
  const selectClassName = 'w-full border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 appearance-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white';

  useEffect(() => {
    if (!isOpen) return;
      const fetchPackages = async () => {
        try {
          const res = await packagesApi.getAll();
    
          localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(res.data || []));
          setPackages(res.data || []);
        } catch (error) {
          console.error('Error fetching packages:', error);
        }
      };
  
      fetchPackages();
    }, [setPackages]);

  const handleCustomerSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload = {
        first_name: editingCustomer?.firstName,
        last_name: editingCustomer?.lastName,
        email: editingCustomer?.email,
        phone: editingCustomer?.phone,
        location: editingCustomer?.location,
        apartment: editingCustomer?.apartment,
        house_no: editingCustomer?.houseNo,
        parent_id: editingCustomer?.parentId || null,
        is_independent: editingCustomer?.isIndependent || false,
        ip_address: editingCustomer?.ipAddress || null,
        mac_address: editingCustomer?.macAddress || null,
        radius_username: editingCustomer?.radiusUsername || null,
        radius_password: editingCustomer?.radiusPassword || null,
        connection_type: editingCustomer?.connectionType || 'PPPoE',
        package_id: editingCustomer?.packageId,
        installation_fee: editingCustomer?.installationFee || 0,
      };

      if (editingCustomer?.id) {
        // Update existing customer
        const response = await customersApi.update(String(editingCustomer.id), payload);
        setEditingCustomer(response.customer); // Update form with latest data
        onSuccess && onSuccess(); // Trigger any success callbacks
        toast.success("Customer updated successfully!");
        
        // Notify if username was modified due to conflicts
        if (response.username_modified) {
          toast.info(response.username_message || "RADIUS username was modified to avoid conflicts");
        }
      } else {
        // Create new customer
        const response = await customersApi.create(payload);

        setEditingCustomer({}); // Reset form for potential new entry
        navigate(`/crm/customers/${response.customer.id}`); // Redirect to new customer detail page
        toast.success("Customer created successfully!");
        
        // Notify if username was modified due to conflicts
        if (response.username_modified) {
          toast.info(response.username_message || "RADIUS username was modified to avoid conflicts");
        }
      }

      // Save successful state
      lastValidStateRef.current = { ...editingCustomer };
      
      // Close modal and reset
      setIsCustomerModalOpen(false);
      setEditingCustomer(null);
      
      // Call success callback if provided
      // navigate(`/crm/customers/${editingCustomer?.id}`); // Redirect to customerid after creation
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
      title={editingCustomer?.id ? "Update Subscriber" : (isSubAccount ? "Add New Sub-Account" : "New Customer Registration")}
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
              <label className={labelClassName}>First Name*</label>
              <input 
                required
                readOnly={isSubAccount}
                type="text" 
                value={editingCustomer?.firstName || ''} 
                onChange={e => setEditingCustomer({...editingCustomer, firstName: e.target.value})}
                className={isSubAccount ? readOnlyInputClassName : inputClassName}
                placeholder="John"
              />              
            </div>
            <div>
              <label className={labelClassName}>Last Name*</label>
              <input 
                required
                readOnly={isSubAccount}
                type="text" 
                value={editingCustomer?.lastName || ''} 
                onChange={e => setEditingCustomer({...editingCustomer, lastName: e.target.value})}
                className={isSubAccount ? readOnlyInputClassName : inputClassName}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>Email</label>
              <input 
                type="email" 
                readOnly={isSubAccount}
                value={editingCustomer?.email || ''} 
                onChange={e => setEditingCustomer({...editingCustomer, email: e.target.value})}
                className={isSubAccount ? readOnlyInputClassName : inputClassName}
                placeholder="jane.doe@example.com"
              />
            </div>
            <div>
              <label className={labelClassName}>Phone*</label>
              <input 
                required
                readOnly={isSubAccount}
                type="tel" 
                value={editingCustomer?.phone || ''} 
                onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})}
                className={isSubAccount ? readOnlyInputClassName : inputClassName}
                placeholder="+2547XXXXXXXX"
              />
            </div>
          </div>
        </div>

        {/* Physical Address Section */}
        <div className="p-4 bg-gray-100 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
          <h5 className="text-[11px] font-black uppercase text-gray-800 dark:text-gray-50 tracking-widest ml-1">Physical Address</h5>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClassName}>Area / Location*</label>
              <input 
                required
                type="text" 
                value={editingCustomer?.location || ''} 
                onChange={e => setEditingCustomer({...editingCustomer, location: e.target.value})}
                className={inputClassName}
                placeholder="e.g. Githurai 45"
              />
            </div>
            <div>
              <label className={labelClassName}>Apartment / Building</label>
              <input 
                type="text" 
                value={editingCustomer?.apartment || ''} 
                onChange={e => setEditingCustomer({...editingCustomer, apartment: e.target.value})}
                className={inputClassName}
                placeholder="e.g. Hadasa Apt"
              />
            </div>
            <div>
              <label className={labelClassName}>House / Unit No</label>
              <input 
                type="text" 
                value={editingCustomer?.houseNo || ''} 
                onChange={e => setEditingCustomer({...editingCustomer, houseNo: e.target.value})}
                className={inputClassName}
                placeholder="e.g. A4"
              />
            </div>
          </div>
        </div>

        {/* Account Hierarchy Section */}
        <div className="p-4 bg-purple-50/50 dark:bg-purple-900/5 rounded-2xl border border-purple-100 dark:border-purple-900/20 space-y-3">
          <h5 className="text-[10px] font-black uppercase text-purple-600 tracking-widest ml-1">Account Hierarchy</h5>
          <div>
            <label className={labelClassName}>Linked Main Account</label>
            <select 
              disabled={isSubAccount && !editingCustomer?.id}
              value={editingCustomer?.parentId || ''}
              onChange={e => setEditingCustomer({...editingCustomer, parentId: e.target.value || undefined})}
              className={selectClassName}
            >
              <option value="">Standalone / Main Account</option>
              {potentialParents.map(parent => (
                <option key={parent.id} value={parent.id}>{parent.firstName} {parent.lastName} ({parent.radiusUsername})</option>
              ))}
            </select>
          </div>
          
          {editingCustomer?.parentId && (
            <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-purple-100 dark:border-purple-800">
               <div>
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-200">Independent Billing?</p>
                  <p className="text-[9px] text-gray-400 italic">If OFF, internet cuts when Main Account expires.</p>
               </div>
               <ToggleSwitch 
                  checked={editingCustomer.isIndependent || false} 
                  onChange={() => setEditingCustomer({...editingCustomer, isIndependent: !editingCustomer.isIndependent})} 
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
                value={editingCustomer?.ipAddress || ''} 
                onChange={e => setEditingCustomer({...editingCustomer, ipAddress: e.target.value})}
                className={inputClassName}
                placeholder="15.15.15.226"
              />
            </div>
            <div>
              <label className={labelClassName}>MAC Address</label>
              <input 
                type="text" 
                value={editingCustomer?.macAddress || ''} 
                onChange={e => setEditingCustomer({...editingCustomer, macAddress: e.target.value})}
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
                value={editingCustomer?.radiusUsername || ''} 
                onChange={e => setEditingCustomer({...editingCustomer, radiusUsername: e.target.value})}
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>Radius Password</label>
              <input 
                type="text" 
                value={editingCustomer?.radiusPassword || ''} 
                onChange={e => setEditingCustomer({...editingCustomer, radiusPassword: e.target.value})}
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
                value={editingCustomer?.connectionType || 'PPPoE'}
                onChange={e => setEditingCustomer({...editingCustomer, connectionType: e.target.value as any})}
                className={selectClassName}
              >
                <option value="PPPoE">PPPoE</option>
                <option value="Static IP">Static IP</option>
                <option value="DHCP">DHCP</option>
              </select>
            </div>
            <div>
              <label className={labelClassName}>Package*</label>
              <select 
                required
                value={editingCustomer?.packageId || ''}
                onChange={e => setEditingCustomer({...editingCustomer, packageId: e.target.value})}
                className={selectClassName}
              >
                <option value="">Select...</option>
                {packages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className={labelClassName}>Installation Fee (KSH)*</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-[10px] font-black uppercase">KSH</span>
              <input 
                required
                type="number" 
                value={editingCustomer?.installationFee ?? 0} 
                onChange={e => setEditingCustomer({...editingCustomer, installationFee: Number(e.target.value)})}
                className={`${inputClassName} pl-12`}
                placeholder="0.00"
              />
            </div>
            <p className="text-[9px] text-gray-400 mt-1 italic ml-1">Enter the total setup cost for this subscriber.</p>
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
            editingCustomer?.id ? "Update Subscriber" : (isSubAccount ? "Activate Sub-Account" : "Register and Activate")
          )}
        </button>
      </form>
    </Modal>
  );
};

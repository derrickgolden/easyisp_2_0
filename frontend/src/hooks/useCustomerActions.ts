import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Customer, Payment } from "../types";
import Swal from "sweetalert2";
import { customersApi, paymentsApi, smsApi } from "../services/apiService";
import { toast } from "sonner";
import { STORAGE_KEYS } from "../constants/storage";

// hooks/useCustomerActions.ts
export function useCustomerActions() {
    const [smsText, setSmsText] = useState('');
    const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
    const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
    const [payments, setPayments] = useState<Payment[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYMENTS) || '[]'));

    const navigate = useNavigate();
  
    const deleteCustomer = async (customer: Customer) => {
      const hasSubAccounts = customer.subAccounts && customer.subAccounts.length > 0;
      
      // Custom message if children exist
      const warningText = hasSubAccounts 
        ? `Warning: This account has ${customer.subAccounts.length} sub-accounts (${customer.subAccounts.map(s => s.radiusUsername).join(', ')}). Deleting this master account will delete ALL of them.`
        : 'This will permanently remove the customer and their RADIUS access.';
  
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: warningText,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: hasSubAccounts ? 'Yes, Delete All' : 'Yes, Delete',
        cancelButtonText: 'Cancel'
      });
  
      if (!result.isConfirmed) return;
  
      try {
        Swal.showLoading();
        // Pass a query param to tell the backend we are okay with deleting children
        await customersApi.delete(`${customer.id}?cascade=true`);
        
        toast.success('All accounts deleted successfully');
        navigate('/crm/customers');
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to delete');
        Swal.close();
      }
    };
  
    const handleEdit = (customer: Customer) => {
      setEditingCustomer(customer); 
      setIsCustomerModalOpen(true);
    }

    const handleAddChild = (customer: Customer) => {
      setEditingCustomer({
        parentId: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        email: customer.email,
      }); 
      setIsCustomerModalOpen(true);
    }

    const handlePauseService = async (customer: Customer) => {
      const isPaused = customer.status === 'suspended';
      const actionLabel = isPaused ? 'Resume Service' : 'Pause Service';
      const confirmMessage = isPaused 
        ? 'This will restore their service with the remaining time they had left.'
        : 'This will pause their service and save their remaining time for later.';

      const result = await Swal.fire({
        title: `${actionLabel}?`,
        text: confirmMessage,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: isPaused ? '#10b981' : '#f59e0b',
        confirmButtonText: `Yes, ${actionLabel}`,
        cancelButtonText: 'Cancel',
      });

      if (!result.isConfirmed) return;

      try {
        Swal.showLoading();
        
        if (isPaused) {
          // Resume service
          await customersApi.resumeSubscription(customer.id);
          toast.success('Service resumed successfully');
        } else {
          // Pause service
          await customersApi.pauseSubscription(customer.id);
          toast.success('Service paused successfully');
        }

        // Refresh the page or parent component data
        window.location.reload();
        
      } catch (err: any) {
        toast.error(err.response?.data?.message || `Failed to ${actionLabel.toLowerCase()}`);
        Swal.close();
      }
    };

    const handleStkPush = async (customer: Customer) => {
      if (!customer?.phone) {
        toast.error('Customer phone number is missing');
        return;
      }

      const defaultAmount = Math.max(1, Number(customer.package?.price || 1));

      const result = await Swal.fire({
        title: 'Initiate STK Push',
        html: `<div style="text-align:left;">` +
          `<div style="margin-bottom:8px;"><strong>Customer:</strong> ${customer.firstName || ''} ${customer.lastName || ''}</div>` +
          `<div style="margin-bottom:8px;"><strong>Phone:</strong> ${customer.phone}</div>` +
          `<div style="margin-bottom:8px;"><strong>Package:</strong> ${customer.package?.name || 'N/A'}</div>` +
        `</div>`,
        input: 'number',
        inputLabel: 'Amount (KSH)',
        inputValue: defaultAmount,
        inputAttributes: {
          min: '1',
          step: '1',
        },
        showCancelButton: true,
        confirmButtonText: 'Send STK Push',
        cancelButtonText: 'Cancel',
        preConfirm: (value) => {
          const amount = Number(value);
          if (!amount || Number.isNaN(amount) || amount < 1) {
            Swal.showValidationMessage('Enter a valid amount');
            return null;
          }
          return amount;
        },
      });

      if (!result.isConfirmed) return;

      try {
        Swal.fire({
          title: 'Sending STK Push...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        await paymentsApi.stkPushPayhero({
          phone: customer.phone,
          amount: Number(result.value),
        });

        Swal.close();
        toast.success('STK push initiated. Ask the customer to enter their PIN.');
      } catch (err: any) {
        Swal.close();
        toast.error(err?.message || 'Failed to initiate STK push');
      }
    };

    
// Usage: 
// startLiveUptime('2026-01-31T17:26:00Z', 'uptime-display');

  return {
    state: { smsText, isSmsModalOpen, isCustomerModalOpen, editingCustomer, isDepositModalOpen, 
      isPackageModalOpen, isReconcileModalOpen, payments },
    actions: { setSmsText, setIsSmsModalOpen, deleteCustomer, handleEdit, 
      handlePauseService, handleAddChild, handleStkPush, setIsCustomerModalOpen, setEditingCustomer, 
      setIsDepositModalOpen, setIsPackageModalOpen, setIsReconcileModalOpen, setPayments },
  };
}
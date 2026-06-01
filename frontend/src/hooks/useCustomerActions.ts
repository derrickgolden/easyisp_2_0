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
      const subAccounts = customer.subAccounts ?? [];
      const hasSubAccounts = subAccounts.length > 0;
      
      // Custom message if children exist
      const warningText = hasSubAccounts 
        ? `Warning: This account has ${subAccounts.length} sub-accounts (${subAccounts.map(s => s.radiusUsername).join(', ')}). Deleting this master account will delete ALL of them.`
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
        packageId: customer.packageId,
        package: customer.package,
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

    const handleStkPush = (customer: Customer) => {
      if (!customer?.phone) {
        toast.error('Customer phone number is missing');
        return;
      }

      const defaultAmount = Math.max(1, Number(customer.package?.price || 1));
      const isDarkMode = document.documentElement.classList.contains('dark');
      const theme = isDarkMode
        ? {
            cardBorder: '#334155',
            cardBg: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)',
            headerBg: '#1e3a8a',
            headerText: '#f8fafc',
            labelText: '#94a3b8',
            valueText: '#e2e8f0',
            inputBorder: '#334155',
            inputBg: '#0b1220',
            inputText: '#f8fafc',
            helperText: '#94a3b8',
            modalBg: '#0f172a',
            modalText: '#e2e8f0',
          }
        : {
            cardBorder: '#dbeafe',
            cardBg: 'linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%)',
            headerBg: '#1d4ed8',
            headerText: '#ffffff',
            labelText: '#64748b',
            valueText: '#0f172a',
            inputBorder: '#bfdbfe',
            inputBg: '#ffffff',
            inputText: '#0f172a',
            helperText: '#475569',
            modalBg: '#ffffff',
            modalText: '#0f172a',
          };

      const escapeHtml = (value: string = '') =>
        value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');

      const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer';
      const packageName = customer.package?.name || 'N/A';

      Swal.fire({
        title: 'Initiate STK Push',
        background: theme.modalBg,
        color: theme.modalText,
        html:
          `<div style="text-align:left; border:1px solid ${theme.cardBorder}; border-radius:20px; overflow:hidden; background:${theme.cardBg};">` +
            `<div style="padding:14px 16px; background:${theme.headerBg}; color:${theme.headerText};">` +
              `<div style="font-weight:800; font-size:14px; letter-spacing:0.04em; text-transform:uppercase; opacity:0.9;">M-Pesa Prompt</div>` +
              `<div style="font-weight:900; font-size:18px; margin-top:4px;">${escapeHtml(customerName)}</div>` +
            `</div>` +
            `<div style="padding:16px;">` +
              `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">` +
                `<span style="font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:${theme.labelText};">Package</span>` +
                `<span style="font-size:12px; font-weight:700; color:${theme.valueText};">${escapeHtml(packageName)}</span>` +
              `</div>` +
              `<label for="swal-stk-phone" style="display:block; margin-bottom:6px; font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:${theme.labelText};">Phone Number</label>` +
              `<input id="swal-stk-phone" type="tel" value="${escapeHtml(customer.phone)}" placeholder="07XXXXXXXX" style="width:100%; box-sizing:border-box; padding:11px 12px; border-radius:12px; border:1px solid ${theme.inputBorder}; background:${theme.inputBg}; color:${theme.inputText}; font-size:14px; font-weight:700; margin-bottom:12px; outline:none;" />` +
              `<label for="swal-stk-amount" style="display:block; margin-bottom:6px; font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:${theme.labelText};">Amount (KSH)</label>` +
              `<input id="swal-stk-amount" type="number" min="1" step="1" value="${defaultAmount}" style="width:100%; box-sizing:border-box; padding:11px 12px; border-radius:12px; border:1px solid ${theme.inputBorder}; background:${theme.inputBg}; color:${theme.inputText}; font-size:14px; font-weight:800; outline:none;" />` +
              `<label style="display:block; margin:12px 0 6px; font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:${theme.labelText};">Gateway</label>` +
              `<div style="display:flex; gap:8px; margin-bottom:8px;">` +
                `<label for="swal-stk-provider-payhero" style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; border:1px solid ${theme.inputBorder}; border-radius:12px; padding:10px 12px; background:${theme.inputBg}; color:${theme.inputText}; font-weight:800; font-size:12px;">` +
                  `<input id="swal-stk-provider-payhero" type="radio" name="swal-stk-provider" value="payhero" />` +
                  `<span>PayHero</span>` +
                `</label>` +
                `<label for="swal-stk-provider-daraja" style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; border:1px solid ${theme.inputBorder}; border-radius:12px; padding:10px 12px; background:${theme.inputBg}; color:${theme.inputText}; font-weight:800; font-size:12px;">` +
                  `<input id="swal-stk-provider-daraja" type="radio" name="swal-stk-provider" value="daraja" checked/>` +
                  `<span>Daraja</span>` +
                `</label>` +
              `</div>` +
              `<p style="margin:10px 0 0; font-size:12px; color:${theme.helperText};">The customer will receive a prompt and must enter their M-Pesa PIN.</p>` +
            `</div>` +
          `</div>`,
        customClass: {
          popup: 'rounded-[1.75rem]',
          confirmButton: 'rounded-xl px-5 py-3 font-extrabold',
          cancelButton: 'rounded-xl px-5 py-3 font-bold'
        },
        showCancelButton: true,
        confirmButtonColor: '#059669',
        confirmButtonText: 'Send STK Push',
        cancelButtonText: 'Cancel',
        focusConfirm: false,
        preConfirm: () => {
          const phoneInput = document.getElementById('swal-stk-phone') as HTMLInputElement | null;
          const amountInput = document.getElementById('swal-stk-amount') as HTMLInputElement | null;
          const providerInput = document.querySelector('input[name="swal-stk-provider"]:checked') as HTMLInputElement | null;

          const phone = (phoneInput?.value || '').trim();
          const amount = Number(amountInput?.value || 0);
          const provider = (providerInput?.value || 'payhero').trim();

          if (!phone) {
            Swal.showValidationMessage('Enter a phone number');
            return null;
          }

          if (!amount || Number.isNaN(amount) || amount < 1) {
            Swal.showValidationMessage('Enter a valid amount');
            return null;
          }

          return { phone, amount, provider };
        },
      }).then(async (result) => {
        if (!result.isConfirmed) return;

        try {
          Swal.fire({
            title: 'Sending STK Push...',
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });

          const provider = result.value.provider === 'daraja' ? 'daraja' : 'payhero';

          if (provider === 'daraja') {
            await paymentsApi.stkPushDaraja({
              phone: result.value.phone,
              amount: Number(result.value.amount),
            });
          } else {
            await paymentsApi.stkPushPayhero({
              phone: result.value.phone,
              amount: Number(result.value.amount),
            });
          }

          Swal.close();
          toast.success(`${provider === 'daraja' ? 'Daraja' : 'PayHero'} STK push initiated. Ask the customer to enter their PIN.`);
        } catch (err: any) {
          Swal.close();
          toast.error(err?.message || 'Failed to initiate STK push');
        }
      });
    };

    const handleShare = async (customer: Customer) => {
      const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer';
      const customerLink = new URL(`/crm/customers/${customer.id}`, window.location.origin).toString();
      const shareMessage = [
        `Customer: ${customerName}`,
        customer.phone ? `Phone: ${customer.phone}` : null,
        customer.status ? `Status: ${customer.status}` : null,
        customer.isOnline !== undefined ? `Online: ${customer.isOnline ? 'Yes' : 'No'}` : null,
        `Link: ${customerLink}`,
      ].filter(Boolean).join('\n\n');

      try {
        if (navigator.share) {
          await navigator.share({
            text: shareMessage,
          });

          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
      const whatsappWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

      try {
        await navigator.clipboard.writeText(shareMessage);
        toast.success(whatsappWindow ? 'Opening WhatsApp. Customer details copied to clipboard.' : 'Customer details copied to clipboard.');
      } catch {
        if (whatsappWindow) {
          toast.success('Opening WhatsApp.');
        } else {
          Swal.fire({
            title: 'Share Customer Details',
            text: shareMessage,
            icon: 'info',
            confirmButtonText: 'Close',
          });
        }
      }
    };

    
// Usage: 
// startLiveUptime('2026-01-31T17:26:00Z', 'uptime-display');

  return {
    state: { smsText, isSmsModalOpen, isCustomerModalOpen, editingCustomer, isDepositModalOpen, 
      isPackageModalOpen, isReconcileModalOpen, payments },
    actions: { setSmsText, setIsSmsModalOpen, deleteCustomer, handleEdit, 
      handlePauseService, handleAddChild, handleStkPush, handleShare, setIsCustomerModalOpen, setEditingCustomer, 
      setIsDepositModalOpen, setIsPackageModalOpen, setIsReconcileModalOpen, setPayments },
  };
}
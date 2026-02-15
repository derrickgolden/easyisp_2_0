import React, { useEffect, useMemo } from "react";
import { Modal } from "../UI";
import { customersApi, paymentsApi } from "@/src/services/apiService";

export const ResolveMpesaModal = ({ isResolveModalOpen, setIsResolveModalOpen, reconcilingPayment, setReconcilingPayment, onResolved }) => {
    const [customers, setCustomers] = React.useState([]);
    const [targetCustomerId, setTargetCustomerId] = React.useState("");
  const [customerSearch, setCustomerSearch] = React.useState("");
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState("");

    useEffect(() => {
        if (isResolveModalOpen) {
            // Reset state when modal opens
            setTargetCustomerId("");
            setCustomerSearch("");
            setError("");
            setIsSubmitting(false);
            //fetch customers if needed, or ensure they are up to date
            customersApi.getAll().then(res => {
              const list = Array.isArray(res?.data) ? res.data : res?.data?.data || [];
              setCustomers(list);
            }).catch(err => {
                console.error("Error fetching customers for reconciliation:", err);
                setCustomers([]);
            });

        }
    }, [isResolveModalOpen]);

    const filteredCustomers = useMemo(() => {
      const search = customerSearch.trim().toLowerCase();
      if (!search) return customers;
      return customers.filter((customer) => {
        const name = `${customer.firstName || ""} ${customer.lastName || ""}`.toLowerCase();
        const radiusUsername = (customer.radiusUsername || "").toLowerCase();
        const phone = (customer.phone || "").toLowerCase();
        return name.includes(search) || radiusUsername.includes(search) || phone.includes(search);
      });
    }, [customers, customerSearch]);

    const handleFinalizeReconciliation = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!reconcilingPayment || !targetCustomerId) {
            setError("Please select a customer");
            return;
        }

        setIsSubmitting(true);
        setError("");

        try {
            await paymentsApi.resolvePending(reconcilingPayment.id, targetCustomerId);
            
            // Success - close modal and refresh
            setIsResolveModalOpen(false);
            setReconcilingPayment(null);
            setTargetCustomerId("");
            
            // Notify parent component to refresh data
            if (onResolved) {
                onResolved();
            }
        } catch (err: any) {
            console.error("Error resolving payment:", err);
            setError(err.response?.data?.message || err.message || "Failed to resolve payment");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal 
        isOpen={isResolveModalOpen} 
        onClose={() => { setIsResolveModalOpen(false); setReconcilingPayment(null); setTargetCustomerId(""); }} 
        title="Resolve M-Pesa Receipt"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleFinalizeReconciliation} className="space-y-6">
          {reconcilingPayment && (
            <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-amber-600">Transaction Info</span>
                <span className="font-mono font-black text-amber-700 dark:text-amber-400">{reconcilingPayment.mpesaCode}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-y border-amber-200/50">
                <span className="text-xs font-bold text-gray-500">Receipt Amount</span>
                <span className="text-lg font-black text-gray-900 dark:text-white">KSH {reconcilingPayment.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Sender Phone</span>
                <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">{reconcilingPayment.phone}</span>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Target Subscriber Account</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search name, phone, or username..."
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => setTargetCustomerId(customer.id)}
                    className={`p-4 rounded-xl border transition-all group shadow-sm flex items-center justify-between cursor-pointer ${
                      targetCustomerId === customer.id
                        ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700"
                        : "bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:border-blue-500"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {customer.firstName} {customer.lastName}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                        @{customer.radiusUsername || "No Username"} • {customer.phone}
                      </p>
                    </div>
                    <div className={`transition-opacity ${targetCustomerId === customer.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                      <span className="text-[10px] font-black text-blue-600 dark:text-blue-300 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg">
                        {targetCustomerId === customer.id ? "Selected" : "Link Here"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-2xl">
                  <p className="text-xs text-gray-400 font-medium italic">
                    {customerSearch.trim().length < 2
                      ? "Start typing to find a subscriber..."
                      : "No subscribers match your search."}
                  </p>
                </div>
              )}
            </div>
            <p className="text-[9px] text-gray-400 mt-1 italic ml-1">Linking this transaction will instantly credit the selected account's balance.</p>
          </div>
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
            </div>
          )}
          
          <button 
            type="submit"
            disabled={isSubmitting || !targetCustomerId}
            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                Confirm Link & Finalize
              </>
            )}
          </button>
        </form>
      </Modal>
    );
  };
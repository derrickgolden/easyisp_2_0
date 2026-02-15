import { paymentsApi } from "@/src/services/apiService";
import React, { useEffect, useMemo } from "react";
import { Modal } from "../UI";
import { Customer, Payment } from "@/src/types";

interface ReconcileMpesaModalProps {
  customer: Customer | null;
  isResolveModalOpen: boolean;
  setIsResolveModalOpen: (isOpen: boolean) => void;
  onClose?: () => void;
  onSuccess?: () => void;
}

const normalizePayment = (payment: any): Payment => ({
  id: payment?.id?.toString() || "",
  subscriberId: payment?.customer_id?.toString() || "",
  mpesaCode: payment?.mpesa_code || payment?.mpesaCode || "",
  amount: Number(payment?.amount) || 0,
  billRef: payment?.bill_ref || payment?.billRef || "",
  phone: payment?.phone || "",
  firstName: payment?.first_name || payment?.firstName || "",
  lastName: payment?.last_name || payment?.lastName || "",
  timestamp: payment?.created_at || payment?.timestamp || "",
  status: payment?.status || "pending",
});

export const ReconcileMpesaModal: React.FC<ReconcileMpesaModalProps> = ({
  customer,
  isResolveModalOpen,
  setIsResolveModalOpen,
  onClose,
  onSuccess,
}) => {
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isResolving, setIsResolving] = React.useState(false);
  const [paymentSearchTerm, setPaymentSearchTerm] = React.useState("");
  const [reconcilingPayment, setReconcilingPayment] = React.useState<Payment | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [paymentToConfirm, setPaymentToConfirm] = React.useState<Payment | null>(null);
  const [targetCustomerId, setTargetCustomerId] = React.useState(customer?.id || "");
  const [error, setError] = React.useState("");

  useEffect(() => {
    if (!isResolveModalOpen) return;

    let isActive = true;
    const fetchPendingPayments = async () => {
      setIsLoading(true);
      setError("");
      setPaymentSearchTerm("");
      setReconcilingPayment(null);
      setTargetCustomerId(customer?.id || "");

      try {
        const res = await paymentsApi.getPending();
        const rawPayments = Array.isArray(res?.data) ? res.data : res?.data?.data || [];
        if (isActive) {
          setPayments(rawPayments.map(normalizePayment));
        }
      } catch (err: any) {
        console.error("Error fetching pending payments:", err);
        if (isActive) {
          setPayments([]);
          setError(err?.message || "Failed to load pending payments");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchPendingPayments();

    return () => {
      isActive = false;
    };
  }, [customer?.id, isResolveModalOpen]);

  const handleClose = () => {
    setIsResolveModalOpen(false);
    setReconcilingPayment(null);
    setIsConfirmOpen(false);
    setPaymentToConfirm(null);
    setTargetCustomerId("");
    setPaymentSearchTerm("");
    setError("");
    if (onClose) {
      onClose();
    }
  };

  const handleFinalizeReconciliation = async (payment: Payment) => {
    if (!payment || !targetCustomerId || isResolving) return;

    setIsResolving(true);
    setReconcilingPayment(payment);
    setError("");

    try {
      await paymentsApi.resolvePending(payment.id, targetCustomerId);
      setPayments((prev) => prev.filter((p) => p.id !== payment.id));
      if (onSuccess) {
        onSuccess();
      }
      handleClose();
    } catch (err: any) {
      console.error("Error resolving payment:", err);
      setError(err?.message || "Failed to resolve pending payment");
    } finally {
      setIsResolving(false);
      setReconcilingPayment(null);
    }
  };

  const handleRequestConfirmation = (payment: Payment) => {
    if (!payment || isResolving) return;
    setPaymentToConfirm(payment);
    setIsConfirmOpen(true);
  };

  const handleCancelConfirmation = () => {
    setIsConfirmOpen(false);
    setPaymentToConfirm(null);
  };

  const handleConfirmReconciliation = async () => {
    if (!paymentToConfirm) return;
    setIsConfirmOpen(false);
    await handleFinalizeReconciliation(paymentToConfirm);
    setPaymentToConfirm(null);
  };

  const filteredPendingPayments = useMemo(() => {
    const search = paymentSearchTerm.trim().toLowerCase();
    return payments.filter((payment) => {
      if (payment.status !== "pending") return false;
      if (!search) return true;
      return (
        payment.mpesaCode.toLowerCase().includes(search) ||
        payment.phone.includes(search) ||
        payment.lastName.toLowerCase().includes(search)
      );
    });
  }, [payments, paymentSearchTerm]);

  return (
    <Modal
      isOpen={isResolveModalOpen}
      onClose={handleClose}
      title={"Search Pending Receipts"}
      maxWidth="max-w-lg"
    >
      <div className="relative space-y-4">
        <p className="text-[10px] font-black uppercase text-gray-400 bg-gray-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-gray-100 dark:border-slate-700">
          Select a pending transaction to link to {customer?.firstName || "subscriber"}
        </p>
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
            autoFocus
            type="text"
            placeholder="Search M-Pesa Code or Phone..."
            value={paymentSearchTerm}
            onChange={(event) => setPaymentSearchTerm(event.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
          </div>
        )}

        <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {isLoading ? (
            <div className="py-16 text-center">
              <div className="inline-flex items-center gap-2 text-gray-400 text-xs font-semibold">
                <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></span>
                Loading pending receipts...
              </div>
            </div>
          ) : filteredPendingPayments.length > 0 ? (
            filteredPendingPayments.map((payment) => (
              <div
                key={payment.id}
                onClick={() => handleRequestConfirmation(payment)}
                className={`p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 transition-all group shadow-sm ${
                  isResolving ? "cursor-not-allowed opacity-70" : "hover:border-blue-500 cursor-pointer"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono font-black text-gray-900 dark:text-white tracking-tight">
                    {payment.mpesaCode}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                    KSH {payment.amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-400 font-bold uppercase tracking-tighter">
                    Phone: {payment.phone}
                  </span>
                  <span className="text-blue-500 font-black uppercase tracking-widest transition-opacity">
                    {reconcilingPayment?.id === payment.id ? "Linking..." : "Select Payment & Link"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center">
              <p className="text-xs text-gray-400 italic font-medium">
                No pending payments match your search.
              </p>
            </div>
          )}
        </div>

        {isConfirmOpen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Confirm Link
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                    Link this receipt to {customer?.firstName || "this subscriber"}?
                  </p>
                </div>
                <button
                  onClick={handleCancelConfirmation}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Close confirmation"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {paymentToConfirm?.mpesaCode || "Receipt"}
                  </span>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    KSH {paymentToConfirm?.amount.toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-300">
                  Phone: {paymentToConfirm?.phone || "-"}
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={handleCancelConfirmation}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-black uppercase text-slate-500 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReconciliation}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500"
                >
                  Confirm Link
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
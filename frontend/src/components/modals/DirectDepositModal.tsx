import React from "react";
import { Modal } from "../UI";
import { toast } from "sonner";
import { Customer } from "../../types";
import { transactionsApi } from "../../services/apiService";

interface DirectDepositModalProps {
    isOpen: boolean;
    setIsDepositModalOpen: (isOpen: boolean) => void;
    customer: Customer;
    onSuccess?: () => void;
}

export const DirectDepositModal: React.FC<DirectDepositModalProps> = ({ isOpen, setIsDepositModalOpen, customer, onSuccess }) => {
    const [depositForm, setDepositForm] = React.useState<{amount: string; reason: string}>({ amount: '', reason: '' });

    const handleDepositSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!depositForm.amount || !depositForm.reason) {
            toast.warning("Amount and reason are required");
            return;
        }

        const signedAmount = Number(depositForm.amount);
        if (Number.isNaN(signedAmount) || signedAmount === 0) {
            toast.warning("Enter a valid amount different from zero");
            return;
        }

        const type = signedAmount < 0 ? 'debit' : 'credit';
        const absoluteAmount = Math.abs(signedAmount);
        const category = signedAmount < 0 ? 'Adjustment' : 'Deposit';

        try {
            const response = await transactionsApi.create({
                customer_id: customer.id,
                amount: absoluteAmount,
                type,
                category,
                method: 'Cash',
                description: depositForm.reason,
            });

            const activationNote = response?.activation_note;
            toast.success(activationNote || `${signedAmount < 0 ? 'Deduction' : 'Deposit'} of ${Math.abs(signedAmount)} applied successfully`);
            setIsDepositModalOpen(false);
            onSuccess?.();
            setDepositForm({ amount: '', reason: '' });
        } catch (error) {
            console.error('Error creating deposit:', error);
            toast.error('Failed to apply deposit. Please try again.');
        }
    };

        return(
            <Modal isOpen={isOpen} onClose={() => setIsDepositModalOpen(false)} title="Manual Balance Credit">
                <form onSubmit={handleDepositSubmit} className="space-y-4">
                    <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Deposit Amount (KSH)</label>
                    <input 
                        required
                        type="number" 
                        step="0.01"
                        value={depositForm.amount}
                        onChange={e => setDepositForm({...depositForm, amount: e.target.value})}
                        placeholder="e.g. 2500 or -2500" 
                        className="w-full bg-gray-50 dark:bg-slate-800 p-4 rounded-xl font-black border-none mt-1 focus:ring-2 focus:ring-blue-500" 
                    />
                    </div>
                    <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Reason for Credit</label>
                    <textarea 
                        required
                        rows={3}
                        value={depositForm.reason}
                        onChange={e => setDepositForm({...depositForm, reason: e.target.value})}
                        placeholder="e.g. Overpayment reversal, Cash collection, Goodwill credit" 
                        className="w-full bg-gray-50 dark:bg-slate-800 p-4 rounded-xl font-bold border-none mt-1 focus:ring-2 focus:ring-blue-500 text-sm" 
                    />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-blue-500 transition-all active:scale-95">Apply Manual Credit</button>
                </form>
            </Modal>
        );
    } 
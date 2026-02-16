
import React, { useState, useEffect } from 'react';
import { Modal } from '../UI';
import { Expense, ExpenseCategory } from '../../types';
import { toast } from 'sonner';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Partial<Expense>) => Promise<void>;
  editingExpense: Partial<Expense> | null;
  categories: ExpenseCategory[];
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen, onClose, onSave, editingExpense, categories
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [referenceNo, setReferenceNo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingExpense) {
      setDescription(editingExpense.description || '');
      setAmount(editingExpense.amount?.toString() || '');
      setCategory(editingExpense.category || (categories.length > 0 ? categories[0].name : ''));
      setDate(editingExpense.date ? editingExpense.date.split('T')[0] : new Date().toISOString().split('T')[0]);
      setPaymentMethod(editingExpense.payment_method || 'Bank Transfer');
      setReferenceNo(editingExpense.reference_no || '');
    } else {
      setDescription('');
      setAmount('');
      setCategory(categories.length > 0 ? categories[0].name : '');
      setDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('Bank Transfer');
      setReferenceNo('');
    }
  }, [editingExpense, isOpen, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...editingExpense,
        description,
        amount: parseFloat(amount),
        category,
        date,
        payment_method: paymentMethod,
        reference_no: referenceNo
      };

      await onSave(payload);
      toast.success(editingExpense?.id ? 'Expense updated successfully' : 'Expense recorded successfully');
      onClose();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('Failed to save expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editingExpense?.id ? "Update Expense Record" : "Record New Expenditure"}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Expense Description</label>
            <input 
              required
              type="text" 
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
              placeholder="e.g. Monthly Electricity Bill"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Category</label>
              <select 
                required
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 appearance-none text-gray-900 dark:text-white font-bold"
              >
                {categories.length === 0 && <option value="">No categories defined</option>}
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Amount (KSH)</label>
              <input 
                required
                type="number" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-black" 
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Expense Date</label>
            <input 
              required
              type="date" 
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Payment Method</label>
            <select 
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 appearance-none text-gray-900 dark:text-white font-bold"
            >
              <option>Bank Transfer</option>
              <option>M-Pesa</option>
              <option>Cash</option>
              <option>Cheque</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Reference / Receipt No.</label>
          <input 
            type="text" 
            value={referenceNo}
            onChange={e => setReferenceNo(e.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-mono" 
            placeholder="e.g. TXN-12345678"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : (editingExpense?.id ? "Update Audit Record" : "Confirm Expenditure")}
        </button>
      </form>
    </Modal>
  );
};

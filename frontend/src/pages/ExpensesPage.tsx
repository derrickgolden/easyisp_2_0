
import React, { useState, useMemo, useEffect } from 'react';
import { Card, Badge } from '../components/UI';
import { Expense, ExpenseCategory } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { ExpenseModal } from '../components/modals/ExpenseModal';
import { CategoryModal } from '../components/modals/CategoryModal';
import TableScrollModal from '../components/modals/TableScrollModal';
import { expensesApi } from '../services/apiService';
import { toast } from 'sonner';
import { usePermissions } from '../hooks/usePermissions';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Utilities: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Equipment: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Salaries: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Marketing: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
  Maintenance: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Rent: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  Other: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>,
};

const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-utilities', name: 'Utilities' },
  { id: 'cat-equipment', name: 'Equipment' },
  { id: 'cat-salaries', name: 'Salaries' },
  { id: 'cat-marketing', name: 'Marketing' },
  { id: 'cat-maintenance', name: 'Maintenance' },
  { id: 'cat-rent', name: 'Rent' },
  { id: 'cat-other', name: 'Other' },
];

export const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]'));
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Partial<Expense> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const { can } = usePermissions();

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [currentPage, rowsPerPage, searchTerm, categoryFilter, startDate, endDate]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const response = await expensesApi.getAll(
        currentPage,
        rowsPerPage,
        categoryFilter,
        searchTerm,
        startDate,
        endDate
      );
      
      const expensesList = response.data || [];
      const formattedExpenses = expensesList.map((exp: any) => ({
        id: exp.id.toString(),
        description: exp.description,
        amount: parseFloat(exp.amount),
        category: exp.category,
        date: exp.date,
        payment_method: exp.payment_method,
        reference_no: exp.reference_no,
      }));
      
      setExpenses(formattedExpenses);
      setTotalPages(response.last_page || 1);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to fetch expenses');
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      const storedCategories = raw ? JSON.parse(raw) : [];
      const safeCategories = Array.isArray(storedCategories) && storedCategories.length > 0
        ? storedCategories
        : DEFAULT_CATEGORIES;
      setExpenseCategories(safeCategories);
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(safeCategories));
    } catch (error) {
      console.error('Error fetching categories:', error);
      setExpenseCategories(DEFAULT_CATEGORIES);
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    }
  };
    
  
  const totalSpend = useMemo(() => expenses.reduce((acc, curr) => acc + curr.amount, 0), [expenses]);

  const onAdd = () => { setEditingExpense(null); setIsExpenseModalOpen(true); };
  const onEdit = (e: Expense) => { setEditingExpense(e); setIsExpenseModalOpen(true); };
  
  const onDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    try {
      await expensesApi.delete(id);
      toast.success('Expense deleted successfully');
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Failed to delete expense');
    }
  };
  
  const onRefresh = () => fetchExpenses();
  const onManageCategories = () => setIsCategoryModalOpen(true);

  const handleExpenseSave = async (expenseData: Partial<Expense>) => {
    try {
      if (expenseData.id) {
        await expensesApi.update(expenseData.id, expenseData);
      } else {
        await expensesApi.create(expenseData);
      }
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      throw error;
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Operational Expenses</h2>
          <p className="text-sm text-gray-500">Track company spend and financial overhead.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onRefresh}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button 
            onClick={onManageCategories}
            className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 hover:bg-slate-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            Categories
          </button>
          {can('manage-expenses') && (
          <button 
            onClick={onAdd}
            className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Expense
          </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 rounded-3xl">
           <p className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-1">Total in Range</p>
           <p className="text-2xl font-black text-red-700 dark:text-red-400">KSH {totalSpend.toLocaleString()}</p>
         </div>
         {['Equipment', 'Utilities', 'Salaries'].map(cat => {
            const catTotal = expenses.filter(e => e.category === cat).reduce((acc, curr) => acc + curr.amount, 0);
            return (
              <div key={cat} className="p-6 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-sm">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{cat}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">KSH {catTotal.toLocaleString()}</p>
              </div>
            );
         })}
      </div>

      <Card title="Expense Filters" className="border-none shadow-sm overflow-visible py-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block tracking-widest">Search Description</label>
            <input 
              type="text" 
              placeholder="Filter by description..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm p-2.5 focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block tracking-widest">Filter Category</label>
            <select 
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm p-2.5 focus:ring-2 focus:ring-blue-500 appearance-none text-gray-900 dark:text-white"
            >
              <option value="All">All Categories</option>
              {expenseCategories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block tracking-widest">From Date</label>
            <input 
              type="date" 
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm p-2.5 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block tracking-widest">To Date</label>
            <input 
              type="date" 
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm p-2.5 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </Card>

      <Card title="Expenditure Ledger" className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest border-b dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
              <tr>
                <th className="py-4 px-6">Description</th>
                <th className="py-4 px-6">Category</th>
                <th className="py-4 px-6">Method</th>
                <th className="py-4 px-6">Ref No.</th>
                <th className="py-4 px-6">Amount</th>
                <th className="py-4 px-6">Date</th>
                {can('manage-expenses') && <th className="py-4 px-6 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-gray-400">Loading expenses...</td>
                </tr>
              ) : expenses.length > 0 ? expenses.map((exp) => (
                <tr key={exp.id} className="group hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-all">
                  <td className="py-5 px-6">
                    <p className="font-bold text-gray-900 dark:text-white">{exp.description}</p>
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-2">
                       <div className="w-7 h-7 bg-gray-100 dark:bg-slate-800 text-gray-400 rounded-lg flex items-center justify-center">
                          {CATEGORY_ICONS[exp.category] || <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01" /></svg>}
                       </div>
                       <span className="text-xs font-bold text-gray-500">{exp.category}</span>
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <span className="text-xs text-gray-500 font-medium">{exp.payment_method}</span>
                  </td>
                  <td className="py-5 px-6">
                    <span className="font-mono text-[10px] text-slate-400">{exp.reference_no || '--'}</span>
                  </td>
                  <td className="py-5 px-6">
                    <span className="font-black text-red-600 dark:text-red-400">
                      KSH {exp.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-5 px-6 text-gray-500 text-xs">{exp.date}</td>
                  {can('manage-expenses') && (
                    <td className="py-5 px-6 text-right">
                      <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                           onClick={() => onEdit(exp)}
                           className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        >
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button 
                           onClick={() => onDelete(exp.id)}
                           className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      >
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                  )}
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-gray-400 italic">
                    {searchTerm || categoryFilter !== 'All' || startDate || endDate 
                      ? 'No expenses found matching the selected filters.'
                      : 'No expenses recorded yet. Click "Add Expense" to get started.'}
                  </td>
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
      <ExpenseModal 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)} 
        onSave={handleExpenseSave}
        editingExpense={editingExpense} 
        categories={expenseCategories} 
      />
      <CategoryModal 
        isOpen={isCategoryModalOpen} 
        onClose={() => setIsCategoryModalOpen(false)} 
        categories={expenseCategories} 
        onAdd={(name) => setExpenseCategories([...expenseCategories, { id: 'c'+Date.now(), name }])} 
        onDelete={(id) => setExpenseCategories(prev => prev.filter(c => c.id !== id))} 
      />
    </div>
  );
};

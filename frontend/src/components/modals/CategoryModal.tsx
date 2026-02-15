
import React, { useState } from 'react';
import { Modal } from '../UI';
import { ExpenseCategory } from '../../types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ExpenseCategory[];
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen, onClose, categories, onAdd, onDelete
}) => {
  const [newCat, setNewCat] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    onAdd(newCat.trim());
    setNewCat('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Expense Categories">
      <div className="space-y-6">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input 
            type="text" 
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            className="flex-1 bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold text-gray-900 dark:text-white" 
            placeholder="Category Name (e.g. Fuel)"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
            Add
          </button>
        </form>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-1">Active Categories</p>
          <div className="max-h-60 overflow-y-auto pr-1 space-y-1">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl group transition-all">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{cat.name}</span>
                <button 
                  onClick={() => onDelete(cat.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

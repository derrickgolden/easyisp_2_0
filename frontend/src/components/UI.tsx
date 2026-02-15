
import React from 'react';

export const Card: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-md border border-gray-100 dark:border-slate-800 p-6 transition-all duration-300 ${className}`}>
    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{title}</h3>
    {children}
  </div>
);

export const StatCard: React.FC<{ label: string; value: string | number; subValue?: string; icon: React.ReactNode; color: string }> = ({ label, value, subValue, icon, color }) => (
  <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 transition-all duration-300">
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
    <div className='flex items-center mt-2 space-x-4'>
      <div className={`p-3 rounded-lg bg-opacity-10`} style={{ backgroundColor: `${color}20`, color }}>
        <div className="w-6 h-6">{icon}</div>
      </div>
      <div>
        <div className="flex items-baseline space-x-2">
          <p className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">{value}</p>
          {subValue && (
            <span className="absolute top-4 right-4 text-xs text-green-500 font-medium">
              {subValue}
            </span>
          )}
        </div>
      </div>
    </div>
  </div>
);

export const Badge: React.FC<{ variant: string; children: React.ReactNode }> = ({ variant, children }) => {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    online: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    offline: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Inactive: 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-400',
    suspended: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[variant] || 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-400'}`}>{children}</span>;
};

export const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; label?: string }> = ({ checked, onChange, label }) => (
  <div className="flex items-center space-x-2">
    <button
      type='button'
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
    {label && <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>}
  </div>
);

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full ${maxWidth} overflow-hidden transform animate-in slide-in-from-bottom-4 duration-300`}>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>
  );
};

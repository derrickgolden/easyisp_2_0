import React, { useState } from 'react';
import { Modal, ToggleSwitch, Badge } from '../UI';
import { Package } from '../../types';

interface PackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  editingPackage: Partial<Package> | null;
  setEditingPackage: (pkg: Partial<Package> | null) => void;
  isSaving?: boolean;
  saveError?: string | null;
}

export const PackageModal: React.FC<PackageModalProps> = ({
  isOpen, onClose, onSave, editingPackage, setEditingPackage
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  /**
   * Bandwidth Regex: 
   * - Must start with a number.
   * - Can optionally end with k, M, or G (case-insensitive handled by lowercase conversion).
   * - Example: 10M, 512k, 2G, 1000000
   */
  const bandwidthPattern = "^[0-9]+[kMGkmg]?$";
  
  /**
   * Time Regex:
   * - Number or Number/Number
   * - Example: 30, 30/30, 30s, 30s/30s
   */
  const timePattern = "^[0-9]+[s]?(/[0-9]+[s]?)?$";

  // Real-time sanitization for bandwidth inputs
  const handleBandwidthChange = (field: keyof Package, value: string) => {
    // Only allow digits and unit suffixes (k, M, G, s, /)
    const sanitized = value.replace(/[^0-9kMGkmgs/]/gi, '');
    setEditingPackage({ ...editingPackage, [field]: sanitized });
  };

  // Helper to build the rate-limit string for MikroTik RADIUS
  const getMikroTikRateLimit = () => {
    const rx = editingPackage?.speed_up || '5M';
    const tx = editingPackage?.speed_down || '20M';
    let limitStr = `${rx}/${tx}`;

    const hasBurst = editingPackage?.burst_limit_up && editingPackage?.burst_limit_down;
    const hasPriority = editingPackage?.priority !== undefined;
    const hasMinLimit = editingPackage?.min_limit_up && editingPackage?.min_limit_down;

    // Standard Positional Order: rx/tx [burst-rx/burst-tx [thr-rx/thr-tx [time-rx/time-tx [prio [min-rx/min-tx]]]]]
    if (hasBurst || hasPriority || hasMinLimit) {
      const bRx = editingPackage?.burst_limit_up || rx;
      const bTx = editingPackage?.burst_limit_down || tx;
      const tRx = editingPackage?.burst_threshold_up || rx;
      const tTx = editingPackage?.burst_threshold_down || tx;
      const time = editingPackage?.burst_time || '30/30';

      limitStr += ` ${bRx}/${bTx} ${tRx}/${tTx} ${time}`;

      if (hasPriority || hasMinLimit) {
        const prio = editingPackage?.priority || 8;
        limitStr += ` ${prio}`;

        if (hasMinLimit) {
          const mRx = editingPackage?.min_limit_up;
          const mTx = editingPackage?.min_limit_down;
          limitStr += ` ${mRx}/${mTx}`;
        }
      }
    }

    return limitStr;
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editingPackage?.id ? "Update Package Profile" : "Define New Service Plan"}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={onSave} className="space-y-4">
        {/* Basic Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Package Name</label>
            <input 
              required
              type="text" 
              value={editingPackage?.name || ''} 
              onChange={e => setEditingPackage({...editingPackage, name: e.target.value})}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
              placeholder="e.g. Fiber Home 10Mbps"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Price (KSH)</label>
            <input 
              required
              type="number" 
              min="0"
              value={editingPackage?.price || ''} 
              onChange={e => setEditingPackage({...editingPackage, price: Number(e.target.value)})}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-black" 
              placeholder="1500"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Validity (Days)</label>
            <input 
              required
              type="number" 
              min="1"
              value={editingPackage?.validity_days || ''} 
              onChange={e => setEditingPackage({...editingPackage, validity_days: Number(e.target.value)})}
              className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3.5 mt-1 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold" 
              placeholder="30"
            />
          </div>
        </div>

        {/* Level 1: Core Speed (rx/tx) */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20">
          <h5 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-3">Level 1: Base Bandwidth (MIR)</h5>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Upload (rx)</label>
              <input 
                required 
                type="text" 
                pattern={bandwidthPattern}
                title="Input must be a number followed by k, M, or G (e.g., 5M)"
                value={editingPackage?.speed_up || ''} 
                onChange={e => handleBandwidthChange('speed_up', e.target.value)} 
                className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 font-mono text-sm invalid:ring-2 invalid:ring-red-500 transition-all uppercase" 
                placeholder="5M" 
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Download (tx)</label>
              <input 
                required 
                type="text" 
                pattern={bandwidthPattern}
                title="Input must be a number followed by k, M, or G (e.g., 20M)"
                value={editingPackage?.speed_down || ''} 
                onChange={e => handleBandwidthChange('speed_down', e.target.value)} 
                className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-blue-500 font-mono text-sm invalid:ring-2 invalid:ring-red-500 transition-all uppercase" 
                placeholder="20M" 
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-2 py-1">
           <span className="text-xs font-bold text-gray-500">Advanced QoS (Bursts, Priority, CIR)</span>
           <ToggleSwitch checked={showAdvanced} onChange={() => setShowAdvanced(!showAdvanced)} />
        </div>

        {showAdvanced && (
          <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
            {/* Level 2 & 3: Bursts */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
              <h5 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Level 2: Bursting Parameters</h5>
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="text" 
                  pattern={bandwidthPattern}
                  placeholder="Burst Up (e.g. 10M)" 
                  value={editingPackage?.burst_limit_up || ''} 
                  onChange={e => handleBandwidthChange('burst_limit_up', e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 text-xs font-mono uppercase invalid:text-red-500" 
                />
                <input 
                  type="text" 
                  pattern={bandwidthPattern}
                  placeholder="Burst Down (e.g. 40M)" 
                  value={editingPackage?.burst_limit_down || ''} 
                  onChange={e => handleBandwidthChange('burst_limit_down', e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 text-xs font-mono uppercase invalid:text-red-500" 
                />
                <input 
                  type="text" 
                  pattern={bandwidthPattern}
                  placeholder="Thr Up (e.g. 3M)" 
                  value={editingPackage?.burst_threshold_up || ''} 
                  onChange={e => handleBandwidthChange('burst_threshold_up', e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 text-xs font-mono uppercase invalid:text-red-500" 
                />
                <input 
                  type="text" 
                  pattern={bandwidthPattern}
                  placeholder="Thr Down (e.g. 15M)" 
                  value={editingPackage?.burst_threshold_down || ''} 
                  onChange={e => handleBandwidthChange('burst_threshold_down', e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 text-xs font-mono uppercase invalid:text-red-500" 
                />
                <div className="col-span-2">
                   <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Burst Time (rx/tx)</label>
                   <input 
                    type="text" 
                    pattern={timePattern}
                    title="Format: Seconds or Seconds/Seconds (e.g., 30/30)"
                    placeholder="30/30" 
                    value={editingPackage?.burst_time || ''} 
                    onChange={e => handleBandwidthChange('burst_time', e.target.value)} 
                    className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 mt-1 text-xs font-mono invalid:ring-1 invalid:ring-red-500" 
                   />
                </div>
              </div>
            </div>

            {/* Level 4 & 5: Priority & Min Limit */}
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 space-y-4">
              <h5 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-1">Level 3: Priority & Min (CIR)</h5>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Traffic Priority (1-8)</label>
                  <select 
                    value={editingPackage?.priority || 8}
                    onChange={e => setEditingPackage({...editingPackage, priority: Number(e.target.value)})}
                    className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 mt-1 focus:ring-2 focus:ring-indigo-500 font-bold"
                  >
                    {[1,2,3,4,5,6,7,8].map(p => (
                      <option key={p} value={p}>
                        Priority {p} {p === 1 ? '(Highest)' : p === 8 ? '(Lowest)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Min Upload (CIR)</label>
                  <input 
                    type="text" 
                    pattern={bandwidthPattern}
                    placeholder="2M" 
                    value={editingPackage?.min_limit_up || ''} 
                    onChange={e => handleBandwidthChange('min_limit_up', e.target.value)} 
                    className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 mt-1 text-xs font-mono uppercase invalid:text-red-500" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Min Download (CIR)</label>
                  <input 
                    type="text" 
                    pattern={bandwidthPattern}
                    placeholder="5M" 
                    value={editingPackage?.min_limit_down || ''} 
                    onChange={e => handleBandwidthChange('min_limit_down', e.target.value)} 
                    className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 mt-1 text-xs font-mono uppercase invalid:text-red-500" 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live RouterOS Preview */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-inner">
           <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">MikroTik Rate-Limit String</span>
              <Badge variant="active">Live Output</Badge>
           </div>
           <code className="text-sm text-green-400 font-mono block leading-relaxed break-all whitespace-pre-wrap">
              {getMikroTikRateLimit()}
           </code>
           <p className="text-[8px] text-gray-500 mt-2 italic uppercase">This value is pushed to the 'Mikrotik-Rate-Limit' RADIUS attribute.</p>
        </div>

        <button 
          type="submit" 
          className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-500 transition-all active:scale-95 group flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {editingPackage?.id ? "Sync Package Update" : "Deploy Network Package"}
        </button>
      </form>
    </Modal>
  );
};


import React from 'react';
import { Modal } from '../UI';
import { Site } from '../../types';

interface SiteProvisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProvision: () => void;
}

export const SiteProvisionModal: React.FC<SiteProvisionModalProps> = ({ isOpen, onClose, onProvision }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Register Network Site">
    <div className="space-y-4">
      <input type="text" placeholder="Friendly Name" className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-gray-900 dark:text-white" />
      <input type="text" placeholder="Primary Gateway IP" className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-gray-900 dark:text-white" />
      <button onClick={onProvision} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all">Provision Site</button>
    </div>
  </Modal>
);

interface IPAMModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSite: Site | null;
}

export const IPAMModal: React.FC<IPAMModalProps> = ({ isOpen, onClose, selectedSite }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={`IPAM Inventory: ${selectedSite?.name}`} maxWidth="max-w-2xl">
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl mb-4 text-xs font-semibold text-blue-800 dark:text-blue-300">
      Subnet: {selectedSite?.ip_address.split('.').slice(0,3).join('.')}.0/24
    </div>
    <div className="grid grid-cols-8 gap-2">
      {[...Array(64)].map((_, i) => (
        <div key={i} className={`h-8 rounded flex items-center justify-center text-[8px] font-mono border ${i % 7 === 0 ? 'bg-red-500 text-white border-red-600' : 'bg-green-100 dark:bg-slate-800 text-green-700 border-green-200 dark:border-slate-700'}`}>.{i+1}</div>
      ))}
    </div>
  </Modal>
);

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSite: Site | null;
  onCopy: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, selectedSite, onCopy }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="MikroTik CLI Environment" maxWidth="max-w-3xl">
    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
      <pre className="text-green-400 font-mono text-[11px] overflow-x-auto leading-relaxed">
        {`# EasyTech Auto-Provision Script\n# TARGET: ${selectedSite?.name}\n\n/ip address add address=${selectedSite?.ip_address}/24 interface=ether1\n/ip pool add name=pool_${selectedSite?.id} ranges=${selectedSite?.ip_address.split('.').slice(0,3).join('.')}.100-${selectedSite?.ip_address.split('.').slice(0,3).join('.')}.250\n/ppp profile add name=profile_${selectedSite?.name} local-address=${selectedSite?.ip_address} remote-address=pool_${selectedSite?.id}`}
      </pre>
    </div>
    <button onClick={onCopy} className="w-full mt-4 py-2 border border-gray-200 dark:border-slate-700 text-xs font-bold rounded-xl dark:text-gray-300">
      Copy Script to Clipboard
    </button>
  </Modal>
);

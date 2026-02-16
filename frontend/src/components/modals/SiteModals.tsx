
import React, { useEffect, useState } from 'react';
import { Modal } from '../UI';
import { Site } from '../../types';
import { sitesApi } from '../../services/apiService';
import { toast } from 'sonner';

interface SiteProvisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SiteProvisionModal: React.FC<SiteProvisionModalProps> = ({ isOpen, onClose, onSuccess }) =>{
  const [name, setName] = useState('');
  const [gateway, setGateway] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProvision = async () => {
    // Validation
    if (!name.trim()) {
      setError('Site name is required');
      return;
    }
    if (!gateway.trim()) {
      setError('Gateway IP address is required');
      return;
    }

    // Basic IP validation
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(gateway)) {
      setError('Invalid IP address format');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await sitesApi.create({
        name: name.trim(),
        ip_address: gateway.trim(),
        location: location.trim() || 'Not specified',
        notify_on_down: true,
      });

      toast.success('Site provisioned successfully');

      // Reset form
      setName('');
      setGateway('');
      setLocation('');
      
      onClose();
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create site');
      toast.error('Failed to provision site');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register Network Site">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        
        <input 
          type="text" 
          placeholder="Friendly Name" 
          className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-gray-900 dark:text-white" 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />
        
        <input 
          type="text" 
          placeholder="Primary Gateway IP" 
          className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-gray-900 dark:text-white" 
          value={gateway} 
          onChange={(e) => setGateway(e.target.value)}
          disabled={loading}
        />
        
        <input 
          type="text" 
          placeholder="Location (optional)" 
          className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-gray-900 dark:text-white" 
          value={location} 
          onChange={(e) => setLocation(e.target.value)}
          disabled={loading}
        />
        
        <button 
          onClick={handleProvision} 
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
        >
          {loading ? 'Provisioning...' : 'Provision Site'}
        </button>
      </div>
    </Modal>
  );
};

interface IPAMModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSite: Site | null;
}

interface IpamData {
  site_id: string;
  site_name: string;
  base_network: string;
  subnet: string;
  allocations: {
    [key: number]: {
      id: string;
      name: string;
      username: string;
      status: string;
      ip: string;
    };
  };
  total_allocated: number;
  total_available: number;
}

export const IPAMModal: React.FC<IPAMModalProps> = ({ isOpen, onClose, selectedSite }) => {
  const [ipamData, setIpamData] = useState<IpamData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIp, setSelectedIp] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && selectedSite) {
      fetchIpamData();
    }
  }, [isOpen, selectedSite]);

  const fetchIpamData = async () => {
    if (!selectedSite) return;
    
    try {
      setLoading(true);
      const data = await sitesApi.getIpam(selectedSite.id);
      console.log('Fetched IPAM data:', data);
      setIpamData(data);
    } catch (error) {
      console.error('Error fetching IPAM data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500 border-green-600';
      case 'expired': return 'bg-red-500 border-red-600';
      case 'suspended': return 'bg-yellow-500 border-yellow-600';
      default: return 'bg-gray-500 border-gray-600';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`IPAM Inventory: ${selectedSite?.name}`} maxWidth="max-w-6xl">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : ipamData ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <p className="text-xs font-black uppercase text-gray-500 mb-1">Subnet</p>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{ipamData.subnet}</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <p className="text-xs font-black uppercase text-gray-500 mb-1">Allocated</p>
              <p className="text-sm font-bold text-green-600 dark:text-green-400">{ipamData.total_allocated} IPs</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <p className="text-xs font-black uppercase text-gray-500 mb-1">Available</p>
              <p className="text-sm font-bold text-gray-600 dark:text-gray-400">{ipamData.total_available} IPs</p>
            </div>
          </div>

          <div className="grid grid-cols-8 gap-2 mb-4">
            {[...Array(256)].map((_, i) => {
              const allocation = ipamData.allocations[i];
              const isAllocated = !!allocation;
              
              return (
                <div
                  key={i}
                  onClick={() => isAllocated && setSelectedIp(i)}
                  className={`h-8 rounded flex items-center justify-center text-[8px] font-mono border transition-all ${
                    isAllocated 
                      ? `${getStatusColor(allocation.status)} text-white cursor-pointer hover:scale-105` 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-400 border-gray-200 dark:border-slate-700'
                  } ${selectedIp === i ? 'ring-2 ring-blue-400 scale-105' : ''}`}
                  title={isAllocated ? `${allocation.name} (${allocation.ip})` : `${ipamData.base_network}.${i} - Available`}
                >
                  .{i}
                </div>
              );
            })}
          </div>

          {selectedIp !== null && ipamData.allocations[selectedIp] && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-l-4 border-blue-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-black uppercase text-gray-500 mb-1">Customer Details</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{ipamData.allocations[selectedIp].name}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">{ipamData.allocations[selectedIp].username}</p>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1">{ipamData.allocations[selectedIp].ip}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                  ipamData.allocations[selectedIp].status === 'active' ? 'bg-green-100 text-green-700' :
                  ipamData.allocations[selectedIp].status === 'expired' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {ipamData.allocations[selectedIp].status}
                </span>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t dark:border-slate-800">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500 border border-green-600"></div>
                <span className="text-gray-600 dark:text-gray-400 font-medium">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500 border border-red-600"></div>
                <span className="text-gray-600 dark:text-gray-400 font-medium">Expired</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500 border border-yellow-600"></div>
                <span className="text-gray-600 dark:text-gray-400 font-medium">Suspended</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700"></div>
                <span className="text-gray-600 dark:text-gray-400 font-medium">Available</span>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </Modal>
  );
};

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
        {`# EasyTech Auto-Provision Script
# TARGET: ${selectedSite?.name}

# IP Address Configuration
/ip address add address=${selectedSite?.ip_address}/24 interface=ether1

# IP Pools
/ip pool
add name=expired ranges=${selectedSite?.ip_address.split('.').slice(0,3).join('.')}.50-${selectedSite?.ip_address.split('.').slice(0,3).join('.')}.99
add name=pppoe-pool ranges=${selectedSite?.ip_address.split('.').slice(0,3).join('.')}.100-${selectedSite?.ip_address.split('.').slice(0,3).join('.')}.250

# PPP Profiles
/ppp profile
add local-address=${selectedSite?.ip_address} name=expired remote-address=expired
add dns-server=8.8.8.8,1.1.1.1 local-address=${selectedSite?.ip_address} name=ppoe-profile \\
    remote-address=pppoe-pool

# DNS Configuration
/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes

# PPPoE Server Configuration
/interface pppoe-server server
add default-profile=ppoe-profile disabled=no interface=ether3-pppoe \\
    one-session-per-host=yes service-name=pppoe-server

# RADIUS Configuration
/ppp aaa set use-radius=yes
/radius add address=102.212.246.245 service=ppp,login,hotspot secret=p5D031tEhfRNXBwm
/radius incoming set accept=yes

# WireGuard Configuration
/interface wireguard add name=wg-radius listen-port=13231
/interface wireguard peers add interface=wg-radius public-key="5jhaRrfQt+PFcWT69GosWDYmt7icp4DpOYzZXYLOclM=" \
    endpoint-address=102.212.246.245:51820 allowed-address=10.0.0.0/24 persistent-keepalive=25s

/ip address add address=10.0.0.2/24 interface=wg-radius

# Firewall Rules
# Allow RADIUS and COA from the WireGuard Tunnel only
/ip firewall filter
add action=accept chain=input src-address=10.0.0.1 protocol=udp dst-port=1812,1813 comment="Allow RADIUS Auth/Acct"
add action=accept chain=input src-address=10.0.0.1 protocol=udp dst-port=3799 comment="Allow RADIUS COA (Disconnect)"

# System Clock
/system clock set time-zone-name=Africa/Nairobi`}
      </pre>
    </div>
    <button onClick={onCopy} className="w-full mt-4 py-2 border border-gray-200 dark:border-slate-700 text-xs font-bold rounded-xl dark:text-gray-300">
      Copy Script to Clipboard
    </button>
  </Modal>
);


import React, { useEffect, useState } from 'react';
import { Modal } from '../UI';
import { Site } from '../../types';
import { sitesApi } from '../../services/apiService';
import { toast } from 'sonner';
const WIREGUARD_PUBLIC_KEY = import.meta.env.VITE_WIREGUARD_PUBLIC_KEY;
const WIREGUARD_ALLOWED_ADDRESS = import.meta.env.VITE_WIREGUARD_ALLOWED_ADDRESS;

interface SiteProvisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingSite?: Site | null;
}

export const SiteProvisionModal: React.FC<SiteProvisionModalProps> = ({ isOpen, onClose, onSuccess, editingSite }) =>{
  const [name, setName] = useState('');
  const [gateway, setGateway] = useState('');
  const [location, setLocation] = useState('');
  const [mikrotikUsername, setMikrotikUsername] = useState('');
  const [mikrotikPassword, setMikrotikPassword] = useState('');
  const [mikrotikPort, setMikrotikPort] = useState('8728');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (editingSite) {
      setName(editingSite.name || '');
      setGateway(editingSite.ip_address || '');
      setLocation(editingSite.location || '');
      setMikrotikUsername(editingSite.mikrotik_username || '');
      setMikrotikPassword(editingSite.mikrotik_password || '');
      setMikrotikPort(String(editingSite.mikrotik_port || 8728));
    } else {
      setName('');
      setGateway('');
      setLocation('');
      setMikrotikUsername('');
      setMikrotikPassword('');
      setMikrotikPort('8728');
    }

    setError(null);
  }, [isOpen, editingSite]);

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

      const payload: any = {
        name: name.trim(),
        ip_address: gateway.trim(),
        location: location.trim() || 'Not specified',
        mikrotik_username: mikrotikUsername.trim() || null,
        mikrotik_port: mikrotikPort ? Number(mikrotikPort) : null,
        notify_on_down: true,
      };

      if (mikrotikPassword.trim()) {
        payload.mikrotik_password = mikrotikPassword.trim();
      }

      if (editingSite) {
        await sitesApi.update(editingSite.id, payload);
        toast.success('Site updated successfully');
      } else {
        payload.mikrotik_password = mikrotikPassword.trim() || null;
        await sitesApi.create(payload);
        toast.success('Site provisioned successfully');
      }

      onClose();
      onSuccess();
    } catch (err: any) {
      setError(err.message || `Failed to ${editingSite ? 'update' : 'create'} site`);
      toast.error(`Failed to ${editingSite ? 'update' : 'provision'} site`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingSite ? 'Edit Network Site' : 'Register Network Site'}>
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Friendly Name
          </label>
          <input 
            type="text" 
            placeholder="Friendly Name" 
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-gray-900 dark:text-white" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Primary Gateway IP
          </label>
          <input 
            type="text" 
            placeholder="Primary Gateway IP" 
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-gray-900 dark:text-white" 
            value={gateway} 
            onChange={(e) => setGateway(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Location
          </label>
          <input 
            type="text" 
            placeholder="Location (optional)" 
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-gray-900 dark:text-white" 
            value={location} 
            onChange={(e) => setLocation(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            MikroTik Username
          </label>
          <input
            type="text"
            placeholder="MikroTik Username"
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-gray-900 dark:text-white"
            value={mikrotikUsername}
            onChange={(e) => setMikrotikUsername(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            MikroTik Password
          </label>
          <input
            type="password"
            placeholder={editingSite ? 'MikroTik Password (leave blank to keep current)' : 'MikroTik Password'}
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-gray-900 dark:text-white"
            value={mikrotikPassword}
            onChange={(e) => setMikrotikPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            MikroTik Port
          </label>
          <input
            type="number"
            placeholder="MikroTik Port"
            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-gray-900 dark:text-white"
            value={mikrotikPort}
            onChange={(e) => setMikrotikPort(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <button 
          onClick={handleProvision} 
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
        >
          {loading ? (editingSite ? 'Saving...' : 'Provisioning...') : (editingSite ? 'Save Changes' : 'Provision Site')}
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

# IP Pools
/ip pool
add name=expired_pool ranges=10.0.0.100-10.0.0.200
add name=pppoe-pool ranges=10.254.0.10-10.254.0.250

# PPP Profiles
/ppp profile
add local-address=10.0.0.1 name=Expired_Redirect remote-address=expired_pool
add dns-server=8.8.8.8,1.1.1.1 local-address=10.254.0.1 name=pppoe-profile \\
    remote-address=pppoe-pool

# DNS Configuration
/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=no

# PPPoe Server Configuration
# 1. Create the Bridge if not already created.
/interface bridge add name=bridge-pppoe

# 2. Add all the ports you want to serve customers on
/interface bridge port
add bridge=bridge-pppoe interface=ether3

# 3. Point the PPPoE Server to the BRIDGE
/interface pppoe-server server
add default-profile=pppoe-profile disabled=no interface=bridge-pppoe \
    one-session-per-host=yes service-name=pppoe-server

# RADIUS Configuration
/ppp aaa set use-radius=yes
/radius add address=102.212.246.245 service=ppp,login,hotspot secret=p5D031tEhfRNXBwm
/radius incoming set accept=yes

# WireGuard Configuration
/interface wireguard add name=wg-client listen-port=13231
/interface wireguard peers add interface=wg-client public-key="${WIREGUARD_PUBLIC_KEY}" \
endpoint-address=102.212.246.245 endpoint-port=51820 allowed-address=${WIREGUARD_ALLOWED_ADDRESS} persistent-keepalive=25s

# WireGuard IP Address Configuration
/ip address add address=${selectedSite?.ip_address}/24 interface=wg-client \
comment="Wireguard Primary Gateway IP for ${selectedSite?.name}"

# Firewall Rules
# Allow RADIUS and COA from the WireGuard Tunnel only
/ip firewall filter
add action=accept chain=input src-address=10.0.0.1 protocol=udp dst-port=1812,1813 \
comment="Allow RADIUS Auth/Acct"
add action=accept chain=input src-address=10.0.0.1 protocol=udp dst-port=3799 \
comment="Allow RADIUS COA (Disconnect)"

# API configuration
/ip service enable api
# restrict API access to the WireGuard tunnel for security
/ip firewall filter add action=accept chain=input src-address=${WIREGUARD_ALLOWED_ADDRESS} \
comment="Allow API access from WireGuard tunnel only"
add action=drop chain=input src-address=!${WIREGUARD_ALLOWED_ADDRESS} comment="Drop API access from other sources"
/ip service set api address=192.168.88.0/24
#create api user with strong password
/user add name=apiuser password=hjdTY162JGFkas group=full

# System Clock
/system clock set time-zone-name=Africa/Nairobi`}
      </pre>
    </div>
    <button onClick={onCopy} className="w-full mt-4 py-2 border border-gray-200 dark:border-slate-700 text-xs font-bold rounded-xl dark:text-gray-300">
      Copy Script to Clipboard
    </button>
  </Modal>
);

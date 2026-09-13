import { useEffect, useState } from 'react';
import { Card, Modal } from "../../UI";
import { usePermissions } from '@/src/hooks/usePermissions';
import { hotspotCustomersApi } from '@/src/services/apiService';

interface ConnectedDevice {
  id: number;
  current_mac: string | null;
  previous_mac: string | null;
  last_seen_at: string | null;
}

interface ConnectedDevicesCardProps {
  customerId: string;
}

export const ConnectedDevicesCard = ({ customerId }: ConnectedDevicesCardProps) => {
    const [isAccountingModalOpen, setIsAccountingModalOpen] = useState(false);
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
    

    const { can } = usePermissions();

    useEffect(() => {
      let isMounted = true;

      const fetchDevices = async () => {
        setIsLoading(true);
        try {
          const response = await hotspotCustomersApi.getDevices(customerId);
          if (isMounted) setDevices(response.data || []);
        } catch (error) {
          console.error('Failed to fetch connected devices:', error);
          if (isMounted) setDevices([]);
        } finally {
          if (isMounted) setIsLoading(false);
        }
      };

      fetchDevices();

      return () => {
        isMounted = false;
      };
    }, [customerId]);

    return (
           <Card title={`Connected Devices (${devices.length})`} className="border-none shadow-sm rounded-[2.5rem] bg-slate-900 text-white">
              <div className="space-y-5">
                 {isLoading ? (
                    <p className="text-sm text-slate-400">Loading devices...</p>
                 ) : devices.length === 0 ? (
                    <p className="text-sm text-slate-400">No connected devices</p>
                 ) : devices.map((device) => (
                    <div key={device.id} className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-mono font-bold text-emerald-400">{device.current_mac || 'Unbound'}</p>
                        {device.previous_mac && <p className="text-[10px] text-slate-500 mt-1">Previous: {device.previous_mac}</p>}
                        {device.last_seen_at && <p className="text-[10px] text-slate-400 mt-1">Last seen: {new Date(device.last_seen_at).toDateString()}, {new Date(device.last_seen_at).toLocaleTimeString()}</p>}
                      </div>
                      <div className="p-2 bg-white/5 rounded-lg">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3c1.268 0 2.49.234 3.62.661m-1.42 14.24l.066.088A10.018 10.018 0 0021 12c0-2.312-.783-4.441-2.091-6.13" /></svg>
                      </div>
                    </div>
                 ))}
              </div>

              <Modal 
                isOpen={isAccountingModalOpen} 
                onClose={() => setIsAccountingModalOpen(false)} 
                title={`RADIUS Session History: `}
                maxWidth="max-w-6xl"
              >
                <div className="space-y-4">
                  
                </div>
              </Modal>
           </Card>         
    )
}
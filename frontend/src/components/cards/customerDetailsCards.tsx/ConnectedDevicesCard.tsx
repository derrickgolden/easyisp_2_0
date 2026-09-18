import { useState } from 'react';
import { Card } from "../../UI";
import { hotspotCustomersApi } from '@/src/services/apiService';
import { HotspotTechnicalSpecsModal } from '@/src/components/modals/HotspotTechnicalSpecsModal';
import type { Customer, HotspotCustomerDevice, TechnicalSpecs } from '@/src/types';

interface ConnectedDevicesCardProps {
  customer: Customer;
  revokeSession: ({customerId, radiusUsername}: {customerId: string, radiusUsername: string}, macAddress: string) => Promise<void>;
  devices: HotspotCustomerDevice[];
  selectedDevice: HotspotCustomerDevice | null;
  setSelectedDevice: (device: HotspotCustomerDevice | null) => void;
  isLoading: boolean;
  isRevokingSession: boolean;
}

export const ConnectedDevicesCard = ({ customer, devices, isLoading, revokeSession, selectedDevice, setSelectedDevice, isRevokingSession }: ConnectedDevicesCardProps) => {
  const [selectedTechnicalSpecs, setSelectedTechnicalSpecs] = useState<TechnicalSpecs | null>(null);
  const [isSpecsLoading, setIsSpecsLoading] = useState(false);

  const openDeviceHistory = async (device: HotspotCustomerDevice) => {
    setSelectedDevice(device);
    setSelectedTechnicalSpecs(null);
    setIsSpecsLoading(true);

    try {
      const response = await hotspotCustomersApi.getTechnicalSpecs(customer.id.toString(), device.current_mac || device.previous_mac || '');
      setSelectedTechnicalSpecs(response);
    } catch (error) {
      console.error('Failed to fetch device session history:', error);
    } finally {
      setIsSpecsLoading(false);
    }
  };

  return (
    <Card title={`Connected Devices (${devices.length})`} className="border-none shadow-sm rounded-[2.5rem] bg-slate-900 text-white">
      <div className="space-y-4">

        {isLoading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">Loading devices...</div>
        ) : devices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-400">No connected devices</div>
        ) : devices.map((device) => {
          const isOnline = device.online_status === 'online';

          return (
            <div key={device.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.07]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]' : 'bg-slate-500'}`} />
                  <p className={`truncate text-sm font-mono font-bold ${isOnline ? 'text-emerald-400' : 'text-orange-400'}`}>{device.current_mac || 'Unbound'}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${isOnline ? 'bg-emerald-400/10 text-emerald-300' : 'bg-orange-500/15 text-orange-400'}`}>
                    {device.online_status}
                  </span>
                </div>
                {device.previous_mac && <p className="mt-2 text-[10px] text-slate-500">Previous: <span className="font-mono">{device.previous_mac}</span></p>}
                {device.last_seen_at && <p className="mt-1 text-[10px] text-slate-400">Reg At: {new Date(device.last_seen_at).toLocaleDateString()} at {new Date(device.last_seen_at).toLocaleTimeString()}</p>}
              </div>
              <button
                type="button"
                onClick={() => openDeviceHistory(device)}
                aria-label={`View session history for ${device.current_mac || 'unbound device'}`}
                title="View session history"
                className={`shrink-0 rounded-xl border border-white/10 bg-white/[0.06] p-2.5 text-slate-400 transition-colors ${isOnline ? 'border-emerald-400/40 bg-emerald-400/10 hover:text-emerald-300' : 'border-orange-500/40 bg-orange-500/10 hover:text-orange-300'} focus:outline-none focus:ring-2 focus:ring-emerald-400/50`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7s-8.268-2.943-9.542-7Z" />
                  <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      <HotspotTechnicalSpecsModal
        isOpen={selectedDevice !== null}
        onClose={() => setSelectedDevice(null)}
        device={selectedDevice}
        customer={customer}
        onRevokeSession={revokeSession}
        isRevokingSession={isRevokingSession}
        onRefresh={async () => {
          if (selectedDevice) {
            await openDeviceHistory(selectedDevice);
          }
        }}
        technicalSpecs={selectedTechnicalSpecs}
        isLoading={isSpecsLoading}
      />
    </Card>
  );
}
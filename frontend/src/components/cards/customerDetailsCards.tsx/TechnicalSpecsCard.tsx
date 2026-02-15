import { useState, useEffect, useRef } from 'react';
import { Card, Modal } from "../../UI";
import { customersApi } from '../../../services/apiService';
import { toast } from 'sonner';

export const TechnicalSpecCard = ({technicalSpecs, customer, onRefresh}) => {
    const [uptime, setUptime] = useState<string>('Offline');
    const [isPolling, setIsPolling] = useState(false);
    const [isAccountingModalOpen, setIsAccountingModalOpen] = useState(false);
    const isRequesting = useRef(false);
    const currentDelay = useRef(2000); // Use ref to persist delay across renders
    const startTimeIso = technicalSpecs?.start_time;
    const isOnline = technicalSpecs?.is_online;

    useEffect(() => {
      if (!startTimeIso) {
        setUptime('Offline');
        return;
      }

      // Replace +00:00 with +03:00 so JS knows it's Nairobi time
      const startDate = new Date(startTimeIso.replace('+00:00', '+03:00')).getTime();

      const interval = setInterval(() => {
        const now = new Date().getTime();
        const diffInSeconds = Math.floor((now - startDate) / 1000);

        if (diffInSeconds >= 0) {
          const d = Math.floor(diffInSeconds / 86400);
          const h = Math.floor((diffInSeconds % 86400) / 3600);
          const m = Math.floor((diffInSeconds % 3600) / 60);
          const s = diffInSeconds % 60;

          setUptime(`${d}d:${h}h:${m}m:${s.toString().padStart(2, '0')}`);
        }
      }, 1000);

      // Cleanup interval on component unmount to prevent memory leaks
      return () => clearInterval(interval);
    }, [startTimeIso, isOnline]);

    // AUTO-REFRESH EFFECT (Polls API every 2s ONLY if offline)
    useEffect(() => {
      let timeoutId;
      const maxDelay = 60000; // Cap at 1 minute

      // Reset delay when user comes back online
      if (isOnline) {
        currentDelay.current = 2000;
        return;
      }

      const poll = async () => {
        if (!isOnline) {
          if (!isRequesting.current) {
            isRequesting.current = true;
            setIsPolling(true);
            
            await onRefresh();
            
            isRequesting.current = false;
            setIsPolling(false);

            // Increase delay for the next run
            currentDelay.current = Math.min(currentDelay.current * 2, maxDelay);
            console.log('Next delay will be:', currentDelay.current);
          }

          // Schedule the next poll with updated delay
          timeoutId = setTimeout(poll, currentDelay.current);
        }
      };

      // Start polling
      timeoutId = setTimeout(poll, currentDelay.current);

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
    }, [isOnline, onRefresh]);

    const onResetMAC = async (customerId: string) => {
      try {
        const response = await customersApi.resetMacBinding(customerId);
        onRefresh();
        toast.success(response.message);
      } catch (error) {
        console.error("Error resetting MAC binding:", error);
        toast.error("Failed to reset MAC binding.");
      }
    };

    const formatDuration = (seconds: number) => {
      if (seconds < 0) return '--';
      if (seconds < 60) return `${seconds}s`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    }

    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
           <Card title="Technical Specs" className="border-none shadow-sm rounded-[2.5rem] bg-slate-900 text-white">
              <div className="space-y-5">
                 <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Allocated IP</p>
                      <p className="text-sm font-mono font-bold text-blue-400">{technicalSpecs?.framed_ip || 'Not Assigned'}</p>
                    </div>
                    <div className="p-2 bg-white/5 rounded-lg">
                      <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                 </div>
                 <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Device Type</p>
                      <p className="text-sm font-mono font-bold text-blue-400">{technicalSpecs?.device_vendor}</p>
                    </div>
                    <div className="p-2 bg-white/5 rounded-lg">
                      <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                 </div>
                 <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Physical MAC</p>
                      <p className="text-sm font-mono font-bold text-emerald-400">{technicalSpecs?.calling_station_id || 'Unbound'}</p>
                    </div>
                    <div className="p-2 bg-white/5 rounded-lg">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3c1.268 0 2.49.234 3.62.661m-1.42 14.24l.066.088A10.018 10.018 0 0021 12c0-2.312-.783-4.441-2.091-6.13" /></svg>
                    </div>
                 </div>
                 <div className=" border-t border-white/5 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Last Uptime</span>
                        <span className="text-sm font-mono font-bold text-purple-400">{technicalSpecs?.last_uptime}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className={`text-[12px] font-bold uppercase ${technicalSpecs?.is_online ? 'text-emerald-400' : 'text-red-400'}`}>
                        {technicalSpecs?.is_online ? 'Online' : 'Offline'}
                       </span>
                       <div className="flex items-center gap-1.5">
                        {isPolling ? (
                          /* Mini Spinner */
                          <span className="w-2.5 h-2.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></span>
                        ) : (
                          /* Status Dot */
                          <span className={`w-2 h-2 rounded-full ${technicalSpecs?.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                        )}
                        
                        <span className={`text-xs font-black font-mono tracking-widest ${technicalSpecs?.is_online ? 'text-emerald-600' : 'text-red-500'}`}>
                          {uptime}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onResetMAC(customer.id)} 
                      className="w-1/2 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                        Flush MAC
                      </button>
                       <button onClick={() => setIsAccountingModalOpen(true)} className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Sess Details</button>
                    </div>

                 </div>
              </div>

              <Modal 
                isOpen={isAccountingModalOpen} 
                onClose={() => setIsAccountingModalOpen(false)} 
                title={`RADIUS Session History: ${customer.radiusUsername}`}
                maxWidth="max-w-6xl"
              >
                <div className="space-y-4">
                  <div className="overflow-x-auto -mx-6">
                    <table className="w-full text-[11px]">
                      <thead className="bg-gray-50 dark:bg-slate-800 text-gray-400 uppercase tracking-widest">
                        <tr>
                          <th className="py-3 px-6 text-left">Start Time</th>
                          <th className="py-3 px-6 text-left">Stop Time</th>
                          <th className="py-3 px-6 text-left">Offline Time</th>
                          <th className="py-3 px-6 text-left">Duration</th>
                          <th className="py-3 px-6 text-left">DL / UL</th>
                          <th className="py-3 px-6 text-right">Cause</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-slate-800">
                        {technicalSpecs?.sessions?.map((record, index: number) => {
                          let offlineSeconds = -1;
                          const nextRecord = technicalSpecs.sessions[index + 1];
                          if (nextRecord && nextRecord.acctstoptime) {
                            const start = new Date(record.acctstarttime).getTime();
                            const prevStop = new Date(nextRecord.acctstoptime).getTime();
                            offlineSeconds = Math.floor((start - prevStop) / 1000);
                          }

                          return (
                            <tr key={record.radacctid} className="hover:bg-gray-50 dark:hover:bg-slate-800/40 group">
                              <td className="py-4 px-6 font-medium text-gray-900 dark:text-slate-100 whitespace-nowrap">{record.acctstarttime}</td>
                              <td className="py-4 px-6 font-medium text-gray-900 dark:text-slate-100 whitespace-nowrap">{record.acctstoptime || <span className="text-emerald-500 animate-pulse font-black">ACTIVE</span>}</td>
                              <td className="py-4 px-6">
                                {offlineSeconds !== -1 ? (
                                  <div className="flex flex-col">
                                    <span className={`font-black text-[10px] ${offlineSeconds > 300 ? 'text-red-500' : 'text-gray-400'}`}>
                                      {formatDuration(offlineSeconds)}
                                    </span>
                                    <span className="text-[8px] text-gray-500 uppercase tracking-tighter font-bold">since prev session</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic">Oldest Record</span>
                                )}
                              </td>
                              <td className="py-4 px-6 font-bold text-gray-900 dark:text-slate-100 whitespace-nowrap">
                                {record.acctstoptime ? 
                                  formatDuration(Math.floor((new Date(record.acctstoptime).getTime() - new Date(record.acctstarttime).getTime()) / 1000))
                                  : <span className="text-emerald-500 font-black">{uptime}</span>
                                }
                              </td>
                              <td className="py-4 px-6 whitespace-nowrap">
                                <div className="flex flex-col">
                                    <span className="text-blue-600 font-bold">DL: {formatBytes(record.acctinputoctets)}</span>
                                    <span className="text-indigo-600 font-bold">UL: {formatBytes(record.acctoutputoctets)}</span>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-right">
                                <span className={`px-2 py-0.5 rounded uppercase font-black text-[9px] 
                                  ${record.acctterminatecause === 'NAS-Error' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                  {record.acctterminatecause}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t dark:border-slate-800">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-tighter">
                      Last synced with MikroTik: {new Date().toLocaleTimeString()}
                    </p>
                    <button onClick={() => setIsAccountingModalOpen(false)} 
                      className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] 
                      font-black uppercase rounded-xl">
                        Close Intelligence
                    </button>
                  </div>
                </div>
              </Modal>
           </Card>         
    )
}
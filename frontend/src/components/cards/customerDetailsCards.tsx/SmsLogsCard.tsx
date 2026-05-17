import { useState, useEffect } from "react";
import { Card, Modal } from "../../UI";
import { smsApi } from "../../../services/apiService";
import { toast } from "sonner";

interface SmsLog {
  id: number;
  phone: string;
  message: string;
  status: string;
  provider: string;
  error_message?: string;
  type: string;
  created_at: string;
  user?: {
    id: number;
    name: string;
  };
}

interface SmsLogsCardProps {
  customerId: number | string;
}

const SmsLogsCard: React.FC<SmsLogsCardProps> = ({ customerId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SmsLog | null>(null);

  useEffect(() => {
    if (isExpanded && !hasLoaded) {
      fetchLogs();
    }
  }, [isExpanded]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const id = typeof customerId === 'string' ? parseInt(customerId) : customerId;
      const response = await smsApi.getLogs(id, 5);

      setLogs(response.data || []);
      setHasLoaded(true);
    } catch (error: any) {
      console.error('Failed to fetch SMS logs:', error);
      toast.error('Failed to load SMS logs');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const datePart = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return (
      <>
        {datePart},<br />
        {timePart}
      </>
    );
  };

  return (
    <Card title="SMS Logs" className="border-none shadow-sm rounded-[2.5rem]">
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500 font-medium italic">
          {isExpanded ? "SMS history for this customer" : "Click to view SMS history"}
        </p>
        <button
          onClick={toggleExpand}
          className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center gap-2"
        >
          {isExpanded ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Hide
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Show Logs
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 overflow-x-auto -mx-6 border-t dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-sm font-medium">No SMS logs found</p>
              <p className="text-xs mt-1">SMS sent to this customer will appear here</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest bg-gray-50/50 dark:bg-slate-800/30">
                <tr>
                  <th className="px-6 py-3 font-black">Date</th>
                  <th className="px-6 py-3 font-black">Message</th>
                  <th className="px-6 py-3 font-black">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {formatDate(log.created_at)}
                      </span>
                    </td>
                    <td className="px-6 py-4 relative group">
                      <div className="max-w-xs">
                        <p className="text-xs text-gray-900 dark:text-white line-clamp-2">
                          {log.message}
                        </p>
                        {log.error_message && (
                          <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">
                            Error: {log.error_message}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all"
                        title="View full message"
                        aria-label="View full message"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          log.status === 'success'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="SMS Message Details"
        maxWidth="max-w-lg"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black mb-1">Phone</p>
                <p className="text-sm font-mono text-gray-900 dark:text-white break-all">{selectedLog.phone || '-'}</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black mb-1">Status</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white uppercase">{selectedLog.status}</p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black mb-2">Full Message</p>
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words leading-relaxed">
                {selectedLog.message || '-'}
              </p>
            </div>

            {selectedLog.error_message && (
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-red-500 font-black mb-1">Provider Error</p>
                <p className="text-xs text-red-700 dark:text-red-300 break-words">{selectedLog.error_message}</p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-black uppercase"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default SmsLogsCard;
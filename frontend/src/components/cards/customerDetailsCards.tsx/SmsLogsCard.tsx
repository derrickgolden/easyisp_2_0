import { useState, useEffect } from "react";
import { Card } from "../../UI";
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
      console.log('Fetched SMS logs:', response);
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
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
                    <td className="px-6 py-4">
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
    </Card>
  );
};

export default SmsLogsCard;
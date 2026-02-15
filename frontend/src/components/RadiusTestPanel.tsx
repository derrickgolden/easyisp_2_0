import React, { useState } from 'react';
import { radiusApi } from '../services/radiusService';

interface RadiusTestResult {
  success: boolean;
  message: string;
  customer?: any;
  status: string;
  timestamp: string;
}

export const RadiusTestPanel: React.FC<{ customers: any[] }> = ({ customers }) => {
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [testResults, setTestResults] = useState<RadiusTestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [manualUsername, setManualUsername] = useState('');
  const [manualPassword, setManualPassword] = useState('');

  const handleTestCustomer = async (customerId: string) => {
    const customer = customers.find((c: any) => c.id === customerId);
    if (!customer) {
      setTestResults((prev) => [
        {
          success: false,
          message: 'Customer not found',
          status: 'Error',
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
      return;
    }

    setIsLoading(true);
    try {
      const result = await radiusApi.testAuthentication(
        customer.radiusUsername,
        customer.radiusPassword
      );

      setTestResults((prev) => [
        {
          ...result,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (error) {
      setTestResults((prev) => [
        {
          success: false,
          message: String(error),
          status: 'Error',
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualTest = async () => {
    if (!manualUsername || !manualPassword) {
      alert('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    try {
      const result = await radiusApi.testAuthentication(manualUsername, manualPassword);

      setTestResults((prev) => [
        {
          ...result,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (error) {
      setTestResults((prev) => [
        {
          success: false,
          message: String(error),
          status: 'Error',
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 space-y-6">
      <div>
        <h3 className="text-xl font-black text-white mb-4">🛜 RADIUS WiFi Authentication Test</h3>
        
        {/* Quick Test */}
        <div className="space-y-4 mb-6 p-4 bg-slate-800/50 rounded-xl">
          <label className="block text-sm font-bold text-slate-300">Select Customer to Test</label>
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white"
          >
            <option value="">-- Choose a customer --</option>
            {customers.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} ({c.radiusUsername}) - {c.status}
              </option>
            ))}
          </select>
          <button
            onClick={() => selectedCustomer && handleTestCustomer(selectedCustomer)}
            disabled={!selectedCustomer || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition"
          >
            {isLoading ? 'Testing...' : 'Test WiFi Access'}
          </button>
        </div>

        {/* Manual Test */}
        <div className="space-y-4 p-4 bg-slate-800/50 rounded-xl">
          <label className="block text-sm font-bold text-slate-300">Manual Credentials Test</label>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="RADIUS Username"
              value={manualUsername}
              onChange={(e) => setManualUsername(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white placeholder-slate-500"
            />
            <input
              type="password"
              placeholder="RADIUS Password"
              value={manualPassword}
              onChange={(e) => setManualPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white placeholder-slate-500"
            />
            <button
              onClick={handleManualTest}
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition"
            >
              {isLoading ? 'Authenticating...' : 'Authenticate'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {testResults.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-300">Test Results ({testResults.length})</h4>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {testResults.map((result, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  result.success
                    ? 'bg-green-900/30 border-green-700 text-green-300'
                    : 'bg-red-900/30 border-red-700 text-red-300'
                }`}
              >
                <div className="font-mono text-xs">
                  <div className="font-bold">{result.status}</div>
                  <div>{result.message}</div>
                  {result.customer && (
                    <div className="text-slate-300 mt-1">
                      👤 {result.customer.name} | 📍 {result.customer.ip_address}
                    </div>
                  )}
                  <div className="text-slate-500 text-xs mt-1">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

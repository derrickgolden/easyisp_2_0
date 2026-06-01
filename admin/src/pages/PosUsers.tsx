import React, { useEffect, useState } from 'react';
import { ApiError, posUsersApi } from '../services/apiService';
import { PosUser } from '../types';

const PosUsers: React.FC = () => {
  const [users, setUsers] = useState<PosUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await posUsersApi.getAll();
      const list = Array.isArray(response) ? response : response?.data ?? [];
      setUsers(list as PosUser[]);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to load users');
      } else {
        setError('Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleStatus = async (user: PosUser) => {
    setTogglingId(user.id);
    setError(null);

    try {
      await posUsersApi.toggleStatus(user.id);
      setUsers((prevUsers) =>
        prevUsers.map((item) =>
          item.id === user.id
            ? { ...item, status: !item.status }
            : item
        )
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to update user status');
      } else {
        setError('Failed to update user status');
      }
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">POS Users Status</h1>
        <p className="text-slate-500 mt-1">List all users and toggle status true/false from laravel_pos database.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading users...</div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600">{error}</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">First Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 text-sm text-slate-700">{user.id}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{user.first_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{user.last_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{user.email || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{user.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                          user.status ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {user.status ? 'true' : 'false'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={togglingId === user.id}
                        onClick={() => handleToggleStatus(user)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 ${
                          user.status
                            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        }`}
                      >
                        {togglingId === user.id
                          ? 'Updating...'
                          : user.status
                            ? 'Set False'
                            : 'Set True'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PosUsers;

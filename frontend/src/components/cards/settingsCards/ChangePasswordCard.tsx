import { useState } from "react";
import { Card } from "../../UI";
import { authApi, usersApi } from "../../../services/apiService";
import { STORAGE_KEYS } from "../../../constants/storage";
import { toast } from "sonner";

const ChangePasswordCard = () => {
    const [passwordForm, setPasswordForm] = useState({
        current: '',
        next: '',
        confirm: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChangePassword = async () => {
        setError(null);

        if (!passwordForm.current.trim() || !passwordForm.next.trim() || !passwordForm.confirm.trim()) {
        const message = 'All password fields are required.';
        setError(message);
        toast.error(message);
        return;
        }

        if (passwordForm.next !== passwordForm.confirm) {
        const message = 'New password and confirmation do not match.';
        setError(message);
        toast.error(message);
        return;
        }

        if (passwordForm.next.length < 6) {
        const message = 'New password must be at least 6 characters.';
        setError(message);
        toast.error(message);
        return;
        }

        if (passwordForm.current === passwordForm.next) {
        const message = 'New password must be different from the current password.';
        setError(message);
        toast.error(message);
        return;
        }

        const savedUser = localStorage.getItem(STORAGE_KEYS.AUTH);
        if (!savedUser) {
            const message = 'No authenticated user found. Please log in again.';
            setError(message);
            toast.error(message);
            return;
        }

        const user = JSON.parse(savedUser) as { id?: string; email?: string };
        if (!user?.id || !user?.email) {
            const message = 'Missing user details. Please log in again.';
            setError(message);
            toast.error(message);
            return;
        }

        setIsLoading(true);
        try {
        await authApi.login(user.email, passwordForm.current);
        await usersApi.update(String(user.id), { password: passwordForm.next });

        setPasswordForm({ current: '', next: '', confirm: '' });
        toast.success('Password updated successfully. Logging you out...');

        try {
          await authApi.logout();
        } finally {
          localStorage.removeItem(STORAGE_KEYS.AUTH);
          setTimeout(() => window.location.reload(), 800);
        }
        } catch (err: any) {
            const message = err?.message || 'Failed to update password.';
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto py-10 space-y-6">
            <Card title="Update Access Key">
              <div className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-xl text-center font-bold">
          {error}
          </div>
        )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Existing Password</label>
                  <input 
                    type="password" 
                    value={passwordForm.current} 
                    onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })} 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" 
                    placeholder="••••••••" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">New Security Key</label>
                  <input 
                    type="password" 
                    value={passwordForm.next} 
                    onChange={e => setPasswordForm({ ...passwordForm, next: e.target.value })} 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" 
                    placeholder="••••••••" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Confirm Key</label>
                  <input 
                    type="password" 
                    value={passwordForm.confirm} 
                    onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} 
                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" 
                    placeholder="••••••••" 
                  />
                </div>
                <button 
                  type="button" 
                  onClick={handleChangePassword} 
                  disabled={isLoading}
                  className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-60"
                >
                  {isLoading ? 'Updating...' : 'Update Authorization Key'}
                </button>
              </div>
            </Card>
        </div>
    )
}

export default ChangePasswordCard;
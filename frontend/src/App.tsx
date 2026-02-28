
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { SitesPage } from './pages/SitesPage';
import { AccessControlPage } from './pages/AccessControlPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { PackagesPage } from './pages/PackagesPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ReportsPage } from './pages/ReportsPage';
import { LeadsPage } from './pages/LeadsPage';
import { TicketsPage } from './pages/TicketsPage';
import { authApi, setAuthToken, getAuthToken, ApiError } from './services/apiService';
import { AdminUser } from './types';

import { toast } from 'sonner';
import NotesTemplate from './components/cards/settingsCards/NotesTemplate';
import { navItems } from './utils/navItems';

const AUTH_KEY = 'easy-tech-auth';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('easy-tech-theme') || 'light');
  
  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('easy-tech-theme', theme);
  }, [theme]);
  
  const currentRole = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.role) return currentUser.role;
  }, [currentUser]);

  const userPermissions = useMemo(() => {
    if (!currentUser) return [] as string[];
    if (currentUser.isSuperAdmin) return ['*'];
    const rawPerms = (currentRole?.permissions || []) as any[];
    return rawPerms
      .map((perm) => (typeof perm === 'string' ? perm : perm?.name))
      .filter((perm): perm is string => Boolean(perm));
  }, [currentUser, currentRole]);

  const hasPermission = (permId: string) => {
    if (!currentUser) return false;
    if (currentUser.isSuperAdmin) return true;
    return userPermissions.includes(permId);
  };

  const hasAnyPermission = (permIds: string[]) => {
    if (!currentUser) return false;
    if (currentUser.isSuperAdmin) return true;
    return permIds.some(p => userPermissions.includes(p));
  };

  const canAccessPerm = (perm?: string | string[]) => {
    if (!perm) return true;
    if (Array.isArray(perm)) return hasAnyPermission(perm);
    return hasPermission(perm);
  };

  const filteredNavItems = useMemo(() => {
    return navItems
      .map(item => {
        if (!item.subItems) return item;
        const filteredSub = item.subItems.filter(sub => canAccessPerm(sub.perm));
        return { ...item, subItems: filteredSub };
      })
      .filter(item => {
        if (item.subItems) return item.subItems.length > 0;
        return canAccessPerm(item.perm);
      });
  }, [navItems, userPermissions, currentUser]);

  const RequirePermission: React.FC<{ perms: string[]; children: React.ReactNode }> = ({ perms, children }) => {
    if (currentUser?.isSuperAdmin) return <>{children}</>;
    if (hasAnyPermission(perms)) return <>{children}</>;
    return <Navigate to="/dashboard" replace />;
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    toast.success(message);
  };

  const handleLogin = async (email: string, pass: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await authApi.login(email, pass);
      const roleFromAuth = result.role || null;
      const user: AdminUser = {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone || '',
        role_id: result.user.role_id,
        status: result.user.status,
        last_login: new Date().toLocaleString(),
        password: '',
        isSuperAdmin: result.user.is_super_admin || false,
        role: roleFromAuth || undefined,
      };
      console.log("Login successful, user data:", user);
      setCurrentUser(user);
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      showToast(`Authorized as ${user.name}`);
      
      // Load initial data after login
    } catch (error) {
      if (error instanceof ApiError) {
        setAuthError(error.message);
        showToast(error.message, 'error');
      } else {
        setAuthError('Login failed. Please try again.');
        showToast('Login failed', 'error');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      console.log("Logging out...");
      await authApi.logout();
      console.log("Logging out...");
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      console.log("Logged out...");
      setCurrentUser(null);
      localStorage.removeItem(AUTH_KEY);
      setAuthToken(null);
      showToast("Logged out safely", "info");
    }
  };

  // Load auth token on mount
  useEffect(() => {
    const token = getAuthToken();
    if (token && currentUser) {
      // User is still logged in
    }
  }, []);
console.log("Rendering App, currentUser:");
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} isLoading={authLoading} error={authError} />;
  }

  return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} isLoading={authLoading} error={authError} />} />
        
        {/* Protected Routes */}
        <Route path="/*" element={
          <div className="flex h-screen overflow-hidden">
            <Layout 
              navItems={filteredNavItems} 
              theme={theme} 
              toggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
              currentUser={currentUser} 
              onLogout={handleLogout}
            >
              <Routes>
                {/* Dashboard */}
                <Route path="/dashboard" element={<Dashboard />} />
                
                {/* Management Routes */}
                <Route path="/management/sites" element={
                  <RequirePermission perms={['view-sites']}>
                    <SitesPage />
                  </RequirePermission>
                } />
                <Route path="/management/packages" element={
                  <RequirePermission perms={['view-packages']}>
                    <PackagesPage />
                  </RequirePermission>
                } />
                
                {/* CRM Routes */}
                <Route path="/crm/customers" element={
                  <RequirePermission perms={['view-customers']}>
                    <CustomersPage />
                  </RequirePermission> }
                  />
                <Route path="/crm/customers/:customerId" element={
                  <RequirePermission perms={['view-customer-details']}>
                    <CustomerDetailPage />
                  </RequirePermission>
                } />
                <Route path="/crm/leads" element={
                  <RequirePermission perms={['view-leads']}>
                    <LeadsPage />
                  </RequirePermission> } 
                  />
                <Route path="/crm/tickets" element={
                  <RequirePermission perms={['view-tickets']}>
                    <TicketsPage />
                  </RequirePermission> } 
                  />
                
                {/* Revenue Routes */}
                <Route path="/revenue/payments" element={
                  <RequirePermission perms={['view-payments']}>
                    <PaymentsPage />
                  </RequirePermission>
                } />
                <Route path="/revenue/transactions" element={
                  <RequirePermission perms={['view-transactions']}>
                    <TransactionsPage />
                  </RequirePermission>
                } />
                <Route path="/revenue/invoices" element={
                  <RequirePermission perms={['view-invoices']}>
                    <InvoicesPage />
                  </RequirePermission>
                } />
                <Route path="/revenue/expenses" element={
                  <RequirePermission perms={['view-expenses']}>
                    <ExpensesPage />
                  </RequirePermission>
                } />
                <Route path="/revenue/reports" element={
                  <RequirePermission perms={['view-reports']}>
                    <ReportsPage />
                  </RequirePermission>
                } />
                
                {/* Settings Routes */}
                <Route path="/settings/access-control" element={
                  <RequirePermission perms={['view-admins', 'view-roles']}>
                    <AccessControlPage
                      canManageAdmins={hasPermission('manage-admins')}
                      canManageRoles={hasPermission('manage-roles')}
                    />
                  </RequirePermission>
                } />
                <Route path='/settings/notes-template' element={
                  <RequirePermission perms={['view-templates']}>
                    <NotesTemplate />
                  </RequirePermission>
                } />
                <Route path="/settings/*" element={
                  <RequirePermission perms={['system-settings', 'view-templates', 'manage-templates']}>
                    <SettingsPage onSave={(msg) => showToast(msg)} />
                  </RequirePermission>
                } />
                
                {/* Default redirect */}
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="*" element={<Navigate to="/dashboard" />} />
              </Routes>
            </Layout>
          </div>
        } />
      </Routes>

  );
};

export default App;
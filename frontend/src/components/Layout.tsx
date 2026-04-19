import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminUser } from '../types';
import Footer from './modals/FooterModal';
import { organizationApi } from '../services/apiService';

interface LayoutProps {
  navItems: NavItem[];
  theme: string;
  toggleTheme: () => void;
  children: React.ReactNode;
  currentUser: AdminUser | null;
  onLogout: () => void;
}

interface NavSubItem {
  id: string;
  label: string;
  perm?: string | string[];
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  perm?: string | string[];
  subItems?: NavSubItem[];
}

export const Layout: React.FC<LayoutProps> = ({ 
  navItems, theme, toggleTheme, children, currentUser, onLogout
}) => {
  const EASYTECH_LOGO = '/EasyTech.svg';
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSubTab, setActiveSubTab] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [organizationName, setOrganizationName] = useState('EasyTech');
  const [organizationLogo, setOrganizationLogo] = useState(EASYTECH_LOGO);
  const [organizationStatus, setOrganizationStatus] = useState<'active' | 'suspended'>('active');
  const [latestBillStatus, setLatestBillStatus] = useState<string | null>(null);
  const [latestBillSnapshotMonth, setLatestBillSnapshotMonth] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    if (pathParts[0]) setActiveTab(pathParts[0]);
    setActiveSubTab(pathParts[1] || '');
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsSidebarOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchOrganizationBranding = async () => {
      try {
        const [response, billingResponse] = await Promise.all([
          organizationApi.get(),
          organizationApi.getLicenseBilling(),
        ]);
        const settings = response?.settings || {};
        const general = settings.general || {};
        const logo = general.business_logo || '';
        const legalName = general.isp_legal_name || response?.name || 'EasyTech';
        setOrganizationName(legalName);
        setOrganizationLogo(logo || EASYTECH_LOGO);
        setOrganizationStatus(response?.status === 'suspended' ? 'suspended' : 'active');
        setLatestBillStatus(billingResponse?.current?.status || null);
        setLatestBillSnapshotMonth(billingResponse?.current?.snapshot_month || null);
      } catch (error) {
        console.error('Failed to fetch organization branding:', error);
        setOrganizationName('EasyTech');
        setOrganizationLogo(EASYTECH_LOGO);
        setOrganizationStatus('active');
        setLatestBillStatus(null);
        setLatestBillSnapshotMonth(null);
      }
    };
    fetchOrganizationBranding();
  }, []);

  const getExpiryDeadline = () => {
    if (!latestBillSnapshotMonth) return null;

    const snapshotDate = new Date(latestBillSnapshotMonth);
    if (Number.isNaN(snapshotDate.getTime())) return null;

    return new Date(
      snapshotDate.getFullYear(),
      snapshotDate.getMonth() + 1,
      5,
      10,
      0,
      0,
      0,
    );
  };

  const getRemainingTimeLabel = () => {
    const deadline = getExpiryDeadline();
    if (!deadline) return null;

    const diffMs = deadline.getTime() - currentTime.getTime();
    if (diffMs <= 0) return 'Expiry due now';

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const statusLabel = organizationStatus === 'suspended' ? 'Expired' : 'Active';
  const showBillingCountdown = organizationStatus === 'active' && latestBillStatus !== 'paid';
  const remainingTimeLabel = showBillingCountdown ? getRemainingTimeLabel() : null;

  const getSubItemLabel = () => {
    if (!activeSubTab) return '';
    const item = navItems.find(i => i.id === activeTab);
    const sub = item?.subItems?.find(s => s.id === activeSubTab);
    return sub ? ` / ${sub.label}` : '';
  };

  const shouldSubItemsBeOpen = (itemId: string) => {
    if (itemId === 'management' || itemId === 'crm' || itemId === 'revenue') return true;
    return activeTab === itemId;
  };

  return (
    <div className="min-h-dvh w-full flex bg-gray-50 dark:bg-slate-950 transition-all duration-300 font-sans">
      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-30 lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          bg-slate-900 text-white flex flex-col h-full fixed lg:relative z-40 shadow-2xl transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0 w-72 lg:w-64' : '-translate-x-full lg:translate-x-0 w-72 lg:w-20'}
        `}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-8 h-8 flex-shrink-0 bg-gray-100 rounded-lg flex items-center justify-center font-bold shadow-lg shadow-blue-500/20">
              <img
                src={organizationLogo}
                alt="Logo"
                className="w-full h-full object-contain"
                onError={() => setOrganizationLogo(EASYTECH_LOGO)}
              />
            </div>
            {(isSidebarOpen || window.innerWidth < 1024) && (
              <div className="min-w-0 flex-1">

              <span className="block truncate font-bold text-lg tracking-tight">
                {organizationName}
              </span>
              <span className={`block text-xs font-semibold uppercase tracking-wider ${organizationStatus === 'suspended' ? 'text-red-400' : 'text-emerald-300'}`}>
                {statusLabel}
              </span>
              {remainingTimeLabel && (
                <span className="block text-[11px] text-slate-400">
                  Unpaid Bill: {remainingTimeLabel}
                </span>
              )}
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-slate-800 rounded-lg text-slate-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-1 py-2 scrollbar-hide">
          {navItems.map(item => (
            <div key={item.id}>
              <button
                onClick={() => { 
                  setActiveTab(item.id);
                  if (!item.subItems) {
                    navigate(`/${item.id}`);
                  } else {
                    const belongs = item.subItems.some(s => s.id === activeSubTab);
                    const targetSub = belongs ? activeSubTab : item.subItems[0].id;
                    navigate(`/${item.id}/${targetSub}`);
                  }
                  if (!item.subItems && window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all duration-200 ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <div className="w-5 h-5 flex-shrink-0">{item.icon}</div>
                {(isSidebarOpen || window.innerWidth < 1024) && <span className="text-sm font-medium">{item.label}</span>}
              </button>
              {(isSidebarOpen || window.innerWidth < 1024) && item.subItems && shouldSubItemsBeOpen(item.id) && (
                <div className="mt-1 ml-6 space-y-1 border-l border-slate-700/50 pl-4 animate-in slide-in-from-top-2">
                  {item.subItems.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        navigate(`/${item.id}/${sub.id}`);
                        if (window.innerWidth < 1024) setIsSidebarOpen(false);
                      }}
                      className={`w-full text-left py-2 text-xs transition-colors rounded-r-lg pl-2 ${activeTab === item.id && activeSubTab === sub.id ? 'text-blue-400 font-bold bg-blue-500/5' : 'text-slate-500 hover:text-white hover:bg-slate-800/50'}`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {(isSidebarOpen || window.innerWidth < 1024) && (
          <div className="p-4 border-t border-slate-800">
            <button 
              onClick={onLogout}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-red-600/20 hover:text-red-400 transition-all group"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        )}
      </aside>

      {/* Content Column */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="flex-shrink-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 px-4 lg:px-6 py-4 flex items-center justify-between transition-theme">
          <div className="flex items-center space-x-3 lg:space-x-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center"
              aria-label="Toggle Navigation"
            >
              <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg lg:text-xl font-bold capitalize text-gray-800 dark:text-white tracking-tight truncate max-w-[150px] sm:max-w-none">
               {activeTab.replace('-', ' ')} <span className="text-gray-400 font-normal hidden sm:inline">{getSubItemLabel()}</span>
            </h1>
          </div>
          <div className="flex items-center space-x-2 lg:space-x-4">
             <button onClick={toggleTheme} className="p-2 lg:p-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:scale-110 transition-transform">
                {theme === 'dark' ? '☀️' : '🌙'}
             </button>
             <div className="flex items-center space-x-2 lg:space-x-3 pl-2 lg:pl-4 border-l border-gray-100 dark:border-slate-800">
               <div className="text-right hidden md:block">
                 <p className="text-xs font-bold text-gray-900 dark:text-white leading-none">{currentUser?.name || 'User'}</p>
                 <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-tighter">Admin</p>
               </div>
               <div className="w-8 h-8 lg:w-9 lg:h-9 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 font-black shadow-sm flex-shrink-0">
                 {currentUser?.name?.charAt(0) || 'A'}
               </div>
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="p-4 lg:p-10 max-w-7xl mx-auto w-full animate-in fade-in duration-500 pb-10 min-h-full flex flex-col">
            <div className="flex-1">
              {children}
            </div>
            <Footer />
          </div>
        </main>
      </div>
    </div>
  );
};
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Stethoscope, 
  UserCircle, 
  Calendar, 
  Video, 
  FileText, 
  CreditCard, 
  Store, 
  Settings,
  LogOut,
  Menu,
  X,
  Activity,
  Users,
  ShieldCheck,
  MessageSquare,
  History,
  Sun,
  Moon
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import CallNotification from './CallNotification';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getNavItems = (role: string, subscribed: boolean) => {
  const items = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Stethoscope, label: 'Diagnosis AI', path: '/diagnosis' },
    { icon: UserCircle, label: role === 'Doctor' ? 'Doctor Profile' : 'Patient Profile', path: '/profile' },
    { icon: MessageSquare, label: 'Messages', path: '/messages' },
    { icon: Calendar, label: 'Appointments', path: '/appointments' },
    { icon: Users, label: 'My Patients', path: '/patients', doctorOnly: true },
    { icon: Video, label: 'Consultation', path: '/consultation' },
    { icon: History, label: 'Call History', path: '/call-history' },
    { icon: FileText, label: 'Prescriptions', path: '/prescriptions' },
    { icon: Store, label: 'Medical Store', path: '/store' },
    { icon: CreditCard, label: 'Payments', path: '/payments' },
    { icon: ShieldCheck, label: 'Subscription', path: '/subscription' },
    { icon: Users, label: 'Doctor Profiles', path: '/doctors' },
  ];

  if (role === 'Admin') {
    return items;
  }

  if (role === 'Doctor') {
    // Doctors don't need Diagnosis AI (it's for patients) but they need all other features
    return items.filter(item => !['/diagnosis'].includes(item.path || ''));
  }
  
  return items.filter(item => !item.doctorOnly);
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(() => window.innerWidth >= 768);
  const location = useLocation();
  const { user, profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navItems = getNavItems(profile?.role || 'Patient', profile?.subscribed || false);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Collapse sidebar when path changes on mobile
  React.useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-slate-950 flex text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <CallNotification />

      {/* Mobile Drawer Overlay Back-drop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-50",
          "fixed inset-y-0 left-0 md:relative md:flex",
          isSidebarOpen 
            ? "translate-x-0 w-64" 
            : "-translate-x-full md:translate-x-0 md:w-20"
        )}
      >
        <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 dark:bg-emerald-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-100 dark:shadow-none">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            {isSidebarOpen && <span className="font-bold text-xl tracking-tight text-slate-800 dark:text-slate-100">TeleMed AI</span>}
          </div>
          {/* Close button inside sidebar on mobile only */}
          {isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-750 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isComingSoon = 'comingSoon' in item && item.comingSoon;

            if (isComingSoon) {
              return (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl opacity-60 cursor-not-allowed group"
                  )}
                  title="Coming Soon"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    {isSidebarOpen && <span className="text-slate-500 dark:text-slate-400">{item.label}</span>}
                  </div>
                  {isSidebarOpen && (
                    <span className="text-[8px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                      Soon
                    </span>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
                  isActive 
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-450 font-semibold" 
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-transform duration-250 group-hover:scale-105", isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-650 dark:group-hover:text-slate-300")} />
                {isSidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800/60 space-y-2">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isSidebarOpen && <span>Logout</span>}
          </button>
          
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden md:flex w-full items-center gap-3 px-3 py-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-all"
          >
            {isSidebarOpen ? <X className="w-5 h-5 shrink-0" /> : <Menu className="w-5 h-5 shrink-0" />}
            {isSidebarOpen && <span>Collapse Menu</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-8 shrink-0 transition-colors duration-200 shadow-sm z-10 w-full">
          <div className="flex items-center gap-3.5">
            {/* Hamburger helper toggler for mobile & collapsed states */}
            <button
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350 rounded-xl border border-slate-200 dark:border-slate-700/85 transition-all shadow-xs"
              title="Toggle Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight transition-colors">
              {navItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Elegant Global Dark/Light Theme Switching Pin with tooltip */}
            <button
              onClick={toggleTheme}
              className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-105 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-705 rounded-xl transition-all shadow-xs active:scale-95"
              title={theme === 'light' ? 'Switch to Dark Mode for Nighttime Navigation' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 text-indigo-600" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500 animate-pulse" />
              )}
            </button>

            {/* User Account Info */}
            <div className="text-right hidden sm:block">
              <div className="flex items-center gap-2 justify-end">
                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{(profile?.email || 'User').split('@')[0]}</p>
                {profile?.subscribed && profile?.role !== 'Admin' && (
                  <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-black rounded uppercase tracking-tighter">
                    PRO
                  </span>
                )}
                {profile?.role === 'Admin' && (
                  <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded uppercase tracking-tighter">
                    ADMIN
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{profile?.role}</p>
            </div>
            
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-850 border-2 border-white dark:border-slate-850 shadow-xs overflow-hidden flex items-center justify-center text-slate-500 dark:text-slate-400 font-extrabold text-sm shrink-0">
              {profile?.email?.[0].toUpperCase() || 'U'}
            </div>
          </div>
        </header>
        
        {/* Dynamic Canvas Container with responsive padding */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-8 bg-slate-50/50 dark:bg-slate-950 transition-colors duration-200">
          {children}
        </div>
      </main>
    </div>
  );
}

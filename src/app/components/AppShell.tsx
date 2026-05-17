import React from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../auth';
import { User as UserIcon, LogOut, ArrowLeft } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';
import { toast } from 'sonner';

export function AppShell() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    const handleRateLimit = (e: Event) => {
      const customEvent = e as CustomEvent;
      toast.warning(customEvent.detail || "Rate limit exceeded. Please wait.");
    };
    window.addEventListener('api:ratelimit', handleRateLimit);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('api:ratelimit', handleRateLimit);
    };
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Determine if we are not at the root role path to show back button
  const isRootRolePath = location.pathname === '/admin' || location.pathname === '/manager' || location.pathname === '/agent';

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-slate-800 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 flex items-center justify-between px-4 h-16 shadow-sm">
        <div className="flex items-center gap-3">
          {!isRootRolePath ? (
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
              C
            </div>
          )}
          <span className="font-semibold text-lg text-slate-900 tracking-tight">ConstrucTrack</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Notification bell for all roles */}
          <NotificationPanel />

          <div className="relative" ref={userMenuRef}>
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold text-sm border-2 border-transparent hover:border-blue-200 transition-all">
                {user.name.charAt(0)}
              </div>
            </button>
            
            {isUserMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden transform origin-top-right transition-all">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                  <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-blue-600 mt-0.5">{user.role}</p>
                </div>
                <div className="p-1">
                  <button 
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }} 
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-5xl mx-auto md:px-6">
        <Outlet />
      </main>
    </div>
  );
}

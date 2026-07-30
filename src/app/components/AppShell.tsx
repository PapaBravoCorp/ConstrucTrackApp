import React from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../auth';
import { LogOut, ArrowLeft, HardHat, Loader2, CircleUserRound, HelpCircle } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';
import { AppSidebar } from './AppSidebar';
import { BrandedLoader } from './BrandedLoader';
import { CommandPalette } from './CommandPalette';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './ui/sidebar';
import { toast } from 'sonner';

/** Role badge color mapping */
const ROLE_BADGE_STYLES: Record<string, string> = {
  Admin: 'bg-purple-100 text-purple-700 border-purple-200',
  Manager: 'bg-blue-100 text-blue-700 border-blue-200',
  Agent: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

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
    return <BrandedLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Determine if we are not at the root role path to show back button
  const isRootRolePath = location.pathname === '/admin' || location.pathname === '/manager' || location.pathname === '/agent';
  const roleBadgeStyle = ROLE_BADGE_STYLES[user.role] || ROLE_BADGE_STYLES.Agent;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-col min-h-screen bg-gray-50 text-slate-800 font-sans">
          <header className="bg-white border-b border-gray-200 sticky top-0 z-10 flex items-center justify-between px-4 h-16 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Sidebar toggle trigger for mobile / collapse */}
              <SidebarTrigger className="-ml-1 shrink-0" />
              {!isRootRolePath ? (
                <button onClick={() => navigate(-1)} className="p-2 -ml-1 rounded-full hover:bg-gray-100 transition-colors shrink-0">
                  <ArrowLeft className="w-5 h-5 text-gray-700" />
                </button>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-md shrink-0 md:hidden">
                  <HardHat className="w-4 h-4 text-white" />
                </div>
              )}
              <span className="font-bold text-lg text-slate-900 tracking-tight shrink-0">
                Construc<span className="text-orange-500">Track</span>
              </span>
              {/* Role badge */}
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${roleBadgeStyle}`}
                role="status"
                aria-label={`Current role: ${user.role}`}
              >
                {user.role}
              </span>
              {/* Product tagline — hidden on small screens */}
              <span className="hidden lg:inline text-xs text-gray-400 font-medium truncate ml-1">
                Track every milestone from planning to handover
              </span>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {/* Command palette trigger + Ctrl+K shortcut */}
              <CommandPalette />
              {/* Notification bell for all roles */}
              <NotificationPanel />

              <div className="relative" ref={userMenuRef}>
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors flex items-center gap-2"
                  title={user.name}
                >
                  <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold text-sm border-2 border-transparent hover:border-blue-200 transition-all">
                    {user.name.charAt(0)}
                  </div>
                </button>
                
                {isUserMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden transform origin-top-right transition-all">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                      <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                      <p className={`text-[10px] uppercase tracking-wider font-bold mt-0.5 ${
                        user.role === 'Admin' ? 'text-purple-600' :
                        user.role === 'Manager' ? 'text-blue-600' :
                        'text-emerald-600'
                      }`}>{user.role}</p>
                    </div>
                    <div className="p-1">
                      <button 
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          toast.info('Profile settings coming soon.');
                        }} 
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2 transition-colors font-medium"
                      >
                        <CircleUserRound className="w-4 h-4 text-gray-500" /> Profile
                      </button>
                      <button 
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          toast.info('Help & documentation coming soon.');
                        }} 
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2 transition-colors font-medium"
                      >
                        <HelpCircle className="w-4 h-4 text-gray-500" /> Help
                      </button>
                      <div className="border-t border-gray-100 my-1"></div>
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
      </SidebarInset>
    </SidebarProvider>
  );
}


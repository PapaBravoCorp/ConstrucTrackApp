import React from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../auth';
import { User as UserIcon, LogOut, ArrowLeft } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';

export function AppShell() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

          <div className="relative group">
            <button className="p-2 rounded-full hover:bg-gray-100 transition-colors flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-medium text-sm">
                {user.name.charAt(0)}
              </div>
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
              <button onClick={logout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center gap-2">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-5xl mx-auto md:px-6">
        <Outlet />
      </main>
    </div>
  );
}

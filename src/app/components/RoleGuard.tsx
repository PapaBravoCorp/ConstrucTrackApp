import React from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth';
import type { Role } from '../api';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
  allowedRole: Role;
  children: React.ReactNode;
}

/**
 * Route guard that ensures only users with the correct role can access child routes.
 * - Not authenticated → redirect to login (/)
 * - Wrong role → redirect to the user's correct dashboard
 * - Correct role → render children
 */
export function RoleGuard({ allowedRole, children }: RoleGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role !== allowedRole) {
    return <Navigate to={`/${user.role.toLowerCase()}`} replace />;
  }

  return <>{children}</>;
}

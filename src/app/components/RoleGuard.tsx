import React, { useEffect, useRef } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth';
import type { Role } from '../api';
import { toast } from 'sonner';
import { BrandedLoader } from './BrandedLoader';

interface RoleGuardProps {
  allowedRole: Role;
  children: React.ReactNode;
}

/**
 * Route guard that ensures only users with the correct role can access child routes.
 * - Not authenticated → redirect to login (/)
 * - Wrong role → redirect to the user's correct dashboard (with toast notification)
 * - Correct role → render children
 */
export function RoleGuard({ allowedRole, children }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const hasToasted = useRef(false);

  // Fire a toast notification when redirecting due to wrong role
  const isWrongRole = !loading && user && user.role !== allowedRole;
  useEffect(() => {
    if (isWrongRole && !hasToasted.current) {
      hasToasted.current = true;
      toast.info("You don't have access to this area. Redirecting to your dashboard.");
    }
  }, [isWrongRole]);

  if (loading) {
    return <BrandedLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== allowedRole) {
    return <Navigate to={`/${user.role.toLowerCase()}`} replace />;
  }

  return <>{children}</>;
}

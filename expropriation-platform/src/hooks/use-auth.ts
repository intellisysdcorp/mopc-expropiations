'use client';

import { useSession as useNextAuthSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { hasPermission, hasRole } from '@/lib/auth-client';
import clientLogger from '@/lib/client-logger';

interface UseAuthOptions {
  required?: boolean;
  onUnauthenticated?: () => void;
}

export function useAuth(options: UseAuthOptions = {}) {
  const { data: session, status, update } = useNextAuthSession();
  const router = useRouter();
  const { required = false, onUnauthenticated } = options;

  // Auth state
  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated' && session?.user?.isActive;
  const isUnauthenticated = status === 'unauthenticated' || (session?.user && !session.user.isActive);

  // User data
  const user = useMemo(() => {
    if (!session?.user) {return null;}
    return session.user;
  }, [session]);

  // Permission checks
  const permissions = useMemo(() => {
    return user?.permissions || {};
  }, [user]);

  const hasUserPermission = useCallback(
    (permission: string) => {
      if (!user || !permissions) {return false;}
      return hasPermission(permissions, permission);
    },
    [user, permissions]
  );

  const hasUserRole = useCallback(
    (roles: string | string[]) => {
      if (!user) {return false;}
      const allowedRoles = Array.isArray(roles) ? roles : [roles];
      return hasRole(user.role, allowedRoles);
    },
    [user]
  );

  // Role-based checks for common scenarios
  const isSuperAdmin = hasUserRole('super_admin');
  const isDepartmentAdmin = hasUserRole('department_admin');
  const isAnalyst = hasUserRole('analyst');
  const isSupervisor = hasUserRole('supervisor');
  const isObserver = hasUserRole('observer');

  // Permission-based checks
  const canCreateCases = hasUserPermission('canCreate');
  const canReadCases = hasUserPermission('canRead');
  const canUpdateCases = hasUserPermission('canUpdate');
  const canDeleteCases = hasUserPermission('canDelete');
  const canAssignCases = hasUserPermission('canAssign');
  const canSuperviseCases = hasUserPermission('canSupervise');
  const canExportCases = hasUserPermission('canExport');
  const canManageUsers = hasUserPermission('canManageUsers');

  // Actions
  const signOut = useCallback(async () => {
    await nextAuthSignOut({ callbackUrl: '/login' });
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      await update();
    } catch (error: unknown) {
      clientLogger.error(
        'Failed to refresh session:',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }, [update]);

  // Redirect helpers
  const redirectToLogin = useCallback(() => {
    router.push('/login');
  }, [router]);

  const redirectToDashboard = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  // Handle unauthenticated state
  if (required && isUnauthenticated && onUnauthenticated) {
    onUnauthenticated();
  }

  return {
    // State
    session,
    user,
    status,
    isLoading,
    isAuthenticated,
    isUnauthenticated,

    // User info
    userId: user?.id,
    userName: user?.name,
    userEmail: user?.email,
    userRole: user?.role,
    userDepartment: user?.department,
    userDepartmentId: user?.departmentId,
    userAvatar: user?.avatar,
    userPhone: user?.phone,

    // Permissions
    permissions,
    hasPermission: hasUserPermission,
    hasRole: hasUserRole,

    // Role checks
    isSuperAdmin,
    isDepartmentAdmin,
    isAnalyst,
    isSupervisor,
    isObserver,

    // Permission checks
    canCreateCases,
    canReadCases,
    canUpdateCases,
    canDeleteCases,
    canAssignCases,
    canSuperviseCases,
    canExportCases,
    canManageUsers,

    // Actions
    signOut,
    refreshSession,
    redirectToLogin,
    redirectToDashboard,
  };
}

/**
 * Hook that requires authentication - will redirect to login if not authenticated
 */
export function useRequireAuth() {
  const auth = useAuth({ required: true });

  // Auto-redirect to login if not authenticated
  if (!auth.isLoading && !auth.isAuthenticated) {
    auth.redirectToLogin();
  }

  return auth;
}

/**
 * Hook for specific role requirements
 */
export function useRequireRole(roles: string | string[]) {
  const auth = useAuth({ required: true });

  const hasRequiredRole = auth.hasRole(roles);

  // Auto-redirect to dashboard if doesn't have required role
  if (!auth.isLoading && auth.isAuthenticated && !hasRequiredRole) {
    auth.redirectToDashboard();
  }

  return {
    ...auth,
    hasRequiredRole,
  };
}

/**
 * Hook for specific permission requirements
 */
export function useRequirePermission(permission: string) {
  const auth = useAuth({ required: true });

  const hasRequiredPermission = auth.hasPermission(permission);

  // Auto-redirect to dashboard if doesn't have required permission
  if (!auth.isLoading && auth.isAuthenticated && !hasRequiredPermission) {
    auth.redirectToDashboard();
  }

  return {
    ...auth,
    hasRequiredPermission,
  };
}
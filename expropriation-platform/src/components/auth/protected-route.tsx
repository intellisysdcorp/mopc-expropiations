'use client';

import { useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
  roles?: string | string[];
  permissions?: string | string[];
  requireAll?: boolean; // For multiple permissions, require all vs any
}

/**
 * Component that protects routes based on authentication status,
 * roles, and permissions.
 */
export function ProtectedRoute({
  children,
  fallback,
  redirectTo = '/login',
  roles,
  permissions,
  requireAll = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole, hasPermission, redirectToLogin } = useAuth();
  const router = useRouter();

  // Handle redirect for unauthenticated users
  useEffect(() => {
    // Only redirect if NOT loading and NOT authenticated
    if (!isLoading && !isAuthenticated) {
      if (redirectTo === '/login') {
        redirectToLogin();
      } else {
        router.push(redirectTo);
      }
    }
  }, [isAuthenticated, isLoading, redirectTo, router, redirectToLogin]);

  // Check role requirements
  const hasRequiredRole = !roles || hasRole(roles);

  // Check permission requirements
  const hasRequiredPermissions = !permissions || (
    requireAll
      ? (Array.isArray(permissions)
          ? permissions.every(p => hasPermission(p))
          : hasPermission(permissions)
        )
      : (Array.isArray(permissions)
          ? permissions.some(p => hasPermission(p))
          : hasPermission(permissions)
        )
  );

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  // Show access denied if user doesn't have required role or permissions
  if (!hasRequiredRole || !hasRequiredPermissions) {
    const AccessDenied = () => (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center p-6">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-orange-100 rounded-full">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-gray-600 mb-6">
            No tienes los permisos necesarios para acceder a esta página.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => router.back()}
              className="block w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              Volver
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="block w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Ir al Panel Principal
            </button>
          </div>
        </div>
      </div>
    );

    return fallback || <AccessDenied />;
  }

  // Render children if all checks pass
  return <>{children}</>;
}

/**
 * Higher-order component for protecting routes with specific roles
 */
export function withRoleProtection(
  roles: string | string[],
  options: Omit<ProtectedRouteProps, 'roles'> = {}
) {
  return function ProtectedComponent({ children }: { children: ReactNode }) {
    return (
      <ProtectedRoute {...options} roles={roles}>
        {children}
      </ProtectedRoute>
    );
  };
}

/**
 * Higher-order component for protecting routes with specific permissions
 */
export function withPermissionProtection(
  permissions: string | string[],
  options: Omit<ProtectedRouteProps, 'permissions'> = {}
) {
  return function ProtectedComponent({ children }: { children: ReactNode }) {
    return (
      <ProtectedRoute {...options} permissions={permissions}>
        {children}
      </ProtectedRoute>
    );
  };
}

/**
 * Pre-configured protected route components for common use cases
 */

// Super admin only routes
export const SuperAdminRoute = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute roles="super_admin">{children}</ProtectedRoute>
);

// Department admin routes
export const DepartmentAdminRoute = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute roles={['super_admin', 'department_admin']}>
    {children}
  </ProtectedRoute>
);

// Analyst and above routes
export const AnalystRoute = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute roles={['super_admin', 'department_admin', 'analyst']}>
    {children}
  </ProtectedRoute>
);

// Supervisor and above routes
export const SupervisorRoute = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute roles={['super_admin', 'department_admin', 'supervisor']}>
    {children}
  </ProtectedRoute>
);

// Routes requiring case creation permission
export const CaseCreatorRoute = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute permissions="canCreate">{children}</ProtectedRoute>
);

// Routes requiring case management permission
export const CaseManagerRoute = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute permissions={['canCreate', 'canUpdate', 'canRead']} requireAll>
    {children}
  </ProtectedRoute>
);

// User management routes
export const UserManagementRoute = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute permissions="canManageUsers">{children}</ProtectedRoute>
);
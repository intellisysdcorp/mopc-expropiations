'use client';

import { ReactNode } from 'react';
import { SidebarProvider } from '@/hooks/use-sidebar';
import { SidebarLayout } from '@/components/layout/sidebar-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <SidebarLayout>
          {children}
        </SidebarLayout>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
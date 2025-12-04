'use client';

import { useSidebar } from '@/hooks/use-sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Menu, X } from 'lucide-react';

export default function TestSidebarPage() {
  const { isCollapsed, isMobileOpen, toggleSidebar, closeMobileSidebar } = useSidebar();

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Prueba de Sidebar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Estado Sidebar:</span>
              <p>Colapsado: {isCollapsed ? 'Sí' : 'No'}</p>
              <p>Mobile abierto: {isMobileOpen ? 'Sí' : 'No'}</p>
            </div>
            <div className="space-y-2">
              <Button onClick={toggleSidebar} size="sm">
                <Menu className="h-4 w-4 mr-2" />
                Toggle Sidebar
              </Button>
              {isMobileOpen && (
                <Button onClick={closeMobileSidebar} size="sm" variant="outline">
                  <X className="h-4 w-4 mr-2" />
                  Cerrar Mobile
                </Button>
              )}
            </div>
          </div>
          <div className="p-4 bg-gray-100 rounded">
            <p className="text-sm">
              Si puedes ver este contenido y los botones de arriba funcionan,
              el sidebar está correctamente implementado en esta página.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
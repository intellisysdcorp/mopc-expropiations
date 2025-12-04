'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Command,
  Search,
  Plus,
  Download,
  Calendar,
  Settings,
  LogOut,
  Users,
  FileText,
  BarChart3,
  Home,
  ArrowLeft,
  ArrowRight,
  Save,
  Keyboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';

interface KeyboardShortcut {
  id: string;
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  description: string;
  icon?: React.ReactNode;
  action: () => void;
  category: 'navigation' | 'actions' | 'forms' | 'system' | 'search';
  global?: boolean;
}

interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
  shortcuts?: KeyboardShortcut[];
}

export function KeyboardShortcutsProvider({
  children,
  shortcuts: propShortcuts = [],
}: KeyboardShortcutsProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMac, setIsMac] = useState(false);
  const [_isClient, setIsClient] = useState(false);
  const router = useRouter();

  // Default shortcuts
  const defaultShortcuts: KeyboardShortcut[] = useMemo(() => [
    // Navigation
    {
      id: 'dashboard',
      key: 'g',
      ctrlKey: true,
      metaKey: true,
      description: 'Ir al panel principal',
      icon: <Home className="h-4 w-4" />,
      action: () => router.push('/dashboard'),
      category: 'navigation',
      global: true,
    },
    {
      id: 'cases',
      key: 'g',
      ctrlKey: true,
      shiftKey: true,
      description: 'Ir a casos',
      icon: <FileText className="h-4 w-4" />,
      action: () => router.push('/cases'),
      category: 'navigation',
      global: true,
    },
    {
      id: 'users',
      key: 'g',
      ctrlKey: true,
      altKey: true,
      description: 'Ir a usuarios',
      icon: <Users className="h-4 w-4" />,
      action: () => router.push('/users'),
      category: 'navigation',
      global: true,
    },
    {
      id: 'reports',
      key: 'g',
      ctrlKey: true,
      shiftKey: true,
      altKey: true,
      description: 'Ir a reportes',
      icon: <BarChart3 className="h-4 w-4" />,
      action: () => router.push('/reports'),
      category: 'navigation',
      global: true,
    },
    {
      id: 'back',
      key: 'ArrowLeft',
      altKey: true,
      description: 'Navegar atrás',
      icon: <ArrowLeft className="h-4 w-4" />,
      action: () => {
        if (typeof window !== 'undefined') {
          window.history.back();
        }
      },
      category: 'navigation',
      global: true,
    },
    {
      id: 'forward',
      key: 'ArrowRight',
      altKey: true,
      description: 'Navegar adelante',
      icon: <ArrowRight className="h-4 w-4" />,
      action: () => {
        if (typeof window !== 'undefined') {
          window.history.forward();
        }
      },
      category: 'navigation',
      global: true,
    },

    // Actions
    {
      id: 'search',
      key: 'k',
      ctrlKey: true,
      metaKey: true,
      description: 'Búsqueda global',
      icon: <Search className="h-4 w-4" />,
      action: () => {
        // Trigger global search
        const searchButton = document.querySelector('[data-global-search-trigger]') as HTMLButtonElement;
        searchButton?.click();
      },
      category: 'search',
      global: true,
    },
    {
      id: 'create',
      key: 'n',
      ctrlKey: true,
      metaKey: true,
      description: 'Crear nuevo',
      icon: <Plus className="h-4 w-4" />,
      action: () => {
        // Find and click create button
        const createButton = document.querySelector('[data-create-trigger]') as HTMLButtonElement;
        createButton?.click();
      },
      category: 'actions',
      global: true,
    },
    {
      id: 'export',
      key: 'e',
      ctrlKey: true,
      shiftKey: true,
      description: 'Exportar datos',
      icon: <Download className="h-4 w-4" />,
      action: () => {
        const exportButton = document.querySelector('[data-export-trigger]') as HTMLButtonElement;
        exportButton?.click();
      },
      category: 'actions',
      global: true,
    },
    {
      id: 'save',
      key: 's',
      ctrlKey: true,
      metaKey: true,
      description: 'Guardar',
      icon: <Save className="h-4 w-4" />,
      action: () => {
        const saveButton = document.querySelector('[data-save-trigger]') as HTMLButtonElement;
        saveButton?.click();
      },
      category: 'forms',
      global: false,
    },

    // System
    {
      id: 'shortcuts',
      key: '?',
      shiftKey: true,
      description: 'Mostrar atajos de teclado',
      icon: <Keyboard className="h-4 w-4" />,
      action: () => setIsOpen(true),
      category: 'system',
      global: true,
    },
    {
      id: 'settings',
      key: ',',
      ctrlKey: true,
      metaKey: true,
      description: 'Configuración',
      icon: <Settings className="h-4 w-4" />,
      action: () => router.push('/settings'),
      category: 'system',
      global: true,
    },
    {
      id: 'logout',
      key: 'q',
      ctrlKey: true,
      shiftKey: true,
      description: 'Cerrar sesión',
      icon: <LogOut className="h-4 w-4" />,
      action: () => {
        const logoutButton = document.querySelector('[data-logout-trigger]') as HTMLButtonElement;
        logoutButton?.click();
      },
      category: 'system',
      global: true,
    },
    {
      id: 'calendar',
      key: 'c',
      ctrlKey: true,
      shiftKey: true,
      altKey: true,
      description: 'Ver calendario',
      icon: <Calendar className="h-4 w-4" />,
      action: () => {
        // Navigate to calendar tab
        const calendarTab = document.querySelector('[data-calendar-tab]') as HTMLButtonElement;
        calendarTab?.click();
      },
      category: 'navigation',
      global: true,
    },
  ], [router]);

  const shortcuts = useMemo(
    () => [...defaultShortcuts, ...propShortcuts], 
    [defaultShortcuts, propShortcuts]
  );

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if user is typing in input, textarea, or contentEditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('[contenteditable="true"]')
      ) {
        // Only allow global shortcuts when typing
        const globalShortcuts = shortcuts.filter(s => s.global);
        const matchingShortcut = globalShortcuts.find(shortcut => {
          const ctrl = shortcut.ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
          const alt = shortcut.altKey ? event.altKey : !event.altKey;
          const shift = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
          const meta = shortcut.metaKey ? event.metaKey : !event.metaKey;

          return (
            event.key.toLowerCase() === shortcut.key.toLowerCase() &&
            ctrl &&
            alt &&
            shift &&
            meta
          );
        });

        if (matchingShortcut) {
          event.preventDefault();
          matchingShortcut.action();
          return;
        }

        return;
      }

      // Find matching shortcut
      const matchingShortcut = shortcuts.find(shortcut => {
        const ctrl = shortcut.ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const alt = shortcut.altKey ? event.altKey : !event.altKey;
        const shift = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const meta = shortcut.metaKey ? event.metaKey : !event.metaKey;

        return (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrl &&
          alt &&
          shift &&
          meta
        );
      });

      if (matchingShortcut) {
        event.preventDefault();
        matchingShortcut.action();
      }
    },
    [shortcuts]
  );

  // Detect platform on client-side only
  useEffect(() => {
    setIsClient(true);
    setIsMac(window.navigator.platform.includes('Mac'));
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Filter shortcuts based on search
  const filteredShortcuts = shortcuts.filter(shortcut =>
    shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shortcut.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group shortcuts by category
  const shortcutsByCategory = filteredShortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category]!.push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  const categoryNames = {
    navigation: 'Navegación',
    actions: 'Acciones',
    forms: 'Formularios',
    system: 'Sistema',
    search: 'Búsqueda',
  };

  const formatKeybinding = (shortcut: KeyboardShortcut) => {
    const parts = [];
    if (shortcut.ctrlKey) parts.push(isMac ? '⌘' : 'Ctrl');
    if (shortcut.altKey) parts.push('Alt');
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.metaKey && !shortcut.ctrlKey) parts.push('⌘');
    parts.push(shortcut.key.toUpperCase());
    return parts.join(' + ');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            data-shortcuts-trigger
          >
            <Keyboard className="h-4 w-4" />
            <span className="hidden sm:inline">Atajos</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">?</span>
            </kbd>
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Atajos de Teclado</DialogTitle>
            <DialogDescription>
              Navega rápidamente por la plataforma usando atajos de teclado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar atajos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Shortcuts by category */}
            <ScrollArea className="h-[60vh]">
              <div className="space-y-6">
                {Object.entries(shortcutsByCategory).map(([category, categoryShortcuts]) => (
                  <div key={category}>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      {category === 'navigation' && <Home className="h-5 w-5" />}
                      {category === 'actions' && <Plus className="h-5 w-5" />}
                      {category === 'forms' && <Save className="h-5 w-5" />}
                      {category === 'system' && <Settings className="h-5 w-5" />}
                      {category === 'search' && <Search className="h-5 w-5" />}
                      {categoryNames[category as keyof typeof categoryNames]}
                    </h3>
                    <div className="grid gap-2">
                      {categoryShortcuts.map(shortcut => (
                        <div
                          key={shortcut.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {shortcut.icon}
                            <div>
                              <p className="font-medium">{shortcut.description}</p>
                              {shortcut.global && (
                                <Badge variant="secondary" className="text-xs mt-1">
                                  Global
                                </Badge>
                              )}
                            </div>
                          </div>
                          <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-xs font-medium text-muted-foreground">
                            {formatKeybinding(shortcut)}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-center">
              <p className="text-xs text-muted-foreground">
                Tip: Los atajos globales funcionan incluso cuando estás escribiendo en campos de texto
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {children}
    </>
  );
}

// Hook to use keyboard shortcuts in components
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  deps: React.DependencyList = []
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in input, textarea, or contentEditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      const matchingShortcut = shortcuts.find(shortcut => {
        const ctrl = shortcut.ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const alt = shortcut.altKey ? event.altKey : !event.altKey;
        const shift = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const meta = shortcut.metaKey ? event.metaKey : !event.metaKey;

        return (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrl &&
          alt &&
          shift &&
          meta
        );
      });

      if (matchingShortcut) {
        event.preventDefault();
        matchingShortcut.action();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, deps]);
}

// Quick access floating button
export function QuickAccessButton() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const quickActions = [
    {
      icon: <Home className="h-4 w-4" />,
      label: 'Panel',
      key: 'g d',
      action: () => router.push('/dashboard'),
    },
    {
      icon: <FileText className="h-4 w-4" />,
      label: 'Casos',
      key: 'g c',
      action: () => router.push('/cases'),
    },
    {
      icon: <Plus className="h-4 w-4" />,
      label: 'Nuevo',
      key: '⌘ n',
      action: () => {
        const createButton = document.querySelector('[data-create-trigger]') as HTMLButtonElement;
        createButton?.click();
      },
    },
    {
      icon: <Search className="h-4 w-4" />,
      label: 'Buscar',
      key: '⌘ k',
      action: () => {
        const searchButton = document.querySelector('[data-global-search-trigger]') as HTMLButtonElement;
        searchButton?.click();
      },
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg"
            aria-label="Acceso rápido"
          >
            <Command className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {quickActions.map((action, index) => (
            <DropdownMenuItem
              key={index}
              onClick={action.action}
              className="flex items-center gap-3"
            >
              {action.icon}
              <div className="flex-1">
                <p className="font-medium">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.key}</p>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onClick={() => {
              const shortcutsButton = document.querySelector('[data-shortcuts-trigger]') as HTMLButtonElement;
              shortcutsButton?.click();
            }}
            className="flex items-center gap-3"
          >
            <Keyboard className="h-4 w-4" />
            <div className="flex-1">
              <p className="font-medium">Todos los atajos</p>
              <p className="text-xs text-muted-foreground">Shift + ?</p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
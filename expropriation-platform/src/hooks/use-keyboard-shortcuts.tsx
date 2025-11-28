'use client';

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
  enabled?: boolean;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when user is typing in an input
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true'
    ) {
      return;
    }

    const matchingShortcut = shortcuts.find((shortcut) => {
      if (shortcut.enabled === false) return false;

      return (
        shortcut.key.toLowerCase() === event.key.toLowerCase() &&
        !!shortcut.ctrlKey === event.ctrlKey &&
        !!shortcut.altKey === event.altKey &&
        !!shortcut.shiftKey === event.shiftKey &&
        !!shortcut.metaKey === event.metaKey
      );
    });

    if (matchingShortcut) {
      event.preventDefault();
      event.stopPropagation();
      matchingShortcut.action();
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return shortcuts;
}

// Common shortcuts for the application
export const commonShortcuts = {
  // Navigation
  goToDashboard: {
    key: 'd',
    altKey: true,
    description: 'Ir al panel principal',
  },
  goToCases: {
    key: 'c',
    altKey: true,
    description: 'Ir a casos',
  },
  goToUsers: {
    key: 'u',
    altKey: true,
    description: 'Ir a usuarios',
  },
  goToReports: {
    key: 'r',
    altKey: true,
    description: 'Ir a reportes',
  },
  goToMeetings: {
    key: 'm',
    altKey: true,
    description: 'Ir a reuniones',
  },

  // Actions
  createNew: {
    key: 'n',
    ctrlKey: true,
    description: 'Crear nuevo',
  },
  search: {
    key: '/',
    description: 'Búsqueda',
  },
  help: {
    key: '?',
    description: 'Mostrar ayuda',
  },

  // Theme
  toggleTheme: {
    key: 't',
    ctrlKey: true,
    shiftKey: true,
    description: 'Cambiar tema',
  },

  // Accessibility
  focusMain: {
    key: 'm',
    altKey: true,
    description: 'Enfocar contenido principal',
  },
  toggleAria: {
    key: 'a',
    ctrlKey: true,
    altKey: true,
    description: 'Modo accesibilidad',
  },
};
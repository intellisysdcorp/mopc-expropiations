'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Keyboard, Command, Option } from 'lucide-react';
import { KeyboardShortcut } from '@/hooks/use-keyboard-shortcuts';

interface KeyboardShortcutsPanelProps {
  shortcuts: (KeyboardShortcut & { category?: string })[];
  children?: React.ReactNode;
}

/**
 * Groups keyboard shortcuts by their category.
 *
 * This function takes an array of keyboard shortcuts and organizes them into
 * a Record where each key is a category name and each value is an array of
 * shortcuts belonging to that category. Shortcuts without a category are
 * automatically grouped under 'General'.
 *
 * @param shortcuts - Array of keyboard shortcuts with optional category property
 * @returns Record mapping category names to arrays of KeyboardShortcut objects
 */
function groupShortcutsByCategory(shortcuts: (KeyboardShortcut & { category?: string })[]): Record<string, KeyboardShortcut[]> {
  return shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);
}

export function KeyboardShortcutsPanel({ shortcuts, children }: KeyboardShortcutsPanelProps) {
  const formatKeybinding = (shortcut: KeyboardShortcut) => {
    const keys = [];

    if (shortcut.ctrlKey || shortcut.metaKey) {
      keys.push(
        <span key="meta" className="flex items-center">
          {typeof window !== 'undefined' && window.navigator.platform.includes('Mac') ? (
            <Command className="h-3 w-3" />
          ) : (
            'Ctrl'
          )}
        </span>
      );
    }

    if (shortcut.altKey) {
      keys.push(
        <span key="alt" className="flex items-center">
          {typeof window !== 'undefined' && window.navigator.platform.includes('Mac') ? (
            <Option className="h-3 w-3" />
          ) : (
            'Alt'
          )}
        </span>
      );
    }

    if (shortcut.shiftKey) {
      keys.push(<span key="shift">Shift</span>);
    }

    keys.push(
      <span key="key" className="font-mono">
        {shortcut.key.toUpperCase()}
      </span>
    );

    return keys.map((key, index) => (
      <span key={index} className="flex items-center">
        {index > 0 && <span className="mx-1">+</span>}
        <span className="px-2 py-1 text-xs bg-muted border rounded">{key}</span>
      </span>
    ));
  };

  const groupedShortcuts = groupShortcutsByCategory(shortcuts);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Keyboard className="h-4 w-4 mr-2" />
            Atajos de Teclado
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Atajos de Teclado</DialogTitle>
          <DialogDescription>
            Usa estos atajos para navegar más rápido por la aplicación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-h-96 overflow-y-auto">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">
                {category}
              </h3>
              <div className="grid gap-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={`${shortcut}-${index}`}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center space-x-1">
                      {formatKeybinding(shortcut)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
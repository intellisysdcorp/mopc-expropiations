'use client';

import { ReactNode, createContext, useContext, useState, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
}

  export interface ToastOptions {
  id?: string;
  type?: ToastType;
  title?: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
  dismissible?: boolean;
  persistent?: boolean;
  icon?: ReactNode;
  className?: string;
  progress?: number;
}

interface EnhancedToast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
  action?: ToastAction;
  dismissible: boolean;
  persistent: boolean;
  icon?: ReactNode;
  className?: string;
  progress?: number;
  timestamp: Date;
}

// Helper function to convert ToastOptions to EnhancedToast with proper defaults
function createEnhancedToast(options: ToastOptions): EnhancedToast {
  const toast: EnhancedToast = {
    id: options.id || Math.random().toString(36).substring(2, 9),
    type: options.type || 'info',
    title: options.title || '',
    duration: options.duration ?? (options.type === 'loading' ? Infinity : 5000),
    dismissible: options.dismissible ?? true,
    persistent: options.persistent ?? false,
    timestamp: new Date(),
  };

  // Only add optional properties if they are defined (not undefined)
  if (options.description !== undefined) {
    toast.description = options.description;
  }
  if (options.action !== undefined) {
    toast.action = options.action;
  }
  if (options.icon !== undefined) {
    toast.icon = options.icon;
  }
  if (options.className !== undefined) {
    toast.className = options.className;
  }
  if (options.progress !== undefined) {
    toast.progress = options.progress;
  }

  return toast;
}

interface ToastContextType {
  toasts: EnhancedToast[];
  toast: (options: ToastOptions) => string;
  success: (title: string, description?: string, options?: Omit<ToastOptions, 'type' | 'title'>) => string;
  error: (title: string, description?: string, options?: Omit<ToastOptions, 'type' | 'title'>) => string;
  warning: (title: string, description?: string, options?: Omit<ToastOptions, 'type' | 'title'>) => string;
  info: (title: string, description?: string, options?: Omit<ToastOptions, 'type' | 'title'>) => string;
  loading: (title: string, description?: string, options?: Omit<ToastOptions, 'type' | 'title'>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useEnhancedToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useEnhancedToast must be used within an EnhancedToastProvider');
  }
  return context;
}

const typeConfig = {
  success: {
    icon: <CheckCircle className="h-5 w-5 text-green-600" />,
    className: 'border-green-200 bg-green-50 text-green-800',
    progressClass: 'bg-green-600',
  },
  error: {
    icon: <XCircle className="h-5 w-5 text-red-600" />,
    className: 'border-red-200 bg-red-50 text-red-800',
    progressClass: 'bg-red-600',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
    className: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    progressClass: 'bg-yellow-600',
  },
  info: {
    icon: <Info className="h-5 w-5 text-blue-600" />,
    className: 'border-blue-200 bg-blue-50 text-blue-800',
    progressClass: 'bg-blue-600',
  },
  loading: {
    icon: <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />,
    className: 'border-blue-200 bg-blue-50 text-blue-800',
    progressClass: 'bg-blue-600',
  },
};

export function EnhancedToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<EnhancedToast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback((options: ToastOptions): string => {
    const toast = createEnhancedToast(options);

    setToasts(prev => [...prev, toast]);

    // Auto-dismiss if not persistent
    if (toast.duration !== Infinity && !toast.persistent) {
      setTimeout(() => {
        dismiss(toast.id);
      }, toast.duration);
    }

    return toast.id;
  }, [dismiss]);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    return addToast(options);
  }, [addToast]);

  // Higher-order function to create typed toast functions
const createTypedToastFunction = useCallback((
  type: ToastType
) => {
  return (
    title: string,
    description?: string,
    options?: Omit<ToastOptions, 'type' | 'title'>
  ) => {
    const toastOptions: ToastOptions = { ...options, type, title };
    if (description !== undefined) {
      toastOptions.description = description;
    }
    return addToast(toastOptions);
  };
}, [addToast]);

  // Create typed toast functions using the higher-order function
  const success = createTypedToastFunction('success');
  const error = createTypedToastFunction('error');
  const warning = createTypedToastFunction('warning');
  const info = createTypedToastFunction('info');
  const loading = createTypedToastFunction('loading');

  const contextValue: ToastContextType = {
    toasts,
    toast,
    success,
    error,
    warning,
    info,
    loading,
    dismiss,
    dismissAll,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, dismiss } = useEnhancedToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: EnhancedToast; onDismiss: (id: string) => void }) {
  const config = typeConfig[toast.type];

  return (
    <div
      className={cn(
        "relative p-4 rounded-lg border shadow-lg transition-all duration-300 ease-in-out transform",
        "animate-in slide-in-from-right-full",
        config.className,
        toast.className
      )}
    >
      {/* Progress bar */}
      {toast.progress !== undefined && toast.progress < 100 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 rounded-t-lg overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300", config.progressClass)}
            style={{ width: `${toast.progress}%` }}
          />
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {toast.icon || config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm leading-tight mb-1">
            {toast.title}
          </h4>
          {toast.description && (
            <p className="text-sm opacity-90 leading-relaxed">
              {toast.description}
            </p>
          )}

          {/* Action */}
          {toast.action && (
            <div className="mt-3">
              <Button
                variant={toast.action.variant || 'default'}
                size="sm"
                onClick={toast.action.onClick}
                className="gap-2"
              >
                {toast.action.icon}
                {toast.action.label}
              </Button>
            </div>
          )}
        </div>

        {/* Dismiss button */}
        {toast.dismissible && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-black/10"
            onClick={() => onDismiss(toast.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Timestamp for persistent toasts */}
      {toast.persistent && (
        <div className="absolute bottom-1 right-2">
          <span className="text-xs opacity-60">
            {toast.timestamp.toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}

// Predefined toast functions for common actions
export const useToastHelpers = () => {
  const { success, error, warning, info, loading } = useEnhancedToast();

  return {
    // Case management toasts
    caseCreated: (caseNumber: string) =>
      success('Caso creado', `Caso ${caseNumber} ha sido creado exitosamente.`),

    caseUpdated: (caseNumber: string) =>
      success('Caso actualizado', `Caso ${caseNumber} ha sido actualizado.`),

    caseDeleted: (caseNumber: string) =>
      warning('Caso eliminado', `Caso ${caseNumber} ha sido eliminado.`),

    caseAssigned: (caseNumber: string, assignee: string) =>
      info('Caso asignado', `Caso ${caseNumber} asignado a ${assignee}.`),

    // Document management toasts
    documentUploaded: (fileName: string) =>
      success('Documento subido', `${fileName} ha sido subido exitosamente.`),

    documentDeleted: (fileName: string) =>
      warning('Documento eliminado', `${fileName} ha sido eliminado.`),

    // Export toasts
    exportStarted: (format: string) =>
      loading('Exportando', `Generando exportación en formato ${format.toUpperCase()}...`),

    exportCompleted: (fileName: string, downloadUrl?: string) => {
      const options: Omit<ToastOptions, 'type' | 'title'> = {};
      if (downloadUrl) {
        options.action = {
          label: 'Descargar',
          icon: <Download className="h-4 w-4" />,
          onClick: () => {
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        };
      }
      return success('Exportación completada', `Datos exportados exitosamente.`, options);
    },

    exportFailed: (errorMsg: string) =>
      error('Error en exportación', `No se pudo completar la exportación: ${errorMsg}`),

    // User management toasts
    userCreated: (userName: string) =>
      success('Usuario creado', `${userName} ha sido creado exitosamente.`),

    userUpdated: (userName: string) =>
      success('Usuario actualizado', `${userName} ha sido actualizado.`),

    userDeleted: (userName: string) =>
      warning('Usuario eliminado', `${userName} ha sido eliminado.`),

    // Authentication toasts
    loginSuccess: (userName: string) =>
      success('Bienvenido', `Has iniciado sesión como ${userName}.`),

    loginError: (errorMsg: string) =>
      error('Error de inicio de sesión', errorMsg),

    logoutSuccess: () =>
      info('Sesión cerrada', 'Has cerrado tu sesión exitosamente.'),

    // General toasts
    saved: (entity: string) =>
      success('Guardado', `${entity} ha sido guardado exitosamente.`),

    deleted: (entity: string) =>
      warning('Eliminado', `${entity} ha sido eliminado.`),

    updated: (entity: string) =>
      success('Actualizado', `${entity} ha sido actualizado exitosamente.`),

    error: (message: string) =>
      error('Error', message),

    warning: (message: string) =>
      warning('Advertencia', message),

    info: (message: string) =>
      info('Información', message),
  };
};
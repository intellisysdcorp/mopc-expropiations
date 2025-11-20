'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { KeyboardShortcutsPanel } from '@/components/help/keyboard-shortcuts-panel';
import { useKeyboardShortcuts, commonShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useTutorial } from '@/components/tutorial/tutorial-provider';
import {
  FileText,
  BarChart3,
  AlertTriangle,
  Clock,
  TrendingUp,
  HelpCircle,
  Keyboard
} from 'lucide-react';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { DashboardCharts } from '@/components/dynamic';
import { DashboardCases } from '@/components/dashboard/dashboard-cases';
import { DashboardAlerts } from '@/components/dashboard/dashboard-alerts';
import { GlobalSearch } from '@/components/search/global-search';
import { DataExport } from '@/components/export/data-export';
import { CaseCalendar } from '@/components/calendar/case-calendar';

export default function DashboardPage() {
  const { user } = useAuth();
  const { startTutorial } = useTutorial();
  const router = useRouter();

  // Keyboard shortcuts
  const shortcuts = [
    {
      ...commonShortcuts.goToDashboard,
      action: () => router.push('/dashboard'),
    },
    {
      ...commonShortcuts.goToCases,
      action: () => router.push('/cases'),
    },
    {
      ...commonShortcuts.goToReports,
      action: () => router.push('/reports'),
    },
    {
      ...commonShortcuts.goToMeetings,
      action: () => router.push('/meetings'),
    },
    {
      ...commonShortcuts.createNew,
      action: () => router.push('/cases?action=create'),
    },
    {
      ...commonShortcuts.help,
      action: () => startTutorial('dashboard-intro'),
    },
    {
      ...commonShortcuts.toggleTheme,
      action: () => {
        // Theme toggle is handled by the component
      },
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return (
    <div className="p-6 lg:p-8 space-y-6">
          {/* Top Bar with utilities */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                Panel Principal
              </h1>
              <p className="text-muted-foreground">
                Sistema de Gestión de Casos de Expropiación
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <GlobalSearch />
              <DataExport />
              <ThemeToggle />
              <KeyboardShortcutsPanel
                shortcuts={shortcuts.map(s => ({ ...s, category: 'Navegación' }))}
              >
                <Button variant="ghost" size="sm" aria-label="Atajos de teclado">
                  <Keyboard className="h-4 w-4" />
                </Button>
              </KeyboardShortcutsPanel>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startTutorial('dashboard-intro')}
                aria-label="Iniciar tutorial"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
            {/* Welcome Section */}
            <section className="mb-8" aria-labelledby="welcome-heading">
              <div className="flex items-center justify-between flex-col sm:flex-row gap-4">
                <div>
                  <h2 id="welcome-heading" className="text-2xl font-bold text-foreground mb-2">
                    Bienvenido, {user?.firstName} {user?.lastName}
                  </h2>
                  <p className="text-muted-foreground">
                    Panel principal del Sistema de Gestión de Casos de Expropiación
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">
                    {user?.role?.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {user?.department}
                  </Badge>
                </div>
              </div>
            </section>


            {/* Dashboard Tabs */}
            <Tabs defaultValue="overview" className="space-y-6" data-tutorial="dashboard-tabs">
              <TabsList
                className="grid w-full grid-cols-2 sm:grid-cols-5 lg:w-auto lg:grid-cols-5"
                role="tablist"
                aria-label="Vistas del panel"
              >
                <TabsTrigger
                  value="overview"
                  className="flex items-center space-x-2"
                  role="tab"
                  aria-selected="true"
                  aria-controls="overview-panel"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Resumen</span>
                </TabsTrigger>
                <TabsTrigger
                  value="analytics"
                  className="flex items-center space-x-2"
                  role="tab"
                  aria-selected="false"
                  aria-controls="analytics-panel"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Análisis</span>
                </TabsTrigger>
                <TabsTrigger
                  value="cases"
                  className="flex items-center space-x-2"
                  role="tab"
                  aria-selected="false"
                  aria-controls="cases-panel"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Casos</span>
                </TabsTrigger>
                <TabsTrigger
                  value="calendar"
                  className="flex items-center space-x-2"
                  role="tab"
                  aria-selected="false"
                  aria-controls="calendar-panel"
                >
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Calendario</span>
                </TabsTrigger>
                <TabsTrigger
                  value="alerts"
                  className="flex items-center space-x-2"
                  role="tab"
                  aria-selected="false"
                  aria-controls="alerts-panel"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span className="hidden sm:inline">Alertas</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6" id="overview-panel" role="tabpanel">
                <DashboardStats {...(user?.departmentId && { departmentId: user.departmentId })} />
              </TabsContent>

              <TabsContent value="analytics" className="space-y-6" id="analytics-panel" role="tabpanel">
                <DashboardCharts {...(user?.departmentId && { departmentId: user.departmentId })} />
              </TabsContent>

              <TabsContent value="cases" className="space-y-6" id="cases-panel" role="tabpanel">
                <DashboardCases
                  {...(user?.departmentId && { departmentId: user.departmentId })}
                  {...(user?.id && { userId: user.id })}
                />
              </TabsContent>

              <TabsContent value="calendar" className="space-y-6" id="calendar-panel" role="tabpanel">
                <CaseCalendar />
              </TabsContent>

              <TabsContent value="alerts" className="space-y-6" id="alerts-panel" role="tabpanel">
                <DashboardAlerts
                  {...(user?.departmentId && { departmentId: user.departmentId })}
                  {...(user?.id && { userId: user.id })}
                />
              </TabsContent>
            </Tabs>
    </div>
  );
}
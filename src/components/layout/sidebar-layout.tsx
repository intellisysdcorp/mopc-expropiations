'use client'

import { Button } from '@/components/ui/button'
import { SidebarNavigation } from './sidebar-navigation'
import { useSidebar, SidebarProvider } from '@/hooks/use-sidebar'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarLayoutProps {
  children: React.ReactNode
  className?: string
}

export { SidebarProvider }
export function SidebarLayout({ children, className }: SidebarLayoutProps) {
  const { isCollapsed, isMobileOpen, toggleSidebar, closeMobileSidebar } = useSidebar()

  return (
    <div className={cn("flex h-screen bg-background", className)}>
      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={closeMobileSidebar}
        >
          <div
            className="fixed left-0 top-0 h-full w-80 bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarNavigation
              isCollapsed={false}
              onToggle={closeMobileSidebar}
            />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex lg:flex-col",
        isCollapsed ? "w-16" : "w-80",
        "transition-all duration-300 ease-in-out border-r bg-background"
      )}>
        <SidebarNavigation
          isCollapsed={isCollapsed}
          onToggle={toggleSidebar}
        />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b bg-background">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="p-2"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">MOPC</h1>
          <div className="w-9" /> {/* Spacer for alignment */}
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="h-full px-4">
            {children}
          </div>
        </main>
      </div>

      {/* Desktop Sidebar Toggle Button (when collapsed) */}
      {isCollapsed && !isMobileOpen && (
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="fixed left-16 top-4 z-40 p-2 bg-background border shadow-sm"
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
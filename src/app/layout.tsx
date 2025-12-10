import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { AuthProvider } from "@/components/providers/auth-provider";
import { QueryProvider } from "@/components/providers/query-client-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TutorialProvider } from "@/components/tutorial/tutorial-provider";
import { EnhancedToastProvider } from "@/components/ui/enhanced-toast-provider";
import { SkipLink as AccessibleSkipLink } from "@/components/ui/accessibility";
import { PerformanceMonitor as PerfMonitor } from "@/lib/performance";
import { TutorialOverlay } from "@/components/tutorial/tutorial-overlay";
import { MicroInteractionStyles } from "@/components/ui/micro-interactions";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: "Plataforma de Expropiación - MOPC",
  description: "Plataforma digital para la gestión de casos de expropiación en la República Dominicana",
  keywords: ["expropiación", "gobierno", "casos", "MOPC", "República Dominicana"],
  authors: [{ name: "MOPC Development Team" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e40af",
  colorScheme: "light dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get the nonce from the headers set by middleware
  const headersList = await headers();
  const nonce = headersList.get('x-nonce');

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Add nonce as meta tag for client components */}
        {nonce && <meta name="csp-nonce" content={nonce} />}
      </head>
      <body className={inter.className}>
        <ThemeProvider
          defaultTheme="system"
          storageKey="mopc-ui-theme"
        >
          <TutorialProvider>
            <AuthProvider>
              <QueryProvider>
                <EnhancedToastProvider>
                  <PerfMonitor />
                  <MicroInteractionStyles />

                  {/* Skip links for accessibility */}
                  <AccessibleSkipLink href="#main-content">
                    Saltar al contenido principal
                  </AccessibleSkipLink>
                  <AccessibleSkipLink href="#navigation">
                    Saltar a la navegación
                  </AccessibleSkipLink>

                  <div className="min-h-screen flex flex-col bg-background text-foreground">
                    <main id="main-content" className="flex-1 focus:outline-none" tabIndex={-1}>
                      {children}
                    </main>
                  </div>

                  {/* Tutorial overlay */}
                  <TutorialOverlay />
                </EnhancedToastProvider>
              </QueryProvider>
            </AuthProvider>
          </TutorialProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
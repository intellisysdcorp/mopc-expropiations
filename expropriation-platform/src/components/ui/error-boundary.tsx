'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import clientLogger from '@/lib/client-logger'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
  retryCount: number
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; retry: () => void; reset: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  maxRetries?: number
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeouts: NodeJS.Timeout[] = []

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    clientLogger.error('Error Boundary caught an error:', error, errorInfo)

    this.setState({
      error,
      errorInfo
    })

    // Call error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log to performance monitor
    if (typeof window !== 'undefined') {
      const report = {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: Date.now(),
        userAgent: window.navigator.userAgent,
        url: window.location.href
      }
      clientLogger.error('Performance Error Report:', report)
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props
    const { retryCount } = this.state

    if (retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        retryCount: prevState.retryCount + 1
      }))
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      retryCount: 0
    })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout))
  }

  render() {
    const { hasError, error, retryCount } = this.state
    const { children, fallback: Fallback, maxRetries = 3 } = this.props

    if (hasError) {
      if (Fallback) {
        return (
          <Fallback
            {...(error && { error })}
            retry={this.handleRetry}
            reset={this.handleReset}
          />
        )
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-xl">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {error?.message || 'An unexpected error occurred while rendering this component.'}
              </p>

              {retryCount > 0 && (
                <div className="text-sm text-muted-foreground text-center">
                  Retry attempt {retryCount} of {maxRetries}
                </div>
              )}

              <div className="flex flex-col gap-2">
                {retryCount < maxRetries && (
                  <Button
                    onClick={this.handleRetry}
                    className="w-full"
                    variant="default"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                )}

                <Button
                  onClick={this.handleReset}
                  className="w-full"
                  variant="outline"
                >
                  Reset Component
                </Button>

                <Button
                  onClick={this.handleGoHome}
                  className="w-full"
                  variant="ghost"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && error && (
                <details className="mt-4">
                  <summary className="text-sm font-medium cursor-pointer">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                    {error.stack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return children
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

// Custom hook for error handling in functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: string) => {
    clientLogger.error('Error caught by useErrorHandler:', error, errorInfo)

    if (typeof window !== 'undefined') {
      const report = {
        error: error.message,
        stack: error.stack,
        additionalInfo: errorInfo,
        timestamp: Date.now(),
        userAgent: window.navigator.userAgent,
        url: window.location.href
      }
      clientLogger.error('Handled Error Report:', report)
    }
  }
}

export default ErrorBoundary
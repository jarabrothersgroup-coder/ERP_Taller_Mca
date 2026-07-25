"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches render errors in the child component tree
 * and displays a fallback UI instead of crashing the entire page.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary]", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Algo salió mal</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Ocurrió un error inesperado al renderizar esta sección. Nuestro equipo ha sido notificado.
          </p>
          <details className="mb-6 max-w-lg text-left">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              Ver detalle del error
            </summary>
            <pre className="mt-2 p-3 rounded-lg bg-muted text-xs text-destructive overflow-auto max-h-32">
              {this.state.error?.message || "Error desconocido"}
            </pre>
          </details>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

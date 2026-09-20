import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors so a single failing view never blanks the whole console.
 * Shows a readable message with a retry action instead of a white screen.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[admin] Render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <p className="font-medium text-destructive">This view failed to load</p>
              <p className="text-sm text-muted-foreground">
                {this.state.error.message || "An unexpected rendering error occurred."}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => this.setState({ error: null })}
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

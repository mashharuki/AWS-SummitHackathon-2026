import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import i18n from "@/i18n";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen bg-saboru-cream flex items-center justify-center p-4">
          <div
            className="card-brutal max-w-sm w-full p-6 text-center"
            style={{ background: "#FFF7ED" }}
          >
            <p className="font-bold text-saboru-ink" style={{ fontSize: 16 }}>
              {i18n.t("app.errorUnexpected")}
            </p>
            <p className="text-saboru-ink-muted mt-2" style={{ fontSize: 13 }}>
              {i18n.t("app.errorReload")}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-lg font-bold"
              style={{
                background: "#F97316",
                color: "#fff",
                border: "2px solid #2B1E16",
                fontSize: 13,
              }}
            >
              {i18n.t("app.reload")}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

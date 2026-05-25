import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      let errorDetails = null;
      try {
        if (this.state.error?.message) {
          errorDetails = JSON.parse(this.state.error.message);
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 text-center">
            <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center text-rose-600 mx-auto mb-6">
              <AlertCircle className="w-10 h-10" />
            </div>
            
            <h1 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Something went wrong</h1>
            <p className="text-slate-500 font-medium mb-8">
              {errorDetails 
                ? `A database error occurred while performing a ${errorDetails.operationType} operation.`
                : "An unexpected error occurred. Our team has been notified."}
            </p>

            {errorDetails && (
              <div className="bg-slate-50 rounded-2xl p-4 mb-8 text-left overflow-hidden">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Error Details</p>
                <div className="font-mono text-[11px] text-slate-600 break-all whitespace-pre-wrap">
                  {JSON.stringify(errorDetails, null, 2)}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-all"
              >
                <RefreshCcw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-slate-800 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"
              >
                <Home className="w-4 h-4" />
                Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

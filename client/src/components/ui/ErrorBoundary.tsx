import React, { ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends (React.Component as any) {
  state: State = { hasError: false };

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Safe ErrorBoundary catch:', error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-lg mx-auto w-full my-auto flex items-center justify-center">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl w-full p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto shadow-xs border border-orange-100">
              <ShieldAlert size={32} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Section Refreshed</h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                This section encountered a temporary display state and was safely contained. Your session and data are secure.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-xs transition-all active:scale-[0.98]"
              >
                <RefreshCw size={15} />
                <span>Reload Section</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

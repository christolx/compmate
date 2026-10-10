import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Logo } from '../components/icons';

interface Props {
  children: ReactNode;
  /** Clears the saved demo state and restarts the app. */
  onReset: () => void;
}

interface State {
  failed: boolean;
}

/**
 * Shows a recovery screen instead of a blank page when anything below it fails
 * to render. The screen needs no router, store or app shell.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CompMate hit an unexpected error while rendering.', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <RecoveryScreen onRetry={() => this.setState({ failed: false })} onReset={this.props.onReset} />;
  }
}

export function RecoveryScreen({ onRetry, onReset }: { onRetry: () => void; onReset: () => void }) {
  return (
    <main className="min-h-dvh bg-white font-sans text-ink">
      <div className="mx-auto max-w-[640px] px-5 py-24 text-center">
        <div className="flex justify-center">
          <Logo size={40} />
        </div>
        <div className="mt-6 font-mono text-[12px] font-semibold tracking-[.08em] text-slate-500 uppercase">Something went wrong</div>
        <h1 className="mt-3 mb-0 text-[30px] font-extrabold tracking-[-0.03em]">This page couldn't load.</h1>
        <p className="mt-2 mb-0 text-[15px] leading-[1.55] text-slate-500">
          Try again. If it keeps happening, reset the demo data saved in this browser. Saved competitions, applications and other demo changes
          go back to the start.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <button type="button" onClick={onRetry} className="h-[46px] cursor-pointer rounded-[12px] border-0 bg-brand px-5 text-[14px] font-bold text-white hover:bg-brand-hover">
            Try again
          </button>
          <button type="button" onClick={onReset} className="h-[46px] cursor-pointer rounded-[12px] border border-slate-200 bg-white px-5 text-[14px] font-bold text-ink hover:bg-slate-50">
            Reset demo data
          </button>
        </div>
      </div>
    </main>
  );
}

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppErrorBoundary, RecoveryScreen } from './AppErrorBoundary';

describe('AppErrorBoundary', () => {
  it('switches to the recovery screen when a child fails to render', () => {
    expect(AppErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true });
  });

  it('renders the recovery screen without the router, store or app shell', () => {
    const html = renderToStaticMarkup(<RecoveryScreen onRetry={() => {}} onReset={() => {}} />);
    expect(html).toContain('Try again');
    expect(html).toContain('Reset demo data');
  });
});

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  /** When this changes, the boundary tries again. */
  readonly resetKey: string;
  readonly children: ReactNode;
}

/** Keeps one broken view from taking down the app. */
export class ErrorBoundary extends Component<Props, { error: Error | null; key: string }> {
  override state: { error: Error | null; key: string } = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: { error: Error | null; key: string }) {
    return props.resetKey === state.key ? null : { error: null, key: props.resetKey };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="notice notice-error" role="alert">
        <strong>This view stopped working. </strong>
        The rest of the site is fine.
        <pre>{this.state.error.message}</pre>
        <button type="button" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}

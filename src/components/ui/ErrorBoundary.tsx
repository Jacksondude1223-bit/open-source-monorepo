import { Component, ErrorInfo, ReactNode } from 'react';
import ErrorView from '~/components/ui/ErrorView';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Catches render-time errors anywhere in the child tree and shows a recoverable
 * error screen instead of a blank white page. The underlying error message and
 * stack are surfaced behind the collapsible "Show error details" toggle (only in
 * development) so issues are easy to diagnose without crashing the whole app.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Uncaught render error:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  handleReset = (): void => {
    this.setState({ error: null, componentStack: null });
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;

    if (error) {
      const isDev = process.env.NODE_ENV !== 'production';
      const fullDetails = [
        `${error.name}: ${error.message}`,
        error.stack,
        componentStack && `Component stack:${componentStack}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      return (
        <ErrorView
          statusCode={500}
          title="Something went wrong"
          message="An unexpected error occurred while rendering this page. You can try again, or head back home."
          details={isDev ? fullDetails : null}
          reportDetails={fullDetails}
          onRetry={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

import type { NextPageContext } from 'next';
import ErrorView from '~/components/ui/ErrorView';

interface ErrorPageProps {
  statusCode: number;
  /** Serialized error details surfaced behind the "Show error details" toggle. */
  details: string | null;
  /** Full error context forwarded to the reporting webhook (not displayed). */
  reportDetails: string | null;
}

function buildFullDetails(err?: Error | null, message?: string): string | null {
  if (err) {
    return [err.name && `${err.name}: ${err.message}`, err.stack]
      .filter(Boolean)
      .join('\n\n');
  }
  return message || null;
}

export default function ErrorPage({ statusCode, details, reportDetails }: ErrorPageProps) {
  const isServerError = !statusCode || statusCode >= 500;
  return (
    <ErrorView
      statusCode={statusCode || 500}
      title={isServerError ? 'Internal server error' : 'Something went wrong'}
      message={
        isServerError
          ? 'Something went wrong on our end. The issue has been logged — please try again in a moment.'
          : `The request could not be completed (error ${statusCode}).`
      }
      details={details}
      reportDetails={reportDetails}
      onRetry={() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }}
    />
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext): ErrorPageProps => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500;
  const fullDetails = buildFullDetails(err, err?.message);
  // Never expose stack traces in production builds — only show them while developing.
  const isDev = process.env.NODE_ENV !== 'production';
  return {
    statusCode,
    details: isDev ? fullDetails : null,
    reportDetails: fullDetails,
  };
};

import { useRouter } from 'next/router';
import { PropsWithChildren } from 'react';
import { DefaultLayout } from '~/components/DefaultLayout';
import { DashboardLayout } from '~/components/page_components/DashboardLayout';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import ErrorView from '~/components/ui/ErrorView';

export default function InternalServerError() {
  const router = useRouter();
  const path = router.asPath;

  const Layout = ({ children }: PropsWithChildren): React.ReactElement => {
    const SurroundingLayout = path.startsWith('/workspaces/[groupId]')
      ? WorkspaceLayout
      : path.startsWith('/dashboard')
        ? DashboardLayout
        : DefaultLayout;
    return <SurroundingLayout>{children}</SurroundingLayout>;
  };

  return (
    <Layout>
      <ErrorView
        statusCode={500}
        title="Internal server error"
        message="Something went wrong on our end. The issue has been logged — please try again in a moment."
      />
    </Layout>
  );
}

import { BriefcaseIcon, ClipboardDocumentIcon, DocumentTextIcon, HomeIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';
import AuthedLayout from '~/components/layouts/PageLayout';

type DefaultLayoutProps = { children: ReactNode; disableMl?: boolean };

export const DashboardLayout = ({ children, disableMl }: DefaultLayoutProps) => {
  const router = useRouter();

  return (
    <AuthedLayout
      disableMl={disableMl || false}
      navigation={[
        { name: 'Workspaces', href: '/dashboard', icon: HomeIcon, current: router.asPath === '/dashboard' },
        { name: 'Form Submissions', href: '/dashboard/applications', icon: ClipboardDocumentIcon, current: router.asPath.startsWith('/dashboard/applications') },
        { name: 'My Resume', href: '/dashboard/resume', icon: DocumentTextIcon, current: router.asPath.startsWith('/dashboard/resume') },
        { name: 'Job Applications', href: '/dashboard/job-applications', icon: BriefcaseIcon, current: router.asPath.startsWith('/dashboard/job-applications') },
        { name: 'Browse Postings', href: '/postings', icon: MagnifyingGlassIcon, current: router.asPath === '/postings' },
      ]}
    >
      <Head>
        <title>ReAdmin - Dashboard</title>
        <link rel="icon" href="https://cdn.readmin.app/readmin-public/RA-White.png" />
      </Head>

      <main>{children}</main>
    </AuthedLayout>
  );
};

import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';
import AuthedLayout from '~/components/layouts/PageLayout';
import { useUser } from '~/components/contexts/user';
import { UsersIcon, ServerStackIcon, BellIcon, BoltIcon, ChartBarIcon, BriefcaseIcon, DocumentTextIcon, FlagIcon } from '@heroicons/react/20/solid';
import { BRAND_NAME, BRAND_WORDMARK_DARK } from '~/utils/brand';

type DefaultLayoutProps = { children: ReactNode };

export const AdminLayout = ({ children }: DefaultLayoutProps) => {
  const router = useRouter();
  const user = useUser();
  const { groupId } = router.query;
  const path = router.asPath;

  let role: string | undefined;
  if ('loggedIn' in user) {
    if (user.loggedIn == false) {
      router.push(`/`);
    } else {
      role = user.user.dbUser.role;
      if (role !== 'Founder' && role !== 'Trust and Saftey') {
        router.push(`/`);
      }
    }
  }

  const isFounder = role === 'Founder';

  // Admin navigation items
  const adminNavigation = [
    ...(isFounder
      ? [
        {
          name: 'Users',
          href: `/admin`,
          icon: UsersIcon,
          current: path === '/admin',
        },
        {
          name: 'Workspaces',
          href: `/admin/workspaces`,
          icon: ServerStackIcon,
          current: path === '/admin/workspaces',
        },
        {
          name: 'Founder Statistics',
          href: `/admin/game-stats`,
          icon: ChartBarIcon,
          current: path === '/admin/game-stats',
        },
        {
          name: 'Site Alerts',
          href: `/admin/alerts`,
          icon: BoltIcon,
          current: path === '/admin/alerts',
        },
        {
          name: 'Postings',
          href: `/admin/postings`,
          icon: BriefcaseIcon,
          current: path === '/admin/postings',
        },
        {
          name: 'Resumes',
          href: `/admin/resumes`,
          icon: DocumentTextIcon,
          current: path === '/admin/resumes',
        },
        {
          name: 'Reports',
          href: `/admin/reports`,
          icon: FlagIcon,
          current: path === '/admin/reports',
        },
      ]
      : []),
  ];

  return (
    <AuthedLayout navigation={adminNavigation}>
      <Head>
        <title>{`${BRAND_NAME} - Admin Panel`}</title>
        <link rel="icon" href={BRAND_WORDMARK_DARK} />
      </Head>

      <main>{children}</main>
    </AuthedLayout>
  );
};

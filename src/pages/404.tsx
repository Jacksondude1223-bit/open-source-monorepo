/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useRouter } from 'next/router';
import { PropsWithChildren } from 'react';
import { DefaultLayout } from '~/components/DefaultLayout';
import { DashboardLayout } from '~/components/page_components/DashboardLayout';
export default function NotFound() {
  const router = useRouter();
  const path = router.asPath;

  const workspace = path.startsWith('/workspaces/');
  const dashboard = path.startsWith('/dashboard');
  const unauthenticated = !workspace && !dashboard;

  const Layout = ({ children }: PropsWithChildren): React.ReactElement => {
    const SurroundingLayout = workspace
      ? DashboardLayout
      : dashboard
        ? DashboardLayout
        : DefaultLayout;
    return <SurroundingLayout>{children}</SurroundingLayout>;
  };

  return (
    <Layout>
      <div
        className={`flex ${unauthenticated ? 'h-screen' : ''} flex-col pt-16`}
      >
        <main className="mx-auto flex w-full max-w-7xl grow flex-col justify-center px-6 lg:px-8">
          {unauthenticated && (
            <div className="flex shrink-0 justify-center">
              <img
                src="https://cdn.readmin.app/readmin-public/RA-Black.png"
                alt="ReAdmin Logo"
                className="max-w-sm"
              />
              <Link href="/" className="inline-flex">
                <span className="sr-only">ReAdmin</span>
                <img className="h-12 w-auto" src="https://cdn.readmin.app/readmin-public/Group%203.png" alt="" />
              </Link>
            </div>
          )}
          <div className="py-16">
            <div className="text-center">
              <p className="text-base font-semibold text-blue-600 dark:text-blue-400">404</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl">
                Page not found.
              </h1>
              <p className="mt-2 text-base text-gray-500">
                Sorry, we couldn&apos;t find the page you&apos;re looking for.
              </p>
              <div className="mt-6">
                <Link
                  href="/dashboard"
                  className="text-base font-medium text-blue-600 dark:text-blue-400 transition hover:text-blue-500"
                >
                  Dashboard
                  <span aria-hidden="true"> &rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
}

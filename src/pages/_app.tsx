'use client';

import './main.css';

import type { NextPage } from 'next';
import type { AppType, AppProps } from 'next/app';
import { PropsWithChildren, ReactElement, ReactNode, useEffect } from 'react';
import { DefaultLayout } from '~/components/DefaultLayout';
import { trpc } from '~/utils/trpc';
import { UserProvider } from '~/components/contexts/user';
import { WorkspaceProvider } from '~/components/contexts/workspace';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from '~/components/ui/ErrorBoundary';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useRouter } from 'next/router';

import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { GoogleAnalytics } from '@next/third-parties/google';
import Head from 'next/head';
import { createTheme, ThemeProvider, useColorScheme } from '@mui/material';
import { LicenseInfo } from '@mui/x-license';
import { LocalizationProvider } from '@mui/x-date-pickers-pro/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers-pro/AdapterMoment';
import { AppCacheProvider } from '@mui/material-nextjs/v16-pagesRouter';

config.autoAddCss = false

export type NextPageWithLayout<
  TProps = Record<string, unknown>,
  TInitialProps = TProps,
> = NextPage<TProps, TInitialProps> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

// Tailwind palette so MUI surfaces (DataGrid, pickers, etc.) match the rest of the site.
const tw = {
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  blue500: '#3b82f6',
  blue600: '#2563eb',
};

function buildMuiTheme(darkMode: boolean) {
  return createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: { main: tw.blue600 },
    },
    colorSchemes: {
      dark: darkMode,
    },
    components: {
      //@ts-expect-error in the wise words of mother marry, let it be!
      MuiDataGrid: {
        styleOverrides: {
          // NOTE: never set `backgroundColor` on `root` here — in MUI X v8 it
          // breaks the grid's paint layer and the rows/headers render blank.
          // Style text/border colors only and let the surface keep its default.
          root: ({ theme }: any) => {
            const dark = theme.palette.mode === 'dark';
            const paper = dark ? tw.gray800 : tw.white;
            const headerBg = dark ? tw.gray800 : tw.gray50;
            const border = dark ? tw.gray700 : tw.gray200;
            const text = dark ? tw.gray100 : tw.gray900;
            const subtext = dark ? tw.gray400 : tw.gray500;
            return {
              border: 'none',
              fontFamily: 'inherit',
              color: text,
              '--DataGrid-rowBorderColor': border,
              '--DataGrid-containerBackground': headerBg,
              // Color the inner surfaces instead of `root` — setting
              // backgroundColor on `root` breaks the grid's paint layer in v8.
              '& .MuiDataGrid-main': { backgroundColor: paper },
              '& .MuiDataGrid-columnHeaders': { backgroundColor: headerBg },
              '& .MuiDataGrid-columnHeader': { backgroundColor: headerBg },
              '& .MuiDataGrid-columnHeaderTitle': { color: text, fontWeight: 600 },
              '& .MuiDataGrid-cell': { color: text, borderColor: border },
              '& .MuiDataGrid-row:hover': { backgroundColor: theme.palette.action.hover },
              '& .MuiDataGrid-footerContainer': {
                backgroundColor: paper,
                borderTop: `1px solid ${border}`,
              },
              '& .MuiDataGrid-columnSeparator': { color: border },
              '& .MuiDataGrid-filler': { backgroundColor: paper },
              '& .MuiDataGrid-scrollbarFiller': { backgroundColor: headerBg },
              '& .MuiTablePagination-root': { color: subtext },
              '& .MuiDataGrid-overlay': { backgroundColor: paper, color: subtext },
            };
          },
        },
      },
    },
  });
}


const MyApp = (({ Component, pageProps }: AppPropsWithLayout) => {
  const router = useRouter();
  const { data } = trpc.user.info.useQuery(undefined, { refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false });
  const darkMode = data?.user?.dbUser?.darkMode == true || false;
  const { setMode } = useColorScheme();
  setMode(darkMode ? 'dark' : 'light');
  // this is needed
  LicenseInfo.setLicenseKey('');

  // Sync dark mode preference to localStorage so the blocking script in _document.tsx
  // can apply it before first paint on next page load, preventing white flash
  useEffect(() => {
    if (data?.user?.dbUser) {
      localStorage.setItem('darkMode', String(darkMode));
      if (darkMode) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.backgroundColor = '#111827';
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.backgroundColor = '';
        document.documentElement.style.colorScheme = '';
      }
    }
  }, [darkMode, data?.user?.dbUser]);

  useEffect(() => {
    // Track page views
    const handleRouteChange = () => posthog?.capture('$pageview');
    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, []);

  const WrappedLayout = ({ children }: PropsWithChildren<{}>) => {
    return (
      <div className={`first-letter:h-screen bg-white transition dark:bg-gray-900 dark:text-gray-100`}>
        {children}
      </div>
    );
  };

  const getLayout =
    Component.getLayout ?? ((page) => <DefaultLayout>{page}</DefaultLayout>);

  return (
    <div>
      <Head>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>

      <GoogleAnalytics gaId="G-N781RBS71P" />
      <PostHogProvider client={posthog}>

        <AppCacheProvider {...pageProps}>
          <ThemeProvider
            defaultMode={darkMode ? 'dark' : 'light'}
            theme={buildMuiTheme(darkMode)}>
            <LocalizationProvider dateAdapter={AdapterMoment}>
              {/* <CssBaseline /> */}
              <UserProvider>
                <WorkspaceProvider>

                  <ErrorBoundary>
                    <WrappedLayout>{getLayout(<Component {...pageProps} />)}</WrappedLayout>
                  </ErrorBoundary>

                  <div className="z-50 absoloute">
                    <Toaster
                      position="top-center"
                      reverseOrder={false}
                    />
                  </div>
                </WorkspaceProvider>
              </UserProvider>
            </LocalizationProvider>
          </ThemeProvider>
        </AppCacheProvider>
      </PostHogProvider>
    </div>
  );
}) as AppType;

export default trpc.withTRPC(MyApp);

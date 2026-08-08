import Head from 'next/head';
import { ReactNode } from 'react';
import { BRAND_NAME, BRAND_WORDMARK_DARK } from '~/utils/brand';

type DefaultLayoutProps = { children: ReactNode };

export const DefaultLayout = ({ children }: DefaultLayoutProps) => {
  return (
    <>
      <Head>
        <title>{BRAND_NAME}</title>
        <link rel="icon" href={BRAND_WORDMARK_DARK} />
      </Head>

      {children}
    </>
  );
};

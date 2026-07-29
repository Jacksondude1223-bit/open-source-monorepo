import Head from 'next/head';
import { ReactNode } from 'react';

type DefaultLayoutProps = { children: ReactNode };

export const DefaultLayout = ({ children }: DefaultLayoutProps) => {
  return (
    <>
      <Head>
        <title>ReAdmin</title>
        <link rel="icon" href="https://cdn.readmin.app/readmin-public/RA-White.png" />
      </Head>

      {children}
    </>
  );
};

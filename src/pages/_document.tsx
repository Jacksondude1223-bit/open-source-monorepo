/* eslint-disable @next/next/no-sync-scripts */
import { Html, Head, Main, NextScript } from 'next/document';
import {
  DocumentHeadTags,
  documentGetInitialProps,
} from '@mui/material-nextjs/v15-pagesRouter';

// Blocking script to apply dark mode before first paint, preventing white flash
const darkModeScript = `
(function() {
  try {
    var darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = '#111827';
      document.documentElement.style.colorScheme = 'dark';
    }
  } catch (e) {}
})();
`;

export default function Document(props?: any) {
  return (
    <Html className="h-screen bg-white dark:bg-gray-900 dark:text-gray-100">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
        <link rel="apple-touch-icon" sizes="180x180" href="https://cdn.readmin.app/readmin-public/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="https://cdn.readmin.app/readmin-public/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="https://cdn.readmin.app/readmin-public/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#000000" />
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta name="theme-color" content="#2a6a80"></meta>
        <DocumentHeadTags {...props} />
        <style dangerouslySetInnerHTML={{ __html: `
          /* Prevent white flash - set background before CSS loads */
          html { background-color: #fff; }
          html.dark { background-color: #111827; color: #f3f4f6; }
        `}} />
      </Head>
      <body className="h-screen bg-white dark:bg-gray-900 dark:text-gray-100">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

Document.getInitialProps = async (ctx: any) => {
  const finalProps = await documentGetInitialProps(ctx);
  return finalProps;
};
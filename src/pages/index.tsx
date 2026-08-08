/* eslint-disable @next/next/no-img-element */
import { useUser } from '~/components/contexts/user';
import { NextPageWithLayout } from './_app';
import { useRouter } from 'next/router';
import { BRAND_WORDMARK_LIGHT } from '~/utils/brand';

const IndexPage: NextPageWithLayout = () => {
  const user = useUser();
  const router = useRouter();
  if ('loggedIn' in user) {
    if (router.isReady && typeof window !== 'undefined') {
      if (user.loggedIn == true) {
        router.push(`/dashboard`)
      } else {
        router.push(`/login`)
      }
    }
  }
  return (
    <main className="h-screen flex flex-col justify-center align-middle py-24 px-8 bg-gray-100">
      <div className="flex flex-col justify-center self-center align-middle">
        <img
          src={BRAND_WORDMARK_LIGHT}
          alt="ReAdmin Logo"
          className="self-center max-w-lg w-full h-min"
        />
        <p className="text-center text-4xl font-bold mt-12 self-center">
          We are logging you in!
        </p>
        <p className="text-xl mt-2 max-w-lg self-center text-center">
          Please wait as we redirect you
        </p>
      </div>
    </main>
  );
};

export default IndexPage;

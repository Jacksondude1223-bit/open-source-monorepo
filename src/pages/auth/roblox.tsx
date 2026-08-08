/* eslint-disable @next/next/no-img-element */
import { GetServerSideProps } from 'next';
import { caller } from '~/server/routers/_app';
import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { setCookie } from 'cookies-next';
import posthog from 'posthog-js';
//@ts-expect-error ahh its eight
import * as THREE from "~/components/vanta/three";
//@ts-expect-error ahh its eight
import NET from '~/components/vanta/vanta';
import Link from 'next/link';
import { BRAND_MARK_DARK } from '~/utils/brand';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return new Promise(async (resolve) => {
    const { req, res } = context;
    const { code, state } = context.query as { code: string; state?: string; };
    if (!code) {
      return resolve({
        redirect: {
          destination: '/',
          permanent: false,
        },
      });
    }

    if (state?.startsWith('workspaceCreateLink')) {
      // Open Cloud link initiated from the workspace creation flow. Exchange the
      // code on the integrations page, then return to the creation flow so it can
      // show the "finished" screen once the first sync completes.
      const groupId = state.split(':')[1];
      return resolve({
        redirect: {
          destination: `/workspaces/${groupId}/settings/integrations/roblox?code=${code}&returnTo=create`,
          permanent: false,
        },
      });
    }

    if (state?.startsWith('workspaceLink')) {
      const groupId = state.split(':')[1];
      return resolve({
        redirect: {
          destination: `/workspaces/${groupId}/settings/integrations/roblox?code=${code}`,
          permanent: false,
        },
      });
    }

    caller.auth
      .robloxLogin({ code })
      .then((resp) => {
        setCookie('ReAdmin_Session', resp.token, {
          req,
          res,
          expires: new Date(Date.now() + (1000 * 60 * 60 * 24 * 6)),
        });
        return resolve({
          props: { code: resp.token, name: resp.name, userId: resp.userId, state: state || '' },
        });
      })
      .catch((err) => {
        return resolve({
          props: { errMsg: err.message },
        });
      });
  });
};

export default function Page(props: PropsWithChildren<{ code: string; userId: string; name: string; state?: string; } | { errMsg: string }>) {
  const { code, userId, name, state, errMsg } = props as any;
  const router = useRouter();
  const [vantaEffect, setVantaEffect] = useState<any>(0);
  const vantaRef = useRef(null);
  useEffect(() => {
    if (code) {
      if (!router.isReady) {
        return;
      }
      if (!code) {
        router.push('/');
      }
      localStorage.setItem('token', code);
      window.location.href = state ? state : '/dashboard';

      if (posthog) {
        posthog.identify(userId, {
          name: name,
          userId,
        });
      }
    }

  }, [code || '', router, router.isReady]);


  useEffect(() => {
    if (!vantaEffect) {
      try {
        setVantaEffect(
          NET({
            el: vantaRef.current,
            THREE: THREE,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            points: 16,
            minHeight: 200.00,
            minWidth: 200.00,
            scale: 1.00,
            scaleMobile: 1.00,
            color: 0x4e82e3,
            backgroundColor: 0x161616,
            spacing: 18.00
          })
        );
      } catch (e) {

      }
    }
    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
  }, [vantaEffect]);

  return (

    <div ref={vantaRef} className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8 h-screen" style={{ backgroundColor: '#161616' }}>
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <img
          className="mx-auto h-10 w-auto"
          src={BRAND_MARK_DARK}
          alt="ReAdmin"
        />
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-white">
          {errMsg ? errMsg == 'User is not authorized to access the development enviorment.' ? 'You are not authorized.' : 'Something went wrong...' : `Welcome back, ${name}`}
        </h2>
      </div>

      <div className="max-w-sm w-full self-center mt-4 justify-center flex flex-col">
        <p className="text-gray-100 text-center text-sm mt-4">{errMsg ? errMsg == 'User is not authorized to access the development enviorment.' ? `You are not authorized to access the ReAdmin development enviorment. If you believe this is a mistake contact us on Discord.` : errMsg : 'Please wait as we log you into ReAdmin.'}</p>
      </div>
      {errMsg == 'User is not authorized to access the development enviorment.' && (
        <div className="max-w-sm w-full self-center mt-4 justify-center flex flex-col">
          <Link href="/login" className="text-gray-100 hover:text-gray-300 font-bold text-center text-sm mt-4">Go back to login</Link>
        </div>
      )}

    </div>
  )
}
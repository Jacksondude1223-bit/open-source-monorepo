/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { getBaseUrl } from '~/utils/trpc';
//@ts-expect-error ahh its eight
import * as THREE from "~/components/vanta/three";
//@ts-expect-error ahh its eight
import NET from '~/components/vanta/vanta';
import Button from '~/components/forms/Button';
import { DiscordIcon, RobloxIcon } from '~/components/icons';
import { useRouter } from 'next/router';
import { Alert } from '~/components/page_components/alerts';
import Link from 'next/link';

export default function Page() {
  const [vantaEffect, setVantaEffect] = useState<any>(0);
  const vantaRef = useRef(null);
  const router = useRouter();

  const baseUrl = getBaseUrl(); // does not have slash
  const stateParam = router.query.state;
  const state = Array.isArray(stateParam) ? stateParam[0] : stateParam;

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
          src="https://cdn.readmin.app/readmin-public/RA-White-RA.png"
          alt="ReAdmin"
        />
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-white">
          Sign in with Roblox
        </h2>
      </div>

      <div className="max-w-sm w-full self-center mt-4 justify-center flex flex-col">
        <div className='flex flex-col gap-4'>
          <Button href={`https://authorize.roblox.com/?client_id=8369795969584799403&response_type=Code&redirect_uri=${encodeURI(`${baseUrl}/auth/roblox`)}&scope=${[
            'openid',
            'profile',
            'group:read'
          ].map(scope => encodeURIComponent(scope)).join('+')}&step=landing${state ? `&state=${encodeURIComponent(state as string)}` : ''}`} icon={RobloxIcon} variant="discrete" className=''>Login with Roblox</Button>
          <Button href={`https://discord.com/oauth2/authorize?client_id=${process.env?.NEXT_PUBLIC_DISCORD_CLIENT_ID}&response_type=code&scope=identify&redirect_uri=${encodeURI(`${baseUrl}/auth/discord`)}${state ? `&state=${encodeURIComponent(state as string)}` : ''}`} icon={DiscordIcon} variant="discrete" className=''>Login with Discord</Button>
        </div>

        <p className="text-gray-500 text-center text-sm mt-4">By using ReAdmin you agree to our <a href="https://readmin.app/legal/terms">Terms of Service</a>, and <a href="https://readmin.app/legal/privacy">Privacy Policy</a>.</p>
      </div>

    </div>
  )
}

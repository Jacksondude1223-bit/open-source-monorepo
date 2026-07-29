'use client';
/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import PageHeading from '~/components/layouts/PageHeading';
import AuthedLayout from '~/components/layouts/PageLayout';
import { useUser } from '~/components/contexts/user';
import { trpc } from '~/utils/trpc';
import Link from 'next/link';

export default function DashboardPage() {
  const user = useUser();
  const router = useRouter();

  if ('loading' in user) {
    return (<></>)
  }
  if (!user || !user?.user) {
    if (router.isReady && typeof window !== 'undefined') {
      router.push('/');
    }
    return (<></>)
  }
  const moderation = user.user.dbUser?.isModerated;
  const mutation = trpc.user.reactivateWarnedAccount.useMutation();

  if (moderation == false || moderation?.is == false) {
    if (router.isReady && typeof window !== 'undefined') {
      router.push('/dashboard');
    }
    return (<></>)
  }

  if (moderation?.bannedBy == 'billing') {
    return (
      <>
        <PageHeading title="Your account has been banned by ReAdmin!" description='You are unable to use ReAdmin due to non-payment for ReAdmin services.' />
        <p className="font-bold text-lg">You are banned from using ReAdmin due to an overdue invoice. Your ban will be automatically revoked once the invoice is paid.</p>
        <p>{moderation.reason}</p>

        <Button href={moderation.invoiceUrl} variant="primary" size="medium" className='mt-4' target='_blank'>Pay Invoice</Button>

        <small>If you pay this invoice and are not automatically unbanned, <Link href="https://discord.gg/readmin-845829826626584606" target="_blank" className="dark:text-blue-100 text-blue-900 transiton hover:text-blue-500">please contact our support team immediately.</Link></small>
      </>
    );
  }

  return (
    <>
      <PageHeading title="Your account has been moderated by ReAdmin!" description='You are unable to use ReAdmin.' />
      <p className="font-bold text-lg">You are {moderation?.type == 'ban' ? 'banned from using ReAdmin' : 'being warned by ReAdmin.'}</p>
      <p>Moderator Reason: {moderation.reason}</p>
      {moderation?.type == 'warning' && (
        <Button variant="primary" size="medium" className='mt-4' onClick={() => {
          mutation.mutateAsync().then(() => {
            toast.success('Reactivated Account')
            window.location.href = '/';
          }).catch(e => {
            toast.error(e)
          })
        }}>Reactivate Account</Button>
      )}

    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <AuthedLayout navigation={[]}>{page}</AuthedLayout>
);

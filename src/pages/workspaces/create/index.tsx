'use client';
/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '~/components/page_components/DashboardLayout';
import { useUser } from '~/components/contexts/user';
import { getBaseUrl, RouterOutput, trpc } from '~/utils/trpc';
import Dropdown from '~/components/forms/Dropdown';
import { ArrayToValueType } from '~/server/routers/_app';
import { GroupRole } from '~/services/types/roblox.types';
import Toggle from '~/components/forms/Toggle';
import Button from '~/components/forms/Button';
import { BookOpenIcon, ChevronLeftIcon, PlusCircleIcon } from '@heroicons/react/20/solid';
import {
  BoltIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  ServerStackIcon,
  CalendarDaysIcon,
  FolderOpenIcon,
  TrophyIcon,
  ArrowPathIcon,
  PuzzlePieceIcon,
  CheckCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
//@ts-expect-error ahh its eight
import * as THREE from "~/components/vanta/three";
//@ts-expect-error ahh its eight
import FOG from '~/components/vanta/vanta-fog';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Spinner from '~/components/ui/Spinner';
import { GetServerSideProps } from 'next';
import { SHUTDOWN_INFO_URL } from '~/services/constants/Subscriptions';
import { isShutdownDeployment } from '~/utils/deployment';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';

/** Outcome-led premium feature showcase for the create flow's right panel. */
type CreateFeature = {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof BoltIcon;
  /** Floating badge shown over the screenshot to make it feel alive. */
  stat?: { value: string; label: string };
  media?: { type: 'video' | 'image'; src: string; alt?: string };
};

const CREATE_PREMIUM_FEATURES: CreateFeature[] = [
  {
    eyebrow: 'Activity Tracking',
    title: 'Finally know who your best staff really are',
    description:
      'Measure total, active, idle, and typing time for tens of thousands of staff at once — turned into clean weekly distributions you can actually trust. Promote on real effort, not guesswork.',
    icon: ClockIcon,
    stat: { value: '+18%', label: 'active time' },
    media: {
      type: 'image',
      src: 'https://readmin.app/app/user-profile.png',
      alt: 'ReAdmin activity tracking dashboard',
    },
  },
  {
    eyebrow: 'Remote Admin',
    title: 'Run your games without ever opening Roblox',
    description:
      'Notify, kick, ban, and watch live chat across every server — straight from the dashboard or Discord. Spot problems and act on them in seconds, wherever you are.',
    icon: BoltIcon,
    stat: { value: '1-click', label: 'kick & ban' },
    media: {
      type: 'image',
      src: 'https://readmin.app/app/games.png',
      alt: 'ReAdmin remote admin and live games dashboard',
    },
  },
  {
    eyebrow: 'Staff Records',
    title: 'A complete history for every staff member',
    description:
      "Promotions, demotions, write-ups, and terminations all in one place — safely recorded and never deleted — for confident audits, promotions, and decisions.",
    icon: FolderOpenIcon,
    stat: { value: '100%', label: 'actions logged' },
    media: {
      type: 'image',
      src: 'https://readmin.app/app/staff-history.png',
      alt: 'ReAdmin staff history and action log',
    },
  },
  {
    eyebrow: 'Discord Integration',
    title: 'Manage everything from your server',
    description:
      'Run admin actions, review performance, and mirror logs without ever leaving Discord — keeping your whole team in sync.',
    icon: ChatBubbleLeftRightIcon,
    stat: { value: 'Live', label: 'in Discord' },
    media: {
      type: 'image',
      src: 'https://readmin.app/features/discord-activity-summary.png',
      alt: 'ReAdmin Discord activity summary',
    },
  },
  {
    eyebrow: 'Views',
    title: 'Compare staff side-by-side at scale',
    description:
      'Filter, sort, and slice performance with custom Views to instantly surface your top performers — and spot who is coasting.',
    icon: ChartBarIcon,
    stat: { value: 'Top 50', label: 'leaderboard' },
    media: {
      type: 'image',
      src: 'https://readmin.app/app/views.png',
      alt: 'ReAdmin custom Views dashboard',
    },
  },
  {
    eyebrow: 'Resource Hub',
    title: 'Secure handbooks & guides for your team',
    description:
      'Lock resource containers to departments and track exactly who opened what, and when — with a full audit trail.',
    icon: FolderOpenIcon,
    stat: { value: 'Audited', label: 'every open' },
    media: {
      type: 'image',
      src: 'https://readmin.app/app/hub.png',
      alt: 'ReAdmin resource hub',
    },
  },
  {
    eyebrow: 'Session Logging',
    title: 'Schedule sessions without the role fights',
    description:
      'Staff claim roles by your rules, link sessions to live games, and run multi-server sessions — so everyone knows exactly what they are doing.',
    icon: CalendarDaysIcon,
    stat: { value: 'Multi', label: 'server sessions' },
    media: {
      type: 'image',
      src: 'https://readmin.app/app/sessions.png',
      alt: 'ReAdmin sessions page',
    },
  },
  {
    eyebrow: 'Activity Goals',
    title: 'Set quotas everyone can see',
    description:
      'Give staff clear performance goals so they always know what is expected — and can prove they are hitting it.',
    icon: TrophyIcon,
  },
  {
    eyebrow: 'Ranking API',
    title: 'Rank on Roblox automatically',
    description:
      'Rerank and derank users from the dashboard, Discord, or your own code with our HTTP Ranking APIs.',
    icon: ServerStackIcon,
  },
  {
    eyebrow: 'Automated Distributions',
    title: 'Your week, reset on your schedule',
    description:
      'Performance metrics roll over on the exact day you choose, with every period stored securely so nothing is ever lost.',
    icon: ArrowPathIcon,
  },
  {
    eyebrow: 'Integrations',
    title: 'Connect Roblox & Discord in minutes',
    description:
      'Members, roles, rankings, and game events flow in automatically — no manual exports, no copy-paste.',
    icon: PuzzlePieceIcon,
  },
];

const CREATE_TRUST_STATS = [
  { value: '1,000+', label: 'Communities' },
  { value: '8M+', label: 'Users tracked' },
  { value: '30 min', label: 'Sync interval' },
];

/**
 * Signup is closed on ReAdmin's hosted service while it shuts down, but *not* on
 * self-hosted deployments - so the decision is made from the host this page was
 * requested on, server side, to avoid flashing the signup form at people who
 * can't use it.
 */
export const getServerSideProps: GetServerSideProps<{ shuttingDown: boolean }> = async ({ req }) => {
  const forwardedHost = req.headers['x-forwarded-host'];
  const host =
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.split(',')[0]?.trim() ||
    req.headers.host ||
    null;
  return { props: { shuttingDown: isShutdownDeployment(host) } };
};

export default function DashboardPage({ shuttingDown }: { shuttingDown: boolean }) {
  const info = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const { data: workspaces } = trpc.workspaces.getUserWorkspacesEligibleForCreation.useQuery();
  const finishWorkspaceSubscriptionMutation = trpc.workspaces.workspace.settings.billing.finishWorkspaceSubscribe.useMutation();
  const createWorkspaceProcedure = trpc.workspaces.createWorkspace.useMutation();
  const [group, setGroup] = useState<ArrayToValueType<RouterOutput['workspaces']['getUserWorkspacesEligibleForCreation']> | null>(null);
  const [minSyncRole, setMinSyncRole] = useState<GroupRole | null>(null);
  const [usePremiumPromotion, setUsePremiumPromotion] = useState(false);

  // Optional one-time "done-for-you" setup add-on, only offered alongside the
  // premium trial so it rides along on the subscription's first invoice.
  const [setupAssist, setSetupAssist] = useState(false);
  const [setupContactMethod, setSetupContactMethod] = useState<'discord' | 'email'>('discord');
  const [setupContact, setSetupContact] = useState('');
  const [setupPreviousTool, setSetupPreviousTool] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [isCreatingHidden, setIsCreatingHidden] = useState(false);
  const [needsOAuthLink, setNeedsOAuthLink] = useState(false);
  const [vantaEffect, setVantaEffect] = useState<any>(0);
  const [premiumSetupWorked, setPremiumSetupWorked] = useState(false);
  const vantaRef = useRef(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function transitionToCreated() {
    setIsCreated(true);
    setTimeout(() => {
      setIsCreatingHidden(true)
    }, 700)

  }
  function resumeWorkspaceCreation(groupId: string) {

    if (searchParams.get('checkout_session')) {
      // ensure subscription is handled before leaving this page.
      finishWorkspaceSubscriptionMutation.mutateAsync({
        groupId,
        subscriptionId: searchParams.get('checkout_session') || '',
      }).then(() => {
        setPremiumSetupWorked(true);
      }).catch(e => {
        toast.error(`Something went wrong while trying to setup your workspace subscription, please contact support. ${e.message}`)
      })


    }

    // Poll the workspace's creation status. A workspace cannot sync its members /
    // roles (and therefore is not usable) until the owner links their Roblox Open
    // Cloud OAuth integration. So:
    //   - If Open Cloud is not linked yet -> stop and require the user to link it.
    //   - Once linked, the first sync runs and sets finishedSetup -> show success.
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    const checkStatus = () => {
      utils.workspaces.getWorkspaceCreationStatus
        .fetch({ groupId }, { staleTime: 0 })
        .then(status => {
          if (!status.usingOpenCloud) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setNeedsOAuthLink(true);
            return;
          }
          setNeedsOAuthLink(false);
          if (status.finishedSetup == true) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            transitionToCreated();
          }
        })
        .catch(() => {
          // transient errors -> keep polling
        });
    };
    checkStatus();
    pollRef.current = setInterval(checkStatus, 2000);
  }

  /*
    resume_finish_creating = group id
    checkout_session = checkout session id
    checkout_abandoned = true
  */

  function transitionToCreation() {
    setIsCreating(true)
    setTimeout(() => {
      setIsHidden(true)
    }, 700)
    setTimeout(async () => {
      if (!vantaEffect) {
        setVantaEffect(
          FOG({
            el: vantaRef.current,
            THREE: THREE,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.00,
            minWidth: 200.00,
            highlightColor: 0xa84bb0,
            midtoneColor: 0x5998b8,
            lowlightColor: 0x2300e3,
            baseColor: 0xd6d6d6,
            blurFactor: 0.90,
            speed: 2.90,
            zoom: 1.20
          })
        );
      }
    }, 720)
  }

  useEffect(() => {
    // Nothing to resume once signups are closed - the shutdown notice is all
    // this page renders.
    if (!shuttingDown && searchParams.get('resume_finish_creating')) {
      const groupId = searchParams.get('resume_finish_creating') || '';
      // Fetch group info via ReAdmin's Open Cloud (not the workspace OAuth, which may
      // not be linked yet at this point in creation) so the group name renders correctly.
      utils.workspaces.getGroupCreationInfo.fetch({ groupId }).then(groupInfo => {
        setGroup(groupInfo)
        transitionToCreation()
        setTimeout(() => {
          resumeWorkspaceCreation(groupId)
        }, 2000) // artifical slowness just to not be disorienting on transitions
      }).catch(() => {
        // If the Open Cloud lookup fails we still attempt to resume so the user
        // can link their integration and finish setup.
        transitionToCreation()
        setTimeout(() => {
          resumeWorkspaceCreation(groupId)
        }, 2000)
      })
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ReAdmin's hosted service is winding down, so readmin.app takes no new
  // workspaces. Self-hosted deployments never see this and sign up as normal.
  if (shuttingDown) {
    return (
      <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gray-50 px-6 py-12 dark:bg-gray-950">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="animate-aurora absolute -top-32 -left-20 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-600/20" />
          <div className="animate-aurora absolute bottom-0 -right-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl [animation-delay:-8s] dark:bg-indigo-500/15" />
        </div>

        <div className="fade-in animate-in slide-in-from-top relative z-10 w-full max-w-2xl text-center duration-700">
          <img
            src="https://cdn.readmin.app/readmin-public/RA-Black.png"
            className="mx-auto h-10 w-auto dark:hidden"
            alt="ReAdmin"
          />
          <img
            src="https://cdn.readmin.app/readmin-public/RA-White.png"
            className="mx-auto hidden h-10 w-auto dark:block"
            alt="ReAdmin"
          />

          <span className="mt-8 inline-flex items-center gap-x-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
            ReAdmin is shutting down
          </span>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            New workspaces can no longer be created
          </h1>
          <p className="mt-4 text-lg font-light text-gray-600 dark:text-gray-300">
            We&apos;ve closed signups while we wind ReAdmin down, so this group
            can&apos;t be set up. Existing workspaces keep working for now — our
            shutdown notice explains the timeline, what happens to your data, and
            how to export it.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
            <Button
              variant="primary"
              size="medium"
              icon={ArrowTopRightOnSquareIcon}
              target="_blank"
              href={SHUTDOWN_INFO_URL}
            >
              Read the shutdown notice
            </Button>
            <Button variant="discrete" size="medium" icon={ChevronLeftIcon} href="/dashboard">
              Back to your workspaces
            </Button>
          </div>

          <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">
            Questions about your group or your data? Reach us on{' '}
            <Link
              href="https://discord.gg/readmin-845829826626584606"
              target="_blank"
              className="font-medium text-blue-600 transition hover:text-blue-500 dark:text-blue-400"
            >
              Discord
            </Link>
            .
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* finish creating */}
      {isHidden && (
        <div ref={vantaRef} className={`${(isCreatingHidden || needsOAuthLink) ? 'justify-center' : ''} flex flex-col fade-in animate-in duration-1000 w-full h-full px-6 py-7 2xl:py-12 2xl:px-24 bg-blue-950 min-h-screen max-h-screen`}>
          {needsOAuthLink ? ( // Open Cloud must be linked before the workspace can sync.
            <div className="fade-in animate-in slide-in-from-top duration-1000 flex flex-col bg-white shadow-lg rounded-lg px-6 py-4 self-center align-middle max-w-xl">
              <img src="https://cdn.readmin.app/readmin-public/ra-black-ra.png" className='w-20 h-auto self-center' alt="ReAdmin logo" />
              <h1 className="mt-4 font-bold text-black text-2xl text-center">One last step: Link your Roblox integration</h1>
              <p className="text-gray-700 mt-2 text-sm text-center">
                ReAdmin relies on Roblox Open Cloud to read {`${group?.group?.displayName || 'your group'}'s`}{' '}members, roles, and other Roblox data, and to perform actions within Roblox. We can&apos;t finish setting up your workspace until it&apos;s linked.
              </p>
              <Button
                variant="primary"
                size="medium"
                className='w-full mt-4'
                href={`https://authorize.roblox.com/?client_id=8369795969584799403&response_type=Code&scope=${[
                  'openid',
                  'profile',
                  'group:read',
                  'group:write',
                  'legacy-group:manage'
                ].map(scope => encodeURIComponent(scope)).join('+')}&step=accountConfirm&redirect_uri=${encodeURI(`${getBaseUrl()}/auth/roblox`)}&state=workspaceCreateLink:${group?.group.id}`}
              >
                Link Roblox integration
              </Button>
              <Button variant="discrete" size="medium" icon={BookOpenIcon} className='w-full mt-2' target='_blank' href="https://docs.readmin.app">Learn more in our Docs</Button>
            </div>
          ) : isCreatingHidden == false ? ( // Workspace is still syncing
            <div className={`${isCreated == true ? 'fade-out animate-out slide-out-to-top duration-1000' : ''}`}>
              <img src="https://cdn.readmin.app/readmin-public/ra-black-ra.png" className='w-24 h-auto' alt="ReAdmin logo" />
              <h1 className="mt-4 font-bold text-black text-4xl">We are setting up {`${group?.group?.displayName}'s` || 'your'} workspace</h1>
              <p className="mt-2 text-lg font-light text-black">This wont take long, we&apos;ve got to sync your group roles, and members. You&apos;ll be going in no time.</p>
            </div>
          ) : ( // Creation is complete.
            <div className="fade-in animate-in slide-in-from-top duration-1000 flex flex-col bg-white shadow-lg rounded-lg px-6 py-4 self-center align-middle max-w-xl">
              <h1 className="font-bold text-black text-2xl text-center">Your workspace has been created!</h1>

              {premiumSetupWorked && (
                <div className='text-gray-900 max-w-lg py-2'>
                  <p>Thank you for subscribing to ReAdmin Premium! We&apos;re excited to have you on board and can&apos;t wait to see how we can help enhance your group&apos;s management experience. Join our <Link href="https://discord.gg/readmin-845829826626584606" target="_blank" className='text-blue-900 hover:text-blue-500 transition'>support server on Discord</Link> to connect with our team and get the most out of your subscription.</p>
                </div>
              )}
              {searchParams.get('checkout_abandoned') && (
                <div className='text-gray-900 max-w-lg py-2'>
                  <p>We&apos;re sorry to see that you chose not to try out ReAdmin Premium. We&apos;d love to discuss how we can help improve your group&apos;s management. Please join our <Link href="https://discord.gg/readmin-845829826626584606" target="_blank" className='text-blue-900 hover:text-blue-500 transition'>support server</Link> to chat with us!</p>
                </div>
              )}

              <p className="text-gray-700 mt-2 text-sm text-center">
                Your Roblox integration is linked and your members and roles have been synced. You&apos;re all set to start managing better.
              </p>

              <div className="flex flex-row gap-2">
                <Button variant="primary" size="medium" icon={ChevronLeftIcon} className='w-full mt-4' onClick={() => { router.push(`/workspaces/${group?.group.id}?new_workspace=true`) }}>Go to your workspace</Button>
                <Button variant="discrete" size="medium" icon={BookOpenIcon} className='w-full mt-4' target='_blank' href="https://docs.readmin.app">Checkout our Docs</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* create flow */}
      <main className={`${isHidden ? 'hidden' : isCreating == true ? 'fade-out animate-out slide-out-to-top duration-1000' : ""} min-h-screen max-h-screen grid grid-cols-1 xl:grid-cols-7`}>
        <div className="relative overflow-hidden bg-gray-50 dark:bg-gray-950 col-span-3 px-6 py-7 2xl:py-12 2xl:px-24 h-full max-h-screen overflow-y-auto">
          {/* Ambient glow to match the showcase on the right */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="animate-aurora absolute -top-32 -left-20 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-600/20" />
            <div className="animate-aurora absolute bottom-0 -right-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl [animation-delay:-8s] dark:bg-indigo-500/15" />
          </div>

          <div className="relative z-10">
            <img
              src="https://cdn.readmin.app/readmin-public/RA-Black.png"
              className="h-9 w-auto dark:hidden"
              alt="ReAdmin"
            />
            <img
              src="https://cdn.readmin.app/readmin-public/RA-White.png"
              className="hidden h-9 w-auto dark:block"
              alt="ReAdmin"
            />

            <span className="mt-6 inline-flex items-center gap-x-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 dark:border-white/10 dark:bg-white/5 dark:text-blue-300">
              <SparklesIcon className="h-3.5 w-3.5" />
              Let&apos;s set up your workspace
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              Welcome to{' '}
              <span className="bg-linear-to-r from-blue-600 via-sky-500 to-indigo-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-sky-300 dark:to-indigo-400">
                ReAdmin
              </span>
            </h1>
            <p className="mt-2 text-lg font-light text-gray-600 dark:text-gray-300">
              You&apos;re a couple of clicks away from managing your group like a
              real company. Pick a group and you&apos;re in.
            </p>

            {/* Reassurance strip */}
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {[
                'Free to start',
                'Setup in minutes',
                'No card to create',
              ].map((point) => (
                <span key={point} className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <CheckCircleIcon className="h-4 w-4 flex-none text-blue-500 dark:text-blue-400" />
                  {point}
                </span>
              ))}
            </div>
          </div>

          <div className="relative z-10">
          {('loading' in info || !workspaces) ? (
            <div className='flex flex-row gap-2 mt-4 align-middle fade-in animate-in slide-in-from-top'>
              <Spinner size={10} align="center" className='self-center align-middle' />
              <div className='self-center align-middle'>
                <p className="font-bold">Please wait as we load some information about your groups</p>
                <p className="text-sm">This wont take long.</p>
              </div>
            </div>
          ) : (
            <form className='mt-8 flex flex-col gap-2' onSubmit={(event) => {
              event.preventDefault();
              if (usePremiumPromotion && setupAssist && !setupContact.trim()) {
                toast.error(
                  setupContactMethod === 'email'
                    ? 'Please add an email so we can reach you about your setup.'
                    : 'Please add your Discord username so we can reach you about your setup.',
                );
                return;
              }
              transitionToCreation()
              // create workspace

              createWorkspaceProcedure.mutateAsync({
                groupId: group?.group.id.toString() || '',
                roleId: minSyncRole?.rank.toString() || '',
                redeemPromotion: usePremiumPromotion,
                path: getBaseUrl().toString() || '',
                ...(usePremiumPromotion && setupAssist
                  ? {
                      setupAssist: {
                        contactMethod: setupContactMethod,
                        contact: setupContact.trim(),
                        ...(setupPreviousTool.trim() ? { previousTool: setupPreviousTool.trim() } : {}),
                      },
                    }
                  : {}),
              }).then(creationResponse => {
                if ('url' in creationResponse && creationResponse.url) {
                  router.push(creationResponse?.url);
                } else {
                  resumeWorkspaceCreation(group?.group.id.toString() || '');
                }
              }).catch((err) => {
                toast.error(`An error occurred while creating your workspace. Please try again later. ${err}`)
                router.push('/dashboard')
              })
            }}>


              {workspaces.length == 0 ? (
                <div className='fade-in animate-in slide-in-from-top flex flex-col gap-2 mt-4'>
                  <p className="text-gray-500">You don&apos;t have any groups that you can create a workspace for. Please create a group in Roblox and try again.</p>
                </div>
              ) : (
                <Dropdown
                  label="Select a group"
                  choices={workspaces.map(group => ({ id: group.group.id.toString(), name: group.group.displayName?.toString() || '', image: group.group.thumbnail?.toString() || '' }))}
                  onChange={(groupId) => {
                    const selected = workspaces.find(findingGroup => findingGroup.group.id.toString() === groupId.toString()) || null;
                    setGroup(selected);
                    // Default the minimum sync role to the lowest eligible rank so the
                    // user can continue straight away without being forced to change it.
                    const eligible = (selected?.roles ?? []).filter(role => ![0, 255].includes(role?.rank)).sort((a, b) => a.rank - b.rank);
                    setMinSyncRole(eligible[0] ?? null);
                  }}
                />
              )}

              {(group && group.roles && group.roles.length > 0) && (<>
                <div className='fade-in animate-in slide-in-from-top flex flex-col gap-2 mt-4'>
                  <Dropdown
                    label="What do you want your minimum sync role to be? (This is usually your lowest staff rank)"
                    choices={group.roles.filter(role => !([0, 255].includes(role?.rank))).filter(role => !(role.rank === 1 && role.name === 'Member')).sort((a, b) => a.rank - b.rank).map(role => ({ id: role.rank.toString(), name: `(${role.rank}) ${role.name?.toString()}` || '' }))}
                    defaultValue={(group.roles.filter(role => !([0, 255].includes(role?.rank))).filter(role => !(role.rank === 1 && role.name === 'Member')).sort((a, b) => a.rank - b.rank)[0]?.rank ?? 0).toString()}
                    onChange={(rankId) => { setMinSyncRole(group?.roles?.find(role => role.rank.toString() == rankId.toString()) || null) }}
                  />
                  <p className="text-xs text-gray-500 pt-1">
                    We&apos;ve pre-filled this with your lowest staff rank — you can leave it as-is. It&apos;s the minimum role required to sync data from Roblox to ReAdmin. For premium workspaces, any users under this role who join your game will have their data deleted from ReAdmin once they leave the server -- and will not have any data saved. We suggest setting this to a role that is where you begin to care about activity.
                  </p>
                </div>
              </>)}

              {(minSyncRole) && (<>
                <div className='fade-in animate-in slide-in-from-top flex flex-col gap-2 mt-4'>
                  <Toggle value={false} onChange={(v) => { setUsePremiumPromotion(v); if (!v) { setSetupAssist(false); } }} id="premiumTrial" titleClass='text-gray-900 dark:text-white' title="Try Premium Free for 7 Days!" description="Start your free 7-day Premium trial today! A credit card is required, but you can cancel your trial or subscription anytime without any hassle. Enjoy exclusive features and enhance your experience!" />

                </div>
              </>)}

              {(minSyncRole && !usePremiumPromotion) && (
                <div className='fade-in animate-in slide-in-from-top mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-900/10'>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">Heads up: without Premium you&apos;re barely scratching the surface</p>
                  <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/80">
                    The free workspace covers the basics, but everything that makes ReAdmin powerful &mdash; activity tracking, remote admin, Discord commands, sessions, the resource hub, ranking APIs and more &mdash; lives in Premium. Start the free 7-day trial above to see what your group is really capable of, and let our team set it all up for you.
                  </p>
                </div>
              )}

              {usePremiumPromotion && (
                <div className='fade-in animate-in slide-in-from-top mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-5 dark:border-blue-900/50 dark:bg-blue-900/10'>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={setupAssist}
                      onChange={(e) => setSetupAssist(e.target.checked)}
                      className="mt-1 h-5 w-5 accent-blue-600"
                    />
                    <span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-gray-900 dark:text-white">
                          Have us set it up for you
                        </span>
                        <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                          +$15 one-time
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-gray-600 dark:text-gray-300">
                        Don&apos;t want to do the setup yourself? Add this and our team will configure your workspace for you, and bringing over whatever data we can from your current tool. It&apos;s added to your first invoice.
                      </span>
                    </span>
                  </label>

                  {setupAssist && (
                    <div className="mt-4 space-y-4 pl-8">
                      <div>
                        <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                          How should we reach you to get started?
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800">
                            {([
                              { value: 'discord', label: 'Discord' },
                              { value: 'email', label: 'Email' },
                            ] as const).map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setSetupContactMethod(opt.value)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${setupContactMethod === opt.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          <input
                            type={setupContactMethod === 'email' ? 'email' : 'text'}
                            value={setupContact}
                            maxLength={200}
                            onChange={(e) => setSetupContact(e.target.value)}
                            placeholder={setupContactMethod === 'email' ? 'you@example.com' : 'your Discord username (e.g. yourname)'}
                            className="w-full flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="create-previous-tool" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Moving from another tool? (optional)
                        </label>
                        <input
                          id="create-previous-tool"
                          type="text"
                          value={setupPreviousTool}
                          maxLength={120}
                          onChange={(e) => setSetupPreviousTool(e.target.value)}
                          placeholder="e.g. Hyra, Trello, a spreadsheet..."
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                          Tell us what you use today and we&apos;ll migrate whatever is technically possible to bring across.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}


              {(minSyncRole) && (
                <Button variant="primary" className='fade-in animate-in slide-in-from-top w-full mt-4' type="submit" icon={PlusCircleIcon}>Create Workspace</Button>
              )}


            </form>
          )}
          </div>

        </div>
        <div className="relative max-h-screen overflow-y-scroll bg-gray-950 col-span-4 px-6 py-7 2xl:py-12 2xl:px-24 h-full text-white">
          {/* Ambient aurora glows */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="animate-aurora absolute -top-24 right-0 h-96 w-96 rounded-full bg-blue-600/25 blur-3xl" />
            <div className="animate-aurora absolute top-1/3 -left-24 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl [animation-delay:-6s]" />
            <div className="animate-aurora absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl [animation-delay:-10s]" />
          </div>

          <div className="relative z-10">
            <span className="inline-flex items-center gap-x-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-blue-300 backdrop-blur">
              <SparklesIcon className="h-3.5 w-3.5" />
              Why groups go Premium
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight">
              Run your group like{' '}
              <span className="bg-linear-to-r from-blue-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
                a real company
              </span>
            </h1>
            <p className="mt-3 text-lg font-light text-gray-300">
              The free workspace keeps you organised — Premium is where ReAdmin
              becomes a superpower. Start the{' '}
              <span className="font-semibold text-white">7-day free trial</span>{' '}
              and cancel anytime.
            </p>

            {/* Social proof */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {CREATE_TRUST_STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/10 bg-white/4 px-3 py-3 text-center backdrop-blur transition hover:border-blue-400/40"
                >
                  <div className="text-lg font-bold text-white">{stat.value}</div>
                  <div className="mt-0.5 text-xs text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Trusted by Washiez, Cineblox, Tsunami Sushi, and 1,000+ Roblox communities.
            </p>

            {/* Rich, screenshot-led feature showcase */}
            <div className="mt-8 flex flex-col gap-6">
              {CREATE_PREMIUM_FEATURES.filter((f) => f.media).map((feature, i) => (
                <div
                  key={feature.eyebrow}
                  className="group rounded-3xl border border-white/10 bg-white/3 p-5 transition duration-300 hover:border-blue-400/30 hover:bg-white/5"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-blue-500/15 ring-1 ring-blue-400/30 transition group-hover:scale-105">
                      <feature.icon className="h-6 w-6 text-blue-300" />
                    </span>
                    <div>
                      <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-300">
                        Premium · {feature.eyebrow}
                      </span>
                      <h2 className="mt-1.5 text-lg font-semibold text-white">{feature.title}</h2>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-gray-400">{feature.description}</p>

                  {/* Browser-chrome screenshot with glow + floating stat */}
                  <div className="group/frame relative mt-5">
                    <div className="absolute -inset-1 z-0 rounded-[1.4rem] bg-linear-to-r from-blue-600/30 via-indigo-500/30 to-sky-500/30 opacity-50 blur-2xl transition duration-500 group-hover:opacity-90" />
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gray-900/70 shadow-2xl ring-1 ring-white/5 backdrop-blur">
                      <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/5 px-4 py-2.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                        <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                        <span className="ml-3 truncate rounded-md bg-white/5 px-2.5 py-0.5 text-[11px] text-gray-400">
                          panel.readmin.app
                        </span>
                        <span className="ml-auto hidden items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-300 ring-1 ring-green-400/20 sm:inline-flex">
                          <span className="animate-pulse-glow h-1.5 w-1.5 rounded-full bg-green-400" />
                          Live
                        </span>
                      </div>
                      {feature.media?.type === 'video' ? (
                        <video src={feature.media.src} controls className="w-full" />
                      ) : (
                        <img
                          src={feature.media!.src}
                          alt={feature.media!.alt || feature.title}
                          loading="lazy"
                          className="w-full"
                        />
                      )}
                    </div>

                    {feature.stat && (
                      <div
                        className={`animate-float ${i % 2 === 0 ? '-right-3 top-16' : '-left-3 top-16'} absolute z-20 hidden items-center gap-2.5 rounded-xl border border-white/10 bg-gray-900/85 px-3 py-2 shadow-xl ring-1 ring-white/10 backdrop-blur-md sm:flex`}
                        style={{ animationDelay: `${-(i % 4)}s` }}
                      >
                        <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                          <feature.icon className="h-4 w-4 text-blue-300" />
                        </span>
                        <div className="leading-tight">
                          <div className="text-sm font-bold text-white">{feature.stat.value}</div>
                          <div className="text-[11px] text-gray-400">{feature.stat.label}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* "And more" compact grid for variety */}
            <div className="mt-8">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-300">
                And a whole lot more
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CREATE_PREMIUM_FEATURES.filter((f) => !f.media).map((feature) => (
                  <div
                    key={feature.eyebrow}
                    className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/3 p-4 transition hover:border-blue-400/30 hover:bg-white/5"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 ring-1 ring-blue-400/30 transition group-hover:scale-105">
                      <feature.icon className="h-5 w-5 text-blue-300" />
                    </span>
                    <h4 className="mt-3 text-sm font-semibold text-white">{feature.eyebrow}</h4>
                    <p className="mt-1 text-xs leading-5 text-gray-400">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Closing reassurance / CTA */}
            <div className="relative mt-8 overflow-hidden rounded-3xl border border-blue-400/20 bg-linear-to-br from-blue-600/20 via-white/3 to-white/2 p-6">
              <div className="animate-aurora absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="relative flex items-start gap-3">
                <CheckCircleIcon className="mt-0.5 h-6 w-6 flex-none text-blue-300" />
                <div>
                  <p className="text-base font-semibold text-white">Try all of it free for 7 days</p>
                  <p className="mt-1 text-sm text-gray-300">
                    A card is required to start, but you can cancel your trial anytime — no contract, no hassle. Want a head start? Add done-for-you setup and our team will configure everything (and migrate your old tool) for you.
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-sm font-light text-gray-500">plus more...</p>
          </div>
        </div>
      </main>
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <DashboardLayout disableMl={true}>{page}</DashboardLayout>
);

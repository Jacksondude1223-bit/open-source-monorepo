'use client';
/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router';
import { ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import Dropdown from '~/components/forms/Dropdown';
import MultiSelect from '~/components/forms/MultiSelect';
import TextLabel from '~/components/forms/TextLabel';
import { TypingSpeedTest } from '~/components/forms/TypingSpeedTest';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { DashboardLayout } from '~/components/page_components/DashboardLayout';
import { trpc } from '~/utils/trpc';
import { Response } from '~/services/NewMongoTypes';
import { getButtonMeta } from '~/components/page_components/workspaces/forms/formsMeta';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserGroupIcon,
  LockClosedIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { RobloxIcon } from '~/components/icons';

export default function DashboardPage() {
  const router = useRouter();
  //@ts-expect-error gay
  const { applyOnlineId }: { applyOnlineId: string } = router.query || {
    applyOnlineId: '',
  };
  const {
    data: applicationData,
    error: applicationError,
    isError: applicationIsError,
    isPending: applicationIsLoading,
  } = trpc.applyOnline.getCenterById.useQuery({
    applyOnlineId,
  });
  const submitApplication = trpc.applyOnline.submitApplication.useMutation();
  const [startTime] = useState(Date.now());
  const [responseState, setResponseState] = useState<
    | {
      success: boolean;
      response: Response;
      quizModeEnabled: boolean;
    }
    | false
  >(false);

  if (applicationIsLoading) {
    return <LoadingPage />;
  }
  if (applicationIsError) {
    return (
      <>
        <PageHeading title="Something went wrong..." />
        <p>{applicationError.message}</p>
      </>
    );
  }

  const application = applicationData!;

  const buttonMeta = getButtonMeta(application.buttonType as any);
  const appearance = application.appearance;
  const workspace = application.workspace;
  const fontFamily = appearance?.font ? `${appearance.font}, sans-serif` : undefined;
  const accent = appearance?.theme?.accent || undefined;
  const showLogo = appearance?.showLogo !== false;
  const showBanner = appearance?.showBanner !== false;
  const logoUrl = showLogo ? workspace?.logoImage || undefined : undefined;
  // Only show a banner when one has actually been configured for this form.
  // Never silently fall back to the workspace banner.
  const bannerUrl = showBanner ? appearance?.webBannerUrl || undefined : undefined;

  function Header() {
    return (
      <div style={{ fontFamily }}>
        {bannerUrl && (
          <div className="w-full h-40 sm:h-48 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/5">
            <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className={`flex flex-row items-start justify-between gap-4 ${bannerUrl ? 'mt-5' : ''}`}>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              {application.name}
            </h1>
            {application.description && (
              <p className="mt-2 text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                {application.description}
              </p>
            )}
          </div>
          {logoUrl && (
            <img
              src={logoUrl}
              alt={workspace?.groupName || 'logo'}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover shrink-0 bg-gray-100 dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 shadow-sm"
            />
          )}
        </div>
      </div>
    );
  }

  function Requirements() {
    const perms = application.permissions;
    const reqs: { icon: any; text: string }[] = [];
    if (perms?.ranking && (perms.ranking.minRank > 0 || perms.ranking.maxRank > 0)) {
      if (perms.ranking.minRank > 0 && perms.ranking.maxRank > 0) {
        reqs.push({ icon: UserGroupIcon, text: `Group rank between ${perms.ranking.minRank} and ${perms.ranking.maxRank}` });
      } else if (perms.ranking.minRank > 0) {
        reqs.push({ icon: UserGroupIcon, text: `Minimum group rank of ${perms.ranking.minRank}` });
      } else {
        reqs.push({ icon: UserGroupIcon, text: `Maximum group rank of ${perms.ranking.maxRank}` });
      }
    }
    if (perms?.applyOnce) {
      reqs.push({ icon: LockClosedIcon, text: 'You may only submit this form once' });
    }
    if (perms?.timeUntilApplyAgain && perms.timeUntilApplyAgain > 0) {
      reqs.push({
        icon: ArrowPathIcon,
        text: `You can re-submit after ${perms.timeUntilApplyAgain} day${perms.timeUntilApplyAgain === 1 ? '' : 's'}`,
      });
    }
    if (reqs.length === 0) return <></>;
    return (
      <div
        style={{ fontFamily }}
        className="rounded-2xl border border-gray-200 dark:border-gray-700/70 bg-gray-50/70 dark:bg-gray-800/40 p-4 sm:p-5"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Requirements</p>
        <ul className="flex flex-col gap-2.5">
          {reqs.map((r, i) => (
            <li key={i} className="flex flex-row items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
              <r.icon className="w-4 h-4 shrink-0 text-gray-400" />
              {r.text}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function Links() {
    const links = application.links;
    const showRoblox = links?.showRobloxGroup && workspace?.groupId;
    const showDiscord = links?.showDiscord && workspace?.discordInvite;
    if (!showRoblox && !showDiscord) return <></>;
    return (
      <div style={{ fontFamily }} className="flex flex-row flex-wrap gap-2">
        {showRoblox && (
          <Button
            variant="default"
            icon={RobloxIcon}
            href={`https://www.roblox.com/groups/${workspace?.groupId}`}
          >
            Join the Roblox group
          </Button>
        )}
        {showDiscord && (
          <Button variant="default" href={workspace?.discordInvite || '#'}>
            Join the Discord
          </Button>
        )}
      </div>
    );
  }

  if (application.windowClosed) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        <Header />
        <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <ClockIcon className="w-10 h-10 mx-auto text-gray-400" />
          <h2 className="mt-3 font-bold text-lg">This form isn&apos;t accepting responses right now</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Responses are only accepted during a scheduled window. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  if (application.webChannelDisabled) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        <Header />
        <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <LockClosedIcon className="w-10 h-10 mx-auto text-gray-400" />
          <h2 className="mt-3 font-bold text-lg">This form is only available in-game</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Online responses are disabled for this form.
          </p>
        </div>
      </div>
    );
  }

  if (application.canApply.canApply == false) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12 flex flex-col gap-5">
        <Header />
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <XCircleIcon className="w-10 h-10 mx-auto text-red-400" />
          <h2 className="mt-3 font-bold text-lg">You&apos;re currently unable to respond to this form</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{application.canApply.reason}</p>
        </div>
        <Requirements />
        <Links />
      </div>
    );
  }

  if (submitApplication.isPending) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <ArrowPathIcon className="w-10 h-10 mx-auto text-gray-400 animate-spin" />
        <h2 className="mt-3 font-bold text-xl">Submitting your response</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">This should only take a moment.</p>
      </div>
    );
  }

  if (responseState !== false) {
    return (
      <div style={{ fontFamily }} className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        {responseState.response.score &&
          responseState.response.status == 'passed' && (
            <>
              <CheckCircleIcon className="w-14 h-14 mx-auto text-green-500" />
              <h2 className="font-bold text-2xl mt-3">Congratulations, you passed!</h2>
              <p className="text-md mt-1 text-gray-600 dark:text-gray-300">
                You scored {responseState.response.score.toString()}%.
              </p>
            </>
          )}
        {responseState.response.score &&
          responseState.response.status == 'failed' && (
            <>
              <XCircleIcon className="w-14 h-14 mx-auto text-red-500" />
              <h2 className="font-bold text-2xl mt-3">Unfortunately, you didn&apos;t pass.</h2>
              <p className="text-md mt-1 text-gray-600 dark:text-gray-300">
                You scored {responseState.response.score.toString()}%.
              </p>
            </>
          )}
        {!responseState.response.score && (
          <>
            <CheckCircleIcon className="w-14 h-14 mx-auto text-green-500" />
            <h2 className="font-bold text-2xl mt-3">{buttonMeta.confirmation}</h2>
            <p className="text-md mt-1 text-gray-600 dark:text-gray-300">
              Thanks for your response. You&apos;ll get updates via Discord.
            </p>
          </>
        )}
      </div>
    );
  }

  const sortedQuestions = [...application.questions].sort((a, b) => a.position - b.position);

  return (
    <div style={{ fontFamily }} className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12 flex flex-col gap-5">
      <Header />
      <Requirements />
      <Links />

      <form
        className="flex flex-col gap-4"
        onSubmit={(f) => {
          f.preventDefault();
          const target = f.target as any;
          const answers: {
            [key: string]: string | number;
          } = {};
          for (const question of application.questions) {
            const id = question.id;
            const response =
              question.type == 'multiple_choice' &&
                question.allow_multiple_selections
                ? JSON.parse(target[id]?.value)
                : target[id]?.value;
            answers[id] = response;
          }

          submitApplication
            .mutateAsync({
              applyOnlineId,
              applicationBody: answers,
              startTime: startTime,
              endTime: Date.now(),
            })
            .then((resp) => {
              //@ts-expect-error sucks to sucx
              setResponseState(resp);
            })
            .catch((e) => {
              toast.error(e.message);
            });
        }}
      >
        <div className="flex flex-col gap-3">
          {sortedQuestions.map((question, index) => {
            const Field = (): ReactElement => {
              if (question.type == 'text_response') {
                return (
                  <TextLabel
                    id={question.id}
                    placeholder={question.text_placeholder || 'Type your answer'}
                  />
                );
              }
              if (question.type == 'multiple_choice') {
                if (question.allow_multiple_selections) {
                  return (
                    <MultiSelect
                      id={question.id}
                      label=""
                      choices={question.choices.map((choice) => {
                        return { id: choice, name: choice };
                      })}
                    />
                  );
                }
                return (
                  <Dropdown
                    id={question.id}
                    choices={question.choices.map((choice) => {
                      return { id: choice, name: choice };
                    })}
                  />
                );
              }
              if (question.type == 'scaled_response') {
                return (
                  <TextLabel
                    id={question.id}
                    placeholder={question.number_placeholder || `${question.scale_min}–${question.scale_max}`}
                    min={question.scale_min.toString()}
                    max={question.scale_max.toString()}
                    type="number"
                  />
                );
              }
              if (question.type == 'typing_speed_test') {
                return (
                  <TypingSpeedTest
                    id={question.id}
                    label=""
                  />
                );
              }
              return <></>;
            };
            return (
              <div
                key={question.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-700/70 bg-white dark:bg-gray-800/40 p-4 sm:p-5 shadow-sm"
              >
                <label className="flex items-start gap-2 mb-3">
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 mt-0.5 tabular-nums">
                    {index + 1}.
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {question.questionText}
                  </span>
                </label>
                <Field />
              </div>
            );
          })}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="large"
          className="w-full"
          style={accent ? { backgroundColor: accent, borderColor: accent } : undefined}
        >
          {buttonMeta.label}
        </Button>
      </form>
    </div>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

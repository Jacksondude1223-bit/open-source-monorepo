'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactElement, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import Dropdown from '~/components/forms/Dropdown';
import TextLabel from '~/components/forms/TextLabel';
import Toggle from '~/components/forms/Toggle';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceFormsApplicationSidebarNavigationLayout from '~/components/page_components/workspaces/forms/WorkspaceFormsApplicationSidebarNavigationLayout';
import Card from '~/components/ui/Card';
import SectionHeader from '~/components/ui/SectionHeader';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import ReadFile from '~/utils/FileReader';
import {
  BUTTON_TYPES,
  CONFIGURABLE_STATUSES,
  DEFAULT_STATUS_OPTIONS,
  FORM_FONTS,
  STATUS_META,
} from '~/components/page_components/workspaces/forms/formsMeta';
import type { ResponseStatus } from '~/services/NewMongoTypes/Application.type';
import {
  Cog6ToothIcon,
  ShieldCheckIcon,
  PaintBrushIcon,
  EyeIcon,
  FlagIcon,
  ClockIcon,
  LinkIcon as LinkIconOutline,
} from '@heroicons/react/24/outline';

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId, applicationId }: { groupId: string; applicationId: string } =
    router.query as any;
  const workspace = useWorkspace();
  const { data: application, isPending: applicationIsLoading } =
    trpc.workspaces.workspace.forms.applications.application.getApplication.useQuery(
      { groupId, applicationId },
    );
  const mutation =
    trpc.workspaces.workspace.forms.applications.application.saveSettings.useMutation();
  const { mutateAsync: uploadWebBanner, isPending: uploadingWebBanner } =
    trpc.workspaces.workspace.forms.applications.application.uploadWebBanner.useMutation();
  const { mutateAsync: removeWebBanner } =
    trpc.workspaces.workspace.forms.applications.application.removeWebBanner.useMutation();
  const context = trpc.useUtils();

  const [audios, setAudios] = useState<{ assetId: string; name: string }[]>([]);
  const [statusOptions, setStatusOptions] = useState<ResponseStatus[]>(
    DEFAULT_STATUS_OPTIONS,
  );
  const [appearanceLoaded, setAppearanceLoaded] = useState(false);

  useEffect(() => {
    if (application && !appearanceLoaded) {
      setAudios(
        application.appearance?.audios?.map((a) => ({
          assetId: a.assetId ?? '',
          name: a.name ?? '',
        })) ?? [],
      );
      setStatusOptions(
        application.statusOptions && application.statusOptions.length > 0
          ? application.statusOptions
          : DEFAULT_STATUS_OPTIONS,
      );
      setAppearanceLoaded(true);
    }
  }, [application, appearanceLoaded]);

  function toggleStatus(id: ResponseStatus) {
    setStatusOptions((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  // Workspace loads asynchronously; wait for it before checking permissions so
  // we don't redirect away on reload / cold navigation (worse on mobile).
  if (!workspace?.department) {
    return <LoadingPage />;
  }
  if (!workspace.department.permissions?.applications?.viewApplications) {
    if (typeof window === 'undefined') return <></>;
    router.push(`/workspaces/${groupId}/forms`);
    return <></>;
  }
  if (!workspace?.department?.permissions?.applications?.editApplications) {
    return (
      <>
        <PageHeading title={`${workspace?.groupName} Forms`} disableDivide={true} />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-lg font-bold">You don&apos;t have permission to edit forms</p>
          <p className="text-gray-500 dark:text-gray-400 mt-1">If you believe this is a mistake, contact one of your group admins.</p>
        </div>
      </>
    );
  }

  if (applicationIsLoading) {
    return <LoadingPage />;
  }

  const appearance = application?.appearance;
  const visibility = application?.applicantVisibility;

  return (
    <>
      <PageHeading
        title={`${application?.name} Settings`}
        description="Configure how this form behaves, looks and collects responses."
        disableDivide={true}
      />

      <form
        className="flex flex-col gap-4"
        onSubmit={(f) => {
          f.preventDefault();
          const target = f.target as any;

          const settings = {
            name: target.name.value,
            description: target.description.value,
            applyOnlineId: target.applyOnlineId.value,
            buttonType: target.buttonType.value,
            enableResponses: target.enableResponses.checked,
            singleResponse: target.singleResponse.checked,
            minimumRole: target.minimumRole.value,
            maximumRole: target.maximumRole.value,
            minimumDaysToApplyAgain: target.minimumDaysToApplyAgain.value,
            hideIfIneligible: target.hideIfIneligible.checked,
            responseChannels: {
              web: target.channelWeb.checked,
              game: target.channelGame.checked,
            },
            responseWindow: {
              enabled: target.windowEnabled.checked,
              start: target.windowStart.value,
              end: target.windowEnd.value,
            },
            statusOptions,
            applicantVisibility: {
              showAnswers: target.visAnswers.checked,
              showQuizCorrectness: target.visQuizCorrectness.checked,
              showCorrectAnswers: target.visCorrectAnswers.checked,
              showStatus: target.visStatus.checked,
            },
            links: {
              showRobloxGroup: target.linkRoblox.checked,
              showDiscord: target.linkDiscord.checked,
            },
            appearance: {
              logoAssetId: target.logoAssetId.value,
              bannerAssetId: target.bannerAssetId.value,
              soundAssetId: target.soundAssetId.value,
              font: target.font.value,
              showLogo: target.showLogo.checked,
              showBanner: target.showBanner.checked,
              audios: audios.filter((a) => a.assetId.trim().length > 0),
              theme: {
                accent: target.themeAccent.value,
                background: target.themeBackground.value,
                surface: target.themeSurface.value,
                text: target.themeText.value,
              },
            },
          };

          mutation
            .mutateAsync({ groupId, applicationId, settings })
            .then(() => {
              toast.success('Settings saved successfully!');
              context.workspaces.workspace.forms.applications.application.getApplication.invalidate(
                { groupId, applicationId },
              );
            })
            .catch((e) => toast.error(`Something went wrong: ${e.message || e}`));
        }}
      >
        {/* General ------------------------------------------------------- */}
        <Card className="flex flex-col gap-3">
          <SectionHeader title="General" enableMt={false} icon={Cog6ToothIcon} />
          <TextLabel id="name" label="Name" defaultValue={application?.name as string} />
          <TextLabel id="description" label="Description" defaultValue={application?.description as string} />
          <Dropdown
            id="buttonType"
            label="Submission button"
            defaultValue={application?.buttonType || 'submit'}
            choices={BUTTON_TYPES.map((b) => ({ id: b.id, name: b.label }))}
          />
          <small className="-mt-1 text-gray-500 dark:text-gray-400">
            The verb shown on the response button. Each choice logs a distinct
            event (e.g. &ldquo;Application submitted&rdquo;, &ldquo;Signed&rdquo;).
          </small>
          <TextLabel
            id="applyOnlineId"
            label="Apply Online ID"
            defaultValue={application?.applyOnlineId as string}
            required={false}
          />
          {!application?.applyOnlineId ? (
            <small className="-mt-1 text-gray-500 dark:text-gray-400">
              Want a public link like https://panel.readmin.app/apply/myForm? Enter a unique ID here and it&apos;ll just work.
            </small>
          ) : (
            <p className="text-sm -mt-1">
              Your apply online link:{' '}
              <Link
                href={`https://panel.readmin.app/apply/${application?.applyOnlineId}`}
                target="__blank"
                className="font-bold text-blue-500 transition hover:text-blue-700"
              >
                https://panel.readmin.app/apply/{application?.applyOnlineId}
              </Link>
            </p>
          )}
        </Card>

        {/* Permissions --------------------------------------------------- */}
        <Card className="flex flex-col gap-3">
          <SectionHeader title="Responses &amp; Permissions" enableMt={false} icon={ShieldCheckIcon} />
          <Toggle
            id="enableResponses"
            title="Enable Responses"
            description="Allow users to respond to this form"
            value={application?.permissions.acceptingResponses}
          />
          <Toggle
            id="singleResponse"
            title="Single Response"
            description="Only allow users to respond to this form once"
            value={application?.permissions.applyOnce}
          />
          <Toggle
            id="hideIfIneligible"
            title="Hide form for ineligible users"
            description="Show the form but lock it for users who don't meet the requirements or when responses are off (mainly for Roblox experiences)."
            value={application?.hideIfIneligible}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Dropdown
              id="minimumRole"
              label="Minimum Role to Respond"
              defaultValue={application?.permissions.ranking.minRank}
              choices={[
                { name: 'Guest', id: '0' },
                ...workspace.roles.map((a) => ({ name: a.name, id: a.rank.toString() })),
              ]}
            />
            <Dropdown
              id="maximumRole"
              label="Maximum Role to Respond"
              defaultValue={application?.permissions.ranking.maxRank}
              choices={[
                { name: 'Guest', id: '0' },
                ...workspace.roles.map((a) => ({ name: a.name, id: a.rank.toString() })),
              ]}
            />
          </div>
          <TextLabel
            id="minimumDaysToApplyAgain"
            label="Cooldown period (in days)"
            defaultValue={application?.permissions.timeUntilApplyAgain}
            type="number"
          />
          <div className="mt-1">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Where can users respond?
            </p>
            <div className="flex flex-col gap-2">
              <Toggle
                id="channelWeb"
                title="Web responses"
                description="Accept responses from the online apply page"
                value={application?.responseChannels?.web !== false}
              />
              <Toggle
                id="channelGame"
                title="In-game responses"
                description="Accept responses from the Roblox Application Center"
                value={application?.responseChannels?.game !== false}
              />
            </div>
          </div>
        </Card>

        {/* Response window ----------------------------------------------- */}
        <Card className="flex flex-col gap-3">
          <SectionHeader title="Response Window" enableMt={false} icon={ClockIcon} />
          <Toggle
            id="windowEnabled"
            title="Limit when responses are accepted"
            description="Set a start and end time. Times are anchored to EST and shown to users in their own timezone."
            value={application?.responseWindow?.enabled}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Start (EST)</label>
              <input
                id="windowStart"
                name="windowStart"
                type="datetime-local"
                defaultValue={application?.responseWindow?.start || ''}
                className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">End (EST)</label>
              <input
                id="windowEnd"
                name="windowEnd"
                type="datetime-local"
                defaultValue={application?.responseWindow?.end || ''}
                className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Card>

        {/* Status options ------------------------------------------------ */}
        <Card className="flex flex-col gap-3">
          <SectionHeader title="Status Options" enableMt={false} icon={FlagIcon} />
          <small className="-mt-1 text-gray-500 dark:text-gray-400">
            Choose which statuses reviewers can assign to responses. &ldquo;Report
            to ReAdmin&rdquo; submits a response to official ReAdmin Trust &amp; Safety.
          </small>
          <div className="flex flex-row flex-wrap gap-2">
            {CONFIGURABLE_STATUSES.map((id) => {
              const meta = STATUS_META[id];
              const active = statusOptions.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleStatus(id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                    active
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                  }`}
                  title={meta.description}
                >
                  <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Applicant visibility ------------------------------------------ */}
        <Card className="flex flex-col gap-3">
          <SectionHeader title="What Applicants Can See" enableMt={false} icon={EyeIcon} />
          <Toggle
            id="visAnswers"
            title="Show their response answers"
            description="Let users review the answers they submitted"
            value={visibility?.showAnswers}
          />
          <Toggle
            id="visQuizCorrectness"
            title="Show if quiz answers were right or wrong"
            description="Reveal per-question correctness for quiz forms"
            value={visibility?.showQuizCorrectness}
          />
          <Toggle
            id="visCorrectAnswers"
            title="Show the correct quiz answers"
            description="Reveal the correct answer for each quiz question"
            value={visibility?.showCorrectAnswers}
          />
          <Toggle
            id="visStatus"
            title="Show their response status"
            description="Let users see whether their response was accepted, denied, etc."
            value={visibility?.showStatus !== false}
          />
        </Card>

        {/* Links --------------------------------------------------------- */}
        <Card className="flex flex-col gap-3">
          <SectionHeader title="Call-to-action Buttons" enableMt={false} icon={LinkIconOutline} />
          <Toggle
            id="linkRoblox"
            title="Show &ldquo;Join Roblox Group&rdquo; button"
            description="Displayed on the form if your Roblox group is linked"
            value={application?.links?.showRobloxGroup}
          />
          <Toggle
            id="linkDiscord"
            title="Show &ldquo;Join Discord Server&rdquo; button"
            description="Displayed on the form if your Discord server is linked"
            value={application?.links?.showDiscord}
          />
        </Card>

        {/* Appearance ---------------------------------------------------- */}
        <Card className="flex flex-col gap-3">
          <SectionHeader title="Appearance" enableMt={false} icon={PaintBrushIcon} />
          <small className="-mt-1 text-gray-500 dark:text-gray-400">
            Customize how this form looks and sounds. Leave a field blank to use the default.
          </small>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Toggle
              id="showLogo"
              title="Display logo"
              description="Show your group logo on the form"
              value={appearance?.showLogo !== false}
            />
            <Toggle
              id="showBanner"
              title="Display banner"
              description="Show the banner image on the form"
              value={appearance?.showBanner !== false}
            />
          </div>

          <Dropdown
            id="font"
            label="Font"
            defaultValue={appearance?.font || FORM_FONTS[0]?.id || ''}
            choices={FORM_FONTS}
            required={false}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextLabel
              id="logoAssetId"
              label="Logo Asset ID (in-game)"
              placeholder="rbxassetid://0 or 123456789"
              defaultValue={appearance?.logoAssetId ?? ''}
              required={false}
            />
            <TextLabel
              id="bannerAssetId"
              label="Banner Asset ID (in-game)"
              placeholder="rbxassetid://0 or 123456789"
              defaultValue={appearance?.bannerAssetId ?? ''}
              required={false}
            />
            <TextLabel
              id="soundAssetId"
              label="Sound Asset ID (Roblox only)"
              placeholder="rbxassetid://0 or 123456789"
              defaultValue={appearance?.soundAssetId ?? ''}
              required={false}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Banner Image (web)
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Upload an image to display at the top of your online form. Uploads
              are moderated; external image links aren&apos;t allowed. Use a
              wide, landscape image for best results.
            </p>
            {appearance?.webBannerUrl && (
              <img
                src={appearance.webBannerUrl}
                alt="Web banner preview"
                className="w-full max-h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              />
            )}
            <div className="flex flex-row gap-3">
              <Button
                type="button"
                variant="discrete"
                size="small"
                disabled={uploadingWebBanner}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = async (e) => {
                    const file = (e.target as any).files?.[0];
                    if (!file) return;
                    const fileData = await ReadFile(file);
                    const data = fileData?.toString();
                    if (!data) {
                      toast.error('Could not read that image.');
                      return;
                    }
                    uploadWebBanner({
                      groupId,
                      applicationId,
                      name: file.name,
                      data,
                    })
                      .then(() => {
                        toast.success('Uploaded banner image successfully!');
                        context.workspaces.workspace.forms.applications.application.getApplication.invalidate(
                          { groupId, applicationId },
                        );
                      })
                      .catch((err) => toast.error(err.message));
                  };
                  input.click();
                }}
              >
                {uploadingWebBanner
                  ? 'Uploading...'
                  : appearance?.webBannerUrl
                    ? 'Replace Image'
                    : 'Upload Image'}
              </Button>
              {appearance?.webBannerUrl && (
                <Button
                  type="button"
                  variant="light_danger"
                  size="small"
                  onClick={() => {
                    removeWebBanner({ groupId, applicationId })
                      .then(() => {
                        toast.success('Removed banner image successfully!');
                        context.workspaces.workspace.forms.applications.application.getApplication.invalidate(
                          { groupId, applicationId },
                        );
                      })
                      .catch((err) => toast.error(err.message));
                  }}
                >
                  Remove Image
                </Button>
              )}
            </div>
          </div>

          <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">Theme Colors</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextLabel id="themeAccent" label="Accent" placeholder="#3B82F6" defaultValue={appearance?.theme?.accent ?? ''} required={false} />
            <TextLabel id="themeBackground" label="Background" placeholder="#090B12" defaultValue={appearance?.theme?.background ?? ''} required={false} />
            <TextLabel id="themeSurface" label="Surface" placeholder="#11141F" defaultValue={appearance?.theme?.surface ?? ''} required={false} />
            <TextLabel id="themeText" label="Text" placeholder="#EDF0F8" defaultValue={appearance?.theme?.text ?? ''} required={false} />
          </div>

          <div className="mt-1 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Background Audio (in-game)</p>
            <Button
              type="button"
              variant="discrete"
              size="small"
              onClick={() => setAudios((prev) => [...prev, { assetId: '', name: '' }])}
            >
              Add audio
            </Button>
          </div>
          <small className="-mt-1 text-gray-500 dark:text-gray-400">
            Link one or more Roblox audios to shuffle in the background in-game.
          </small>
          {audios.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No audios linked yet.</p>
          ) : (
            audios.map((audio, index) => (
              <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <TextLabel
                  label={index === 0 ? 'Audio Asset ID' : undefined}
                  placeholder="rbxassetid://0 or 123456789"
                  value={audio.assetId}
                  required={false}
                  className="flex-1"
                  onChange={(v) =>
                    setAudios((prev) => prev.map((a, i) => (i === index ? { ...a, assetId: v } : a)))
                  }
                />
                <TextLabel
                  label={index === 0 ? 'Label (optional)' : undefined}
                  placeholder="e.g. Lobby music"
                  value={audio.name}
                  required={false}
                  className="flex-1"
                  onChange={(v) =>
                    setAudios((prev) => prev.map((a, i) => (i === index ? { ...a, name: v } : a)))
                  }
                />
                <Button
                  type="button"
                  variant="danger"
                  size="small"
                  onClick={() => setAudios((prev) => prev.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </Card>

        <div className="sticky bottom-2 z-10">
          <Button
            variant="primary"
            size="large"
            className="w-full shadow-lg"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <WorkspaceFormsApplicationSidebarNavigationLayout>{page}</WorkspaceFormsApplicationSidebarNavigationLayout>
);

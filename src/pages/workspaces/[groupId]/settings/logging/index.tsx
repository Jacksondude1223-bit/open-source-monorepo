/* eslint-disable @next/next/no-img-element */
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { ReactElement, useState } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { useRouter } from 'next/router';
import { trpc } from '~/utils/trpc';
import WorkspaceUpsale from '~/components/page_components/workspaces/settings/billing/Upsale';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import { DiscordLogging, DiscordLogType } from '~/services/NewMongoTypes/DiscordLogging.type';
import toast from 'react-hot-toast';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import { TrashIcon } from '@heroicons/react/24/outline';
import { EyeIcon, EyeSlashIcon, HashtagIcon, ClipboardDocumentIcon } from '@heroicons/react/20/solid';
import MultiSelectDropdown from '~/components/forms/MultiSelectDropdown';
import { WithId } from 'mongodb';
import Card from '~/components/ui/Card';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import Toggle from '~/components/forms/Toggle';

const choices = [
  {
    id: 'all',
    name: 'All events',
  },
  {
    id: 'new-application',
    name: 'New form response',
  },
  {
    id: 'read-application',
    name: 'Read form response',
  },
  {
    id: 'new-department-user',
    name: 'New department user',
  },
  {
    id: 'removed-department-user',
    name: 'Removed department user',
  },
  {
    id: 'new-group-member',
    name: 'New group member',
  },
  {
    id: 'member-promotion',
    name: 'Member promotion',
  },
  {
    id: 'member-punishment',
    name: 'Member punishment',
  },
  {
    id: 'member-demotion',
    name: 'Member demotion',
  },
  {
    id: 'removed-group-member',
    name: 'Removed group member',
  },
  {
    id: 'player-join',
    name: 'Player join',
  },
  {
    id: 'remote-admin-action',
    name: 'Remote admin action',
  },
  {
    id: 'player-leave',
    name: 'Player leave',
  },
  {
    id: 'session-create',
    name: 'Session create',
  },
  {
    id: 'session-role-claimed',
    name: 'Session role claimed',
  },
  {
    id: 'session-role-unclaimed',
    name: 'Session role unclaimed',
  },
  {
    id: 'session-server-created',
    name: 'Session server created',
  },
  {
    id: 'session-start',
    name: 'Session starts',
  },
  {
    id: 'session-end',
    name: 'Session ends'
  },
  {
    id: 'session-server-deleted',
    name: 'Session server deleted',
  },
  {
    id: 'inactivity-request-created',
    name: 'Inactivity Request Created',
  },
  {
    id: 'inactivity-request-approved-or-declined',
    name: 'Inactivity Request Approved or Declined',
  },
  {
    id: 'inactivity-start',
    name: 'Inactivity Start',
  },
  {
    id: 'inactivity-end',
    name: 'Inactivity End',
  },
  {
    id: 'inactivity-deleted',
    name: 'Inactivity Deleted',
  }
] as { name: string; id: DiscordLogType; }[];

function maskWebhookUrl(url: string): string {
  const match = url.match(/^(https?:\/\/.*\/webhooks\/\d+\/)(.+)$/i);
  if (!match || !match[1] || !match[2]) return url;
  return match[1] + '•'.repeat(Math.min(match[2].length, 24));
}

function ChannelPreview({ webhook }: { webhook: WithId<DiscordLogging> }) {
  const info = webhook.webhookInfo as any;
  const avatarUrl = info?.avatar
    ? `https://cdn.discordapp.com/avatars/${info.id}/${info.avatar}.png`
    : null;

  return (
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded-full border border-gray-200 dark:border-gray-700"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40">
          <HashtagIcon className="h-5 w-5 text-indigo-500 dark:text-indigo-300" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
          {info?.name || 'Discord Webhook'}
        </p>
        <p className="flex items-center gap-1 truncate text-xs text-gray-400 dark:text-gray-500">
          <HashtagIcon className="h-3 w-3 shrink-0" />
          {info?.channel_id ? `Channel ${info.channel_id}` : 'Unknown channel'}
        </p>
      </div>
    </div>
  );
}

function Webhook({ webhook, groupId }: { webhook: WithId<DiscordLogging>; groupId: string }) {
  const context = trpc.useUtils();
  const editMutation = trpc.workspaces.workspace.settings.discordLogging.edit.useMutation();
  const deleteMutation = trpc.workspaces.workspace.settings.discordLogging.delete.useMutation();
  const [selectedChoices, setSelectedChoices] = useState<DiscordLogType[]>(typeof (webhook.event) == 'object' ? webhook.event : [webhook.event])
  const [url, setUrl] = useState(webhook.webhookUrl);
  const [revealed, setRevealed] = useState(false);

  return (
    <Card className="overflow-visible">
      <form className="flex flex-col gap-3" onSubmit={(f) => {
        f.preventDefault();
        editMutation.mutateAsync({
          groupId,
          id: webhook._id.toString(),
          url,
          events: selectedChoices,
        }).then(() => {
          context.workspaces.workspace.settings.discordLogging.get.invalidate({ groupId })
          toast.success('Webhook updated')
          setRevealed(false)
        }).catch(e => {
          toast.error(e.message)
        })
      }}>
        <ChannelPreview webhook={webhook} />

        <div>
          <label htmlFor={`webhook-url-${webhook._id.toString()}`} className="block text-sm font-medium text-gray-700 transition dark:text-gray-300">
            Webhook URL
          </label>
          <div className="relative mt-1">
            <input
              id={`webhook-url-${webhook._id.toString()}`}
              name="webhook-url"
              type="text"
              required={true}
              readOnly={!revealed}
              value={revealed ? url : maskWebhookUrl(url)}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className={`block w-full rounded-md border-gray-300 py-2 pl-2 pr-20 text-sm transition focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-400 ${!revealed ? 'cursor-default text-gray-500 dark:text-gray-400' : ''}`}
            />
            <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
              <button
                type="button"
                title="Copy webhook URL"
                onClick={() => {
                  navigator.clipboard.writeText(url)
                    .then(() => toast.success('Webhook URL copied'))
                    .catch(() => toast.error('Could not copy URL'));
                }}
                className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                title={revealed ? 'Hide token' : 'Reveal token'}
                onClick={() => setRevealed((r) => !r)}
                className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                {revealed ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            The token is hidden to keep this webhook secure. Reveal it to edit or copy the full URL.
          </p>
        </div>

        <MultiSelectDropdown
          id="event-type"
          label="Events"
          className="w-full"
          choices={choices}
          value={selectedChoices}
          onSelectChoice={setSelectedChoices}
        />
        <div className="flex flex-row gap-2 justify-end">
          <Button variant="blue" type='submit' size="small">Save Webhook</Button>
          <Button onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteMutation.mutateAsync({
              groupId,
              id: webhook._id.toString()
            }).then(() => {
              context.workspaces.workspace.settings.discordLogging.get.invalidate({ groupId })
              toast.success('Webhook deleted')
            }).catch(e => {
              toast.error(e.message)
            })
          }} variant="light_danger" size="small" icon={TrashIcon} />
        </div>
      </form>
    </Card>
  )
}

const DEFAULT_GROWTH_TEMPLATE_PLACEHOLDER = "We've reached **{count}** members! ({gained} new since the last update)";
const DEFAULT_MILESTONE_TEMPLATE_PLACEHOLDER = "🎉 We hit **{count}** members! Only {awayFromMilestone} more to {nextMilestone}.";

function MemberMilestoneSection({ groupId }: { groupId: string }) {
  const context = trpc.useUtils();
  const { data: config, isLoading } = trpc.workspaces.workspace.settings.discordLogging.getMemberMilestone.useQuery({ groupId });
  const saveMutation = trpc.workspaces.workspace.settings.discordLogging.saveMemberMilestone.useMutation();
  const testMutation = trpc.workspaces.workspace.settings.discordLogging.sendTestMemberMilestone.useMutation();
  const deleteMutation = trpc.workspaces.workspace.settings.discordLogging.deleteMemberMilestone.useMutation();

  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState('');
  const [growthEnabled, setGrowthEnabled] = useState(true);
  const [growthTemplate, setGrowthTemplate] = useState('');
  const [milestoneEnabled, setMilestoneEnabled] = useState(true);
  const [milestoneStep, setMilestoneStep] = useState(1000);
  const [milestoneTemplate, setMilestoneTemplate] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate local form state from the saved config once it loads.
  if (config && !hydrated) {
    setEnabled(config.enabled);
    setUrl(config.webhookUrl || '');
    setGrowthEnabled(config.growthEnabled ?? true);
    setGrowthTemplate(config.growthTemplate || '');
    setMilestoneEnabled(config.milestoneEnabled ?? true);
    setMilestoneStep(config.milestoneStep || 1000);
    setMilestoneTemplate(config.milestoneTemplate || '');
    setHydrated(true);
  }

  const safeStep = () => Math.max(1, Math.floor(milestoneStep) || 1000);

  const save = () => {
    saveMutation.mutateAsync({
      groupId,
      enabled,
      url,
      growthEnabled,
      growthTemplate: growthTemplate.trim() ? growthTemplate : undefined,
      milestoneEnabled,
      milestoneStep: safeStep(),
      milestoneTemplate: milestoneTemplate.trim() ? milestoneTemplate : undefined,
    }).then(() => {
      context.workspaces.workspace.settings.discordLogging.getMemberMilestone.invalidate({ groupId });
      toast.success('Member count settings saved');
    }).catch((e) => toast.error(e.message));
  };

  const sendTest = (type: 'growth' | 'milestone') => {
    if (!url.trim()) {
      toast.error('Enter a webhook URL first');
      return;
    }
    testMutation.mutateAsync({
      groupId,
      url,
      type,
      growthTemplate: growthTemplate.trim() ? growthTemplate : undefined,
      milestoneTemplate: milestoneTemplate.trim() ? milestoneTemplate : undefined,
      milestoneStep: safeStep(),
    }).then(() => toast.success('Test message sent'))
      .catch((e) => toast.error(e.message));
  };

  return (
    <Card className="mt-4 overflow-visible border-l-4 border-emerald-500">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Header fontSize="sm">Member Count Announcements</Header>
          <Small>
            We&apos;ll poll Roblox every 10 minutes for your group&apos;s member count and post to a
            Discord channel as it grows. Turn on whichever announcements you want.
          </Small>
        </div>
      </div>

      <form
        className="mt-3 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Toggle
          id="member-milestone-enabled"
          title="Enable member count announcements"
          description="Master switch. When off, nothing is posted regardless of the settings below."
          value={enabled}
          onChange={setEnabled}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 transition dark:text-gray-300">
            Webhook URL
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="mt-1 block w-full rounded-md border-gray-300 py-2 px-2 text-sm transition focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-400"
          />
        </div>

        {/* Growth announcements */}
        <div className={`rounded-lg border p-3 transition ${growthEnabled ? 'border-blue-200 dark:border-blue-900/50' : 'border-gray-200 dark:border-gray-700 opacity-80'}`}>
          <Toggle
            id="member-growth-enabled"
            title="Growth updates"
            description="Posts every time the member count goes up since the last check."
            value={growthEnabled}
            onChange={setGrowthEnabled}
          />
          {growthEnabled && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 transition dark:text-gray-300">
                Message template <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={growthTemplate}
                onChange={(e) => setGrowthTemplate(e.target.value)}
                rows={2}
                placeholder={DEFAULT_GROWTH_TEMPLATE_PLACEHOLDER}
                className="mt-1 block w-full rounded-md border-gray-300 py-2 px-2 text-sm transition focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-400"
              />
              <div className="mt-2 flex justify-end">
                <Button type="button" variant="default" size="small" onClick={() => sendTest('growth')}>
                  Send test
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Milestone announcements */}
        <div className={`rounded-lg border p-3 transition ${milestoneEnabled ? 'border-emerald-200 dark:border-emerald-900/50' : 'border-gray-200 dark:border-gray-700 opacity-80'}`}>
          <Toggle
            id="member-milestone-enabled-toggle"
            title="Milestone updates"
            description="Posts a special message only when you cross a milestone (e.g. every 1,000 members)."
            value={milestoneEnabled}
            onChange={setMilestoneEnabled}
          />
          {milestoneEnabled && (
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 transition dark:text-gray-300">
                  Milestone every
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={milestoneStep}
                    onChange={(e) => setMilestoneStep(Number(e.target.value))}
                    className="block w-40 rounded-md border-gray-300 py-2 px-2 text-sm transition focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">members</span>
                </div>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  e.g. 1,000 posts when you cross 411,000, 412,000, and so on.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 transition dark:text-gray-300">
                  Message template <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={milestoneTemplate}
                  onChange={(e) => setMilestoneTemplate(e.target.value)}
                  rows={2}
                  placeholder={DEFAULT_MILESTONE_TEMPLATE_PLACEHOLDER}
                  className="mt-1 block w-full rounded-md border-gray-300 py-2 px-2 text-sm transition focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-400"
                />
                <div className="mt-2 flex justify-end">
                  <Button type="button" variant="default" size="small" onClick={() => sendTest('milestone')}>
                    Send test
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Placeholders: <code>{'{count}'}</code>, <code>{'{gained}'}</code>, <code>{'{previous}'}</code>,{' '}
          <code>{'{milestoneStep}'}</code>, <code>{'{nextMilestone}'}</code>, <code>{'{awayFromMilestone}'}</code>,{' '}
          <code>{'{groupName}'}</code>. Markdown is supported.
        </p>

        <div className="flex flex-row flex-wrap gap-2 justify-end">
          {config && (
            <Button
              type="button"
              variant="light_danger"
              size="small"
              icon={TrashIcon}
              onClick={() => {
                deleteMutation.mutateAsync({ groupId }).then(() => {
                  context.workspaces.workspace.settings.discordLogging.getMemberMilestone.invalidate({ groupId });
                  setEnabled(false); setUrl(''); setGrowthEnabled(true); setGrowthTemplate('');
                  setMilestoneEnabled(true); setMilestoneStep(1000); setMilestoneTemplate('');
                  toast.success('Member count settings removed');
                }).catch((e) => toast.error(e.message));
              }}
            />
          )}
          <Button variant="blue" type="submit" size="small">
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
      {isLoading && <div className="mt-2"><LoadingAnimation /></div>}
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const context = trpc.useUtils();
  const { data: webhooks } = trpc.workspaces.workspace.settings.discordLogging.get.useQuery({ groupId });
  const createMutation = trpc.workspaces.workspace.settings.discordLogging.create.useMutation();
  const [selectedChoices, setSelectedChoices] = useState<DiscordLogType[]>([])

  if (!user || !workspace) {
    return <LoadingPage />;
  }

  if (!workspace?.premium?.is) {
    return (
      <>
        <PageHeading title={`${workspace?.groupName} Discord Logging`} />
        <div className='flex flex-col items-center gap-4 mt-6'>
          <h2 className='text-xl font-semibold text-center text-gray-900 dark:text-gray-100'>Send important events to your Discord server</h2>
          <p className='text-sm text-gray-500 text-center max-w-md'>Discord logging keeps your team informed in real-time with automated webhook notifications.</p>
          <img
            src="https://cdn.readmin.app/readmin-public/UserTags.png"
            className='max-h-100 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700'
            alt="discord logging preview"
          />
          <WorkspaceUpsale />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Webhooks`}
        description="Manage Discord webhooks to receive event notifications"
      />

      <Card className="mt-4 overflow-visible border-l-4 border-blue-500">
        <Header fontSize="sm">Add New Webhook</Header>
        <Small>Paste a Discord webhook URL and choose which events should be sent to it.</Small>
        <form className="flex flex-col gap-3 mt-3" onSubmit={async (f) => {
          f.preventDefault()
          const target = f.target as any;
          const webhookUrl = target['webhook-url'].value;
          createMutation.mutateAsync({
            groupId,
            url: webhookUrl,
            events: selectedChoices,
          }).then(() => {
            context.workspaces.workspace.settings.discordLogging.get.invalidate({ groupId })
            toast.success('Webhook created')
          }).catch(e => {
            toast.error(e.message)
          })
        }}>
          <TextLabel
            placeholder="https://discord.com/api/webhooks/..."
            label="Webhook URL"
            id="webhook-url"
            className="grow"
          />
          <MultiSelectDropdown
            id="event-type"
            label="Events to listen for"
            className="w-full"
            choices={choices}
            onSelectChoice={setSelectedChoices}
            placeholder='Select events'
          />
          <Button variant="primary" className="w-full">Create Webhook</Button>
        </form>
      </Card>

      <MemberMilestoneSection groupId={groupId} />

      <div className="flex flex-col gap-4 mt-6">
        <div className="flex items-center gap-2">
          <Header>Active Webhooks</Header>
          {webhooks && webhooks.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {webhooks.length}
            </span>
          )}
        </div>
        {!webhooks ? <LoadingAnimation /> : (<>
          {webhooks.length == 0 && (
            <div className="text-center py-12 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-gray-400 dark:text-gray-500 text-sm">No webhooks configured yet</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Create your first webhook above to start receiving notifications</p>
            </div>
          )}
          {webhooks.map(webhook => (
            <Webhook key={webhook._id.toString()} groupId={groupId} webhook={webhook} />
          ))}
        </>)}
      </div>
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);

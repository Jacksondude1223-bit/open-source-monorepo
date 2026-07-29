'use client';

import { useRouter } from 'next/router';
import { ReactElement, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Dropdown from '~/components/forms/Dropdown';
import TextArea from '~/components/forms/TextArea';
import TextLabel from '~/components/forms/TextLabel';
import Toggle from '~/components/forms/Toggle';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceFormsApplicationSidebarNavigationLayout from '~/components/page_components/workspaces/forms/WorkspaceFormsApplicationSidebarNavigationLayout';
import WorkspaceUpsale from '~/components/page_components/workspaces/settings/billing/Upsale';
import CollapsableCard from '~/components/ui/CollapsableCard';
import SectionHeader from '~/components/ui/SectionHeader';
import {
  ApplicationAutomations,
  ApplicationDiscordAutomation,
  ApplicationRobloxAutomation,
} from '~/services/NewMongoTypes/Application.type';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import { RobloxIcon } from '~/components/icons';

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId, applicationId }: { groupId: string; applicationId: string } =
    router.query as any;
  const workspace = useWorkspace();
  const { data: application, isPending: applicationIsLoading } =
    trpc.workspaces.workspace.forms.applications.application.getApplication.useQuery(
      { groupId, applicationId },
    );
  const { data: linkages, isPending: linkagesIsLoading } =
    trpc.workspaces.workspace.settings.integrations.get_linkages.useQuery({
      groupId,
    });
  const { data: robloxOauth } = trpc.workspaces.workspace.settings.integrations.get_roblox_oauth.useQuery({ groupId });
  const saveAutomationsMutation =
    trpc.workspaces.workspace.forms.applications.application.automations.saveAutomations.useMutation();
  const [automations, setAutomations] = useState<ApplicationAutomations>();

  useEffect(() => {
    if (!automations && application?.automations) {
      setAutomations(application?.automations);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automations, application, groupId, applicationId]);

  if (workspace?.department?.permissions?.applications?.viewApplications == false) {
    if (typeof (window) !== undefined) {
      router.push(`/workspaces/${groupId}/forms`)
    }
    return (<></>)
  }

  if (!workspace) {
    return <LoadingPage />;
  }
  if (!workspace?.department?.permissions?.applications?.editApplications) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <PageHeading
          title={`${workspace?.groupName} Forms`}
          disableDivide={true}
        />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Insufficient Permissions
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              You don&apos;t have permission to edit forms in this workspace.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              If you believe this is a mistake, contact one of your group administrators.
            </p>
          </div>
        </div>
      </div>
    )
  }
  if (!workspace?.premium?.is) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <PageHeading
          title={`${workspace?.groupName} Forms`}
          disableDivide={true}
        />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Premium Required
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              This workspace must have premium to use automation features.
            </p>
            <WorkspaceUpsale />
          </div>
        </div>
      </div>
    )
  }

  function saveAutomations(automationsToSave: ApplicationAutomations) {
    saveAutomationsMutation
      .mutateAsync({
        groupId,
        applicationId,
        automations: automationsToSave,
      })
      .then(() => {
        toast.success('Saved automations');
      });
  }

  if (linkagesIsLoading || applicationIsLoading || !automations || !robloxOauth) {
    return <LoadingPage />;
  }

  const keys = [
    { id: 'sent', name: 'Response Sent', icon: '📤', color: 'blue' },
    { id: 'passed', name: 'Response Passed', icon: '✅', color: 'green' },
    { id: 'failed', name: 'Response Failed', icon: '❌', color: 'red' },
    { id: 'reported', name: 'Response Reported', icon: '⚠️', color: 'yellow' },
  ];

  function RobloxAutomation({
    name,
    automation,
  }: {
    name: 'sent' | 'passed' | 'failed' | 'reported';
    automation: ApplicationRobloxAutomation;
  }) {
    if (!robloxOauth) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )
    }
    if (!robloxOauth?.groupRoles) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }
    const rankChoices = (Array.isArray(robloxOauth.groupRoles) ? robloxOauth.groupRoles : [])
      .filter((a) => a.rank !== 0)
      .map((r) => ({ name: r.name, id: r.rank.toString() }));
    // The dropdown renders its first choice when the saved value matches
    // nothing, but it only fires onChange on user input — so a form saved
    // without touching the picker kept rankTo at its 0 default while showing a
    // real role, and the automation then silently matched no role at all.
    const selectedRank = rankChoices.find(
      (c) => c.id === (automation.ranking?.rankTo ?? 0).toString(),
    );
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <Toggle
            title="Enable Automation"
            description={`Automatically perform actions when responses are ${name.replace('_', ' ')}`}
            value={automation.enabled}
            onChange={(newValue) => {
              const newAutomations = automations as ApplicationAutomations;
              newAutomations.roblox[name].enabled = newValue;
              setAutomations(newAutomations);
              saveAutomations(newAutomations);
            }}
          />
        </div>

        {automation.enabled && (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <SectionHeader title="Ranking Settings" enableMt={false} />
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
                <Toggle
                  title="Enable Ranking"
                  description="Automatically rank users to a specified role"
                  value={automation.ranking.enabled}
                  onChange={(newValue) => {
                    const newAutomations = automations as ApplicationAutomations;
                    newAutomations.roblox[name].ranking.enabled = newValue;
                    // Commit the rank the picker is already showing, so enabling
                    // ranking never leaves the automation pointing at nothing.
                    if (newValue && !selectedRank && rankChoices[0]) {
                      newAutomations.roblox[name].ranking.rankTo = parseInt(rankChoices[0].id);
                    }
                    setAutomations(newAutomations);
                    saveAutomations(newAutomations);
                  }}
                />
                {automation.ranking.enabled && (
                  <div className="pl-8 border-l-2 border-blue-200 dark:border-blue-700">
                    <Dropdown
                      label="Rank To"
                      choices={rankChoices}
                      defaultValue={(selectedRank ?? rankChoices[0])?.id ?? ''}
                      onChange={(newValue) => {
                        const newAutomations = automations as ApplicationAutomations;
                        newAutomations.roblox[name].ranking.rankTo = parseInt(newValue);
                        setAutomations(newAutomations);
                        saveAutomations(newAutomations);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <SectionHeader title="Punishment Settings" enableMt={false} />
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <Toggle
                  title="Exile user"
                  description="Remove user from the group"
                  value={automation.punishment.exile}
                  onChange={(newValue) => {
                    const newAutomations = automations as ApplicationAutomations;
                    newAutomations.roblox[name].punishment.exile = newValue;
                    setAutomations(newAutomations);
                    saveAutomations(newAutomations);
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
  function DiscordAutomation({
    name,
    automation,
  }: {
    name: 'sent' | 'passed' | 'failed' | 'reported';
    automation: ApplicationDiscordAutomation;
  }) {
    if (!linkages?.guild) {
      return <LoadingPage />;
    }

    const isEnabled = automation?.dm?.enabled || automation?.ranking?.enabled || automation?.punishment?.kick || automation?.punishment?.ban;
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">Discord Automation Settings</div>
          <p className="text-sm text-purple-700 dark:text-purple-300">Configure Discord actions for when responses are {name.replace('_', ' ')}</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <SectionHeader title="Role Management" enableMt={false} />
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
            <Toggle
              title="Enable Role Assignment"
              description="Automatically assign a role to users"
              value={automation.ranking.enabled}
              onChange={(newValue) => {
                const newAutomations = automations as ApplicationAutomations;
                newAutomations.discord[name].ranking.enabled = newValue;
                setAutomations(newAutomations);
                saveAutomations(newAutomations);
              }}
            />
            {automation.ranking.enabled && (
              <div className="pl-8 border-l-2 border-green-200 dark:border-green-700">
                <Dropdown
                  label="Add role"
                  choices={(Array.isArray(linkages.guild?.roles) ? linkages.guild.roles : [])
                    .filter((a) => a.name !== '@everyone')
                    .map((r) => {
                      return { name: r.name, id: r.id.toString() };
                    })}
                  defaultValue={automation.ranking.rank.toString()}
                  onChange={(newValue) => {
                    const newAutomations = automations as ApplicationAutomations;
                    newAutomations.discord[name].ranking.rank = newValue;
                    setAutomations(newAutomations);
                    saveAutomations(newAutomations);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <SectionHeader title="Direct Message" enableMt={false} />
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
            <Toggle
              title="Enable DM Message"
              description="Send a direct message to the user"
              value={automation.dm.enabled}
              onChange={(newValue) => {
                const newAutomations = automations as ApplicationAutomations;
                newAutomations.discord[name].dm.enabled = newValue;
                setAutomations(newAutomations);
                saveAutomations(newAutomations);
              }}
            />
            {automation.dm.enabled && (
              <div className="pl-8 border-l-2 border-blue-200 dark:border-blue-700">
                <TextArea
                  label="Message Content"
                  placeholder="Enter the message to send to the user..."
                  defaultValue={automation.dm.message}
                  onBlur={(newValue) => {
                    const newAutomations = automations as ApplicationAutomations;
                    newAutomations.discord[name].dm.message = newValue;
                    setAutomations(newAutomations);
                    saveAutomations(newAutomations);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <SectionHeader title="Punishment Actions" enableMt={false} />
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
            <Toggle
              title="Kick user"
              description="Remove user from the Discord server temporarily"
              value={automation.punishment.kick}
              onChange={(newValue) => {
                const newAutomations = automations as ApplicationAutomations;
                newAutomations.discord[name].punishment.kick = newValue;
                setAutomations(newAutomations);
                saveAutomations(newAutomations);
              }}
            />
            <Toggle
              title="Ban user"
              description="Permanently ban user from the Discord server"
              value={automation.punishment.ban}
              onChange={(newValue) => {
                const newAutomations = automations as ApplicationAutomations;
                newAutomations.discord[name].punishment.ban = newValue;
                setAutomations(newAutomations);
                saveAutomations(newAutomations);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeading
        title={`${application?.name} Automations`}
        disableDivide={true}
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {!linkages?.roblox && !linkages?.discord && (
          <div className="max-w-2xl mx-auto mb-8">            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Linked Integrations
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              You haven&apos;t linked any Roblox or Discord integrations yet.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Automations allow you to automatically rank users, send messages, and perform other actions when responses are processed.
            </p>
          </div>
          </div>
        )}

        <div className="space-y-8">
          {robloxOauth && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/50 rounded-lg flex items-center justify-center">
                  <RobloxIcon className='"w-6 h-6 text-red-600 dark:text-red-400' />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Roblox Automations</h2>
                  <p className="text-gray-600 dark:text-gray-300">Configure automatic actions for your Roblox group</p>
                </div>
              </div>              <div className="grid gap-4">
                {keys.map((key) => (
                  <CollapsableCard
                    title={`${key.icon} ${key.name}`}
                    key={key.id}
                  >
                    <RobloxAutomation
                      name={key.id as 'sent' | 'passed' | 'failed' | 'reported'}
                      automation={
                        automations.roblox[
                        key.id as 'sent' | 'passed' | 'failed' | 'reported'
                        ]
                      }
                    />
                  </CollapsableCard>
                ))}
              </div>
            </div>
          )}

          {linkages?.discord && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.445.865-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.249.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Discord Automations</h2>
                  <p className="text-gray-600 dark:text-gray-300">Configure automatic actions for your Discord server</p>
                </div>
              </div>              <div className="grid gap-4">
                {keys.map((key) => (
                  <CollapsableCard
                    title={`${key.icon} ${key.name}`}
                    key={key.id}
                  >
                    <DiscordAutomation
                      name={key.id as 'sent' | 'passed' | 'failed' | 'reported'}
                      automation={
                        automations.discord[
                        key.id as 'sent' | 'passed' | 'failed' | 'reported'
                        ]
                      }
                    />
                  </CollapsableCard>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <WorkspaceFormsApplicationSidebarNavigationLayout>{page}</WorkspaceFormsApplicationSidebarNavigationLayout>
);

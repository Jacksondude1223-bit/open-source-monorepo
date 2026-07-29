import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Card from '~/components/ui/Card';
import Button from '~/components/forms/Button';
import Dropdown from '~/components/forms/Dropdown';
import MultiSelectDropdown from '~/components/forms/MultiSelectDropdown';
import Toggle from '~/components/forms/Toggle';
import SectionHeader from '~/components/ui/SectionHeader';
import { ChatBubbleLeftRightIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { trpc } from '~/utils/trpc';
import { useWorkspace } from '~/components/contexts/workspace';

// Discord channel category type id (ChannelType.GuildCategory).
const DISCORD_CATEGORY_TYPE = 4;

export default function CallDiscordSettings({ groupId }: { groupId: string }) {
  const workspace = useWorkspace();
  const utils = trpc.useUtils();
  const { data: linkages } = trpc.workspaces.workspace.settings.integrations.get_linkages.useQuery({ groupId });
  const updateSettings = trpc.workspaces.workspace.settings.integrations.update_call_discord_settings.useMutation();

  const existing = workspace?.callDiscordSettings;

  const [enabled, setEnabled] = useState<boolean>(!!existing?.categoryId);
  const [categoryId, setCategoryId] = useState<string>(existing?.categoryId || '');
  const [accessRoleIds, setAccessRoleIds] = useState<string[]>(existing?.accessRoleIds || []);
  const [closeAction, setCloseAction] = useState<'delete' | 'move'>(existing?.closeAction || 'delete');
  const [archiveCategoryId, setArchiveCategoryId] = useState<string>(existing?.archiveCategoryId || '');

  useEffect(() => {
    setEnabled(!!existing?.categoryId);
    setCategoryId(existing?.categoryId || '');
    setAccessRoleIds(existing?.accessRoleIds || []);
    setCloseAction(existing?.closeAction || 'delete');
    setArchiveCategoryId(existing?.archiveCategoryId || '');
  }, [existing?.categoryId, existing?.archiveCategoryId, existing?.closeAction, JSON.stringify(existing?.accessRoleIds)]);

  // Discord is not linked — prompt the admin to set up the integration first
  // instead of silently hiding the call settings.
  if (!linkages?.discord) {
    return (
      <Card className="border-l-4 border-indigo-500">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 dark:text-white">Discord Call Channels</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create a private Discord channel for each support call so agents can respond from Discord.
            </p>
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Discord isn&apos;t connected yet
              </p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                You need to link a Discord server before you can configure remote admin call channels.
              </p>
              <Link
                href={`/workspaces/${groupId}/settings/integrations`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Set up Discord integration
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const categories = (Array.isArray(linkages.channels) ? linkages.channels : [])
    .filter((c) => c.type === DISCORD_CATEGORY_TYPE)
    .map((c) => ({ name: c.name || 'Unnamed', id: c.id }));

  const roleChoices = (Array.isArray(linkages.guild?.roles) ? linkages.guild.roles : [])
    .filter((r) => r.name !== '@everyone')
    .map((r) => ({ name: r.name, id: r.id }));

  const handleSave = async () => {
    await toast.promise(
      updateSettings.mutateAsync({
        groupId,
        enabled,
        categoryId: categoryId || undefined,
        accessRoleIds,
        closeAction,
        archiveCategoryId: closeAction === 'move' ? archiveCategoryId || undefined : undefined,
      }),
      {
        loading: 'Saving Discord call settings...',
        success: 'Discord call settings saved!',
        error: (err: any) => `Failed to save: ${err.message}`,
      },
    );
    utils.workspaces.workspace.getWorkspace.invalidate({ groupId });
  };

  return (
    <Card className="border-l-4 border-indigo-500">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
          <ChatBubbleLeftRightIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">Discord Call Channels</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Create a private Discord channel for each support call so agents can respond from Discord.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <Toggle
          title="Enable Discord call channels"
          description="When a user opens a call, a private channel is created in the selected category. Agents reply in-game with /reply."
          value={enabled}
          onChange={setEnabled}
        />

        {enabled && (
          <>
            <div>
              <SectionHeader title="Call category" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                New call channels are created under this category.
              </p>
              <Dropdown
                onChange={setCategoryId}
                choices={categories}
                defaultValue={categoryId}
              />
            </div>

            <div>
              <SectionHeader title="Access roles" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Only these Discord roles can read and send messages in call channels. Channels are never public.
              </p>
              <MultiSelectDropdown
                label="Select roles"
                placeholder={accessRoleIds.length === 0 ? 'Click to select roles...' : ''}
                choices={roleChoices}
                value={accessRoleIds}
                onSelectChoice={(selected: string[]) => setAccessRoleIds(selected)}
              />
            </div>

            <div>
              <SectionHeader title="When a call is closed" />
              <Dropdown
                onChange={(v) => setCloseAction(v as 'delete' | 'move')}
                choices={[
                  { name: 'Delete the channel', id: 'delete' },
                  { name: 'Move to an archive category', id: 'move' },
                ]}
                defaultValue={closeAction}
              />
            </div>

            {closeAction === 'move' && (
              <div>
                <SectionHeader title="Archive category" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Closed call channels are moved here and locked.
                </p>
                <Dropdown
                  onChange={setArchiveCategoryId}
                  choices={categories}
                  defaultValue={archiveCategoryId}
                />
              </div>
            )}
          </>
        )}

        <div className="flex justify-end">
          <Button variant="blue" onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

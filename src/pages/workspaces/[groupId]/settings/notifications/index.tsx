import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { ReactElement } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { useRouter } from 'next/router';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import InputLabel from '~/components/forms/InputLabel';
import TextArea from '~/components/forms/TextArea';
import { trpc } from '~/utils/trpc';
import toast from 'react-hot-toast';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import Card from '~/components/ui/Card';
import type { DiscordDmCategory } from '~/services/NewMongoTypes/Workspace.type';
import { DISCORD_DM_CATEGORY_META } from '~/services/discordDmCategories';

type CategorySettings = { enabled: boolean; title?: string; message?: string };

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const settingsQuery = trpc.workspaces.workspace.settings.notifications.get.useQuery(
    { groupId },
    { enabled: !!groupId },
  );
  const updateMutation = trpc.workspaces.workspace.settings.notifications.update.useMutation();

  if (!user || !workspace || settingsQuery.isLoading || !settingsQuery.data) {
    return <LoadingPage />;
  }

  const current = settingsQuery.data;

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Notifications`}
        description="Control which automated Discord DMs ReAdmin sends to your members"
      />

      <Card className="mt-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Choose which categories of automated Discord direct messages your members receive.
          Disabling a category stops ReAdmin from sending that type of DM, and you can customize
          the title and message of each one. Leave a template blank to use the built-in default.
          Members can still opt out of all messages individually with{' '}
          <code>/opt-into-messaging false</code>.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-3">
          Templates support <code>{'{placeholder}'}</code> variables, listed under each message.
          Any variable that isn&apos;t available for a particular message is replaced with nothing.
        </p>
      </Card>

      <form
        // Remount inputs when fresh server data arrives so defaults stay in sync.
        key={settingsQuery.dataUpdatedAt}
        onSubmit={(e) => {
          e.preventDefault();
          const target = e.target as any;
          const settings = DISCORD_DM_CATEGORY_META.reduce(
            (acc, category) => {
              const title = (target[`${category.id}__title`]?.value || '').trim();
              const message = (target[`${category.id}__message`]?.value || '').trim();
              acc[category.id] = {
                enabled: Boolean(target[category.id]?.checked),
                title: title || undefined,
                message: message || undefined,
              };
              return acc;
            },
            {} as Record<DiscordDmCategory, CategorySettings>,
          );
          updateMutation
            .mutateAsync({ groupId, settings })
            .then(() => {
              settingsQuery.refetch();
              toast.success('Updated notification settings');
            })
            .catch((err) => {
              toast.error(err.message);
            });
        }}
        className="flex flex-col gap-4 mt-6"
      >
        {DISCORD_DM_CATEGORY_META.map((category) => {
          const config = current[category.id];
          return (
            <Card key={category.id} className="flex flex-col gap-4">
              <Toggle
                id={category.id}
                value={config.enabled}
                title={category.title}
                description={category.description}
              />

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex flex-col gap-3">
                <InputLabel
                  label="Custom title"
                  id={`${category.id}__title`}
                  required={false}
                  defaultValue={config.title || ''}
                  placeholder={category.defaultTitle}
                />
                <TextArea
                  label="Custom message"
                  id={`${category.id}__message`}
                  required={false}
                  rows={3}
                  defaultValue={config.message || ''}
                  placeholder={category.defaultMessage}
                />
                <div className="flex flex-wrap gap-2">
                  {category.variables.map((variable) => (
                    <span
                      key={variable.name}
                      title={variable.description}
                      className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs font-mono text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                    >
                      {`{${variable.name}}`}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}

        <Button
          variant={'primary'}
          className="w-full"
          type="submit"
          disabled={updateMutation.isPending}
        >
          Save Settings
        </Button>
      </form>
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);

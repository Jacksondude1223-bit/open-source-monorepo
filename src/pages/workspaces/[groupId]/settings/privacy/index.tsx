import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { ReactElement } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { useRouter } from 'next/router';
import Toggle from '~/components/forms/Toggle';
import { trpc } from '~/utils/trpc';
import toast from 'react-hot-toast';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import Card from '~/components/ui/Card';

export default function PrivacySettingsPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();

  const settingsQuery = trpc.workspaces.workspace.settings.privacy.get.useQuery(
    { groupId },
    { enabled: !!groupId },
  );
  const updateMutation = trpc.workspaces.workspace.settings.privacy.update.useMutation();

  if (!user || !workspace || settingsQuery.isLoading || !settingsQuery.data) {
    return <LoadingPage />;
  }

  const current = settingsQuery.data;

  const save = (patch: { trackStaffOnly?: boolean; requireConsent?: boolean }) => {
    updateMutation
      .mutateAsync({ groupId, ...patch })
      .then(() => {
        settingsQuery.refetch();
        toast.success('Updated privacy settings');
      })
      .catch((err) => {
        toast.error(err.message);
        settingsQuery.refetch();
      });
  };

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Privacy`}
        description="Control how player activity is tracked in your games"
      />

      <Card className="mt-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          These controls were built for Roblox&apos;s scoped user-ID change. They are off by
          default, so tracking behaves exactly as it does today until you turn one on. The
          consent prompt and policy shown to players are entirely in-game &mdash; ReAdmin never
          links players to a website (a Roblox Terms of Service requirement).
        </p>
      </Card>

      <Card className="mt-4 flex flex-col gap-1">
        <Toggle
          title="Only track staff in-game"
          description="Only create activity records for staff (your minimum sync rank and above). Non-staff players are never tracked. This does not count towards your workspace tracked staff count [that is group members]."
          value={current.trackStaffOnly}
          onChange={(v) => save({ trackStaffOnly: v })}
        />
      </Card>

      <Card className="mt-4 flex flex-col gap-1">
        <Toggle
          title="Require player consent"
          description="Show players an in-game consent prompt. They are tracked during their visit, but if they decline (or never answer) the visit's data is deleted when they leave, and they're asked again next time. Granting consent is remembered."
          value={current.requireConsent}
          onChange={(v) => save({ requireConsent: v })}
        />
      </Card>
    </>
  );
}

PrivacySettingsPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);

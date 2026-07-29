import toast from 'react-hot-toast';
import JSONPretty from 'react-json-pretty';
import { useWorkspace } from '~/components/contexts/workspace';
import Button from '~/components/forms/Button';
import Dropdown from '~/components/forms/Dropdown';
import LoadingPage from '~/components/layouts/LoadingPage';
import SectionHeader from '~/components/ui/SectionHeader';
import { trpc } from '~/utils/trpc';

export default function DiscordLinkage({ groupId }: { groupId: string }) {
  const workspace = useWorkspace();
  const mutation =
    trpc.workspaces.workspace.settings.integrations.unlink_discord.useMutation();
  const integrationInfo = trpc.workspaces.workspace.settings.integrations.get_linkages.useQuery({ groupId });
  const updateInactivityRole = trpc.workspaces.workspace.settings.integrations.update_inactivity_role.useMutation();
  const utils = trpc.useUtils();

  if (mutation.isPending) {
    return <LoadingPage />;
  }

  return (
    <div>
      <div>
        <p className="text-md font-bold">Successfully Linked</p>
        <p>Your Discord guild is successfully linked to ReAdmin.</p>
        <Button
          variant="danger"
          className="mt-2"
          size="medium"
          onClick={() => {
            mutation
              .mutateAsync({
                groupId,
              })
              .then(() => {
                window.location.reload();
              })
              .catch((e) => {
                alert(e);
              });
          }}
        >
          Unlink Bot
        </Button>

      </div>
      <div>
        <SectionHeader title='Inactive Role' />
        <Dropdown onChange={(data) => {
          console.log(data);
          updateInactivityRole.mutateAsync({
            groupId,
            roleId: data,
          }).then(() => {
            utils.workspaces.workspace.settings.integrations.get_linkages.invalidate({ groupId });
            utils.workspaces.workspace.getWorkspace.invalidate({ groupId });
          }).catch((e) => {
            toast.error(`Failed to update inactivity role: ${e.message}`);
          });
        }} choices={[{
          name: 'None',
          id: 'disabled',
        }, ...(integrationInfo.data?.guild.roles ?? []).map((role) => {
          return {
            name: role.name,
            id: role.id,
          }
        }).filter((a) => a.name !== '@everyone')]} defaultValue={workspace?.inactivityRole || 'disabled'} />

      </div>
    </div>
  );
}

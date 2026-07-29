import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { ReactElement, useState } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { useRouter } from 'next/router';
import Dropdown from '~/components/forms/Dropdown';
import Button from '~/components/forms/Button';
import { trpc } from '~/utils/trpc';
import toast from 'react-hot-toast';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import { BrandColors } from '~/services/NewMongoTypes/Workspace.type';
import ReadFile from "~/utils/FileReader";
import Card from '~/components/ui/Card';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import Toggle from '~/components/forms/Toggle';

const colors = ['red', 'orange', 'yellow', 'green', 'teal', 'sky', 'cyan', 'blue', 'indigo', 'purple', 'rose', 'pink'];

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const { data: bannerImage } = trpc.workspaces.workspace.getWorkspaceBanner.useQuery({ groupId });
  const { data: workspaceLogo } = trpc.workspaces.workspace.getWorkspaceLogo.useQuery({ groupId });
  const { mutateAsync: updateSettings } = trpc.workspaces.workspace.settings.updateGeneralSettings.useMutation();
  const { mutateAsync: uploadWorkspaceLogo } = trpc.workspaces.workspace.settings.uploadWorkspaceLogo.useMutation();
  const { mutateAsync: removeWorkspaceLogo } = trpc.workspaces.workspace.settings.removeWorkspaceLogo.useMutation();
  const { mutateAsync: uploadBannerImage } = trpc.workspaces.workspace.settings.uploadBannerImage.useMutation();
  const { mutateAsync: removeBannerImage } = trpc.workspaces.workspace.settings.removeBannerImage.useMutation();
  const context = trpc.useUtils();

  const isAdmin = !!workspace?.department?.permissions?.admin;
  const { data: modules } = trpc.workspaces.workspace.settings.modules.get.useQuery(
    { groupId },
    { enabled: !!groupId && isAdmin },
  );
  const setModule = trpc.workspaces.workspace.settings.modules.setModule.useMutation();

  const toggleOrdersModule = (enabled: boolean) => {
    const promise = setModule.mutateAsync({ groupId, module: 'orders', enabled }).then(() => {
      context.workspaces.workspace.settings.modules.get.invalidate({ groupId });
      context.workspaces.workspace.getWorkspace.invalidate({ groupId });
    });
    toast.promise(promise, {
      loading: 'Updating module…',
      success: enabled ? 'Orders module enabled' : 'Orders module disabled',
      error: (e) => e?.message || 'Failed to update module.',
    });
  };

  const [selectedColor, setSelectedColor] = useState<BrandColors>(workspace.brandColor || 'blue');
  if (!user || !workspace) {
    return <LoadingPage />;
  }

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Settings`}
        description="Manage your workspace preferences and branding"
      />

      <form className='flex flex-col gap-6 mt-2' onSubmit={(e) => {
        e.preventDefault();
        const minSyncRole = (e.target as any).minSyncRole.value;

        const update = new Promise<void>((resolve, reject) => {
          updateSettings({ groupId, minSyncRole, selectedColor }).then(() => {
            resolve();
            context.workspaces.workspace.getWorkspace.invalidate({ groupId });
          }).catch(e => {
            reject(e);
          });
        })

        toast.promise(update, {
          loading: 'Please wait while we update settings',
          success: 'Updated workspace settings successfully!',
          error: 'Failed to update workspace settings.'
        })
      }}>

        <Card>
          <Header>Minimum Sync Role</Header>
          <Small className="mt-1">The lowest role counted as a staff member. Set this appropriately to avoid tracking unnecessary data.</Small>
          <Dropdown className='mt-3' choices={workspace?.roles?.map(rank => ({ id: rank.rank.toString(), name: rank.name }))||[]} id="minSyncRole" defaultValue={workspace.minSyncRole} />
        </Card>

        <Card>
          <Header>Workspace Brand Color</Header>
          <Small className="mt-1">Choose a color to personalize your workspace throughout the platform.</Small>
          <div className="flex flex-row gap-3 mt-4 flex-wrap">
            {colors.map(color => (
              <button type="button" key={color} className={`${selectedColor == color ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-gray-800 scale-110' : 'hover:scale-105'} rounded-full h-10 w-10 bg-${color}-600 transition-all duration-150`} onClick={() => { setSelectedColor(color as BrandColors) }} />
            ))}
          </div>
        </Card>

        <Button variant="primary" size="medium" className="w-full">Save Settings</Button>

        <Card>
          <Header>Workspace Logo</Header>
          <Small className="mt-1">Recommended: square image around 500x500 pixels. Renders at ~47x47px.</Small>

          {workspaceLogo && (
            <div className="mt-4 inline-block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <img
                className="w-14 h-14 object-cover"
                src={workspaceLogo}
                alt="Workspace logo"
              />
            </div>
          )}
          <div className="mt-4 flex flex-row gap-3">
            <Button type="button" variant="discrete" size="small" className="w-full" onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = async (e) => {
                const file = (e.target as any).files[0];
                const fileData = await ReadFile(file);
                const name = file.name;
                const data = fileData?.toString();

                uploadWorkspaceLogo({ groupId, name, data: data as string }).then(() => {
                  toast.success('Uploaded workspace logo successfully!');
                  context.workspaces.workspace.getWorkspaceLogo.invalidate({ groupId });
                }).catch(e => {
                  toast.error(e.message);
                });

              }
              input.click();
            }}>Upload Logo</Button>
            {workspace.logoImage && (
              <Button type="button" variant="light_danger" size="small" className="w-full" onClick={() => {
                removeWorkspaceLogo({ groupId }).then(() => {
                  toast.success('Removed workspace logo successfully!');
                  context.workspaces.workspace.getWorkspaceLogo.invalidate({ groupId });
                }).catch(e => {
                  toast.error(e.message);
                });
              }}>Remove Logo</Button>
            )}
          </div>
        </Card>

        <Card>
          <Header>Workspace Banner Image</Header>
          <Small className="mt-1">Displayed at the top of your workspace dashboard. Use a wide, landscape image for best results.</Small>

          {bannerImage && (
            <img src={bannerImage} className="w-full max-h-48 object-cover rounded-lg mt-4 border border-gray-200 dark:border-gray-700" alt="banner image" />
          )}
          <div className="mt-4 flex flex-row gap-3">
            <Button type="button" variant="discrete" size="small" className="w-full" onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = async (e) => {
                const file = (e.target as any).files[0];
                const fileData = await ReadFile(file);
                const name = file.name;
                const data = fileData?.toString();

                uploadBannerImage({ groupId, name, data: data as string }).then(() => {
                  toast.success('Uploaded banner image successfully!');
                  context.workspaces.workspace.getWorkspaceBanner.invalidate({ groupId });
                }).catch(e => {
                  toast.error(e.message);
                });

              }
              input.click();
            }}>Upload Image</Button>
            {workspace.bannerImage && (
              <Button type="button" variant="light_danger" size="small" className="w-full" onClick={() => {
                removeBannerImage({ groupId }).then(() => {
                  toast.success('Removed banner image successfully!');
                  context.workspaces.workspace.getWorkspaceBanner.invalidate({ groupId });
                }).catch(e => {
                  toast.error(e.message);
                });
              }}>Remove Image</Button>
            )}
          </div>
        </Card>

      </form>
      
      {(isAdmin && workspace?.groupName == 'ReAdmin') && (
        <Card className="mt-2">
          <Header>Modules</Header>
          <Small className="mt-1">Enable optional workspace modules. Modules add new sections to your workspace.</Small>
          <div className="mt-4">
            <Toggle
              title="Orders / POS"
              description="In-game point-of-sale, product catalog and order management."
              value={modules?.orders === true}
              onChange={toggleOrdersModule}
            />
          </div>
        </Card>
      )}
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);

/* eslint-disable @next/next/no-img-element */
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { ReactElement, useState } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { useRouter } from 'next/router';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import Dropdown from '~/components/forms/Dropdown';
import { trpc } from '~/utils/trpc';
import toast from 'react-hot-toast';
import { Tag, TagColor } from '~/services/NewMongoTypes/Tag.type';
import { TrashIcon, TagIcon } from '@heroicons/react/20/solid';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import WorkspaceUpsale from '~/components/page_components/workspaces/settings/billing/Upsale';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import Card from '~/components/ui/Card';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';

const TAG_CHIP_CLASSES: Record<TagColor, string> = {
  blue: 'bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100',
  green: 'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100',
  yellow: 'bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100',
  red: 'bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100',
};

const COLOR_CHOICES = [
  { name: 'Blue', id: 'blue' },
  { name: 'Green', id: 'green' },
  { name: 'Yellow', id: 'yellow' },
  { name: 'Red', id: 'red' },
];

function TagPreview({ name, color }: { name: string; color: TagColor }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${TAG_CHIP_CLASSES[color] || TAG_CHIP_CLASSES.blue}`}
    >
      <TagIcon className="h-3 w-3 shrink-0" />
      <span className="truncate">{name?.trim() || 'Tag preview'}</span>
    </span>
  );
}

function ViewTag({ groupId, tag }: { groupId: string; tag: Tag }) {
  const context = trpc.useUtils();
  const updateMutation = trpc.workspaces.workspace.settings.userTags.edit.useMutation();
  const deleteMutation = trpc.workspaces.workspace.settings.userTags.delete.useMutation();
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState<TagColor>(tag.color);

  return (
    <Card className="overflow-visible">
      <form
        className="flex flex-col gap-3"
        onSubmit={(f) => {
          f.preventDefault();
          updateMutation.mutateAsync({ groupId, tagId: tag.tagId, name, color }).then(() => {
            toast.success('Tag updated successfully');
            context.workspaces.workspace.settings.userTags.get.invalidate({ groupId });
          }).catch(() => {
            toast.error('Something went wrong while trying to update a tag');
          });
        }}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <TextLabel
            disableMt={true}
            id="name"
            label="Name"
            className="grow"
            value={name}
            onChange={(v) => setName(v)}
            placeholder="Top performer"
          />
          <Dropdown
            disableWFull={true}
            id="color"
            label="Color"
            defaultValue={color}
            className="h-min"
            onChange={(v) => setColor(v as TagColor)}
            choices={COLOR_CHOICES}
          />
          <Button variant="primary" className="h-min" size="medium" type="submit">
            Save
          </Button>
          <Button
            variant="light_danger"
            icon={TrashIcon}
            className="h-min"
            size="medium"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              deleteMutation.mutateAsync({ groupId, tagId: tag.tagId }).then(() => {
                toast.success('Tag deleted successfully');
                context.workspaces.workspace.settings.userTags.get.invalidate({ groupId });
              }).catch(() => {
                toast.error('Something went wrong while trying to delete a tag');
              });
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">Preview</span>
          <TagPreview name={name} color={color} />
        </div>
      </form>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const context = trpc.useUtils();

  const { data: tags, isPending } = trpc.workspaces.workspace.settings.userTags.get.useQuery({ groupId });
  const createMutation = trpc.workspaces.workspace.settings.userTags.create.useMutation();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<TagColor>('blue');

  if (!user || !workspace) {
    return <LoadingPage />;
  }

  if (!workspace?.premium?.is) {
    return (
      <>
        <PageHeading
          title={`${workspace?.groupName} User Tags`}
          description='Segment and categorize your staff for better tracking'
        />
        <div className='flex flex-col items-center gap-4 mt-6'>
          <h2 className='text-xl font-semibold text-center text-gray-900 dark:text-gray-100'>Tags make it easier to track staff data</h2>
          <p className='text-sm text-gray-500 text-center max-w-md'>Categorize users into custom groups to streamline distributions and reporting.</p>
          <img src="https://cdn.readmin.app/readmin-public/UserTags.png" className='max-h-100 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700' alt="user tags preview" />
          <WorkspaceUpsale />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} User Tags`}
        description='Segment and categorize your staff for better tracking'
      />

      <Card className="mt-4 overflow-visible border-l-4 border-blue-500">
        <Header fontSize="sm">Create a new tag</Header>
        <Small>Give the tag a name and pick a color. You can assign it to staff later.</Small>
        <form
          className='mt-3 flex flex-col gap-3'
          onSubmit={(f) => {
            f.preventDefault();
            createMutation.mutateAsync({ groupId, name: newName, color: newColor }).then(() => {
              toast.success('Tag created successfully');
              context.workspaces.workspace.settings.userTags.get.invalidate({ groupId });
              setNewName('');
              setNewColor('blue');
            }).catch(() => {
              toast.error('Something went wrong while trying to create a tag');
            });
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <TextLabel
              label="Tag name"
              id="name"
              className='grow'
              value={newName}
              onChange={(v) => setNewName(v)}
              placeholder="Top performer"
            />
            <Dropdown
              disableWFull={true}
              className='self-end'
              id="color"
              label="Color"
              defaultValue={newColor}
              onChange={(v) => setNewColor(v as TagColor)}
              choices={COLOR_CHOICES}
            />
            <Button variant="primary" className='h-min shrink-0' size="medium" type="submit">Create Tag</Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">Preview</span>
            <TagPreview name={newName} color={newColor} />
          </div>
        </form>
      </Card>

      <div className='mt-6 flex flex-col gap-3'>
        <Header>Your tags</Header>
        {isPending && (
          <LoadingAnimation />
        )}
        {tags?.length == 0 && !isPending && (
          <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 px-6 py-10 text-center dark:border-gray-700">
            <TagIcon className="h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className='mt-2 text-sm font-medium text-gray-600 dark:text-gray-300'>No tags created yet</p>
            <p className='mt-0.5 text-xs text-gray-400 dark:text-gray-500'>Create your first tag above to start categorizing users</p>
          </div>
        )}
        {tags?.map(tag => (
          <ViewTag groupId={groupId} tag={tag} key={tag.tagId} />
        ))}
      </div>
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);

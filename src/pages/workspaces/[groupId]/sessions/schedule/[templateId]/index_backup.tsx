'use client';

import { TrashIcon, ArrowLeftIcon } from '@heroicons/react/20/solid';
import { useRouter } from 'next/router';
import { useState, ReactElement, useEffect } from 'react';
import Button from '~/components/forms/Button';
import Dropdown from '~/components/forms/Dropdown';
import Toggle from '~/components/forms/Toggle';
import TextLabel from '~/components/forms/TextLabel';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceSessionsSidebarNavigationLayout from '~/components/page_components/workspaces/sessions/WorkspaceSessionsSidebarNavigationLayout';
import Modal from '~/components/ui/Modal';
import { utcToTimezone } from '~/utils/Time';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId, templateId }: { groupId: string; templateId: string } =
    router.query as any;
  const workspace = useWorkspace();

  const [deleting, setDeleting] = useState(false);
  const [repeatType, setRepeatType] = useState<'weekly' | 'daily'>();

  const { data: games } = trpc.workspaces.workspace.games.getGames.useQuery({
    groupId,
  });
  const { data: roles } =
    trpc.workspaces.workspace.sessions.roles.getRoles.useQuery({ groupId });
  const { data: template } =
    trpc.workspaces.workspace.sessions.templates.getTemplateById.useQuery({
      groupId,
      templateId,
    });
  const updateMutation =
    trpc.workspaces.workspace.sessions.templates.updateTemplate.useMutation();
  const deleteMutation =
    trpc.workspaces.workspace.sessions.templates.deleteTemplate.useMutation();
  if (!roles || !games || !template) {
    return <LoadingPage />;
  }
  const permissions = workspace.department.permissions.sessions;

  if (!permissions.manage) {
    return (
      <>

        <PageHeading
          title={`${workspace?.groupName} Sessions`}
          disableDivide={true}
        />
        <div className="text-lg font-bold text-center justify-center">
          <p>You don&apos;t have permission to manage sessions</p>
          <p className="font-normal">If you believe this is a mistake, contact one of your group admins.</p>
        </div>
      </>
    )
  }

  if (roles.length == 0) {
    return (
      <>
        <PageHeading
          title={`${workspace?.groupName} Sessions`}
          disableDivide={true}
        />
        <div>
          <p className="text-center font-bold text-lg">
            You have no session roles
          </p>
          <p className="text-center text-lg">
            You must create a template role before you can create a session
            template
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Sessions`}
        disableDivide={true}
      />

      <div className="mb-2 flex flex-row justify-between">
        <h3 className="text-lg font-bold leading-6 text-gray-900 transition dark:text-gray-100 self-center align-middle">
          {template.name} Settings
        </h3>
        <Button
          onClick={() => {
            setDeleting(true);
          }}
          variant="light_danger"
          size="medium"
          icon={TrashIcon}
        />
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={async (f) => {
          f.preventDefault();
          const target = f.target as any;
          const rolesEnabled = roles
            .filter((role) => target[role.id].checked)
            .map((a) => a.id);
          const {
            repeatType: { value: repeatType },
            name: { value: name },
            description: { value: description },
            time: { value: time },
            game: { value: game },
            appearsMinutesBefore: { value: appearsMinutesBefore },
            sessionDuration: { value: sessionDuration },
            createDiscordEvent: { checked: createDiscordEvent }
          } = target;
          const day = repeatType == 'weekly' ? target.day.value : null;

          if (rolesEnabled.length == 0) {
            return alert(
              'You must select at-least one template role to create a new session template',
            );
          }
          if (!game) {
            return alert('You must link a game to this new template');
          }
          if (repeatType == 'weekly' && !day) {
            return alert('You must select a day of the week');
          }
          const [hours, minutes] = time.split(':');
          // Create a new date object in the local timezone
          const dateObj = new Date();

          // Set the hours and minutes of the date object
          dateObj.setHours(hours);
          dateObj.setMinutes(minutes);

          // Get the UTC hours and minutes from the date object
          const utcHours = dateObj.getUTCHours();
          const utcMinutes = dateObj.getUTCMinutes();
          updateMutation
            .mutateAsync({
              groupId,
              templateId,
              name,
              description,
              repeatType,
              time: { hours: utcHours, minutes: utcMinutes },
              day,
              game,
              appearsMinutesBefore,
              sessionDuration,
              rolesEnabled,
              createDiscordEvent,
            })
            .then(() => {
              toast.success('Successfully updated settings')
            })
            .catch((e) => {
              alert(e.message);
            });
        }}
      >
        <TextLabel
          label="Name"
          id="name"
          placeholder="Type a name here"
          defaultValue={template.name}
        />
        <TextLabel
          label="Description"
          id="description"
          placeholder="Type a description here (this will optionally show on Discord)"
          defaultValue={template.description}
        />
        <div>
          <p className="block text-sm font-medium text-gray-700">Roles</p>
          <div>
            {roles.map((role) => (
              <Toggle
                key={role._id.toString()}
                title={role.name}
                description={''}
                id={role.id}
                value={template.roles.includes(role.id)}
              />
            ))}
          </div>
        </div>

        <Dropdown
          label="Repeat Type"
          id="repeatType"
          choices={[
            { name: 'Daily', id: 'daily' },
            { name: 'Weekly', id: 'weekly' },
          ]}
          defaultValue={repeatType}
          onChange={setRepeatType}
        />

        <TextLabel
          id="time"
          label="Time"
          type="time"
          defaultValue={
            utcToTimezone({
              hours: template.schedule.hour,
              minutes: template.schedule.minute,
            }).time24
          }
        />
        <p className="text-sm font-light -mt-1.5">
          This time is in your local timezone
        </p>

        {repeatType == 'weekly' && ( // Daily
          <Dropdown
            id="day"
            label="Day"
            choices={[
              { name: 'Monday', id: 'monday' },
              { name: 'Tuesday', id: 'tuesday' },
              { name: 'Wednesday', id: 'wednesday' },
              { name: 'Thursday', id: 'thursday' },
              { name: 'Friday', id: 'friday' },
              { name: 'Saturday', id: 'saturday' },
              { name: 'Sunday', id: 'sunday' },
            ]}
          />
        )}

        <Dropdown
          label="Game"
          id="game"
          choices={games.map((game) => ({
            name: game.name,
            id: game.gameId.toString(),
          }))}
          defaultValue={template.gameId.toString()}
        />

        <TextLabel
          label="Time before session to notify"
          id="appearsMinutesBefore"
          type="number"
          placeholder="0"
          defaultValue={template.appearsMinutesBefore.toString()}
        />
        <TextLabel
          label="Estimated session duration (minutes)"
          id="sessionDuration"
          type="number"
          placeholder="0"
          defaultValue={template.sessionDuration.toString()}
          min="0"
        />
        <Toggle id="createDiscordEvent" title="Create Discord Event for Session" description='Will create a Discord event for this session when it is claimed' value={template.createDiscordEvent} />

        <Button variant="primary" size="medium" className="w-full">
          Update {template.name}
        </Button>
      </form>

      <Modal open={deleting} setOpen={setDeleting}>
        <p className="text-center font-bold">{`Are you sure you want to delete ${template.name}?`}</p>
        <div className="flex flex-row gap-2 mt-4">
          <Button
            className="w-full"
            variant="blue"
            size="medium"
            onClick={() => {
              setDeleting(true);
            }}
          >
            Cancel
          </Button>

          <Button
            className="w-full"
            variant="light_danger"
            size="medium"
            onClick={() => {
              deleteMutation
                .mutateAsync({
                  groupId,
                  templateId,
                })
                .then(() => {
                  router.push(`/workspaces/${groupId}/sessions/schedule`);
                })
                .catch((e) => {
                  alert(e.message);
                });
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceSessionsSidebarNavigationLayout>{page}</WorkspaceSessionsSidebarNavigationLayout>
);

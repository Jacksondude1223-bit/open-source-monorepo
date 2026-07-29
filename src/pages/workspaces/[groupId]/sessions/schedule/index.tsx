'use client';

import { PlusCircleIcon, PencilIcon, TrashIcon, EllipsisVerticalIcon, ClockIcon, CalendarIcon, UserGroupIcon } from '@heroicons/react/20/solid';
import { useRouter } from 'next/router';
import { useState, PropsWithChildren, ReactElement } from 'react';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import TextLabel from '~/components/forms/TextLabel';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceSessionsSidebarNavigationLayout from '~/components/page_components/workspaces/sessions/WorkspaceSessionsSidebarNavigationLayout';
import Card from '~/components/ui/Card';
import EmptyCardCreateState from '~/components/ui/EmptyCardCreateState';
import Modal from '~/components/ui/Modal';
import { utcToTimezone } from '~/utils/Time';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import Dropdown from '~/components/forms/Dropdown';
import toast from 'react-hot-toast';
import { Game, SessionRoles } from '~/services/NewMongoTypes';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<any>(null);

  const { data: games } = trpc.workspaces.workspace.games.getGames.useQuery({
    groupId,
  });
  const { data: roles } =
    trpc.workspaces.workspace.sessions.roles.getRoles.useQuery({ groupId });
  const { data: templates } =
    trpc.workspaces.workspace.sessions.templates.getTemplates.useQuery({
      groupId,
    });
  const permissions = workspace.department.permissions.sessions;

  if (!permissions.manage) {
    return (
      <>

        <PageHeading
          title={`${workspace?.groupName} Sessions`}
          disableDivide={true}
        />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">You don&apos;t have permission to manage sessions</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">If you believe this is a mistake, contact one of your group admins.</p>
        </div>
      </>
    )
  }

  if (!roles || !games || !templates) {
    return (
      <>

        <PageHeading
          title={`${workspace?.groupName} Sessions`}
          disableDivide={true}
        />
        <LoadingPage />
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
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            No session roles created
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            You must create a template role before you can create a session template.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Sessions`}
        description="Recurring session templates that automatically appear on the schedule."
        disableDivide={true}
      />
      <div className="animate-in fade-in slide-in-from-left grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onEdit={() => setEditingTemplate(template)}
            onDelete={() => setDeletingTemplate(template)}
          />
        ))}
        <EmptyCardCreateState
          icon={PlusCircleIcon}
          buttonText="Create a new template"
          cbFunction={() => {
            setCreating(true);
          }}
        />
      </div>

      <CreateTemplate
        creating={creating}
        setCreating={setCreating}
        roles={roles}
        games={games}
        groupId={groupId}
      />

      {editingTemplate && (
        <EditTemplate
          template={editingTemplate}
          setTemplate={setEditingTemplate}
          roles={roles}
          games={games}
          groupId={groupId}
        />
      )}

      {deletingTemplate && (
        <DeleteTemplateModal
          template={deletingTemplate}
          setTemplate={setDeletingTemplate}
          groupId={groupId}
        />
      )}
    </>
  );
}

function CreateTemplate({
  creating,
  setCreating,
  roles,
  games,
  groupId,
}: PropsWithChildren<{
  creating: boolean;
  setCreating: any;
  roles: SessionRoles[];
  games: Game[];
  groupId: string;
}>) {
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly'>('daily');
  const createMutation =
    trpc.workspaces.workspace.sessions.templates.createTemplate.useMutation();
  const context = trpc.useUtils();

  return (
    <Modal open={creating} setOpen={setCreating}>
      <PageHeading title="Create a new Session Template" />

      <form
        className="flex flex-col gap-2"
        onSubmit={async (f) => {
          f.preventDefault();
          const target = f.target as any;
          const rolesEnabled = roles
            .filter((role) => target[role.id].checked)
            .map((a) => a.id);
          const day = repeatType == 'weekly' ? target.day.value : null;
          const {
            name: { value: name },
            description: { value: description },
            time: { value: time },
            game: { value: game },
            appearsMinutesBefore: { value: appearsMinutesBefore },
            sessionDuration: { value: sessionDuration },
            createDiscordEvent: { checked: createDiscordEvent }
          } = target;

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
          createMutation
            .mutateAsync({
              groupId,
              name,
              description,
              repeatType,
              time: { hours: utcHours, minutes: utcMinutes },
              day,
              game,
              appearsMinutesBefore,
              rolesEnabled,
              sessionDuration,
              createDiscordEvent
            }).then(() => {
              context.workspaces.workspace.sessions.templates.getTemplates.invalidate({ groupId });
              toast.success('Successfully created template');
              setCreating(false);
            })
            .catch((e) => {
              alert(e.message);
            });
        }}
      >
        <TextLabel label="Name" id="name" placeholder="Type a name here" />
        <TextLabel
          label="Description"
          id="description"
          placeholder="Type a description here (this will optionally show on Discord)"
        />
        <div>
          <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Roles</p>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60 px-3">
            {roles.map((role) => (
              <Toggle
                //@ts-expect-error ignore this.
                key={role._id.toString()}
                title={role.name}
                description={''}
                id={role.id}
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

        <TextLabel id="time" label="Time" type="time" />
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
        />

        <TextLabel
          label="Time before session to notify"
          id="appearsMinutesBefore"
          type="number"
          placeholder="0"
        />

        <TextLabel
          label="Estimated session duration (minutes)"
          id="sessionDuration"
          type="number"
          placeholder="0"
          min="0"
        />        <Toggle id="createDiscordEvent" title="Create Discord Event for Session" description='Will create a Discord event for this session when it is claimed' />        <div className="flex gap-2 mt-4">
          <Button
            type="button"
            variant="discrete"
            size="medium"
            className="flex-1"
            onClick={() => setCreating(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" size="medium" className="flex-1">
            Create Template
          </Button>
        </div>
      </form>
    </Modal>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceSessionsSidebarNavigationLayout>{page}</WorkspaceSessionsSidebarNavigationLayout>
);

function TemplateCard({ template, onEdit, onDelete }: { template: any; onEdit: () => void; onDelete: () => void }) {
  const [showActions, setShowActions] = useState(false);

  return (
    <Card className="relative group hover:shadow-lg transition-all duration-200">
      <div className="flex flex-col h-full">
        {/* Header with title and actions */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate pr-2">
            {template.name}
          </h3>          <div className="relative">
            <Button
              variant="discrete"
              size="small"
              icon={EllipsisVerticalIcon}
              onClick={() => setShowActions(!showActions)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
            {showActions && (
              <>
                {/* Backdrop to close dropdown */}
                <div
                  className="fixed inset-0 z-5"
                  onClick={() => setShowActions(false)}
                />
                <div className="absolute right-0 top-8 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-30">
                  <button
                    onClick={() => {
                      onEdit();
                      setShowActions(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <PencilIcon className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      onDelete();
                      setShowActions(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {template.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
            {template.description}
          </p>
        )}

        {/* Schedule Info */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
          <CalendarIcon className="h-4 w-4" />
          <span>
            {template.schedule.type === 'daily' && 'Daily'}
            {template.schedule.type === 'weekly' && (
              <>
                {
                  // @ts-expect-error - template.schedule.day is a string
                  {
                    monday: 'Mondays',
                    tuesday: 'Tuesdays',
                    wednesday: 'Wednesdays',
                    thursday: 'Thursdays',
                    friday: 'Fridays',
                    saturday: 'Saturdays',
                    sunday: 'Sundays',
                  }[template.schedule.day]
                }
              </>
            )}
          </span>
        </div>

        {/* Time Info */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
          <ClockIcon className="h-4 w-4" />
          <span>
            {
              utcToTimezone({
                hours: template.schedule.hour,
                minutes: template.schedule.minute,
              }).time12
            }
          </span>
        </div>

        {/* Roles Info */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
          <UserGroupIcon className="h-4 w-4" />
          <span>{template.roles.length} role(s)</span>
        </div>

        {/* Duration and notification info */}
        <div className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-500 mt-auto pt-3 border-t border-gray-200 dark:border-gray-700">
          <div>Duration: {template.sessionDuration || 60} minutes</div>
          <div>Notify: {template.appearsMinutesBefore || 0} min before</div>
        </div>
      </div>
    </Card>
  );
}

function EditTemplate({
  template,
  setTemplate,
  roles,
  games,
  groupId,
}: {
  template: any;
  setTemplate: (template: any) => void;
  roles: SessionRoles[];
  games: Game[];
  groupId: string;
}) {
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly'>(template.schedule.type);
  const updateMutation = trpc.workspaces.workspace.sessions.templates.updateTemplate.useMutation();
  const context = trpc.useUtils();

  return (
    <Modal open={!!template} setOpen={() => setTemplate(null)}>
      <PageHeading title={`Edit ${template.name}`} />

      <form
        className="flex flex-col gap-2"
        onSubmit={async (f) => {
          f.preventDefault();
          const target = f.target as any;
          const rolesEnabled = roles
            .filter((role) => target[role.id].checked)
            .map((a) => a.id);
          const day = repeatType == 'weekly' ? target.day.value : null;
          const {
            name: { value: name },
            description: { value: description },
            time: { value: time },
            game: { value: game },
            appearsMinutesBefore: { value: appearsMinutesBefore },
            sessionDuration: { value: sessionDuration },
            createDiscordEvent: { checked: createDiscordEvent }
          } = target;

          if (rolesEnabled.length == 0) {
            return alert('You must select at-least one template role');
          }
          if (!game) {
            return alert('You must link a game to this template');
          }
          if (repeatType == 'weekly' && !day) {
            return alert('You must select a day of the week');
          }

          const [hours, minutes] = time.split(':');
          const dateObj = new Date();
          dateObj.setHours(hours);
          dateObj.setMinutes(minutes);
          const utcHours = dateObj.getUTCHours();
          const utcMinutes = dateObj.getUTCMinutes();

          updateMutation
            .mutateAsync({
              groupId,
              templateId: template.id,
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
              context.workspaces.workspace.sessions.templates.getTemplates.invalidate({ groupId });
              toast.success('Successfully updated template');
              setTemplate(null);
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
          <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Roles</p>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60 px-3">
            {roles.map((role) => (
              <Toggle
                key={role._id?.toString() || role.id}
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

        {repeatType == 'weekly' && (
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
            defaultValue={template.schedule.day}
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
          min="0"
          defaultValue={template.sessionDuration.toString()}
        />

        <Toggle
          id="createDiscordEvent"
          title="Create Discord Event for Session"
          description='Will create a Discord event for this session when it is claimed'
          value={template.createDiscordEvent}
        />        <div className="flex gap-2 mt-4">
          <Button
            type="button"
            variant="discrete"
            size="medium"
            className="flex-1"
            onClick={() => setTemplate(null)}
          >
            Cancel
          </Button>
          <Button variant="primary" size="medium" className="flex-1">
            Update Template
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteTemplateModal({
  template,
  setTemplate,
  groupId,
}: {
  template: any;
  setTemplate: (template: any) => void;
  groupId: string;
}) {
  const deleteMutation = trpc.workspaces.workspace.sessions.templates.deleteTemplate.useMutation();
  const context = trpc.useUtils();

  const handleDelete = () => {
    deleteMutation
      .mutateAsync({
        groupId,
        templateId: template.id,
      })
      .then(() => {
        context.workspaces.workspace.sessions.templates.getTemplates.invalidate({ groupId });
        toast.success('Template deleted successfully');
        setTemplate(null);
      })
      .catch((e) => {
        alert(e.message);
      });
  };

  return (
    <Modal open={!!template} setOpen={() => setTemplate(null)}>
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
          <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Delete Template
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Are you sure you want to delete "{template.name}"? This action cannot be undone.
        </p>        <div className="flex gap-3 justify-center">
          <Button
            variant="discrete"
            size="medium"
            onClick={() => setTemplate(null)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="medium"
            onClick={handleDelete}
          >
            Delete Template
          </Button>
        </div>
      </div>
    </Modal>
  );
}

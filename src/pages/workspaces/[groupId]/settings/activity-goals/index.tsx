/* eslint-disable @next/next/no-img-element */
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { ReactElement, useState } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { useRouter } from 'next/router';
import Button from '~/components/forms/Button';
import { TrashIcon } from '@heroicons/react/20/solid';
import Modal from '~/components/ui/Modal';
import TextLabel from '~/components/forms/TextLabel';
import Toggle from '~/components/forms/Toggle';
import Dropdown from '~/components/forms/Dropdown';
import { trpc } from '~/utils/trpc';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import toast from 'react-hot-toast';
import { ActivityRequirement, Department } from '~/services/NewMongoTypes';
import { ClockIcon } from '@heroicons/react/24/outline';
import WorkspaceUpsale from '~/components/page_components/workspaces/settings/billing/Upsale';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import EmptyCardCreateState from '~/components/ui/EmptyCardCreateState';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';

function GoalForm({
  requirement,
  groupId,
  games,
  departments,
  gamesIsLoading,
  departmentsLoading,
  onSubmit,
  submitLabel,
  isLoading,
}: {
  requirement?: ActivityRequirement;
  groupId: string;
  games: any;
  departments: Department[];
  gamesIsLoading: boolean;
  departmentsLoading: boolean;
  onSubmit: (data: {
    name: string;
    creatingForGameOrGlobal: 'game' | 'global';
    game: { placeId: string; gameId: string } | null;
    minimumMinutes: string;
    minimumActiveMinutes: string;
    minimumMessages: string;
    minimumSessions: string;
    departmentsSelected: string[];
  }) => void;
  submitLabel: string;
  isLoading: boolean;
}) {
  const [creatingForGameOrGlobal, setCreatingForGameOrGlobal] = useState<'game' | 'global'>(
    requirement?.type || 'global'
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const target = e.target as any;
        const name = target.name.value;
        const game: { placeId: string; gameId: string } | null = target.gameId
          ? (games || [])
              .filter((a: any) => a._id.toString() == target.gameId.value)
              .map((a: any) => ({ placeId: a.placeId.toString(), gameId: a.gameId.toString() }))[0] || null
          : null;
        const minimumMinutes = target.minimumMinutes.value;
        const minimumActiveMinutes = target.minimumActiveMinutes.value;
        const minimumMessages = target.minimumMessages.value;
        const minimumSessions = target.minimumSessions.value;
        const departmentsSelected = (departments || [])
          .filter((a) => target[a?._id?.toString() || '']?.checked == true)
          .map((a) => a?._id?.toString() || '');

        if (creatingForGameOrGlobal == 'game' && !game) {
          toast.error('Please select a game.');
          return;
        }
        if (departmentsSelected.length == 0) {
          toast.error('Please select at least one department.');
          return;
        }
        onSubmit({ name, creatingForGameOrGlobal, game, minimumMinutes, minimumActiveMinutes, minimumMessages, minimumSessions, departmentsSelected });
      }}
      className="flex flex-col gap-3 mt-3"
    >
      <TextLabel
        defaultValue={requirement?.name || ''}
        required={true}
        label="Goal Name"
        id="name"
        placeholder="e.g. Weekly Activity Requirement"
      />

      <div className="border-t border-gray-200 dark:border-gray-700" />
      <div>
        <Header fontSize="sm">Scope</Header>
        <Small>Choose whether this goal applies globally or to a specific game.</Small>
      </div>
      <Toggle
        value={creatingForGameOrGlobal == 'global'}
        id="forType"
        title="Global goal"
        onChange={(v) => setCreatingForGameOrGlobal(v ? 'global' : 'game')}
        description="Applies to all games. Disable to target a specific game."
      />
      {creatingForGameOrGlobal == 'game' && (gamesIsLoading ? (
        <LoadingAnimation />
      ) : (
        <Dropdown
          defaultValue={games?.find((a: any) => a.gameId?.toString() == (requirement?.gameId || '').toString())?._id || ''}
          required={true}
          id="gameId"
          label="Game"
          choices={(games || []).map((game: any) => ({ id: game._id.toString(), name: game.name }))}
        />
      ))}

      <div className="border-t border-gray-200 dark:border-gray-700" />
      <div>
        <Header fontSize="sm">Targets</Header>
        <Small>Set minimum thresholds for each metric. Use 0 to disable a target.</Small>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextLabel defaultValue={requirement?.minimumMinutes ?? ''} required={true} id="minimumMinutes" type="number" min="0" max="43800" label="Minutes" placeholder="0" />
        <TextLabel defaultValue={requirement?.minimumActiveMinutes ?? ''} required={true} id="minimumActiveMinutes" type="number" min="0" max="43800" label="Active minutes" placeholder="0" />
        <TextLabel defaultValue={requirement?.minimumMessages ?? ''} required={true} id="minimumMessages" type="number" min="0" max="43800" label="Messages" placeholder="0" />
        <TextLabel defaultValue={requirement?.minimumSessions ?? ''} required={true} id="minimumSessions" type="number" min="0" max="43800" label="Sessions" placeholder="0" />
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">Time spent typing is also counted as active time.</p>

      <div className="border-t border-gray-200 dark:border-gray-700" />
      <div>
        <Header fontSize="sm">Departments</Header>
        <Small>Select which departments this goal applies to.</Small>
      </div>
      {departmentsLoading ? (
        <LoadingAnimation />
      ) : (
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          {(departments || []).map((department: Department) => (
            <Toggle
              value={requirement?.departments?.map((a) => a.toString()).includes(department?._id?.toString() || '') || false}
              key={department._id?.toString()}
              id={department._id?.toString()}
              title={department.name}
              description=""
            />
          ))}
          {(!departments || departments.length == 0) && (
            <p className="text-sm text-gray-400 text-center py-2">No departments found</p>
          )}
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-700" />
      <Button variant="primary" className="w-full" size="medium" disabled={isLoading}>
        {isLoading ? 'Saving...' : submitLabel}
      </Button>
    </form>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  if (!value) return null;
  return (
    <div className="flex flex-col items-center rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2">
      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}

function GoalCard({
  requirement,
  departments,
  games,
  brandColor,
  onEdit,
  onDelete,
  isDeleting,
}: {
  requirement: ActivityRequirement;
  departments: Department[];
  games: any;
  brandColor: string;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const assignedDepts = (departments || []).filter((d) =>
    requirement?.departments?.map((a) => a.toString()).includes(d?._id?.toString() || '')
  );
  const gameName = requirement.type === 'game'
    ? (games || []).find((g: any) => g.gameId?.toString() == requirement.gameId?.toString())?.name || 'Unknown game'
    : null;
  const stats = [
    { label: 'Minutes', value: requirement.minimumMinutes },
    { label: 'Active min', value: requirement.minimumActiveMinutes },
    { label: 'Messages', value: requirement.minimumMessages },
    { label: 'Sessions', value: requirement.minimumSessions },
  ].filter((s) => s.value > 0);

  return (
    <div className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
            {requirement.name}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              requirement.type === 'global'
                ? `bg-${brandColor}-100 text-${brandColor}-700 dark:bg-${brandColor}-900/30 dark:text-${brandColor}-300`
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            }`}>
              {requirement.type === 'global' ? 'Global' : gameName}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {assignedDepts.length} dept{assignedDepts.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <Button type="button" icon={TrashIcon} variant="light_danger" size="small" disabled={isDeleting} onClick={onDelete} />
      </div>

      {stats.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <StatItem key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-3 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">No targets set</p>
        </div>
      )}

      <Button type="button" variant="discrete" size="medium" className="w-full mt-auto" onClick={onEdit}>
        Edit Goal
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const [editingGoal, setEditingGoal] = useState<ActivityRequirement | null>(null);
  const [creating, setCreating] = useState(false);
  const { data: games, isLoading: gamesIsLoading } = trpc.workspaces.workspace.games.getGames.useQuery({ groupId });
  const { data: departments, isLoading: departmentsLoading } = trpc.workspaces.workspace.settings.departments.getDepartments.useQuery({ groupId });
  const { data: getRequirements, isLoading: requirementsLoading } = trpc.workspaces.workspace.settings.activityGoals.getGoals.useQuery({ groupId });
  const createMutation = trpc.workspaces.workspace.settings.activityGoals.createGoal.useMutation();
  const updateMutation = trpc.workspaces.workspace.settings.activityGoals.updateGoal.useMutation();
  const deleteMutation = trpc.workspaces.workspace.settings.activityGoals.deleteGoal.useMutation();
  const context = trpc.useUtils();
  const brandColor = workspace?.brandColor || 'blue';

  if (!user || !workspace || requirementsLoading) {
    return <LoadingPage />;
  }

  if (!workspace?.premium?.is) {
    return (
      <>
        <PageHeading title={`${workspace?.groupName} Activity Goals`} disableDivide={true} />
        <div className="flex flex-col items-center gap-4 mt-6">
          <h2 className="text-xl font-semibold text-center text-gray-900 dark:text-gray-100">Motivate staff with activity goals</h2>
          <p className="text-sm text-gray-500 text-center max-w-md">Set targets for your team and track their performance with advanced activity tracking and reporting.</p>
          <img src="https://cdn.readmin.app/readmin-public/ReAdminMotivatesActivity.png" className="max-h-100 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700" alt="activity goals preview" />
          <WorkspaceUpsale />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Activity Goals`}
        description="Set performance targets for your team"
        className="flex flex-row justify-between pb-2"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {getRequirements?.map((requirement) => (
          <GoalCard
            key={requirement._id.toString()}
            requirement={requirement}
            departments={departments as Department[]}
            games={games}
            brandColor={brandColor}
            onEdit={() => setEditingGoal(requirement)}
            onDelete={() => {
              deleteMutation.mutateAsync({ groupId, goalId: requirement._id.toString() }).then(() => {
                context.workspaces.workspace.settings.activityGoals.getGoals.invalidate({ groupId });
                toast.success('Deleted goal successfully!');
              }).catch((e) => { toast.error(e.message); });
            }}
            isDeleting={deleteMutation.isPending}
          />
        ))}
        <EmptyCardCreateState icon={ClockIcon} buttonText="Create an Activity Goal" cbFunction={() => setCreating(true)} />
      </div>

      <Modal open={!!editingGoal} setOpen={() => setEditingGoal(null)}>
        <PageHeading title="Edit Activity Goal" disableDivide={true} />
        {editingGoal && (
          <GoalForm
            key={editingGoal._id?.toString() || ''}
            requirement={editingGoal}
            groupId={groupId}
            games={games}
            departments={departments as Department[]}
            gamesIsLoading={gamesIsLoading}
            departmentsLoading={departmentsLoading}
            isLoading={updateMutation.isPending}
            submitLabel="Save Changes"
            onSubmit={(data) => {
              updateMutation.mutateAsync({ groupId, goalId: editingGoal._id?.toString() || '', ...data }).then(() => {
                context.workspaces.workspace.settings.activityGoals.getGoals.invalidate({ groupId });
                toast.success('Updated activity goal successfully!');
                setEditingGoal(null);
              }).catch((e) => { toast.error(e.message); });
            }}
          />
        )}
      </Modal>

      <Modal open={creating} setOpen={setCreating}>
        <PageHeading title="Create Activity Goal" disableDivide={true} />
        <GoalForm
          groupId={groupId}
          games={games}
          departments={departments as Department[]}
          gamesIsLoading={gamesIsLoading}
          departmentsLoading={departmentsLoading}
          isLoading={createMutation.isPending}
          submitLabel="Create Goal"
          onSubmit={(data) => {
            createMutation.mutateAsync({ groupId, ...data }).then(() => {
              context.workspaces.workspace.settings.activityGoals.getGoals.invalidate({ groupId });
              toast.success('Created activity goal successfully!');
              setCreating(false);
            }).catch((e) => { toast.error(e.message); });
          }}
        />
      </Modal>
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);


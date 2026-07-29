import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import Toggle from '~/components/forms/Toggle';
import Header from '~/components/NextGenStyles/Header';
import Line from '~/components/NextGenStyles/Line';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import classNames from '~/utils/classNames';
import MultiSelectDropdown from '~/components/forms/MultiSelectDropdown';
import RobloxUserSearch from '~/components/ui/RobloxUserSearch';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import Button from '~/components/forms/Button';
import Card from '~/components/ui/Card';
import Badge from '~/components/ui/Badge';
import { trpc } from '~/utils/trpc';
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { ReactElement } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { useRouter } from 'next/router';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import {
  CommandLineIcon,
  PlayIcon,
  PauseIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  UsersIcon,
  ShieldCheckIcon,
  Cog6ToothIcon,
  ServerIcon,
  ClockIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import TextLabel from '~/components/forms/TextLabel';
import InputLabel from '~/components/forms/InputLabel';
import CallDiscordSettings from '~/components/page_components/workspaces/settings/remote-admin/CallDiscordSettings';
const DEFAULT_AFK_IDLE_SECONDS = 45;

interface CommandDetailPanelProps {
  groupId: string;
  command: any; // Adjust based on your command type
}

function CommandDetailPanel({ groupId, command }: CommandDetailPanelProps) {
  const utils = trpc.useUtils();
  const updateCommandMutation = trpc.workspaces.workspace.settings.remoteAdmin.updateCommand.useMutation();
  const { data: departments } = trpc.workspaces.workspace.settings.departments.getDepartments.useQuery({ groupId });
  const { data: roles } = trpc.roblox.getRobloxGroupRoles.useQuery({ groupId });

  // Local states derived from the selected command
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [allowedDepartments, setAllowedDepartments] = useState<string[]>([]);
  const [allowedUsers, setAllowedUsers] = useState<string[]>([]);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  useEffect(() => {
    setAllowedRoles(command?.permissions?.usableByGroupRole || []);
    setAllowedDepartments(command?.permissions?.usableByDepartments || []);
    setAllowedUsers(command?.permissions?.usableByUsers || []);
    setEnabled(command?.enabled || false);
    setHasChanges(false);
  }, [command]);

  const handleSaveChanges = async () => {
    await toast.promise(
      updateCommandMutation.mutateAsync({
        commandId: command._id.toString(),
        groupId,
        enabled: enabled,
        'permissions.usableByGroupRole': allowedRoles,
        'permissions.usableByDepartments': allowedDepartments,
        'permissions.usableByUsers': allowedUsers,
      }),
      {
        loading: `Saving ${command.name}...`,
        success: `${command.name} saved successfully!`,
        error: (err: any) => `Failed to save ${command.name}: ${err.message}`,
      }
    );

    // Invalidate to fetch fresh data after update
    utils.workspaces.workspace.settings.remoteAdmin.getCommands.invalidate({ groupId });
    setHasChanges(false);
  };

  const handleAddUser = (userId: string) => {
    const updatedUsers = Array.from(new Set([...allowedUsers, userId]));
    setAllowedUsers(updatedUsers);
    setHasChanges(true);
  };

  const handleRemoveUser = (userId: string) => {
    const updatedUsers = allowedUsers.filter((id: string) => id !== userId);
    setAllowedUsers(updatedUsers);
    setHasChanges(true);
  };

  const handleDiscardChanges = () => {
    setAllowedRoles(command?.permissions?.usableByGroupRole || []);
    setAllowedDepartments(command?.permissions?.usableByDepartments || []);
    setAllowedUsers(command?.permissions?.usableByUsers || []);
    setEnabled(command?.enabled || false);
    setHasChanges(false);
  };

  const departmentChoices = (departments || []).map((dept) => ({
    name: dept.name,
    id: dept._id.toString(),
  }));

  const roleChoices = (roles || [])
    .filter((r) => r.rank !== 0)
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({
      name: r.name,
      id: r.rank.toString(),
    }));

  return (
    <div className="space-y-6">
      {/* Command Header Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-l-4 border-blue-500">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <CommandLineIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {command.name}
              <Badge color={command.enabled ? 'green' : 'red'}>
                {command.enabled ? (
                  <>
                    <CheckCircleIcon className="h-3 w-3" />
                    Enabled
                  </>
                ) : (
                  <>
                    <XCircleIcon className="h-3 w-3" />
                    Disabled
                  </>
                )}
              </Badge>
            </h3>
            <p className="text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <ServerIcon className="h-4 w-4" />
              Game: {command?.game?.name || 'Unknown Game'}
            </p>
          </div>
        </div>

        {/* Parameters Section */}
        {command.paramaters && command.paramaters.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Cog6ToothIcon className="h-4 w-4" />
              Command Parameters
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {command.paramaters.map((param: any, index: number) => (<div key={`${param.id}-${index}`} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{param.id}</span>
                <Badge color="light">
                  {param.paramaterType}
                </Badge>
              </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Toggle Card */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${command.enabled ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
              {command.enabled ? (
                <PlayIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <PauseIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Command Status</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {command.enabled ? 'Command is currently active and available for use' : 'Command is disabled and unavailable'}
              </p>
            </div>
          </div>
          <Toggle
            title=""
            description=""
            value={enabled}
            onChange={(newEnabled) => {
              setEnabled(newEnabled);
              setHasChanges(true);
            }}
          />
        </div>
      </Card>

      {/* Permissions Management */}
      <Card className="overflow-visible">
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheckIcon className="h-5 w-5" />
            Permissions Management
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure who can execute this command in your game
          </p>
        </div>

        <TabGroup>
          <TabList className="flex space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
            {[
              { name: 'Roles', icon: UsersIcon },
              { name: 'Departments', icon: InformationCircleIcon },
              { name: 'Users', icon: UsersIcon }
            ].map((category) => (
              <Tab
                key={`${command._id}-${category.name}`}
                className={({ selected }) =>
                  classNames(
                    'w-full py-2.5 text-sm font-medium leading-5 rounded-lg flex items-center justify-center gap-2 transition-all',
                    selected
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600',
                  )
                }
              >
                <category.icon className="h-4 w-4" />
                {category.name}
              </Tab>
            ))}
          </TabList>

          <TabPanels className="mt-6 overflow-visible">
            {/* Roles Tab */}
            <TabPanel className="space-y-4 overflow-visible">
              <div className="flex items-center gap-2 mb-4">
                <UsersIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <h5 className="font-medium text-gray-900 dark:text-white">Group Roles</h5>
                <Badge color="blue">{allowedRoles.length} selected</Badge>
              </div>
              <MultiSelectDropdown
                label="Select allowed roles"
                placeholder={allowedRoles.length === 0 ? "Click to select roles..." : ""}
                key={`${command._id}-roles`}
                choices={roleChoices}
                value={allowedRoles}
                onSelectChoice={(selected: string[]) => {
                  setAllowedRoles(selected);
                  setHasChanges(true);
                }}
              />
              {allowedRoles.length === 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <InformationCircleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      No roles selected. This command won't be available to any group roles.
                    </p>
                  </div>
                </div>
              )}
            </TabPanel>

            {/* Departments Tab */}
            <TabPanel className="space-y-4 overflow-visible">
              <div className="flex items-center gap-2 mb-4">
                <InformationCircleIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <h5 className="font-medium text-gray-900 dark:text-white">Departments</h5>
                <Badge color="blue">{allowedDepartments.length} selected</Badge>
              </div>
              <MultiSelectDropdown
                label="Select allowed departments"
                placeholder={allowedDepartments.length === 0 ? "Click to select departments..." : ""}
                choices={departmentChoices}
                value={allowedDepartments}
                onSelectChoice={(selected: string[]) => {
                  setAllowedDepartments(selected);
                  setHasChanges(true);
                }}
              />
              {allowedDepartments.length === 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <InformationCircleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      No departments selected. This command won't be available to any departments.
                    </p>
                  </div>
                </div>
              )}
            </TabPanel>

            {/* Users Tab */}
            <TabPanel className="space-y-4 overflow-visible">
              <div className="flex items-center gap-2 mb-4">
                <UsersIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <h5 className="font-medium text-gray-900 dark:text-white">Individual Users</h5>
                <Badge color="blue">{allowedUsers.length} users</Badge>
              </div>

              {/* Add User Section */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <MagnifyingGlassIcon className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Add New User</span>
                </div>
                <RobloxUserSearch
                  size="small"
                  color="blue"
                  groupId={groupId}
                  onSelectUser={(userId) => handleAddUser(userId)}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Search and add users by their Roblox username
                </p>
              </div>

              {/* Users List */}
              {allowedUsers.length > 0 ? (
                <div className="space-y-2">
                  <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300">Allowed Users</h6>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {allowedUsers.map((userId: string) => (
                      <div
                        key={`${command._id}-${userId}`}
                        className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                            <UsersIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <TextReturnForUserId userId={userId} includeImage={true} />
                        </div>
                        <Button
                          variant="light_danger"
                          size="small"
                          onClick={() => handleRemoveUser(userId)}
                          className="hover:scale-105 transition-transform"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <UsersIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No users added yet</p>
                  <p className="text-xs">Use the search above to add users</p>
                </div>
              )}
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </Card>

      {/* Save Changes Bar */}
      {hasChanges && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 sticky bottom-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                You have unsaved changes
              </span>
            </div>
            <div className="flex gap-3">
              <Button
                variant="blue"
                onClick={handleDiscardChanges}
                disabled={updateCommandMutation.isPending}
              >
                Discard Changes
              </Button>
              <Button
                variant="blue"
                onClick={handleSaveChanges}
                disabled={updateCommandMutation.isPending}
              >
                {updateCommandMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: commands } = trpc.workspaces.workspace.settings.remoteAdmin.getCommands.useQuery({ groupId });
  const toggleModerationMutation = trpc.workspaces.workspace.settings.remoteAdmin.toggleEnableModerationDashboard.useMutation();
  const updateAfkSettingsMutation = trpc.workspaces.workspace.settings.remoteAdmin.updateAfkReportingSettings.useMutation();
  const utils = trpc.useUtils();

  const isAdmin = workspace?.department?.permissions?.admin || false;

  // Local form state for AFK / idle-tracking settings.
  const [afkAltTabActive, setAfkAltTabActive] = useState<boolean>(
    workspace?.afkReportingSettings?.altTab?.active ?? true,
  );
  const [afkAltTabIdle, setAfkAltTabIdle] = useState<number>(
    workspace?.afkReportingSettings?.altTab?.timeUntilIdle ?? DEFAULT_AFK_IDLE_SECONDS,
  );
  const [afkMovementActive, setAfkMovementActive] = useState<boolean>(
    workspace?.afkReportingSettings?.movement?.active ?? true,
  );
  const [afkMovementIdle, setAfkMovementIdle] = useState<number>(
    workspace?.afkReportingSettings?.movement?.timeUntilIdle ?? DEFAULT_AFK_IDLE_SECONDS,
  );

  if (!user || !workspace || !commands) {
    return <LoadingPage />;
  }
  const handleToggleModerationDashboard = async (enable: boolean) => {
    await toast.promise(
      toggleModerationMutation.mutateAsync({ groupId, enable }),
      {
        loading: enable ? 'Enabling Moderation Dashboard...' : 'Disabling Moderation Dashboard...',
        success: `Moderation Dashboard ${enable ? 'enabled' : 'disabled'}!`,
        error: (err: any) => `Failed to toggle Moderation Dashboard: ${err.message}`,
      }
    );
    utils.workspaces.workspace.settings.remoteAdmin.getCommands.invalidate({ groupId });
  };

  const handleSaveAfkSettings = async () => {
    await toast.promise(
      updateAfkSettingsMutation.mutateAsync({
        groupId,
        altTab: { active: afkAltTabActive, timeUntilIdle: afkAltTabIdle },
        movement: { active: afkMovementActive, timeUntilIdle: afkMovementIdle },
      }),
      {
        loading: 'Saving AFK settings...',
        success: 'AFK settings saved!',
        error: (err: any) => `Failed to save AFK settings: ${err.message}`,
      }
    );
  };


  // Filter commands based on search query
  const filteredCommands = commands.filter((command) =>
    command.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate overview metrics
  const enabledCommands = commands.filter((cmd) => cmd.enabled).length;
  const totalCommands = commands.length;
  const disabledCommands = totalCommands - enabledCommands;

  const selectedCommand = selectedCommandId
    ? commands.find((c) => c._id.toString() === selectedCommandId)
    : null;
  return (
    <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">
      <PageHeading title={`${workspace?.groupName} Remote Admin`} />
      <div className="space-y-6">
        {/* Moderation Dashboard Toggle */}
        <Card className="border-l-4 border-blue-500">
          <Toggle
            title="Enable Calls"
            description="Calls allow you to remotely chat with users in-game from the website or your Discord server."
            value={workspace.enableModerationDashboard || false}
            onChange={(enabled) => handleToggleModerationDashboard(enabled)}
          />
        </Card>

        {/* Discord Call Channels (admins only) */}
        {isAdmin && <CallDiscordSettings groupId={groupId} />}

        {/* AFK / Idle Tracking Settings (admins only) */}
        {isAdmin && (
          <Card className="border-l-4 border-indigo-500">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                <ClockIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <Header fontSize="lg">AFK Detection</Header>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Control how players are detected as AFK in-game. These settings are delivered to the tracker when a server starts.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Movement-based idle */}
              <div className="space-y-3">
                <Toggle
                  title="Movement &amp; Input Detection"
                  description="Mark players as AFK when there is no movement or input activity."
                  value={afkMovementActive}
                  onChange={setAfkMovementActive}
                />
                {afkMovementActive && (
                  <InputLabel
                    label="Seconds until idle (movement)"
                    type="number"
                    id="afk-movement-idle"
                    required={false}
                    defaultValue={String(afkMovementIdle)}
                    onBlur={(v) => setAfkMovementIdle(Math.max(0, parseInt(v, 10) || 0))}
                  />
                )}
              </div>

              <Line />

              {/* Alt-tab / window focus idle */}
              <div className="space-y-3">
                <Toggle
                  title="Alt-Tab &amp; Window Focus Detection"
                  description="Mark players as AFK when they tab out or the game window loses focus."
                  value={afkAltTabActive}
                  onChange={setAfkAltTabActive}
                />
                {afkAltTabActive && (
                  <InputLabel
                    label="Seconds until idle (alt-tab)"
                    type="number"
                    id="afk-alttab-idle"
                    required={false}
                    defaultValue={String(afkAltTabIdle)}
                    onBlur={(v) => setAfkAltTabIdle(Math.max(0, parseInt(v, 10) || 0))}
                  />
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  variant="blue"
                  onClick={handleSaveAfkSettings}
                  disabled={updateAfkSettingsMutation.isPending}
                >
                  {updateAfkSettingsMutation.isPending ? 'Saving...' : 'Save AFK Settings'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <CommandLineIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Commands</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalCommands}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Enabled</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">{enabledCommands}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">Disabled</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100">{disabledCommands}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Commands Sidebar */}
          <div className="w-full lg:w-1/3 xl:w-1/4">
            <Card className="h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CommandLineIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Commands</h3>
                </div>
                <Badge color="blue">{filteredCommands.length}</Badge>
              </div>

              {/* Search Box */}
              <div className="relative mb-4">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search commands..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Commands List */}
              <div className="space-y-2 overflow-y-auto overflow-x-hidden">
                {filteredCommands.length > 0 ? (
                  filteredCommands.map((command) => (
                    <div key={`${command._id}`} className="relative">
                      <button
                        className={`w-full text-left p-3 rounded-lg border transition-all hover:scale-[1.02] ${selectedCommandId === command._id.toString()
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 shadow-sm'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                        onClick={() => setSelectedCommandId(command._id.toString())}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded ${command.enabled
                              ? 'bg-green-100 dark:bg-green-900/50'
                              : 'bg-red-100 dark:bg-red-900/50'
                              }`}>
                              {command.enabled ? (
                                <CheckCircleIcon className="h-3 w-3 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircleIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{command.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {command.paramaters?.length || 0} parameters
                              </p>
                            </div>
                          </div>                          <Badge
                            color={command.enabled ? 'green' : 'red'}
                          >
                            {command.enabled ? 'On' : 'Off'}
                          </Badge>
                        </div>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <MagnifyingGlassIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No commands found</p>
                    <p className="text-xs">Try adjusting your search</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Command Details Panel */}
          <div className="flex-1">
            <Card className="h-full">
              {selectedCommand ? (
                <CommandDetailPanel
                  groupId={groupId}
                  command={selectedCommand}
                />
              ) : (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                  <CommandLineIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-medium mb-2">Select a Command</h3>
                  <p className="text-sm">
                    Choose a command from the list to view and configure its settings.
                  </p>
                  {totalCommands === 0 && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                      <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        No commands available. Commands will appear here once they're created in your game.
                      </p>
                    </div>
                  )}                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}


DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
)

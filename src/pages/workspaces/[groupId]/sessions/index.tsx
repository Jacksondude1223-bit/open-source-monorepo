"use client";

import { useRouter } from 'next/router';
import { ReactElement, useEffect, useRef, useState } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceSessionsSidebarNavigationLayout from '~/components/page_components/workspaces/sessions/WorkspaceSessionsSidebarNavigationLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import {
  getWeekDatesStartingSaturday,
  formatFullDateInTimezone,
  formatTimeInTimezone,
} from '~/utils/DateUtils';
import Button from '~/components/forms/Button';
import { PlusIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import Modal from '~/components/ui/Modal';
import TextLabel from '~/components/forms/TextLabel';
import Dropdown from '~/components/forms/Dropdown';
import Toggle from '~/components/forms/Toggle';
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/20/solid';
import Badge from '~/components/ui/Badge';
import NoSSR, { NoSsr } from '~/components/NoSSR';
import Header from '~/components/NextGenStyles/Header';
import Headshot from '~/components/NextGenStyles/Headshot';
import Card from '~/components/ui/Card';
import { CalendarIcon, ClockIcon, UsersIcon, MapPinIcon } from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();

  const [viewingDay, setViewingDay] = useState(() => new Date());
  const [isLoading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Form state that persists across re-renders
  const [formState, setFormState] = useState<{
    name: string;
    description: string;
    time: string;
    game: string;
    appearsMinutesBefore: string;
    sessionDuration: string;
    createDiscordEvent: boolean;
    roleSelections: Record<string, boolean>;
  }>(() => {
    if (typeof window === 'undefined') return {
      name: '', description: '', time: '', game: '', appearsMinutesBefore: '',
      sessionDuration: '', createDiscordEvent: false, roleSelections: {}
    };
    try {
      const saved = sessionStorage.getItem(`session-modal-form-${groupId}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load form state:', e);
    }
    return {
      name: '', description: '', time: '', game: '', appearsMinutesBefore: '',
      sessionDuration: '', createDiscordEvent: false, roleSelections: {}
    };
  });
  
  // Persist modal state across tab switches using sessionStorage
  const [creatingOneOffSessions, setCreatingOneOffSession] = useState<false | Date>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = sessionStorage.getItem(`session-modal-${groupId}`);
      if (saved) {
        const date = new Date(saved);
        return isNaN(date.getTime()) ? false : date;
      }
    } catch (e) {
      console.error('Failed to restore modal state:', e);
    }
    return false;
  });
  
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const week = getWeekDatesStartingSaturday(viewingDay);

  // Persist modal state when it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (creatingOneOffSessions !== false) {
        sessionStorage.setItem(`session-modal-${groupId}`, creatingOneOffSessions.toISOString());
      } else {
        sessionStorage.removeItem(`session-modal-${groupId}`);
        sessionStorage.removeItem(`session-modal-form-${groupId}`);
        // Reset form state when modal closes
        setFormState({
          name: '', description: '', time: '', game: '', appearsMinutesBefore: '',
          sessionDuration: '', createDiscordEvent: false, roleSelections: {}
        });
      }
    } catch (e) {
      console.error('Failed to save modal state:', e);
    }
  }, [creatingOneOffSessions, groupId]);

  // Persist form state to sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (creatingOneOffSessions !== false) {
      try {
        sessionStorage.setItem(`session-modal-form-${groupId}`, JSON.stringify(formState));
      } catch (e) {
        console.error('Failed to save form state:', e);
      }
    }
  }, [formState, groupId, creatingOneOffSessions]);

  const context = trpc.useUtils();
  const { data: templates } = trpc.workspaces.workspace.sessions.v2.getTemplates.useQuery({ groupId }, {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const { data: schedule } = trpc.workspaces.workspace.sessions.v2.getScheduleForDate.useQuery({
    groupId,
    date: viewingDay,
    tz: userTimezone
  }, {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const { data: games } = trpc.workspaces.workspace.games.getGames.useQuery({
    groupId,
  }, {
    refetchOnWindowFocus: false
  });
  const { data: roles } = trpc.workspaces.workspace.sessions.roles.getRoles.useQuery({ groupId }, {
    refetchOnWindowFocus: false
  });
  const createMutation = trpc.workspaces.workspace.sessions.v2.createOneOffSession.useMutation();
  const viewSessionByIdMutation = trpc.workspaces.workspace.sessions.v2.getExistingSessionOrCreate.useMutation();

  const permissions = workspace.department.permissions.sessions;

  if (!permissions.view) {
    return (
      <>
        <PageHeading
          title={`${workspace?.groupName} Sessions`}
          disableDivide={true}
        />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">You don&apos;t have permission to view other sessions</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            If you believe this is a mistake, contact one of your group admins.
          </p>
        </div>
      </>
    );
  }

  if (!templates || isLoading) {
    return (
      <>
        <PageHeading
          title={`${workspace?.groupName} Sessions`}
          disableDivide={true}
        />
        <LoadingPage />
      </>
    );
  }

  if (typeof (new Date().toLocaleString) !== 'function' || typeof (new Date().toLocaleTimeString) !== 'function') {
    return (
      <>
        <PageHeading
          title={`${workspace?.groupName} Sessions`}
          disableDivide={true}
        />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Your browser does not support this feature</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            This feature requires a browser that supports the Intl.DateTimeFormat API.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeading
        title={permissions?.manage ? `${workspace?.groupName} Sessions` : undefined}
        disableDivide={true}
      />

      <main>        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {new Date().setHours(0, 0, 0, 0) == viewingDay.setHours(0, 0, 0, 0) ? "Today's" : viewingDay.toLocaleDateString()} Sessions
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              {//@ts-expect-error this is ok
                new Date(week[0]).toLocaleString('en-us', { month: 'long', day: 'numeric' })} - {new Date(week[week.length - 1]).toLocaleString('en-us', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Week Navigation */}
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-1">
              <Button
                onClick={() => {
                  //@ts-expect-error this is ok
                  setViewingDay(new Date(week[0].getTime() - 1000 * 60 * 60 * 24))
                }}
                variant="pagination"
                size="small"
                icon={ArrowLeftIcon}
                className="px-3"
              >
                Previous
              </Button>

              <div className="flex gap-1">
                {week.map(day => (
                  <Button
                    key={day.getTime()}
                    variant={viewingDay.toLocaleDateString() == day.toLocaleDateString() ? 'primary' : 'pagination'}
                    size="small"
                    onClick={() => setViewingDay(day)}
                    className="min-w-10"
                  >
                    {day.toLocaleDateString('en-us', { day: 'numeric' })}
                  </Button>
                ))}
              </div>

              <Button
                onClick={() => {
                  //@ts-expect-error this is ok
                  setViewingDay(new Date(week[week.length - 1].getTime() + 1000 * 60 * 60 * 24))
                }}
                variant="pagination"
                size="small"
                icon={ArrowRightIcon}
                className="px-3"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div><NoSSR>
          <div className="grid gap-6 mt-6">
            {!schedule && (
              <div className="flex justify-center py-12">
                <LoadingAnimation />
              </div>
            )}
            {((schedule || []).length == 0 && schedule !== undefined) && (
              <div className="text-center py-12">
                <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">No scheduled sessions</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating a new session for this day.</p>
              </div>
            )}
            {(schedule || []).sort((a, b) => { return new Date(a.date).getTime() - new Date(b.date).getTime() }).map(session => (
              <Card key={session?._id?.toString() || ''} className="hover:shadow-lg transition-shadow duration-200">
                <div className="space-y-6">
                  {/* Header Section */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Header className="text-xl">
                          {session.template.name}
                        </Header>
                        <Badge
                          color={
                            (session?._id || '' as string) === 'notCreated'
                              ? 'yellow'
                              : new Date() < new Date(session?.date)
                                ? 'blue'
                                : new Date() > new Date(session?.endsAt)
                                  ? 'light'
                                  : 'green'
                          }
                        >
                          {(session?._id || '' as string) === 'notCreated'
                            ? 'Not Created'
                            : new Date() < new Date(session?.date)
                              ? 'Upcoming'
                              : new Date() > new Date(session?.endsAt)
                                ? 'Ended'
                                : 'Active'
                          }
                        </Badge>
                      </div>
                      <NoSsr>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <CalendarIcon className="h-4 w-4" />
                          <span>
                            {session?.date && formatFullDateInTimezone(session.date, userTimezone)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <ClockIcon className="h-4 w-4" />
                          <span>
                            {session?.date && formatTimeInTimezone(session.date, userTimezone)} - {session?.endsAt && formatTimeInTimezone(session.endsAt, userTimezone)}
                          </span>
                        </div>
                      </NoSsr>
                    </div>

                    <Button
                      variant="primary"
                      size="medium"
                      onClick={() => {
                        if (isLoading) { return; }
                        setLoading(true);

                        if ((session as any)?._id !== 'notCreated') {
                          router.push(
                            `/workspaces/${groupId}/sessions/session/${session?._id?.toString() || ''}`,
                          );
                        } else {
                          viewSessionByIdMutation
                            .mutateAsync({
                              groupId,
                              sessionId: (session?.template?._id?.toString() || '' as string),
                              startsAt: session.date,
                            })
                            .then((data) => {
                              router.push(
                                `/workspaces/${groupId}/sessions/session/${data._id.toString()}`,
                              );
                            })
                            .catch((e) => {
                              toast.error(e);
                              setLoading(false);
                            });
                        }
                      }}
                      icon={ArrowRightIcon}
                      className="whitespace-nowrap"
                    >
                      {(session?._id || '' as string) == 'notCreated' ? "Create" : "View"} Session
                    </Button>
                  </div>

                  {/* Description Section */}
                  {session.template.description && (
                    <div className="space-y-2">
                      <Header className="text-sm text-gray-700 dark:text-gray-300">Description</Header>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {session.template.description}
                      </p>
                    </div>
                  )}

                  {/* Game Location Section */}
                  <div className="space-y-3">
                    <Header className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <MapPinIcon className="h-4 w-4" />
                      Game Location
                    </Header>
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className="h-12 w-12 rounded-lg border dark:border-gray-600 shadow-sm"
                          src={session?.game?.images?.icon}
                          alt="Game icon"
                        />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {session?.game?.name}
                          </p>
                          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                            <span>{Object.keys(session?.servers || {}).length} server{Object.keys(session?.servers || {}).length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="discrete"
                        size="small"
                        href={`https://roblox.com/games/${session?.game?.placeId}/game`}
                        target="_blank"
                      >
                        Visit Game
                      </Button>
                    </div>
                  </div>

                  {/* Participants Section */}
                  <div className="space-y-3">
                    <Header className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <UsersIcon className="h-4 w-4" />
                      Participants ({session?.claims?.length || 0})
                    </Header>
                    {(session?.claims?.length == 0 || !session?.claims) ? (
                      <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <UsersIcon className="mx-auto h-8 w-8 text-gray-400" />
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No users have claimed this session yet</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {session?.claims?.map(claim => (
                          <div key={`${session.id}-${claim}`} className="relative">
                            <Headshot src={claim} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </NoSSR>        {(workspace.department.permissions.admin || workspace.department.permissions.sessions.manage || workspace.department.permissions.sessions.createOneTime) && (
          <div className="mt-8">
            <Card className={`bg-linear-to-r from-${workspace.brandColor}-50 to-${workspace.brandColor}-50 dark:from-${workspace.brandColor}-900/20 dark:to-${workspace.brandColor}-900/20 border-${workspace.brandColor}-200 dark:border-${workspace.brandColor}-700`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h3 className={`text-lg font-semibold text-${workspace.brandColor}-900 dark:text-blue-100`}>Create One-Time Session</h3>
                  <p className={`text-sm text-${workspace.brandColor}-700 dark:text-${workspace.brandColor}-300`}>
                    Schedule a custom session for {viewingDay.toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="medium"
                  onClick={() => {
                    setCreatingOneOffSession(viewingDay);
                  }}
                  icon={PlusIcon}
                  className="sm:self-start"
                >
                  Create Session
                </Button>
              </div>
            </Card>
          </div>
        )}
      </main>



      <Modal open={creatingOneOffSessions !== false} setOpen={setCreatingOneOffSession}>
        {creatingOneOffSessions !== false && (
          <form 
            ref={formRef}
            className="flex flex-col gap-4" 
            onSubmit={(f) => {
            f.preventDefault();
            if (!roles || !games) {
              return;
            }
            
            const rolesEnabled = Object.keys(formState.roleSelections).filter(roleId => formState.roleSelections[roleId]);

            if (rolesEnabled.length == 0) {
              return alert(
                'You must select at-least one template role to create a new session template',
              );
            }
            if (!formState.game) {
              return alert('You must link a game to this new template');
            }
            const [hours, minutes] = formState.time.split(':');
            // Create a new date object in the local timezone
            const dateObj = new Date(creatingOneOffSessions);

            // Set the hours and minutes of the date object
            dateObj.setHours(parseInt(hours || '0', 10));
            dateObj.setMinutes(parseInt(minutes || '0', 10));
            dateObj.setSeconds(0);
            dateObj.setMilliseconds(0);
            createMutation
              .mutateAsync({
                groupId,
                name: formState.name,
                description: formState.description,
                game: formState.game,
                appearsMinutesBefore: formState.appearsMinutesBefore,
                rolesEnabled,
                sessionDuration: formState.sessionDuration,
                createDiscordEvent: formState.createDiscordEvent,
                date: dateObj
              })
              .then(() => {
                context.workspaces.workspace.sessions.v2.getScheduleForDate.invalidate({
                  groupId,
                  date: viewingDay,
                  tz: userTimezone
                });
                toast.success('Successfully created session')
                setCreatingOneOffSession(false);
              })
              .catch((e) => {
                alert(`Something went wrong while creating a one-time-session ${e.message}`);
              });
          }}>
            <PageHeading title={`Create session on ${formatFullDateInTimezone(creatingOneOffSessions, userTimezone)}`} description="This is a one time session, this means it will only occur once." />

            <TextLabel 
              label="Name" 
              id="name" 
              placeholder="Type a name here"
              value={formState.name}
              onChange={(val) => setFormState(prev => ({ ...prev, name: val }))}
            />
            <TextLabel
              label="Description"
              id="description"
              placeholder="Type a description here (this will optionally show on Discord)"
              value={formState.description}
              onChange={(val) => setFormState(prev => ({ ...prev, description: val }))}
            />
            <div>
              <p className="block text-sm font-medium text-gray-700">Roles</p>
              <div>
                {roles && (<>
                  {roles.map((role) => (
                    <Toggle
                      key={role._id.toString()}
                      title={role.name}
                      description={''}
                      id={role.id}
                      value={formState.roleSelections?.[role.id] ?? false}
                      onChange={(checked) => setFormState(prev => ({
                        ...prev,
                        roleSelections: { ...prev.roleSelections, [role.id]: checked }
                      }))}
                    />
                  ))}
                </>)}
              </div>
            </div>

            <TextLabel 
              id="time" 
              label="Time" 
              type="time"
              value={formState.time}
              onChange={(val) => setFormState(prev => ({ ...prev, time: val }))}
            />
            <p className="text-sm font-light -mt-1.5">
              This time is in your local timezone
            </p>

            {games && (
              <Dropdown
                key={`game-dropdown-${formState.game}`}
                label="Game"
                id="game"
                defaultValue={formState.game}
                onChange={(selectedId) => setFormState(prev => ({ ...prev, game: selectedId }))}
                choices={games.map((game) => ({
                  name: game?.placeInfo?.sourceName ? `${game.name} - ${game?.placeInfo?.sourceName}` : game?.name || game?.name,
                  id: game.gameId.toString(),
                }))}
              />
            )}

            <TextLabel
              label="Time before session to notify"
              id="appearsMinutesBefore"
              type="number"
              placeholder="0"
              value={formState.appearsMinutesBefore}
              onChange={(val) => setFormState(prev => ({ ...prev, appearsMinutesBefore: val }))}
            />

            <TextLabel
              label="Estimated session duration (minutes)"
              id="sessionDuration"
              type="number"
              placeholder="0"
              min="0"
              value={formState.sessionDuration}
              onChange={(val) => setFormState(prev => ({ ...prev, sessionDuration: val }))}
            />

            <Toggle 
              id="createDiscordEvent" 
              title="Create Discord Event for Session" 
              description='Will create a Discord event for this session when it is claimed'
              value={formState.createDiscordEvent}
              onChange={(checked) => setFormState(prev => ({ ...prev, createDiscordEvent: checked }))}
            />

            <Button variant="primary" size="medium" className="w-full">
              Create
            </Button>

          </form>
        )}
      </Modal>
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceSessionsSidebarNavigationLayout>{page}</WorkspaceSessionsSidebarNavigationLayout>
);

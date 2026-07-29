/* eslint-disable @next/next/no-img-element */
import { ReactElement, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import Card from '~/components/ui/Card';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import TextLabel from '~/components/forms/TextLabel';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';

export default function TimeclockSettingsPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const context = trpc.useUtils();

  const { data: settings, isPending } = trpc.workspaces.workspace.settings.timeclock.getSettings.useQuery(
    { groupId },
    { enabled: !!groupId },
  );
  const updateMutation = trpc.workspaces.workspace.settings.timeclock.updateSettings.useMutation();

  const [enabled, setEnabled] = useState(false);
  const [allowManualEntries, setAllowManualEntries] = useState(true);
  const [autoClockOutOverMax, setAutoClockOutOverMax] = useState(false);
  const [maxShiftHours, setMaxShiftHours] = useState('12');
  const [enabledDepartments, setEnabledDepartments] = useState<string[]>([]);
  const [restrictDepartments, setRestrictDepartments] = useState(false);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setAllowManualEntries(settings.allowManualEntries);
      setAutoClockOutOverMax(settings.autoClockOutOverMax);
      setMaxShiftHours(String(settings.maxShiftHours));
      const depts = settings.enabledDepartments ?? [];
      setEnabledDepartments(depts);
      setRestrictDepartments(depts.length > 0);
    }
  }, [settings]);

  const toggleDepartment = (id: string) => {
    setEnabledDepartments((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  if (!workspace) return <LoadingPage />;

  if (!workspace.department.permissions.admin) {
    return (
      <>
        <PageHeading title="Timeclock" disableDivide />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Admins only</p>
          <Small>You must be a workspace admin to manage timeclock settings.</Small>
        </div>
      </>
    );
  }

  if (isPending) return <LoadingPage />;

  const save = () => {
    const hours = Number(maxShiftHours);
    if (!Number.isFinite(hours) || hours < 1 || hours > 48) {
      toast.error('Max shift hours must be between 1 and 48.');
      return;
    }
    if (enabled && restrictDepartments && enabledDepartments.length === 0) {
      toast.error('Select at least one department, or turn off the department limit.');
      return;
    }
    toast.promise(
      updateMutation.mutateAsync({
        groupId,
        enabled,
        // When the restriction toggle is off we persist an empty list, meaning
        // "every department". When on, we save the explicit selection.
        enabledDepartments: restrictDepartments ? enabledDepartments : [],
        allowManualEntries,
        maxShiftHours: hours,
        autoClockOutOverMax,
      }),
      { loading: 'Saving…', success: 'Timeclock settings saved.', error: (err) => err?.message || 'Failed to save.' },
    ).then(() => {
      context.workspaces.workspace.getWorkspace.invalidate({ groupId });
      context.workspaces.workspace.settings.timeclock.getSettings.invalidate({ groupId });
    });
  };

  return (
    <>
      <PageHeading title={`${workspace?.groupName} Timeclock`} description="Let staff clock in and out from the dashboard" />

      <div className="mt-4 flex flex-col gap-4">
        <Card>
          <Toggle
            id="enabled"
            title="Enable timeclock"
            description="Show the clock in / out widget on the dashboard and the manager timeclock page."
            value={enabled}
            onChange={setEnabled}
          />
        </Card>

        {enabled && (
          <Card className="flex flex-col gap-4">
            <Header fontSize="sm">Departments</Header>
            <Toggle
              id="restrictDepartments"
              title="Limit to specific departments"
              description="By default every department can clock in. Turn this on to choose which departments see the timeclock."
              value={restrictDepartments}
              onChange={setRestrictDepartments}
            />
            {restrictDepartments && (
              <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-gray-700/60">
                {(settings?.departments ?? []).length === 0 ? (
                  <Small>No departments found.</Small>
                ) : (
                  (settings?.departments ?? []).map((dept) => (
                    <label
                      key={dept._id}
                      className="flex flex-row items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-200"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={enabledDepartments.includes(dept._id)}
                        onChange={() => toggleDepartment(dept._id)}
                      />
                      <span>{dept.name}{dept.isOwner ? ' (Owner)' : ''}</span>
                    </label>
                  ))
                )}
                {restrictDepartments && enabledDepartments.length === 0 && (
                  <Small>Select at least one department, or turn this off to allow all.</Small>
                )}
              </div>
            )}
          </Card>
        )}

        <Card className="flex flex-col gap-4">
          <Header fontSize="sm">Behavior</Header>
          <Toggle
            id="allowManualEntries"
            title="Allow manual entries"
            description="Let managers add or backfill time entries on a staff member's behalf."
            value={allowManualEntries}
            onChange={setAllowManualEntries}
          />
          <div className="border-t border-gray-100 dark:border-gray-700/60" />
          <div className="max-w-xs">
            <TextLabel
              label="Max shift hours"
              id="maxShiftHours"
              type="number"
              value={maxShiftHours}
              onChange={(e: any) => setMaxShiftHours(e.target.value)}
            />
            <Small>Shifts longer than this are flagged for review.</Small>
          </div>
          <div className="border-t border-gray-100 dark:border-gray-700/60" />
          <Toggle
            id="autoClockOutOverMax"
            title="Auto clock out over max"
            description="Automatically clock out a shift once it exceeds the max shift length, instead of only flagging it."
            value={autoClockOutOverMax}
            onChange={setAutoClockOutOverMax}
          />
        </Card>

        <div className="flex flex-row justify-end">
          <Button variant="primary" size="medium" onClick={save} disabled={updateMutation.isPending}>
            Save Settings
          </Button>
        </div>
      </div>
    </>
  );
}

TimeclockSettingsPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);

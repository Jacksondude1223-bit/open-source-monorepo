import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { ReactElement } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { useRouter } from 'next/router';
import Radio from '~/components/forms/Radio';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import Dropdown from '~/components/forms/Dropdown';
import { trpc } from '~/utils/trpc';
import toast from 'react-hot-toast';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import Header from '~/components/NextGenStyles/Header';
import Card from '~/components/ui/Card';

const DAYS_OF_WEEK = [
  { id: '0', name: 'Sunday' },
  { id: '1', name: 'Monday' },
  { id: '2', name: 'Tuesday' },
  { id: '3', name: 'Wednesday' },
  { id: '4', name: 'Thursday' },
  { id: '5', name: 'Friday' },
  { id: '6', name: 'Saturday' },
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
].map((tz) => ({ id: tz, name: tz.replace(/_/g, ' ') }));

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const updateMutation = trpc.workspaces.workspace.settings.distributions.update.useMutation();
  const newDistributionMutation = trpc.workspaces.workspace.settings.distributions.manualDistribution.useMutation();
  if (!user || !workspace) {
    return <LoadingPage />;
  }

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Distributions`}
        description="Organize and analyze user activity in structured time intervals"
      />

      <Card className="mt-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Distributions partition activity data into convenient intervals — weekly, bi-weekly, or monthly — providing a structured framework for tracking and analyzing your team&apos;s performance over time.
        </p>
      </Card>

      {workspace.distributionPeriod == 'manual' && (
        <Card className="mt-4 border-l-4 border-blue-500">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <Header>Distribute Manually</Header>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Start a new distribution period. You must wait at least a day after the last distribution.</p>
            </div>
            <Button variant="blue" className='h-min shrink-0' size="medium" onClick={() => {
              newDistributionMutation.mutateAsync({
                groupId,
              }).then(() => {
                toast.success('Successfully created new distribution')
              }).catch(e => {
                toast.error(e.message)
              })
            }}>Distribute Manually</Button>
          </div>
        </Card>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const target = e.target as any;
          const period = target.period.value;
          const discord = target.discord.checked;
          const day = parseInt(target.distributionDay.value);
          const timezone = target.distributionTimezone.value;
          updateMutation.mutateAsync({
            groupId,
            period,
            discord,
            day,
            timezone,
          }).then(() => {
            toast.success('Updated distribution settings')
          }).catch(e => {
            toast.error(e.message)
          })
        }}
        className="flex flex-col gap-4 mt-6"
      >
        <Radio
          className="mt-2"
          label="Automated Distribution Periods"
          options={[
            {
              id: 'manual',
              title: 'Manual',
              description: 'You can opt to make your own segments at any time.',
              subDescription: 'Human powered distributions!',
              lockedToPremium: false,
            },
            {
              id: 'weekly',
              title: 'Weekly',
              description:
                'Weekly distributions take place at midnight on your chosen day and timezone.',
              subDescription: 'Automatically done by ReAdmin!',
              lockedToPremium: true,
            },
            {
              id: 'biweekly',
              title: 'Biweekly',
              description:
                'Bi-weekly distributions take place at midnight on your chosen day and timezone.',
              subDescription: 'Automatically done by ReAdmin!',
              lockedToPremium: true,
            },
            {
              id: 'monthly',
              title: 'Monthly',
              description:
                'Monthly distributions take place at midnight on your chosen day and timezone.',
              subDescription: 'Automatically done by ReAdmin!',
              lockedToPremium: true,
            },
          ]}
          defaultValue={workspace.distributionPeriod}
          id="period"
        />

        <Card>
          <Header>Distribution Schedule</Header>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
            Choose the day of the week and timezone your automated distributions run. They occur at midnight (12 AM) of the selected day. This does not affect manual distributions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full">
              <Dropdown
                className="w-full"
                label="Day of week"
                id="distributionDay"
                choices={DAYS_OF_WEEK}
                defaultValue={(workspace.distributionDay ?? 0).toString()}
              />
            </div>
            <div className="w-full">
              <Dropdown
                className="w-full"
                label="Timezone"
                id="distributionTimezone"
                choices={TIMEZONES}
                defaultValue={workspace.distributionTimezone ?? 'America/New_York'}
              />
            </div>
          </div>
        </Card>

        <Card>
          <Toggle
            id="discord"
            value={workspace.distributionDMs}
            title="Enable Discord DMs at the end of a distribution"
            description="Notify users whether or not they met their goals at the end of a distribution. Premium only, works with automated distributions."
          />
        </Card>

        <Button variant={'primary'} className="w-full" type="submit">
          Save Settings
        </Button>
      </form>
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);

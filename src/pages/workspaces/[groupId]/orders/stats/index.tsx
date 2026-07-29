import { useRouter } from 'next/router';
import { ReactElement, useMemo, useState } from 'react';
import { BarChart, LineChart, PieChart } from '@mui/x-charts';
import { useWorkspace } from '~/components/contexts/workspace';
import OrdersLayout from '~/components/page_components/workspaces/orders/OrdersLayout';
import { ordersAccess } from '~/components/page_components/workspaces/orders/access';
import { OrdersGate, formatDuration } from '~/components/page_components/workspaces/orders/shared';
import PageHeading from '~/components/layouts/PageHeading';
import Card from '~/components/ui/Card';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import DataTable, { DataTableColumn } from '~/components/ui/DataTable';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import { trpc } from '~/utils/trpc';

type UserSummaryRow = {
  userId: string;
  created: number;
  claimed: number;
  completed: number;
  avgClaimToComplete: number;
};

const ACCENT = '#3B82F6';

export default function OrdersStatsPage() {
  const router = useRouter();
  const { groupId } = router.query as { groupId: string };
  const workspace = useWorkspace();
  const access = ordersAccess(workspace);
  const canQuery = !!groupId && access.moduleEnabled && access.view;

  const [gameId, setGameId] = useState('');

  const { data: posConfig } = trpc.workspaces.workspace.orders.pos.getConfig.useQuery(
    { groupId },
    { enabled: canQuery },
  );
  const games = posConfig?.games || [];
  const queueName = (id: string) => posConfig?.default?.queues?.find((q) => q.id === id)?.name || id;

  const { data: dashboard, isPending: dashLoading } = trpc.workspaces.workspace.orders.getDashboard.useQuery(
    { groupId, gameId: gameId || undefined },
    { enabled: canQuery },
  );

  const { data: userSummary, isPending: usersLoading } = trpc.workspaces.workspace.orders.getUserSummary.useQuery(
    { groupId, gameId: gameId || undefined },
    { enabled: canQuery },
  );

  const userColumns = useMemo<DataTableColumn<UserSummaryRow>[]>(
    () => [
      { key: 'user', header: 'Staff', cell: (r) => <TextReturnForUserId userId={r.userId} includeImage={true} /> },
      { key: 'created', header: 'Created', align: 'center', cell: (r) => r.created.toLocaleString() },
      { key: 'claimed', header: 'Claimed', align: 'center', cell: (r) => r.claimed.toLocaleString() },
      { key: 'completed', header: 'Completed', align: 'center', cell: (r) => r.completed.toLocaleString() },
      {
        key: 'avg',
        header: 'Avg claim → complete',
        align: 'right',
        cell: (r) => formatDuration(r.avgClaimToComplete),
      },
    ],
    [],
  );

  return (
    <OrdersGate
      moduleEnabled={access.moduleEnabled}
      allowed={access.view}
      groupId={groupId}
      canEnable={!!workspace?.department?.permissions?.admin}
    >
      <PageHeading title="Stats" description="Order volume, products and staff performance.">
        <select
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
        >
          <option value="">All games</option>
          {games.map((g) => (
            <option key={g.gameId} value={g.gameId}>
              {g.name}
            </option>
          ))}
        </select>
      </PageHeading>

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total orders', value: dashboard ? dashboard.total.toLocaleString() : null },
          { label: 'Cancelled', value: dashboard ? dashboard.cancelled.toLocaleString() : null },
          { label: 'Cancel rate', value: dashboard ? `${(dashboard.cancelRate * 100).toFixed(1)}%` : null },
          { label: 'Avg duration', value: dashboard ? formatDuration(dashboard.averageDuration) : null },
        ].map((stat) => (
          <Card key={stat.label} className="!py-3">
            {stat.value !== null ? (
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
            ) : (
              <div className="mb-1 h-7 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <Header>Orders over time</Header>
          {dashboard && dashboard.ordersOverTime.length > 0 ? (
            <div className="w-full" style={{ height: 300 }}>
              <LineChart
                xAxis={[{ scaleType: 'point', data: dashboard.ordersOverTime.map((d) => d.date) }]}
                series={[{ data: dashboard.ordersOverTime.map((d) => d.count), label: 'Orders', color: ACCENT, area: true }]}
                height={300}
              />
            </div>
          ) : (
            <EmptyChart loading={dashLoading} />
          )}
        </Card>

        <Card>
          <Header>Top products</Header>
          {dashboard && dashboard.topProducts.length > 0 ? (
            <div className="w-full" style={{ height: 300 }}>
              <BarChart
                xAxis={[{ scaleType: 'band', data: dashboard.topProducts.map((p) => p.name) }]}
                series={[{ data: dashboard.topProducts.map((p) => p.quantity), label: 'Quantity', color: '#10B981' }]}
                height={300}
              />
            </div>
          ) : (
            <EmptyChart loading={dashLoading} />
          )}
        </Card>

        <Card>
          <Header>Volume per queue</Header>
          {dashboard && dashboard.perQueueVolume.length > 0 ? (
            <div className="w-full" style={{ height: 300 }}>
              <PieChart
                series={[
                  {
                    data: dashboard.perQueueVolume.map((q, i) => ({
                      id: q.queueId || `queue-${i}`,
                      value: q.count,
                      label: queueName(q.queueId),
                    })),
                  },
                ]}
                height={300}
              />
            </div>
          ) : (
            <EmptyChart loading={dashLoading} />
          )}
        </Card>

        <Card>
          <Header>Cancel rate</Header>
          {dashboard ? (
            <div className="flex h-[300px] flex-col items-center justify-center">
              <p className="text-5xl font-bold text-gray-900 dark:text-gray-100">{(dashboard.cancelRate * 100).toFixed(1)}%</p>
              <Small className="mt-2">
                {dashboard.cancelled.toLocaleString()} cancelled of {dashboard.total.toLocaleString()} orders
              </Small>
            </div>
          ) : (
            <EmptyChart loading={dashLoading} />
          )}
        </Card>
      </div>

      {/* Staff summary */}
      <div className="mt-4">
        <Header className="mb-3">Staff performance</Header>
        <DataTable<UserSummaryRow>
          columns={userColumns}
          rows={userSummary}
          loading={usersLoading}
          rowKey={(r) => r.userId}
          emptyState="No staff activity for this period."
        />
      </div>
    </OrdersGate>
  );
}

function EmptyChart({ loading }: { loading: boolean }) {
  return (
    <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
      {loading ? 'Loading…' : 'No data for this period.'}
    </div>
  );
}

OrdersStatsPage.getLayout = (page: ReactElement) => <OrdersLayout disablePadding={false}>{page}</OrdersLayout>;

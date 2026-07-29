import { useRouter } from 'next/router';
import { ReactElement, useMemo, useState } from 'react';
import ReactTimeago from 'react-timeago';
import { useWorkspace } from '~/components/contexts/workspace';
import OrdersLayout from '~/components/page_components/workspaces/orders/OrdersLayout';
import { ordersAccess } from '~/components/page_components/workspaces/orders/access';
import {
  OrderStatusBadge,
  ORDER_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  OrdersGate,
  formatDuration,
  formatMoney,
} from '~/components/page_components/workspaces/orders/shared';
import PageHeading from '~/components/layouts/PageHeading';
import Card from '~/components/ui/Card';
import DataTable, { DataTableColumn } from '~/components/ui/DataTable';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import { trpc } from '~/utils/trpc';
import { Order, OrderSource, OrderStatus } from '~/services/NewMongoTypes';

const STATUS_OPTIONS: OrderStatus[] = [
  'submitted',
  'claimed',
  'released',
  'completed',
  'cancelled',
  'awaiting_customer',
  'handed_to_customer',
];
const SOURCE_OPTIONS: OrderSource[] = ['register', 'kiosk', 'drive_thru', 'api'];
const PAGE_SIZE = 15;

export default function OrdersListPage() {
  const router = useRouter();
  const { groupId } = router.query as { groupId: string };
  const workspace = useWorkspace();
  const access = ordersAccess(workspace);
  const canQuery = !!groupId && access.moduleEnabled && access.view;

  const [page, setPage] = useState(0);
  const [gameId, setGameId] = useState('');
  const [status, setStatus] = useState<'' | OrderStatus>('');
  const [source, setSource] = useState<'' | OrderSource>('');
  const [queueId, setQueueId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [nameSearch, setNameSearch] = useState('');

  const { data: posConfig } = trpc.workspaces.workspace.orders.pos.getConfig.useQuery(
    { groupId },
    { enabled: canQuery },
  );
  const currencySymbol = posConfig?.default?.pricing?.currencySymbol || '$';
  const games = posConfig?.games || [];
  const queues = posConfig?.default?.queues || [];

  const { data: counts } = trpc.workspaces.workspace.orders.getCounts.useQuery(
    { groupId, gameId: gameId || undefined },
    { enabled: canQuery },
  );

  const { data, isPending } = trpc.workspaces.workspace.orders.list.useQuery(
    {
      groupId,
      page,
      pageSize: PAGE_SIZE,
      gameId: gameId || undefined,
      status: status || undefined,
      source: source || undefined,
      queueId: queueId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      nameSearch: nameSearch || undefined,
    },
    { enabled: canQuery },
  );

  const queueName = (id: string) => queues.find((q) => q.id === id)?.name || id;

  const columns = useMemo<DataTableColumn<Order>[]>(
    () => [
      {
        key: 'orderNumber',
        header: 'Order #',
        align: 'left',
        cell: (o) => <span className="font-medium">#{o.orderNumber}</span>,
      },
      {
        key: 'customer',
        header: 'Customer',
        cell: (o) => <TextReturnForUserId userId={o.customerId} includeImage={true} />,
      },
      {
        key: 'status',
        header: 'Status',
        cell: (o) => <OrderStatusBadge status={o.status} />,
      },
      {
        key: 'source',
        header: 'Source',
        cell: (o) => <span className="text-gray-600 dark:text-gray-300">{ORDER_SOURCE_LABELS[o.source] || o.source}</span>,
      },
      {
        key: 'queue',
        header: 'Queue',
        cell: (o) => <span className="text-gray-600 dark:text-gray-300">{queueName(o.queueId)}</span>,
      },
      {
        key: 'items',
        header: 'Items',
        align: 'center',
        cell: (o) => o.items.reduce((sum, i) => sum + i.quantity, 0),
      },
      {
        key: 'total',
        header: 'Total',
        align: 'right',
        cell: (o) => formatMoney(o.total, currencySymbol),
      },
      {
        key: 'created',
        header: 'Created',
        align: 'right',
        cell: (o) => (
          <span className="text-gray-500 dark:text-gray-400">
            <ReactTimeago date={o.created} />
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currencySymbol, queues],
  );

  const resetPage = () => setPage(0);

  return (
    <OrdersGate
      moduleEnabled={access.moduleEnabled}
      allowed={access.view}
      groupId={groupId}
      canEnable={!!workspace?.department?.permissions?.admin}
    >
      <PageHeading title="Orders" description="Browse and manage point-of-sale orders." />

      {/* Stat cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: 'Total Orders', value: counts?.totalOrders },
          { label: 'In Progress', value: counts?.beganOrders },
          { label: 'Cancelled', value: counts?.cancelledOrders },
          { label: 'Finished', value: counts?.finishedOrders },
        ].map((stat) => (
          <Card key={stat.label} className="!py-3">
            {counts ? (
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{(stat.value ?? 0).toLocaleString()}</p>
            ) : (
              <div className="mb-1 h-7 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
          </Card>
        ))}
        <Card className="!py-3">
          {counts ? (
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatDuration(counts.averageDuration)}</p>
          ) : (
            <div className="mb-1 h-7 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Duration</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          type="text"
          value={nameSearch}
          onChange={(e) => {
            setNameSearch(e.target.value);
            resetPage();
          }}
          placeholder="Search by staff / customer name"
        />
        <select
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          value={gameId}
          onChange={(e) => {
            setGameId(e.target.value);
            resetPage();
          }}
        >
          <option value="">All games</option>
          {games.map((g) => (
            <option key={g.gameId} value={g.gameId}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | '');
            resetPage();
          }}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          value={source}
          onChange={(e) => {
            setSource(e.target.value as OrderSource | '');
            resetPage();
          }}
        >
          <option value="">All sources</option>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {ORDER_SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          value={queueId}
          onChange={(e) => {
            setQueueId(e.target.value);
            resetPage();
          }}
        >
          <option value="">All queues</option>
          {queues.map((q) => (
            <option key={q.id} value={q.id}>
              {q.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">From</label>
          <input
            type="date"
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              resetPage();
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">To</label>
          <input
            type="date"
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              resetPage();
            }}
          />
        </div>
      </div>

      {/* Orders table */}
      <div className="mt-4">
        <DataTable<Order>
          columns={columns}
          rows={data?.response}
          loading={isPending}
          rowKey={(o) => o._id!.toString()}
          onRowClick={(o) => router.push(`/workspaces/${groupId}/orders/${o._id!.toString()}`)}
          emptyState="No orders match these filters."
          pagination={{
            page: data?.pagination?.page ?? page,
            pageSize: data?.pagination?.pageSize ?? PAGE_SIZE,
            total: data?.pagination?.total ?? 0,
            totalPages: data?.pagination?.totalPages ?? 0,
            onPageChange: setPage,
          }}
        />
      </div>
    </OrdersGate>
  );
}

OrdersListPage.getLayout = (page: ReactElement) => <OrdersLayout disablePadding={false}>{page}</OrdersLayout>;

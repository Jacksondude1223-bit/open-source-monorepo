import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import ReactTimeago from 'react-timeago';
import toast from 'react-hot-toast';
import { useWorkspace } from '~/components/contexts/workspace';
import OrdersLayout from '~/components/page_components/workspaces/orders/OrdersLayout';
import { ordersAccess } from '~/components/page_components/workspaces/orders/access';
import {
  OrderStatusBadge,
  ORDER_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  OrdersGate,
  formatMoney,
} from '~/components/page_components/workspaces/orders/shared';
import PageHeading from '~/components/layouts/PageHeading';
import LoadingPage from '~/components/layouts/LoadingPage';
import Card from '~/components/ui/Card';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import Button from '~/components/forms/Button';
import { useConfirm } from '~/components/ui/ConfirmModal';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import { trpc } from '~/utils/trpc';

type TransitionAction = 'claim' | 'release' | 'complete' | 'cancel' | 'set_awaiting_pickup' | 'hand_to_customer';

const ACTION_LABELS: Record<TransitionAction, string> = {
  claim: 'Claim',
  release: 'Release',
  complete: 'Complete',
  cancel: 'Cancel order',
  set_awaiting_pickup: 'Mark awaiting pickup',
  hand_to_customer: 'Hand to customer',
};

// Which actions make sense from a given status (purely for surfacing buttons;
// the server still enforces the real status precondition).
const ACTIONS_BY_STATUS: Record<string, TransitionAction[]> = {
  submitted: ['claim', 'cancel'],
  claimed: ['complete', 'set_awaiting_pickup', 'release', 'cancel'],
  released: ['claim', 'cancel'],
  awaiting_customer: ['hand_to_customer', 'cancel'],
  completed: [],
  handed_to_customer: [],
  cancelled: [],
};

export default function OrderDetailPage() {
  const router = useRouter();
  const { groupId, orderId } = router.query as { groupId: string; orderId: string };
  const workspace = useWorkspace();
  const access = ordersAccess(workspace);
  const canQuery = !!groupId && !!orderId && access.moduleEnabled && access.view;
  const utils = trpc.useUtils();
  const [confirm, ConfirmDialog] = useConfirm();

  const { data: order, isPending } = trpc.workspaces.workspace.orders.getById.useQuery(
    { groupId, orderId },
    { enabled: canQuery },
  );

  const { data: posConfig } = trpc.workspaces.workspace.orders.pos.getConfig.useQuery(
    { groupId },
    { enabled: canQuery },
  );
  const currencySymbol = posConfig?.default?.pricing?.currencySymbol || '$';
  const queueName = (id: string) => posConfig?.default?.queues?.find((q) => q.id === id)?.name || id;

  const transition = trpc.workspaces.workspace.orders.transition.useMutation();

  const runTransition = (action: TransitionAction) => {
    const promise = transition
      .mutateAsync({ groupId, orderId, action })
      .then((outcome) => {
        // The op resolves even on a precondition failure — surface the error.
        if (outcome && 'success' in outcome && !outcome.success) {
          throw new Error(outcome.error?.message || 'Action could not be applied.');
        }
        utils.workspaces.workspace.orders.getById.invalidate({ groupId, orderId });
        utils.workspaces.workspace.orders.list.invalidate();
        utils.workspaces.workspace.orders.getCounts.invalidate({ groupId });
        return outcome;
      });

    toast.promise(promise, {
      loading: 'Applying action…',
      success: `${ACTION_LABELS[action]} applied`,
      error: (e) => e?.message || 'Failed to apply action.',
    });
  };

  const onAction = async (action: TransitionAction) => {
    if (action === 'cancel') {
      const ok = await confirm({
        title: 'Cancel this order?',
        body: 'This permanently cancels the order. This cannot be undone.',
        confirmText: 'Cancel order',
        destructive: true,
      });
      if (!ok) return;
    }
    runTransition(action);
  };

  return (
    <OrdersGate
      moduleEnabled={access.moduleEnabled}
      allowed={access.view}
      groupId={groupId}
      canEnable={!!workspace?.department?.permissions?.admin}
    >
      {ConfirmDialog}
      {isPending ? (
        <LoadingPage override="Loading order…" />
      ) : !order ? (
        <Card className="mx-auto mt-10 max-w-xl text-center">
          <Header>Order not found</Header>
          <Small className="mt-2 block">This order doesn&apos;t exist or you can&apos;t access it.</Small>
        </Card>
      ) : (
        <>
          <PageHeading
            backUrl={`/workspaces/${groupId}/orders`}
            title={`Order #${order.orderNumber}`}
            description={<ReactTimeago date={order.created} />}
          >
            <div className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.status} />
              {access.manage &&
                (ACTIONS_BY_STATUS[order.status] || []).map((action) => (
                  <Button
                    key={action}
                    variant={action === 'cancel' ? 'light_danger' : action === 'complete' || action === 'hand_to_customer' ? 'success' : 'discrete'}
                    onClick={() => onAction(action)}
                    disabled={transition.isPending}
                  >
                    {ACTION_LABELS[action]}
                  </Button>
                ))}
            </div>
          </PageHeading>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Items + totals */}
            <Card className="lg:col-span-2">
              <Header>Items</Header>
              <div className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
                {order.items.map((item, i) => (
                  <div key={`${item.productId}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <ItemThumbnail groupId={groupId} productId={item.productId} enabled={canQuery} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {item.quantity} × {formatMoney(item.unitPrice, currencySymbol)}
                        </p>
                      </div>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {item.unitPrice === undefined ? '—' : formatMoney(item.unitPrice * item.quantity, currencySymbol)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-700">
                <p className="font-semibold text-gray-900 dark:text-gray-100">Total</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatMoney(order.total, currencySymbol)}</p>
              </div>
            </Card>

            {/* Summary */}
            <Card>
              <Header>Summary</Header>
              <dl className="mt-3 space-y-3 text-sm">
                <SummaryRow label="Customer">
                  <TextReturnForUserId userId={order.customerId} includeImage={true} />
                </SummaryRow>
                {order.cashierId && (
                  <SummaryRow label="Cashier">
                    <TextReturnForUserId userId={order.cashierId} includeImage={true} />
                  </SummaryRow>
                )}
                {order.preparedBy && (
                  <SummaryRow label="Prepared by">
                    <TextReturnForUserId userId={order.preparedBy} includeImage={true} />
                  </SummaryRow>
                )}
                <SummaryRow label="Source">{ORDER_SOURCE_LABELS[order.source] || order.source}</SummaryRow>
                <SummaryRow label="Queue">{queueName(order.queueId)}</SummaryRow>
                <SummaryRow label="Status">{ORDER_STATUS_LABELS[order.status] || order.status}</SummaryRow>
                {order.lastModified && (
                  <SummaryRow label="Last updated">
                    <ReactTimeago date={order.lastModified} />
                  </SummaryRow>
                )}
              </dl>
            </Card>
          </div>

          {/* Timeline */}
          <Card className="mt-4">
            <Header>Timeline</Header>
            <ol className="mt-4 space-y-4">
              {order.log.length === 0 && <Small>No events recorded.</Small>}
              {order.log.map((event, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-blue-500" />
                    {i < order.log.length - 1 && <span className="mt-1 w-px grow bg-gray-200 dark:bg-gray-700" />}
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {ORDER_STATUS_LABELS[event.event] || event.event}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <TextReturnForUserId userId={event.userId} includeImage={false} />
                      <span>·</span>
                      <ReactTimeago date={event.date} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}
    </OrdersGate>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-right text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  );
}

/**
 * Best-effort thumbnail for an order line item. The line snapshot doesn't carry
 * the image asset id, so we look up the live product and (if it still has an
 * image asset) render its thumbnail. Falls back to a placeholder square.
 */
function ItemThumbnail({ groupId, productId, enabled }: { groupId: string; productId: string; enabled: boolean }) {
  const { data: product } = trpc.workspaces.workspace.orders.products.get.useQuery(
    { groupId, productId },
    { enabled: enabled && !!productId, staleTime: 5 * 60 * 1000 },
  );
  const assetId = product?.imageAssetId;
  const { data: thumb } = trpc.workspaces.workspace.orders.products.getAssetThumbnail.useQuery(
    { groupId, assetId: assetId || '' },
    { enabled: enabled && !!assetId, staleTime: 10 * 60 * 1000 },
  );

  if (thumb?.state === 'Completed' && thumb.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={thumb.imageUrl} alt="" className="h-9 w-9 rounded-md object-cover" />;
  }
  return <div className="h-9 w-9 rounded-md bg-gray-100 dark:bg-gray-700" />;
}

OrderDetailPage.getLayout = (page: ReactElement) => <OrdersLayout disablePadding={false}>{page}</OrdersLayout>;

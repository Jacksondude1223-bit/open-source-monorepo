import { ReactNode } from 'react';
import Link from 'next/link';
import { OrderStatus, OrderSource } from '~/services/NewMongoTypes';
import Badge from '~/components/ui/Badge';
import Card from '~/components/ui/Card';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  submitted: 'Submitted',
  claimed: 'Claimed',
  released: 'Awaiting preparer',
  completed: 'Completed',
  cancelled: 'Cancelled',
  awaiting_customer: 'Awaiting pickup',
  handed_to_customer: 'Handed over',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, 'blue' | 'green' | 'yellow' | 'red' | 'light'> = {
  submitted: 'yellow',
  claimed: 'blue',
  released: 'yellow',
  completed: 'green',
  cancelled: 'red',
  awaiting_customer: 'blue',
  handed_to_customer: 'green',
};

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  register: 'Register',
  kiosk: 'Kiosk',
  drive_thru: 'Drive-thru',
  api: 'API',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge color={ORDER_STATUS_COLORS[status] || 'light'}>{ORDER_STATUS_LABELS[status] || status}</Badge>;
}

/**
 * Render a money amount using the POS config's currency symbol. An absent amount
 * is treated as free/unpriced and rendered as a muted dash.
 */
export function formatMoney(amount: number | undefined, currencySymbol = '$'): string {
  if (amount === undefined || amount === null) return '—';
  return `${currencySymbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Format a duration in milliseconds as a short human string (e.g. "2m 14s"). */
export function formatDuration(ms: number | undefined): string {
  if (!ms || ms <= 0) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Full-page gate shown when the Orders module is off for the workspace, or the
 * user lacks the required permission. Keeps every page's empty/denied state
 * consistent and avoids firing module-gated queries when access is denied.
 */
export function OrdersGate({
  moduleEnabled,
  allowed,
  groupId,
  canEnable,
  children,
}: {
  moduleEnabled: boolean;
  allowed: boolean;
  groupId: string;
  canEnable: boolean;
  children: ReactNode;
}) {
  if (!moduleEnabled) {
    return (
      <Card className="max-w-xl mx-auto mt-10 text-center">
        <Header>Orders module is disabled</Header>
        <Small className="mt-2 block">
          The Orders / POS module is turned off for this workspace.
          {canEnable ? ' Enable it from workspace settings to get started.' : ' Ask a workspace admin to enable it.'}
        </Small>
        {canEnable && (
          <Link
            href={`/workspaces/${groupId}/settings`}
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to settings
          </Link>
        )}
      </Card>
    );
  }

  if (!allowed) {
    return (
      <Card className="max-w-xl mx-auto mt-10 text-center">
        <Header>No access</Header>
        <Small className="mt-2 block">You don&apos;t have permission to view this page.</Small>
      </Card>
    );
  }

  return <>{children}</>;
}

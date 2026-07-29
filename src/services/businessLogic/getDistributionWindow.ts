import { Distribution, Workspace } from '~/services/NewMongoTypes';

// Computes the END date of a distribution period given its start anchor and the
// workspace's distribution cadence. Extracted from calculateSessionCounts.ts so
// the attendance grid and the session-count cron share identical period math.
//   manual    => effectively open-ended (anchor + 1 year)
//   weekly    => anchor + 7 days
//   biweekly  => anchor + 14 days
//   monthly   => anchor + 1 month (default)
export function computeDistributionPeriodEnd(
  anchor: Date,
  period: Workspace['distributionPeriod'],
): Date {
  switch (period) {
    case 'manual': {
      const d = new Date(anchor);
      d.setFullYear(d.getFullYear() + 1);
      return d;
    }
    case 'weekly': {
      const d = new Date(anchor);
      d.setDate(d.getDate() + 7);
      return d;
    }
    case 'biweekly': {
      const d = new Date(anchor);
      d.setDate(d.getDate() + 14);
      return d;
    }
    case 'monthly':
    default: {
      const d = new Date(anchor);
      d.setMonth(d.getMonth() + 1);
      return d;
    }
  }
}

// Returns the [from, to] window a distribution covers, for grid/reporting use.
// For the CURRENT (in-progress) distribution the upper bound is "now" so we do
// not render sessions that haven't happened yet; for a past distribution we use
// its recorded `to`, falling back to the period-based end if it is missing.
export function getDistributionWindow(
  workspace: Pick<Workspace, 'distributionPeriod'>,
  distribution: Pick<Distribution, 'from' | 'to' | 'isCurrent'>,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const from = new Date(distribution.from);
  const periodEnd = computeDistributionPeriodEnd(from, workspace.distributionPeriod);
  const to = distribution.isCurrent
    ? now
    : distribution.to
      ? new Date(distribution.to)
      : periodEnd;
  return { from, to };
}

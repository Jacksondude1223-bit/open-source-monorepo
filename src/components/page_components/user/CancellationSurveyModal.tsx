import { useState } from 'react';
import Modal from '~/components/ui/Modal';
import Button from '~/components/forms/Button';

export type CancellationReason =
  | 'switched_to_competitor'
  | 'too_expensive'
  | 'group_inactive'
  | 'setup_confusing'
  | 'didnt_understand_value'
  | 'missing_feature'
  | 'bugs_reliability'
  | 'support_issue'
  | 'other';

const REASONS: { value: CancellationReason; label: string }[] = [
  { value: 'switched_to_competitor', label: 'We switched to another tool' },
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'group_inactive', label: 'Group is inactive / closed' },
  { value: 'setup_confusing', label: 'Setup was too confusing' },
  { value: 'didnt_understand_value', label: "Didn't understand the value" },
  { value: 'missing_feature', label: 'Missing a feature I need' },
  { value: 'bugs_reliability', label: 'Bugs / reliability' },
  { value: 'support_issue', label: 'Support issue' },
  { value: 'other', label: 'Other' },
];

// One smart retention offer per reason.
const RETENTION_OFFERS: Record<CancellationReason, string | null> = {
  switched_to_competitor:
    "Before you go — tell us what the other tool does better. If we can solve it, we'll give you 2 months free.",
  too_expensive:
    "Money tight this month? We can pause your billing for 30 days, or set you up with an annual discount. Reach out before cancelling and we'll sort it.",
  setup_confusing:
    "Setup shouldn't be the reason you leave. Book a free setup call and we'll get your workspace configured for you in Discord.",
  group_inactive:
    "If your group is just quiet for now, you can pause your workspace instead of deleting it — your data and settings will be waiting when you're back.",
  didnt_understand_value: null,
  missing_feature: null,
  bugs_reliability: null,
  support_issue: null,
  other: null,
};

const SUPPORT_URL = 'https://discord.gg/msdjzQNsV2';

export default function CancellationSurveyModal({
  open,
  setOpen,
  workspaceName,
  loading,
  onConfirm,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  workspaceName?: string;
  loading?: boolean;
  onConfirm: (reason: CancellationReason, details: string) => void;
}) {
  const [reason, setReason] = useState<CancellationReason | null>(null);
  const [details, setDetails] = useState('');

  const offer = reason ? RETENTION_OFFERS[reason] : null;

  return (
    <Modal open={open} setOpen={setOpen} sizeOverride="lg">
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Before you cancel{workspaceName ? ` ${workspaceName}` : ''}
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Quick question — why are you cancelling? Your answer helps us improve
            ReAdmin.
          </p>
        </div>

        <div className="space-y-2">
          {REASONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 transition ${
                reason === option.value
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="cancellation-reason"
                value={option.value}
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {option.label}
              </span>
            </label>
          ))}
        </div>

        {offer && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <p className="text-sm text-blue-900 dark:text-blue-200">{offer}</p>
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm font-semibold text-blue-700 underline dark:text-blue-300"
            >
              Talk to us first
            </a>
          </div>
        )}

        <div>
          <label
            htmlFor="cancellation-details"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Anything else we should know? (optional)
          </label>
          <textarea
            id="cancellation-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Tell us what we could have done better..."
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="discrete" size="medium" onClick={() => setOpen(false)}>
            Keep my subscription
          </Button>
          <Button
            variant="danger"
            size="medium"
            disabled={!reason || loading}
            onClick={() => reason && onConfirm(reason, details)}
          >
            Cancel anyway
          </Button>
        </div>
      </div>
    </Modal>
  );
}

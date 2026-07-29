import type { ButtonVariants } from '~/components/forms/Button';
import type {
  FormButtonType,
  ResponseStatus,
} from '~/services/NewMongoTypes/Application.type';

type BadgeColor = 'blue' | 'green' | 'yellow' | 'red' | 'light';

// ---------------------------------------------------------------------------
// Submission button verbs (item #1 of the forms enhancement plan)
// ---------------------------------------------------------------------------
export type ButtonTypeMeta = {
  id: FormButtonType;
  /** The verb shown on the button itself. */
  label: string;
  /** Past-tense log/confirmation phrasing, e.g. "Application submitted". */
  pastTense: string;
  /** Applicant-facing confirmation headline after responding. */
  confirmation: string;
};

export const BUTTON_TYPES: ButtonTypeMeta[] = [
  {
    id: 'submit',
    label: 'Submit',
    pastTense: 'Submitted',
    confirmation: 'Your response has been submitted',
  },
  {
    id: 'send',
    label: 'Send',
    pastTense: 'Sent',
    confirmation: 'Your response has been sent',
  },
  {
    id: 'apply',
    label: 'Apply',
    pastTense: 'Application submitted',
    confirmation: 'Your application has been submitted',
  },
  {
    id: 'request',
    label: 'Request',
    pastTense: 'Request submitted',
    confirmation: 'Your request has been submitted',
  },
  {
    id: 'complete',
    label: 'Complete',
    pastTense: 'Completed',
    confirmation: 'Your form has been completed',
  },
  {
    id: 'sign',
    label: 'Sign',
    pastTense: 'Signed',
    confirmation: 'Your form has been signed',
  },
];

export function getButtonMeta(type?: FormButtonType): ButtonTypeMeta {
  return BUTTON_TYPES.find((b) => b.id === type) ?? BUTTON_TYPES[0]!;
}

// ---------------------------------------------------------------------------
// Response statuses (item #2 of the forms enhancement plan)
// ---------------------------------------------------------------------------
export type StatusMeta = {
  id: ResponseStatus;
  label: string;
  description: string;
  badge: BadgeColor;
  button: ButtonVariants;
  /** Hex-ish tailwind dot colour for compact indicators. */
  dot: string;
  /** Whether this status can be assigned manually by reviewers. */
  assignable: boolean;
};

export const STATUS_META: Record<ResponseStatus, StatusMeta> = {
  received: {
    id: 'received',
    label: 'Received',
    description: 'The initial value for every new response.',
    badge: 'light',
    button: 'discrete',
    dot: 'bg-gray-400',
    assignable: true,
  },
  pending: {
    id: 'pending',
    label: 'Pending',
    description: 'Awaiting a reviewer decision.',
    badge: 'yellow',
    button: 'primary',
    dot: 'bg-yellow-400',
    assignable: true,
  },
  read: {
    id: 'read',
    label: 'Read',
    description: 'A reviewer has read this response.',
    badge: 'blue',
    button: 'blue',
    dot: 'bg-blue-400',
    assignable: true,
  },
  review: {
    id: 'review',
    label: 'Review',
    description: 'Flagged for additional review.',
    badge: 'yellow',
    button: 'warning',
    dot: 'bg-amber-400',
    assignable: true,
  },
  completed: {
    id: 'completed',
    label: 'Completed',
    description: 'Marked as completed / accepted / passed.',
    badge: 'green',
    button: 'success',
    dot: 'bg-green-500',
    assignable: true,
  },
  passed: {
    id: 'passed',
    label: 'Passed',
    description: 'The applicant passed.',
    badge: 'green',
    button: 'success',
    dot: 'bg-green-500',
    assignable: true,
  },
  denied: {
    id: 'denied',
    label: 'Denied',
    description: 'Marked as denied / failed.',
    badge: 'red',
    button: 'danger',
    dot: 'bg-red-500',
    assignable: true,
  },
  failed: {
    id: 'failed',
    label: 'Failed',
    description: 'The applicant failed.',
    badge: 'red',
    button: 'danger',
    dot: 'bg-red-500',
    assignable: true,
  },
  reported: {
    id: 'reported',
    label: 'Report to ReAdmin',
    description:
      'Submit this response to be reviewed by official ReAdmin Trust & Safety.',
    badge: 'red',
    button: 'warning',
    dot: 'bg-orange-500',
    assignable: true,
  },
};

// Statuses offered by default when a form has not customised its options.
export const DEFAULT_STATUS_OPTIONS: ResponseStatus[] = [
  'pending',
  'passed',
  'reported',
  'failed',
];

// Statuses a workspace can toggle on/off in form settings (item #7.10).
export const CONFIGURABLE_STATUSES: ResponseStatus[] = [
  'received',
  'read',
  'pending',
  'review',
  'completed',
  'passed',
  'denied',
  'failed',
  'reported',
];

export function getStatusMeta(status?: ResponseStatus | string): StatusMeta {
  if (status && status in STATUS_META) {
    return STATUS_META[status as ResponseStatus];
  }
  return STATUS_META.received;
}

export function getEnabledStatuses(
  statusOptions?: ResponseStatus[],
): StatusMeta[] {
  const ids =
    statusOptions && statusOptions.length > 0
      ? statusOptions
      : DEFAULT_STATUS_OPTIONS;
  return ids
    .filter((id) => id in STATUS_META)
    .map((id) => STATUS_META[id]);
}

// Curated font choices for the form text (item #7.3).
export const FORM_FONTS: { id: string; name: string }[] = [
  { id: '', name: 'Default (Inter)' },
  { id: 'Inter', name: 'Inter' },
  { id: 'Roboto', name: 'Roboto' },
  { id: 'Open Sans', name: 'Open Sans' },
  { id: 'Lato', name: 'Lato' },
  { id: 'Montserrat', name: 'Montserrat' },
  { id: 'Poppins', name: 'Poppins' },
  { id: 'Source Sans Pro', name: 'Source Sans Pro' },
  { id: 'Nunito', name: 'Nunito' },
  { id: 'Merriweather', name: 'Merriweather (serif)' },
  { id: 'Georgia', name: 'Georgia (serif)' },
  { id: 'Courier New', name: 'Courier New (mono)' },
];

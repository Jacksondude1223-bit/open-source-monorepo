'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  IdentificationIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  ClockIcon,
  MapPinIcon,
  CakeIcon,
  PencilSquareIcon,
  LockClosedIcon,
} from '@heroicons/react/20/solid';
import toast from 'react-hot-toast';
import { trpc } from '~/utils/trpc';
import Button from '~/components/forms/Button';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Curated fallback for browsers that don't support Intl.supportedValuesOf.
const FALLBACK_TIMEZONES = [
  'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Denver',
  'America/Chicago', 'America/New_York', 'America/Sao_Paulo', 'Atlantic/Azores',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Athens', 'Europe/Moscow',
  'Africa/Cairo', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata',
  'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
  'Pacific/Auckland', 'UTC',
];

/** All IANA timezones the runtime knows about, falling back to a curated list. */
function getTimezoneList(): string[] {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    /* fall through */
  }
  return FALLBACK_TIMEZONES;
}

/** Current UTC offset label (e.g. "UTC-05:00") for a timezone. */
function offsetLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === 'timeZoneName')?.value;
    return name ? name.replace('GMT', 'UTC') : 'UTC';
  } catch {
    return '';
  }
}

/** Live "current time" string for a timezone (e.g. "2:30 PM"). */
function timeInZone(tz: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date());
  } catch {
    return null;
  }
}

function formatBirthday(birthday?: { month: number; day: number } | null): string | null {
  if (!birthday || !birthday.month || !birthday.day) return null;
  const name = MONTHS[birthday.month - 1];
  if (!name) return null;
  return `${name} ${birthday.day}`;
}

type DetailField = 'firstName' | 'lastName' | 'email' | 'country' | 'timezone' | 'address';

/**
 * A single self-contained detail card. In view mode it shows the value with an
 * edit pencil; clicking it swaps the card into an inline editor with its own
 * Save/Cancel, so each field is editable independently without a shared modal.
 *
 * `readOnly` cards (e.g. birthday) render the value with no edit affordance.
 */
function EditableDetailCard({
  icon: Icon,
  label,
  field,
  storedValue,
  displayValue,
  type = 'text',
  canEdit,
  readOnly = false,
  sensitive = false,
  placeholder = '',
  timezones = [],
  saving = false,
  onSave,
}: {
  icon: any;
  label: string;
  field?: DetailField;
  storedValue?: string | null;
  displayValue?: React.ReactNode;
  type?: 'text' | 'email' | 'timezone' | 'address';
  canEdit?: boolean;
  readOnly?: boolean;
  sensitive?: boolean;
  placeholder?: string;
  timezones?: { tz: string; offset: string }[];
  saving?: boolean;
  onSave?: (field: DetailField, value: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(storedValue ?? '');

  // Keep the draft in sync if the underlying value changes while not editing.
  useEffect(() => {
    if (!editing) setDraft(storedValue ?? '');
  }, [storedValue, editing]);

  const startEdit = () => {
    setDraft(storedValue ?? '');
    setEditing(true);
  };

  const cancel = () => {
    setDraft(storedValue ?? '');
    setEditing(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!field || !onSave) return;
    await onSave(field, draft.trim());
    setEditing(false);
  };

  return (
    <div className="flex flex-row items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition dark:border-gray-700/80 dark:bg-gray-800/80">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-300">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <small className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {label}
            {sensitive && <LockClosedIcon className="h-3 w-3" title="Sensitive — encrypted at rest" />}
          </small>
          {!readOnly && canEdit && !editing && (
            <button
              type="button"
              onClick={startEdit}
              className="opacity-60 transition hover:opacity-100"
              title={`Edit ${label.toLowerCase()}`}
            >
              <PencilSquareIcon className="h-4 w-4 text-gray-400 transition hover:text-blue-500" />
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={submit} className="mt-1.5 flex flex-col gap-2">
            {type === 'timezone' ? (
              <>
                <select
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">Not set</option>
                  {timezones.map(({ tz, offset }) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}{offset ? ` (${offset})` : ''}
                    </option>
                  ))}
                </select>
                {draft && timeInZone(draft) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Their local time is currently {timeInZone(draft)}.
                  </p>
                )}
              </>
            ) : (
              <input
                autoFocus
                type={type === 'email' ? 'email' : 'text'}
                value={draft}
                placeholder={placeholder}
                onChange={(e) => setDraft(e.target.value)}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            )}
            <div className="flex flex-row items-center gap-2">
              <Button type="submit" variant="primary" size="small" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="discrete" size="small" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-0.5 w-full break-words text-sm text-gray-800 dark:text-gray-200">
            {displayValue || storedValue || (
              <span className="text-gray-400 dark:text-gray-500">Not set</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Workspace-scoped personal/contact details for a member. Sensitive (PII), so it
 * is only rendered for viewers with the `profile.view` permission — the parent
 * page is responsible for that gate. Editing is additionally gated by
 * `profile.edit`, reported back by the API as `canEdit`. Each field is edited
 * inline on its own card.
 */
export default function UserPersonalDetailsPanel({
  groupId,
  userId,
}: {
  groupId: string;
  userId: string;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading, error } =
    trpc.workspaces.workspace.activity.users.details.get.useQuery(
      { groupId, userId },
      { enabled: !!groupId && !!userId, retry: false },
    );

  // Tracks which field is mid-save so only that card shows a spinner.
  const [savingField, setSavingField] = useState<DetailField | null>(null);

  // Ticks every minute so the displayed local time stays current.
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const timezones = useMemo(() => {
    const list = getTimezoneList();
    return list.map((tz) => ({ tz, offset: offsetLabel(tz) }));
  }, []);

  const update = trpc.workspaces.workspace.activity.users.details.update.useMutation();

  const saveField = async (field: DetailField, value: string) => {
    setSavingField(field);
    try {
      // Only the edited field is sent — the API leaves all others untouched.
      await update.mutateAsync({ groupId, userId, [field]: value });
      await utils.workspaces.workspace.activity.users.details.get.invalidate({ groupId, userId });
      toast.success('Saved');
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
      throw e;
    } finally {
      setSavingField(null);
    }
  };

  // The API throws UNAUTHORIZED if the viewer lacks profile.view — hide the
  // panel entirely in that case rather than showing an error.
  if (error) return null;

  const birthday = formatBirthday(data?.birthday);
  const canEdit = data?.canEdit;

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-row items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <IdentificationIcon className="h-4 w-4" /> Personal Details
        </h3>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800/60" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <EditableDetailCard
            icon={IdentificationIcon}
            label="First Name"
            field="firstName"
            storedValue={data?.firstName}
            canEdit={canEdit}
            placeholder="First name"
            saving={savingField === 'firstName'}
            onSave={saveField}
          />
          <EditableDetailCard
            icon={IdentificationIcon}
            label="Last Name"
            field="lastName"
            storedValue={data?.lastName}
            canEdit={canEdit}
            placeholder="Last name"
            saving={savingField === 'lastName'}
            onSave={saveField}
          />
          <EditableDetailCard
            icon={EnvelopeIcon}
            label="Email"
            field="email"
            type="email"
            storedValue={data?.email}
            canEdit={canEdit}
            placeholder="name@example.com"
            saving={savingField === 'email'}
            onSave={saveField}
          />
          <EditableDetailCard
            icon={GlobeAltIcon}
            label="Country"
            field="country"
            storedValue={data?.country}
            canEdit={canEdit}
            placeholder="Country"
            saving={savingField === 'country'}
            onSave={saveField}
          />
          <EditableDetailCard
            icon={ClockIcon}
            label="Timezone"
            field="timezone"
            type="timezone"
            storedValue={data?.timezone}
            canEdit={canEdit}
            timezones={timezones}
            saving={savingField === 'timezone'}
            onSave={saveField}
            displayValue={
              data?.timezone ? (
                <span className="flex flex-wrap items-center gap-x-2">
                  <span>{data.timezone.replace(/_/g, ' ')}</span>
                  {timeInZone(data.timezone) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                      <ClockIcon className="h-3 w-3" />
                      {timeInZone(data.timezone)} local
                    </span>
                  )}
                </span>
              ) : undefined
            }
          />
          <EditableDetailCard
            icon={CakeIcon}
            label="Birthday"
            readOnly
            storedValue={birthday}
            displayValue={
              birthday ? (
                <span className="flex items-center gap-2">
                  {birthday}
                  <span className="text-xs text-gray-400">(from ReAdmin account)</span>
                </span>
              ) : undefined
            }
          />
          <div className="md:col-span-2">
            <EditableDetailCard
              icon={MapPinIcon}
              label="Address"
              field="address"
              type="address"
              sensitive
              storedValue={data?.address}
              canEdit={canEdit}
              placeholder="Street, city, postal code"
              saving={savingField === 'address'}
              onSave={saveField}
            />
          </div>
        </div>
      )}
    </div>
  );
}


import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { XMarkIcon } from '@heroicons/react/20/solid';
import Modal from '~/components/ui/Modal';
import Header from '~/components/NextGenStyles/Header';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import { trpc } from '~/utils/trpc';
import { DeviceProfile, DeviceType } from '~/services/NewMongoTypes';

const fieldClass =
  'mt-1 block w-full rounded-md border-gray-300 dark:bg-gray-800 dark:border-gray-600 py-2 px-2 focus:border-blue-500 focus:ring-blue-500 dark:text-gray-200 sm:text-sm';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
const hintClass = 'mt-1 text-xs text-gray-500 dark:text-gray-400';

/** The 6 device types, in menu order, with human labels. */
const DEVICE_TYPES: { value: DeviceType; label: string }[] = [
  { value: 'register', label: 'Register' },
  { value: 'kiosk', label: 'Kiosk' },
  { value: 'board', label: 'Board' },
  { value: 'bumpbar', label: 'Bump bar' },
  { value: 'scanner', label: 'Scanner' },
  { value: 'drivethru', label: 'Drive-thru' },
];

/** Device types that present a walk-up prompt (activation distance / prompt key). */
const INTERACTIVE_TYPES: DeviceType[] = ['register', 'kiosk', 'scanner', 'drivethru'];

type SourceValue = '' | 'register' | 'kiosk' | 'drive_thru' | 'api';

const SOURCE_OPTIONS: { value: SourceValue; label: string }[] = [
  { value: '', label: 'Default (from device type)' },
  { value: 'register', label: 'Register' },
  { value: 'kiosk', label: 'Kiosk' },
  { value: 'drive_thru', label: 'Drive-thru' },
  { value: 'api', label: 'API' },
];

const DISPLAY_OPTIONS: { value: '' | 'prompt' | 'surface' | 'both'; label: string }[] = [
  { value: '', label: 'Default (from device type)' },
  { value: 'prompt', label: 'Prompt — walk-up panel' },
  { value: 'surface', label: 'Surface — on-part screen' },
  { value: 'both', label: 'Both — prompt + surface' },
];

const VENUE_OPTIONS: { value: '' | 'restaurant' | 'retail'; label: string }[] = [
  { value: '', label: 'Use config default' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'retail', label: 'Retail' },
];

/** Slugify a name into a valid `key`: lowercase, spaces→underscore, strip invalid chars. */
export function slugifyKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** The Studio CollectionService tag a builder applies to a part for each device type. */
export function raposTag(type: DeviceType): string {
  const map: Record<DeviceType, string> = {
    register: 'RAPOS_Register',
    kiosk: 'RAPOS_Kiosk',
    board: 'RAPOS_Board',
    bumpbar: 'RAPOS_BumpBar',
    scanner: 'RAPOS_Scanner',
    drivethru: 'RAPOS_DriveThru',
  };
  return map[type];
}

type FormState = {
  name: string;
  key: string;
  deviceType: DeviceType;
  queueId: string;
  venueMode: '' | 'restaurant' | 'retail';
  display: '' | 'prompt' | 'surface' | 'both';
  boardTags: string[];
  idleText: string;
  activationDistance: string;
  promptKey: string;
  source: SourceValue;
  enabled: boolean;
};

const EMPTY: FormState = {
  name: '',
  key: '',
  deviceType: 'register',
  queueId: '',
  venueMode: '',
  display: '',
  boardTags: [],
  idleText: '',
  activationDistance: '',
  promptKey: '',
  source: '',
  enabled: true,
};

/** Create / edit modal for a web-managed device profile. */
export default function DeviceModal({
  open,
  setOpen,
  groupId,
  device,
  queues,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  groupId: string;
  device: DeviceProfile | null; // null = create
  queues: { id: string; name: string }[];
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<FormState>(EMPTY);
  // Once the user hand-edits the key we stop auto-suggesting from the name.
  const [keyTouched, setKeyTouched] = useState(false);
  const [tagDraft, setTagDraft] = useState('');

  useEffect(() => {
    if (!open) return;
    setTagDraft('');
    if (device) {
      setKeyTouched(true);
      setForm({
        name: device.name,
        key: device.key,
        deviceType: device.deviceType,
        queueId: device.queueId || '',
        venueMode: device.venueMode || '',
        display: device.display || '',
        boardTags: device.boardTags || [],
        idleText: device.idleText || '',
        activationDistance:
          device.activationDistance !== undefined ? String(device.activationDistance) : '',
        promptKey: device.promptKey || '',
        source: device.source || '',
        enabled: device.enabled,
      });
    } else {
      setKeyTouched(false);
      setForm(EMPTY);
    }
  }, [open, device]);

  const createMut = trpc.workspaces.workspace.orders.devices.create.useMutation();
  const updateMut = trpc.workspaces.workspace.orders.devices.update.useMutation();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Auto-suggest the key from the name until the user edits the key directly.
  const onNameChange = (value: string) => {
    setForm((f) => ({
      ...f,
      name: value,
      key: keyTouched ? f.key : slugifyKey(value),
    }));
  };

  const onKeyChange = (value: string) => {
    setKeyTouched(true);
    // Keep the field honest as you type — only valid chars survive.
    set('key', slugifyKey(value));
  };

  const isInteractive = INTERACTIVE_TYPES.includes(form.deviceType);
  const isBoard = form.deviceType === 'board';
  const isKiosk = form.deviceType === 'kiosk';

  const addTag = () => {
    const t = tagDraft.trim();
    if (!t) return;
    if (!form.boardTags.includes(t)) set('boardTags', [...form.boardTags, t]);
    setTagDraft('');
  };

  const removeTag = (t: string) => set('boardTags', form.boardTags.filter((x) => x !== t));

  const tag = useMemo(() => raposTag(form.deviceType), [form.deviceType]);

  const submit = () => {
    if (!form.name.trim()) {
      toast.error('A device name is required.');
      return;
    }
    if (!form.key) {
      toast.error('A device key is required.');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(form.key)) {
      toast.error('Key may only contain lowercase letters, numbers and underscores.');
      return;
    }

    let distance: number | undefined;
    if (isInteractive && form.activationDistance.trim() !== '') {
      distance = Number(form.activationDistance);
      if (Number.isNaN(distance) || distance < 1 || distance > 64) {
        toast.error('Activation distance must be between 1 and 64 studs.');
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      key: form.key,
      deviceType: form.deviceType,
      queueId: form.queueId || undefined,
      venueMode: form.venueMode || undefined,
      display: form.display || undefined,
      boardTags: isBoard && form.boardTags.length > 0 ? form.boardTags : undefined,
      idleText: isKiosk && form.idleText.trim() ? form.idleText.trim() : undefined,
      activationDistance: isInteractive ? distance : undefined,
      promptKey: isInteractive && form.promptKey.trim() ? form.promptKey.trim() : undefined,
      source: form.source || undefined,
      enabled: form.enabled,
    };

    const invalidate = () => {
      utils.workspaces.workspace.orders.devices.list.invalidate({ groupId });
      setOpen(false);
    };

    const promise = device
      ? updateMut
          .mutateAsync({ groupId, profileId: device._id!.toString(), profile: payload })
          .then(invalidate)
      : createMut.mutateAsync({ groupId, profile: payload }).then(invalidate);

    toast.promise(promise, {
      loading: device ? 'Saving device…' : 'Creating device…',
      success: device ? 'Device saved' : 'Device created',
      // Surfaces the backend CONFLICT (duplicate key) message verbatim.
      error: (e) => e?.message || 'Failed to save device.',
    });
  };

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <Modal open={open} setOpen={setOpen} sizeOverride="2xl">
      <Header>{device ? 'Edit device' : 'New device'}</Header>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Name</label>
          <input
            className={fieldClass}
            value={form.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Front register"
          />
        </div>

        <div>
          <label className={labelClass}>Key</label>
          <input
            className={`${fieldClass} font-mono`}
            value={form.key}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder="front_register"
          />
          <p className={hintClass}>
            Lowercase letters, numbers and underscores only. Referenced by a device&apos;s{' '}
            <code className="font-mono">Profile</code> attribute in Studio.
          </p>
        </div>

        <div>
          <label className={labelClass}>Device type</label>
          <select
            className={fieldClass}
            value={form.deviceType}
            onChange={(e) => set('deviceType', e.target.value as DeviceType)}
          >
            {DEVICE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Queue</label>
          <select className={fieldClass} value={form.queueId} onChange={(e) => set('queueId', e.target.value)}>
            <option value="">Default (first queue)</option>
            {queues.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Venue mode</label>
          <select
            className={fieldClass}
            value={form.venueMode}
            onChange={(e) => set('venueMode', e.target.value as FormState['venueMode'])}
          >
            {VENUE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Display</label>
          <select
            className={fieldClass}
            value={form.display}
            onChange={(e) => set('display', e.target.value as FormState['display'])}
          >
            {DISPLAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className={hintClass}>
            Prompt is a walk-up panel; surface draws on the part itself; both shows each.
          </p>
        </div>

        {isBoard && (
          <div className="sm:col-span-2">
            <label className={labelClass}>Board tags</label>
            <div className="mt-1 flex gap-2">
              <input
                className="block w-full rounded-md border-gray-300 px-2 py-2 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 sm:text-sm"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="barista, grill…"
              />
              <Button variant="discrete" onClick={addTag}>
                Add
              </Button>
            </div>
            {form.boardTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {form.boardTags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2 py-1 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300"
                  >
                    {t}
                    <button type="button" onClick={() => removeTag(t)} className="text-gray-400 hover:text-red-500">
                      <XMarkIcon className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className={hintClass}>Categories routed to a matching tag appear on this board.</p>
          </div>
        )}

        {isKiosk && (
          <div className="sm:col-span-2">
            <label className={labelClass}>Idle text</label>
            <input
              className={fieldClass}
              value={form.idleText}
              onChange={(e) => set('idleText', e.target.value)}
              placeholder="Tap to order"
            />
            <p className={hintClass}>Attract-screen text shown when the kiosk is idle.</p>
          </div>
        )}

        {isInteractive && (
          <>
            <div>
              <label className={labelClass}>Activation distance (studs)</label>
              <input
                className={fieldClass}
                type="number"
                min={1}
                max={64}
                value={form.activationDistance}
                onChange={(e) => set('activationDistance', e.target.value)}
                placeholder="8"
              />
              <p className={hintClass}>Walk-up prompt reach, 1–64 studs.</p>
            </div>

            <div>
              <label className={labelClass}>Prompt key</label>
              <input
                className={fieldClass}
                value={form.promptKey}
                onChange={(e) => set('promptKey', e.target.value)}
                placeholder="E"
              />
              <p className={hintClass}>Key the customer presses to open the prompt (default E).</p>
            </div>
          </>
        )}

        <div>
          <label className={labelClass}>Source (optional)</label>
          <select
            className={fieldClass}
            value={form.source}
            onChange={(e) => set('source', e.target.value as SourceValue)}
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className={hintClass}>Overrides the source recorded on orders this device creates.</p>
        </div>

        <div className="flex items-end">
          <Toggle title="Enabled" value={form.enabled} onChange={(v) => set('enabled', v)} className="w-full" />
        </div>
      </div>

      {/* How to use in Studio */}
      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900/50 dark:bg-blue-900/20">
        <p className="font-medium text-blue-800 dark:text-blue-300">How to use in Studio</p>
        <p className="mt-1 text-blue-700 dark:text-blue-200">
          Tag your part <code className="font-mono">{tag}</code> and add a string attribute{' '}
          <code className="font-mono">Profile</code> ={' '}
          <code className="font-mono">{form.key || '<key>'}</code>.
        </p>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="discrete" onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={saving}>
          {device ? 'Save changes' : 'Create device'}
        </Button>
      </div>
    </Modal>
  );
}

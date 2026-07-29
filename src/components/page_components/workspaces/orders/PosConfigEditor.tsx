import { useState } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/20/solid';
import Card from '~/components/ui/Card';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import { PosConfig, PosCornerRadius, PosPricingMode, PosVenueMode } from '~/services/NewMongoTypes';
import AssetThumbnail from './AssetThumbnail';

// The editable subset of a PosConfig (matches the backend's updateDefault input).
export type PosConfigDraft = {
  venueMode: PosVenueMode;
  pricing: PosConfig['pricing'];
  theme: PosConfig['theme'];
  queues: PosConfig['queues'];
  kiosk: PosConfig['kiosk'];
  register: PosConfig['register'];
  prepFlow: PosConfig['prepFlow'];
};

export function toDraft(config: PosConfig): PosConfigDraft {
  return {
    venueMode: config.venueMode,
    pricing: { ...config.pricing },
    theme: { ...config.theme },
    queues: config.queues.map((q) => ({ ...q })),
    kiosk: { ...config.kiosk },
    register: { ...config.register },
    prepFlow: { ...config.prepFlow },
  };
}

const fieldClass =
  'mt-1 block w-full rounded-md border-gray-300 dark:bg-gray-800 dark:border-gray-600 py-2 px-2 focus:border-blue-500 focus:ring-blue-500 dark:text-gray-200 sm:text-sm';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300';

const THEME_COLOR_FIELDS: { key: keyof PosConfig['theme']; label: string }[] = [
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'textPrimary', label: 'Text primary' },
  { key: 'textSecondary', label: 'Text secondary' },
];

const CORNER_RADIUS: PosCornerRadius[] = ['sharp', 'rounded', 'pill'];
const PRICING_MODES: { id: PosPricingMode; label: string }[] = [
  { id: 'cosmetic', label: 'Cosmetic (display only)' },
  { id: 'currency_hook', label: 'Currency hook (charge in-game)' },
  { id: 'free', label: 'Free (hide all prices)' },
];

/**
 * Controlled editor for the editable portion of a PosConfig. The parent owns the
 * draft state and supplies the save handler — this is shared by the default and
 * per-game override tabs.
 */
export default function PosConfigEditor({
  groupId,
  draft,
  setDraft,
}: {
  groupId: string;
  draft: PosConfigDraft;
  setDraft: (next: PosConfigDraft) => void;
}) {
  const [newQueueName, setNewQueueName] = useState('');

  const patch = (partial: Partial<PosConfigDraft>) => setDraft({ ...draft, ...partial });
  const patchTheme = (partial: Partial<PosConfig['theme']>) => patch({ theme: { ...draft.theme, ...partial } });
  const patchPricing = (partial: Partial<PosConfig['pricing']>) => patch({ pricing: { ...draft.pricing, ...partial } });

  const radiusClass =
    draft.theme.cornerRadius === 'sharp' ? 'rounded-none' : draft.theme.cornerRadius === 'pill' ? 'rounded-full' : 'rounded-lg';

  const addQueue = () => {
    const name = newQueueName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `queue_${draft.queues.length + 1}`;
    if (draft.queues.some((q) => q.id === id)) return;
    patch({ queues: [...draft.queues, { id, name }] });
    setNewQueueName('');
  };

  return (
    <div className="space-y-4">
      {/* Venue mode */}
      <Card>
        <Header>Venue mode</Header>
        <Small className="mt-1 block">Default register behaviour for stations.</Small>
        <select
          className={fieldClass + ' max-w-xs'}
          value={draft.venueMode}
          onChange={(e) => patch({ venueMode: e.target.value as PosVenueMode })}
        >
          <option value="restaurant">Restaurant</option>
          <option value="retail">Retail (scan-based)</option>
        </select>
      </Card>

      {/* Pricing */}
      <Card>
        <Header>Pricing</Header>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Mode</label>
            <select
              className={fieldClass}
              value={draft.pricing.mode}
              onChange={(e) => patchPricing({ mode: e.target.value as PosPricingMode })}
            >
              {PRICING_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Currency symbol</label>
            <input className={fieldClass} maxLength={5} value={draft.pricing.currencySymbol} onChange={(e) => patchPricing({ currencySymbol: e.target.value })} />
          </div>
          <div className="flex items-end pb-1">
            <Toggle title="Show prices" value={draft.pricing.showPrices} onChange={(v) => patchPricing({ showPrices: v })} className="w-full" />
          </div>
        </div>
      </Card>

      {/* Theme + live preview */}
      <Card>
        <Header>Theme</Header>
        <Small className="mt-1 block">Synced live to the in-game POS at bootstrap.</Small>
        <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {THEME_COLOR_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className={labelClass}>{f.label}</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      className="h-9 w-10 cursor-pointer rounded border border-gray-300 dark:border-gray-600"
                      value={(draft.theme[f.key] as string) || '#000000'}
                      onChange={(e) => patchTheme({ [f.key]: e.target.value } as Partial<PosConfig['theme']>)}
                    />
                    <input
                      className="block w-full rounded-md border-gray-300 px-2 py-1.5 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 sm:text-sm"
                      value={(draft.theme[f.key] as string) || ''}
                      onChange={(e) => patchTheme({ [f.key]: e.target.value } as Partial<PosConfig['theme']>)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Corner radius</label>
                <select
                  className={fieldClass}
                  value={draft.theme.cornerRadius}
                  onChange={(e) => patchTheme({ cornerRadius: e.target.value as PosCornerRadius })}
                >
                  {CORNER_RADIUS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Font (Enum.Font name)</label>
                <input className={fieldClass} value={draft.theme.font || ''} onChange={(e) => patchTheme({ font: e.target.value })} placeholder="GothamMedium" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Logo asset id</label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  className="block w-full rounded-md border-gray-300 px-2 py-2 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 sm:text-sm"
                  value={draft.theme.logoAssetId || ''}
                  onChange={(e) => patchTheme({ logoAssetId: e.target.value })}
                  placeholder="Roblox image asset id"
                />
                <AssetThumbnail groupId={groupId} assetId={draft.theme.logoAssetId || ''} size={12} />
              </div>
            </div>
          </div>

          {/* Mock POS preview */}
          <div>
            <label className={labelClass}>Preview</label>
            <div
              className={`mt-1 overflow-hidden border border-gray-200 p-4 dark:border-gray-700 ${radiusClass}`}
              style={{ backgroundColor: draft.theme.background, color: draft.theme.textPrimary }}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className={`inline-block h-8 w-8 ${radiusClass}`} style={{ backgroundColor: draft.theme.accent }} />
                <span className="text-base font-semibold" style={{ color: draft.theme.textPrimary }}>
                  Point of Sale
                </span>
              </div>
              <div className={`p-3 ${radiusClass}`} style={{ backgroundColor: draft.theme.surface }}>
                <p className="text-sm font-medium" style={{ color: draft.theme.textPrimary }}>
                  Cheeseburger
                </p>
                <p className="text-xs" style={{ color: draft.theme.textSecondary }}>
                  {draft.pricing.showPrices ? `${draft.pricing.currencySymbol}5` : 'Tap to add'}
                </p>
              </div>
              <button
                type="button"
                className={`mt-3 w-full py-2 text-sm font-semibold ${radiusClass}`}
                style={{ backgroundColor: draft.theme.accent, color: draft.theme.background }}
              >
                Checkout
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Queues */}
      <Card>
        <Header>Queues</Header>
        <Small className="mt-1 block">Registers, boards and kiosks bind to a queue by id.</Small>
        <div className="mt-3 space-y-2">
          {draft.queues.length === 0 && <Small>No queues defined.</Small>}
          {draft.queues.map((q, i) => (
            <div key={q.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
              <span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">{q.id}</span>
              <input
                className="block flex-1 rounded-md border-gray-300 px-2 py-1.5 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 sm:text-sm"
                value={q.name}
                onChange={(e) => {
                  const next = draft.queues.map((qq, idx) => (idx === i ? { ...qq, name: e.target.value } : qq));
                  patch({ queues: next });
                }}
              />
              <Button variant="light_danger" icon={TrashIcon} onClick={() => patch({ queues: draft.queues.filter((_, idx) => idx !== i) })} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="block flex-1 rounded-md border-gray-300 px-2 py-2 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 sm:text-sm"
            value={newQueueName}
            onChange={(e) => setNewQueueName(e.target.value)}
            placeholder="New queue name (e.g. Drive-thru)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addQueue();
              }
            }}
          />
          <Button variant="primary" icon={PlusIcon} onClick={addQueue}>
            Add queue
          </Button>
        </div>
      </Card>

      {/* Stations + prep flow */}
      <Card>
        <Header>Stations &amp; prep flow</Header>
        <div className="mt-3 space-y-4">
          <Toggle
            title="Kiosk enabled"
            description="Self-service kiosk stations."
            value={draft.kiosk.enabled}
            onChange={(v) => patch({ kiosk: { ...draft.kiosk, enabled: v } })}
          />
          {draft.kiosk.enabled && (
            <div>
              <label className={labelClass}>Kiosk idle text</label>
              <input
                className={fieldClass}
                maxLength={160}
                value={draft.kiosk.idleText || ''}
                onChange={(e) => patch({ kiosk: { ...draft.kiosk, idleText: e.target.value } })}
                placeholder="Tap to start your order"
              />
            </div>
          )}
          <Toggle
            title="Register enabled"
            description="Staff-operated register stations."
            value={draft.register.enabled}
            onChange={(v) => patch({ register: { enabled: v } })}
          />
          <Toggle
            title="Require claim"
            description="Orders must be claimed before completion (claim → complete)."
            value={draft.prepFlow.requireClaim}
            onChange={(v) => patch({ prepFlow: { ...draft.prepFlow, requireClaim: v } })}
          />
          <Toggle
            title="Awaiting-pickup step"
            description="Insert an awaiting-customer step before handover."
            value={draft.prepFlow.awaitingPickupStep}
            onChange={(v) => patch({ prepFlow: { ...draft.prepFlow, awaitingPickupStep: v } })}
          />
        </div>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Markdown } from '~/components/Markdown';
import {
  ApplicationMethod,
  JobPostingTag,
  JOB_POSTING_TAGS,
} from '~/services/NewMongoTypes/JobPosting.type';
import { trpc } from '~/utils/trpc';

export type PostingFormValue = {
  title: string;
  shortSummary: string;
  description: string;
  requirements: string[];
  tags: JobPostingTag[];
  compensation?: {
    type: 'robux' | 'usd' | 'unpaid' | 'other';
    amount?: string;
    period?: 'one-time' | 'weekly' | 'biweekly' | 'monthly';
  };
  applicationMethods: ApplicationMethod[];
  visibility: 'public' | 'unlisted';
  opensAt?: string;
  closesAt?: string;
};

export const EMPTY_POSTING: PostingFormValue = {
  title: '',
  shortSummary: '',
  description: '',
  requirements: [],
  tags: [],
  compensation: { type: 'unpaid' },
  applicationMethods: [],
  visibility: 'public',
};

const METHOD_LABELS: Record<ApplicationMethod['type'], string> = {
  readmin_application: 'ReAdmin Application Form',
  readmin_resume: 'ReAdmin Resume (one-click apply)',
  contact_info: 'Submit contact info',
  roblox_game: 'Apply via Roblox game',
  discord_guild: 'Apply via Discord server',
  google_form: 'Apply via Google Form',
  external_link: 'External link',
};

export function PostingForm({
  value,
  onChange,
  groupId,
}: {
  value: PostingFormValue;
  onChange: (next: PostingFormValue) => void;
  groupId: string;
}) {
  const [reqDraft, setReqDraft] = useState('');
  const [descPreview, setDescPreview] = useState(false);
  const { data: applications } =
    trpc.workspaces.workspace.forms.applications.getApplications.useQuery({ groupId });

  function update<K extends keyof PostingFormValue>(key: K, v: PostingFormValue[K]) {
    onChange({ ...value, [key]: v });
  }

  function toggleTag(tag: JobPostingTag) {
    update('tags', value.tags.includes(tag) ? value.tags.filter((t) => t !== tag) : [...value.tags, tag]);
  }

  function addMethod(type: ApplicationMethod['type']) {
    let method: ApplicationMethod;
    switch (type) {
      case 'readmin_application':
        method = { type: 'readmin_application', applyOnlineId: '' };
        break;
      case 'readmin_resume':
        method = { type: 'readmin_resume' };
        break;
      case 'contact_info':
        method = { type: 'contact_info', prompt: '' };
        break;
      case 'roblox_game':
        method = { type: 'roblox_game', gameUrl: '', gameId: '', instructions: '' };
        break;
      case 'discord_guild':
        method = { type: 'discord_guild', inviteUrl: '', instructions: '' };
        break;
      case 'google_form':
        method = { type: 'google_form', url: '', instructions: '' };
        break;
      case 'external_link':
        method = { type: 'external_link', url: '', label: '' };
        break;
    }
    update('applicationMethods', [...value.applicationMethods, method]);
  }

  function updateMethod(idx: number, patch: Partial<ApplicationMethod>) {
    update(
      'applicationMethods',
      value.applicationMethods.map((m, i) => (i === idx ? ({ ...m, ...patch } as ApplicationMethod) : m)),
    );
  }

  function removeMethod(idx: number) {
    update(
      'applicationMethods',
      value.applicationMethods.filter((_, i) => i !== idx),
    );
  }

  function addReq() {
    const r = reqDraft.trim();
    if (!r) return;
    update('requirements', [...value.requirements, r]);
    setReqDraft('');
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
        <h3 className="font-semibold">Basic info</h3>
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={value.title}
            onChange={(e) => update('title', e.target.value)}
            maxLength={100}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Short summary</label>
          <input
            type="text"
            value={value.shortSummary}
            onChange={(e) => update('shortSummary', e.target.value)}
            maxLength={240}
            placeholder="One-line description shown on cards"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium">Description</label>
            <button
              type="button"
              onClick={() => setDescPreview((p) => !p)}
              className="text-xs text-blue-600 hover:underline"
            >
              {descPreview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {descPreview ? (
            <div className="min-h-[150px] border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900">
              {value.description.trim() ? (
                <Markdown>{value.description}</Markdown>
              ) : (
                <p className="text-sm text-gray-400">Nothing to preview yet.</p>
              )}
            </div>
          ) : (
            <textarea
              rows={6}
              value={value.description}
              onChange={(e) => update('description', e.target.value)}
              maxLength={5000}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
            />
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Supports Markdown — **bold**, *italic*, # headings, - lists, and [links](https://example.com).
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
        <h3 className="font-semibold">Tags</h3>
        <div className="flex flex-wrap gap-1.5">
          {JOB_POSTING_TAGS.map((tag) => {
            const active = value.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`text-xs px-2 py-1 rounded-full border transition ${
                  active
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
        <h3 className="font-semibold">Requirements</h3>
        <ul className="space-y-1">
          {value.requirements.map((r, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm">
              <span className="flex-1">• {r}</span>
              <button
                type="button"
                onClick={() =>
                  update(
                    'requirements',
                    value.requirements.filter((_, i) => i !== idx),
                  )
                }
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            type="text"
            value={reqDraft}
            onChange={(e) => setReqDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addReq())}
            placeholder="Add a requirement..."
            className="flex-1 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
          />
          <button
            type="button"
            onClick={addReq}
            className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm px-3 py-2 rounded-md"
          >
            Add
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
        <h3 className="font-semibold">Compensation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <select
            value={value.compensation?.type || 'unpaid'}
            onChange={(e) =>
              update('compensation', {
                ...(value.compensation || { type: 'unpaid' }),
                type: e.target.value as 'robux' | 'usd' | 'unpaid' | 'other',
              })
            }
            className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
          >
            <option value="unpaid">Volunteer / unpaid</option>
            <option value="robux">Robux</option>
            <option value="usd">USD</option>
            <option value="other">Other</option>
          </select>
          {value.compensation?.type !== 'unpaid' && (
            <>
              <input
                type="text"
                placeholder="Amount (e.g. 500 or 5-10)"
                value={value.compensation?.amount || ''}
                onChange={(e) =>
                  update('compensation', { ...(value.compensation || { type: 'unpaid' }), amount: e.target.value })
                }
                className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
              />
              <select
                value={value.compensation?.period || ''}
                onChange={(e) =>
                  update('compensation', {
                    ...(value.compensation || { type: 'unpaid' }),
                    period: (e.target.value || undefined) as 'one-time' | 'weekly' | 'biweekly' | 'monthly' | undefined,
                  })
                }
                className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
              >
                <option value="">No period</option>
                <option value="one-time">One-time</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Application methods</h3>
          <select
            onChange={(e) => {
              if (e.target.value) {
                addMethod(e.target.value as ApplicationMethod['type']);
                e.currentTarget.value = '';
              }
            }}
            value=""
            className="text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-900"
          >
            <option value="">+ Add method</option>
            {(Object.keys(METHOD_LABELS) as ApplicationMethod['type'][]).map((t) => (
              <option key={t} value={t}>
                {METHOD_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        {value.applicationMethods.length === 0 && (
          <p className="text-sm text-gray-500">Add at least one application method.</p>
        )}
        <div className="space-y-3">
          {value.applicationMethods.map((m, idx) => (
            <div key={idx} className="border border-gray-200 dark:border-gray-800 rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{METHOD_LABELS[m.type]}</span>
                <button
                  type="button"
                  onClick={() => removeMethod(idx)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
              {m.type === 'readmin_application' && (
                <select
                  value={m.applyOnlineId}
                  onChange={(e) => updateMethod(idx, { applyOnlineId: e.target.value } as Partial<ApplicationMethod>)}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                >
                  <option value="">— Select an application form —</option>
                  {(applications || [])
                    .filter((a: { applyOnlineId?: string }) => a.applyOnlineId)
                    //@ts-expect-error
                    .map((a: { applyOnlineId?: string; name: string; _id: { toString(): string } }) => (
                      <option key={a._id.toString()} value={a.applyOnlineId}>
                        {a.name}
                      </option>
                    ))}
                </select>
              )}
              {m.type === 'contact_info' && (
                <input
                  type="text"
                  placeholder="Prompt shown to applicant (optional)"
                  value={m.prompt || ''}
                  onChange={(e) => updateMethod(idx, { prompt: e.target.value } as Partial<ApplicationMethod>)}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                />
              )}
              {m.type === 'roblox_game' && (
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="Roblox game URL"
                    value={m.gameUrl}
                    onChange={(e) => updateMethod(idx, { gameUrl: e.target.value } as Partial<ApplicationMethod>)}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Instructions (optional)"
                    value={m.instructions || ''}
                    onChange={(e) =>
                      updateMethod(idx, { instructions: e.target.value } as Partial<ApplicationMethod>)
                    }
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                  />
                </div>
              )}
              {m.type === 'discord_guild' && (
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="Discord invite URL"
                    value={m.inviteUrl}
                    onChange={(e) => updateMethod(idx, { inviteUrl: e.target.value } as Partial<ApplicationMethod>)}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Instructions (optional)"
                    value={m.instructions || ''}
                    onChange={(e) =>
                      updateMethod(idx, { instructions: e.target.value } as Partial<ApplicationMethod>)
                    }
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                  />
                </div>
              )}
              {m.type === 'external_link' && (
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="URL"
                    value={m.url}
                    onChange={(e) => updateMethod(idx, { url: e.target.value } as Partial<ApplicationMethod>)}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Button label (optional)"
                    value={m.label || ''}
                    onChange={(e) => updateMethod(idx, { label: e.target.value } as Partial<ApplicationMethod>)}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                  />
                </div>
              )}
              {m.type === 'google_form' && (
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="Google Form URL (docs.google.com/forms/... or forms.gle/...)"
                    value={m.url}
                    onChange={(e) => updateMethod(idx, { url: e.target.value } as Partial<ApplicationMethod>)}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Instructions (optional)"
                    value={m.instructions || ''}
                    onChange={(e) =>
                      updateMethod(idx, { instructions: e.target.value } as Partial<ApplicationMethod>)
                    }
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Note: ReAdmin can&apos;t track submissions made through Google Forms.
                  </p>
                </div>
              )}
              {m.type === 'readmin_resume' && (
                <p className="text-xs text-gray-500">
                  Applicants who have built a ReAdmin Resume will be able to apply with one click.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
        <h3 className="font-semibold">Visibility</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Visibility</label>
            <select
              value={value.visibility}
              onChange={(e) => update('visibility', e.target.value as PostingFormValue['visibility'])}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
            >
              <option value="public">Public — listed on board</option>
              <option value="unlisted">Unlisted — link only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Opens at (optional)</label>
            <input
              type="datetime-local"
              value={value.opensAt || ''}
              onChange={(e) => update('opensAt', e.target.value || undefined)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Hidden from the public board until this time.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Closes at (optional)</label>
            <input
              type="datetime-local"
              value={value.closesAt || ''}
              onChange={(e) => update('closesAt', e.target.value || undefined)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

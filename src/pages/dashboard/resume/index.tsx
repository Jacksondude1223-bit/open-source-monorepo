/* eslint-disable @next/next/no-img-element */
import { ReactElement, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { DashboardLayout } from '~/components/page_components/DashboardLayout';
import { trpc } from '~/utils/trpc';

type WorkEntry = {
  _id: string;
  groupId?: string;
  groupName: string;
  groupIconUrl?: string;
  position: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  isVerified?: boolean;
};

function genId() {
  return Math.random().toString(36).slice(2, 12);
}

export default function ResumePage() {
  const { data: existing, isLoading, refetch } = trpc.resume.getMine.useQuery();
  const upsert = trpc.resume.upsert.useMutation({
    onSuccess: () => {
      toast.success('Resume saved');
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.resume.delete.useMutation({
    onSuccess: () => {
      toast.success('Resume deleted');
      refetch();
    },
  });

  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState('');
  const [slug, setSlug] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [showRoblox, setShowRoblox] = useState(true);
  const [showDiscord, setShowDiscord] = useState(false);
  const [allowDM, setAllowDM] = useState(false);
  const [workHistory, setWorkHistory] = useState<WorkEntry[]>([]);

  useEffect(() => {
    if (!existing) return;
    setHeadline(existing.headline || '');
    setBio(existing.bio || '');
    setSkills(existing.skills || []);
    setSlug(existing.slug || '');
    setIsPublic(existing.isPublic);
    setShowRoblox(existing.contactPreferences.showRoblox);
    setShowDiscord(existing.contactPreferences.showDiscord);
    setAllowDM(existing.contactPreferences.allowDirectMessages);
    setWorkHistory(
      (existing.workHistory || []).map((w) => ({
        _id: w._id || genId(),
        groupId: w.groupId,
        groupName: w?.groupName,
        groupIconUrl: w.groupIconUrl,
        position: w.position,
        startDate: w.startDate ? new Date(w.startDate).toISOString().slice(0, 10) : undefined,
        endDate: w.endDate ? new Date(w.endDate).toISOString().slice(0, 10) : undefined,
        description: w.description,
        isVerified: w.isVerified,
      })),
    );
  }, [existing]);

  const previewHeadline = useMemo(() => headline || 'Your headline goes here', [headline]);

  if (isLoading) return <LoadingPage />;

  function addWorkEntry() {
    setWorkHistory((p) => [
      ...p,
      { _id: genId(), groupName: '', position: '', isVerified: false },
    ]);
  }

  function updateEntry(id: string, patch: Partial<WorkEntry>) {
    setWorkHistory((p) => p.map((e) => (e._id === id ? { ...e, ...patch } : e)));
  }

  function removeEntry(id: string) {
    setWorkHistory((p) => p.filter((e) => e._id !== id));
  }

  function addSkill() {
    const s = skillDraft.trim();
    if (!s) return;
    if (skills.includes(s)) return;
    setSkills((p) => [...p, s]);
    setSkillDraft('');
  }

  function save() {
    upsert.mutate({
      headline: headline || undefined,
      bio: bio || undefined,
      skills,
      slug: slug || null,
      isPublic,
      contactPreferences: {
        showRoblox,
        showDiscord,
        allowDirectMessages: allowDM,
      },
      workHistory: workHistory.map((w) => ({
        _id: w._id,
        groupId: w.groupId || undefined,
        groupName: w?.groupName || 'Unknown',
        groupIconUrl: w.groupIconUrl,
        position: w.position,
        startDate: w.startDate ? new Date(w.startDate) : undefined,
        endDate: w.endDate ? new Date(w.endDate) : undefined,
        description: w.description,
      })),
    });
  }

  return (
    <>
      <PageHeading
        title="My ReAdmin Resume"
        description="Build a portable profile to apply to staff postings with one click."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
        {/* Editor */}
        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h2 className="font-semibold mb-3">Profile</h2>
            <label className="block text-sm font-medium mb-1">Headline</label>
            <input
              type="text"
              value={headline}
              maxLength={160}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Experienced Moderation Lead"
              className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm mb-3"
            />
            <label className="block text-sm font-medium mb-1">Bio</label>
            <textarea
              rows={4}
              maxLength={300}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm mb-3"
            />
            <label className="block text-sm font-medium mb-1">Skills</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {skills.map((s) => (
                <span key={s} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full flex items-center gap-1">
                  {s}
                  <button
                    onClick={() => setSkills((p) => p.filter((x) => x !== s))}
                    className="hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillDraft}
                onChange={(e) => setSkillDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="Add a skill..."
                className="flex-1 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
              />
              <button
                onClick={addSkill}
                className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm px-3 py-2 rounded-md"
              >
                Add
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Work History</h2>
              <button
                onClick={addWorkEntry}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-md font-medium"
              >
                + Add entry
              </button>
            </div>
            {workHistory.length === 0 && (
              <p className="text-sm text-gray-500">No work history yet.</p>
            )}
            <div className="space-y-4">
              {workHistory.map((w) => (
                <div key={w._id} className="border border-gray-200 dark:border-gray-800 rounded-md p-3 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Group name"
                      value={w?.groupName}
                      onChange={(e) => updateEntry(w._id, { groupName: e.target.value })}
                      className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Position / title"
                      value={w.position}
                      onChange={(e) => updateEntry(w._id, { position: e.target.value })}
                      className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Roblox group ID (optional, for verification)"
                      value={w.groupId || ''}
                      onChange={(e) => updateEntry(w._id, { groupId: e.target.value || undefined })}
                      className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={w.startDate || ''}
                        onChange={(e) => updateEntry(w._id, { startDate: e.target.value })}
                        className="border border-gray-300 dark:border-gray-700 rounded-md px-2 py-2 bg-white dark:bg-gray-900 text-sm"
                      />
                      <input
                        type="date"
                        value={w.endDate || ''}
                        onChange={(e) => updateEntry(w._id, { endDate: e.target.value })}
                        className="border border-gray-300 dark:border-gray-700 rounded-md px-2 py-2 bg-white dark:bg-gray-900 text-sm"
                      />
                    </div>
                  </div>
                  <textarea
                    placeholder="Description (optional)"
                    rows={2}
                    value={w.description || ''}
                    onChange={(e) => updateEntry(w._id, { description: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                  />
                  <div className="flex justify-between items-center">
                    {w.isVerified ? (
                      <span className="text-xs text-green-600 dark:text-green-400">✓ Verified via ReAdmin</span>
                    ) : (
                      <span className="text-xs text-gray-500">Not verified</span>
                    )}
                    <button
                      onClick={() => removeEntry(w._id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h2 className="font-semibold mb-3">Visibility & Contact</h2>
            <label className="flex items-center gap-2 mb-2 text-sm">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              Make my resume public
            </label>
            <label className="block text-sm font-medium mb-1 mt-3">Custom URL slug (optional)</label>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-gray-500">/resume/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="my-name"
                className="flex-1 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
              />
            </div>
            <div className="mt-4 space-y-1.5">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showRoblox} onChange={(e) => setShowRoblox(e.target.checked)} />
                Show my Roblox account on my public resume
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showDiscord} onChange={(e) => setShowDiscord(e.target.checked)} />
                Show my Discord account on my public resume
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allowDM} onChange={(e) => setAllowDM(e.target.checked)} />
                Allow direct messages from recruiters
              </label>
            </div>
          </section>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={upsert.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md disabled:opacity-60"
            >
              {upsert.isPending ? 'Saving…' : 'Save resume'}
            </button>
            {existing && (
              <button
                onClick={() => {
                  if (confirm('Delete your resume? This cannot be undone.')) {
                    del.mutate();
                  }
                }}
                className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 font-medium px-4 py-2 rounded-md"
              >
                Delete resume
              </button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-6 self-start">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-3">Preview</div>
            <h2 className="text-xl font-bold">{previewHeadline}</h2>
            {bio && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{bio}</p>}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {skills.map((s) => (
                  <span key={s} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-2">Work History</h3>
              {workHistory.length === 0 ? (
                <p className="text-xs text-gray-500">No entries yet.</p>
              ) : (
                <ul className="space-y-3">
                  {workHistory.map((w) => (
                    <li key={w._id} className="border-l-2 border-gray-200 dark:border-gray-800 pl-3">
                      <div className="font-medium text-sm">{w.position || '(position)'}</div>
                      <div className="text-xs text-gray-500">
                        {w?.groupName || '(group)'}
                        {w.startDate && (
                          <>
                            {' · '}
                            {w.startDate}
                            {' — '}
                            {w.endDate || 'Present'}
                          </>
                        )}
                      </div>
                      {w.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{w.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

ResumePage.getLayout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>;

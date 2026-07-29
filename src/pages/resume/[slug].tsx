/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import { useUser } from '~/components/contexts/user';
import { PostingsPublicLayout } from '~/components/page_components/PostingsPublicLayout';
import { trpc } from '~/utils/trpc';

function ReportButton({ resumeId }: { resumeId: string }) {
  const user = useUser();
  const isLoggedIn = 'loggedIn' in user && user.loggedIn === true;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<'spam' | 'inappropriate' | 'misleading' | 'other'>('spam');
  const [details, setDetails] = useState('');
  const report = trpc.resume.report.useMutation({
    onSuccess: () => {
      toast.success('Reported. Thanks for letting us know.');
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isLoggedIn) return null;
  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-gray-500 hover:text-red-600 underline"
        >
          Report this resume
        </button>
      ) : (
        <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3 space-y-2 bg-white dark:bg-gray-900">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
            className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900"
          >
            <option value="spam">Spam</option>
            <option value="inappropriate">Inappropriate</option>
            <option value="misleading">Misleading</option>
            <option value="other">Other</option>
          </select>
          <textarea
            placeholder="Details (optional)"
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900"
          />
          <div className="flex gap-2">
            <button
              onClick={() => report.mutate({ resumeId, reason, details: details || undefined })}
              disabled={report.isPending}
              className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5 rounded-md font-medium disabled:opacity-60"
            >
              Submit report
            </button>
            <button
              onClick={() => setOpen(false)}
              className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm px-3 py-1.5 rounded-md font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublicResumePage() {
  const router = useRouter();
  const slugOrId = (router.query.slug as string) || '';

  // Determine if it's a numeric robloxId or a slug
  const isNumeric = /^\d+$/.test(slugOrId);
  const input = isNumeric ? { robloxId: slugOrId } : { slug: slugOrId };

  const { data, isLoading, error } = trpc.resume.getPublic.useQuery(input, {
    enabled: !!slugOrId,
  });

  if (isLoading) return <div className="text-gray-500 py-12 text-center">Loading…</div>;
  if (error || !data) {
    return (
      <div className="text-center py-12">
        <h1 className="text-xl font-bold mb-2">Resume not found</h1>
        <p className="text-sm text-gray-500">
          This resume does not exist, or is not currently public.
        </p>
        <Link href="/postings" className="text-blue-600 hover:underline text-sm mt-4 inline-block">
          ← Browse job postings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-start gap-4 flex-wrap">
          {data.robloxUser?.thumbnailUrl ? (
            <img
              src={data.robloxUser.thumbnailUrl}
              alt=""
              className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{data.headline || 'ReAdmin Resume'}</h1>
            {data.robloxUser && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {data.contactPreferences.showRoblox && data.robloxId ? (
                  <a
                    href={`https://www.roblox.com/users/${data.robloxId}/profile`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    <span className="font-medium">{data.robloxUser.displayName}</span>
                    <span className="text-gray-500"> @{data.robloxUser.username}</span>
                  </a>
                ) : (
                  <>
                    <span className="font-medium">{data.robloxUser.displayName}</span>
                    <span className="text-gray-500"> @{data.robloxUser.username}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.verifiedBadges?.map((b) => {
              const label =
                b.type === 'applications_passed'
                  ? `${b.count} application${b.count === 1 ? '' : 's'} passed`
                  : '';
              if (!label) return null;
              return (
                <span
                  key={b.type}
                  className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  title={label}
                >
                  ✓ {label}
                </span>
              );
            })}
          </div>
        </div>

        {data.bio && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 whitespace-pre-wrap">
            {data.bio}
          </p>
        )}

        {(data.skills?.length || 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {data.skills.map((s) => (
              <span
                key={s}
                className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {data.contactPreferences.showRoblox && data.robloxId && (
            <div>
              <span className="text-gray-500">Roblox: </span>
              <a
                href={`https://www.roblox.com/users/${data.robloxId}/profile`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                View profile
              </a>
            </div>
          )}
          {data.contactPreferences.showDiscord && data.discordId && (
            <div>
              <span className="text-gray-500">Discord ID: </span>
              <span>{data.discordId}</span>
            </div>
          )}
        </div>
      </div>

      {(data.workHistory?.length || 0) > 0 && (
        <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-lg font-semibold mb-4">Work History</h2>
          <ul className="space-y-4">
            {data.workHistory.map((w, idx) => (
              <li
                key={w._id || idx}
                className="border-l-2 border-blue-200 dark:border-blue-800 pl-4"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{w.position}</span>
                  {w.isVerified && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                      title="Verified via ReAdmin"
                    >
                      ✓ Verified
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {w?.groupName}
                  {w.startDate && (
                    <>
                      {' · '}
                      {new Date(w.startDate).toLocaleDateString()}
                      {' — '}
                      {w.endDate ? new Date(w.endDate).toLocaleDateString() : 'Present'}
                    </>
                  )}
                </div>
                {w.description && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                    {w.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <ReportButton resumeId={data._id!.toString()} />
      </div>
    </div>
  );
}

PublicResumePage.getLayout = (page: ReactElement) => <PostingsPublicLayout>{page}</PostingsPublicLayout>;

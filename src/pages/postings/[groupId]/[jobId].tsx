/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import type { GetServerSideProps } from 'next';
import { useUser } from '~/components/contexts/user';
import { Markdown } from '~/components/Markdown';
import {
  PostingsPublicLayout,
  POSTINGS_SITE_BASE,
  type PostingsSeo,
} from '~/components/page_components/PostingsPublicLayout';
import { ApplicationMethod } from '~/services/NewMongoTypes/JobPosting.type';
import { caller } from '~/server/routers/_app';
import { trpc } from '~/utils/trpc';

type SubmissionType = 'readmin_application' | 'readmin_resume' | 'contact_info';

function ApplyPanel({
  groupId,
  jobId,
  methods,
  onApplied,
}: {
  groupId: string;
  jobId: string;
  methods: ApplicationMethod[];
  onApplied: () => void;
}) {
  const user = useUser();
  const isLoggedIn = 'loggedIn' in user && user.loggedIn === true;

  const utils = trpc.useUtils();
  const apply = trpc.postings.applyToPosting.useMutation({
    onSuccess: () => {
      toast.success('Application submitted!');
      utils.postings.myActiveAppliedJobIds.invalidate();
      utils.postings.getMyApplications.invalidate();
      onApplied();
    },
    onError: (e) => toast.error(e.message),
  });

  const [contactInfo, setContactInfo] = useState({
    robloxUsername: '',
    discordUsername: '',
    message: '',
  });

  if (!isLoggedIn) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h3 className="font-semibold mb-2">Log in to apply</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          You need a ReAdmin account to apply to this posting.
        </p>
        <Link
          href={`/login?state=${encodeURIComponent(`/postings/${groupId}/${jobId}`)}`}
          className="block text-center bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
      <h3 className="font-semibold">Apply</h3>
      {methods.map((m, idx) => (
        <div key={idx} className="border-t border-gray-100 dark:border-gray-800 pt-4 first:border-0 first:pt-0">
          {m.type === 'readmin_application' && (
            <Link
              href={`/apply/${m.applyOnlineId}`}
              className="block text-center bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition"
            >
              Take application form
            </Link>
          )}

          {m.type === 'readmin_resume' && (
            <button
              disabled={apply.isPending}
              onClick={() =>
                apply.mutate({ jobId, submissionType: 'readmin_resume' as SubmissionType })
              }
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition disabled:opacity-60"
            >
              {apply.isPending ? 'Submitting…' : 'Submit my ReAdmin Resume'}
            </button>
          )}

          {m.type === 'contact_info' && (
            <div className="space-y-2">
              {m.prompt && <p className="text-sm text-gray-600 dark:text-gray-400">{m.prompt}</p>}
              <input
                type="text"
                placeholder="Roblox username"
                value={contactInfo.robloxUsername}
                onChange={(e) => setContactInfo((p) => ({ ...p, robloxUsername: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900"
              />
              <input
                type="text"
                placeholder="Discord username"
                value={contactInfo.discordUsername}
                onChange={(e) => setContactInfo((p) => ({ ...p, discordUsername: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900"
              />
              <textarea
                placeholder="Optional cover note"
                value={contactInfo.message}
                onChange={(e) => setContactInfo((p) => ({ ...p, message: e.target.value }))}
                rows={3}
                className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900"
              />
              <button
                disabled={apply.isPending}
                onClick={() =>
                  apply.mutate({
                    jobId,
                    submissionType: 'contact_info' as SubmissionType,
                    contactInfo,
                  })
                }
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition disabled:opacity-60"
              >
                Submit contact info
              </button>
            </div>
          )}

          {m.type === 'roblox_game' && (
            <div className="space-y-2">
              {m.instructions && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.instructions}</p>
              )}
              <a
                href={m.gameUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition"
              >
                Apply in Roblox game →
              </a>
            </div>
          )}

          {m.type === 'discord_guild' && (
            <div className="space-y-2">
              {m.instructions && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.instructions}</p>
              )}
              <a
                href={m.inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-md transition"
              >
                Join Discord to apply →
              </a>
            </div>
          )}

          {m.type === 'google_form' && (
            <div className="space-y-2">
              {m.instructions && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.instructions}</p>
              )}
              <a
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-md transition"
              >
                Open Google Form →
              </a>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Submissions made on Google Forms are not tracked by ReAdmin.
              </p>
            </div>
          )}

          {m.type === 'external_link' && (
            <a
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center bg-gray-700 hover:bg-gray-800 text-white font-medium px-4 py-2 rounded-md transition"
            >
              {m.label || 'Apply via external link'} →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function ReportButton({ jobId }: { jobId: string }) {
  const user = useUser();
  const isLoggedIn = 'loggedIn' in user && user.loggedIn === true;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<'spam' | 'inappropriate' | 'misleading' | 'other'>('spam');
  const [details, setDetails] = useState('');
  const report = trpc.postings.public.report.useMutation({
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
          Report this posting
        </button>
      ) : (
        <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3 mt-2 space-y-2 bg-white dark:bg-gray-900">
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
              onClick={() => report.mutate({ jobId, reason, details: details || undefined })}
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

export default function PostingDetailPage({ seo }: { seo: PostingsSeo | null }) {
  const router = useRouter();
  const jobId = (router.query.jobId as string) || '';
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = trpc.postings.public.getById.useQuery(
    { jobId },
    { enabled: !!jobId },
  );

  const detailUser = useUser();
  const isLoggedIn = 'loggedIn' in detailUser && detailUser.loggedIn === true;
  const appliedQuery = trpc.postings.myActiveAppliedJobIds.useQuery(undefined, {
    enabled: isLoggedIn,
  });
  const alreadyApplied = !!appliedQuery.data && appliedQuery.data.includes(jobId);

  if (isLoading) {
    return (
      <PostingsPublicLayout seo={seo ?? undefined}>
        <div className="text-gray-500 py-12 text-center">Loading…</div>
      </PostingsPublicLayout>
    );
  }
  if (error) {
    return (
      <PostingsPublicLayout seo={{ title: 'Posting not found — ReAdmin Postings', noindex: true }}>
        <div className="text-center py-12">
          <h1 className="text-xl font-bold mb-2">Posting not found</h1>
          <p className="text-sm text-gray-500">{error.message}</p>
          <Link href="/postings" className="text-blue-600 hover:underline text-sm mt-4 inline-block">
            ← Back to all postings
          </Link>
        </div>
      </PostingsPublicLayout>
    );
  }
  if (!data) return null;

  const isClosed = data.status !== 'active' || (data.closesAt && new Date(data.closesAt) < new Date());
  const isScheduled = !!(data.opensAt && new Date(data.opensAt) > new Date());

  return (
    <PostingsPublicLayout
      title={data.title}
      seo={seo ?? undefined}
      branding={{
        logoUrl: data.branding?.logoUrl ?? null,
        brandColor: data.branding?.brandColor ?? null,
        groupName: data.group.name,
        href: `/postings/${data.groupId}`,
      }}
    >
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
      <div>
        <Link href={`/postings/${data.groupId}`} className="text-sm text-blue-600 hover:underline">
          ← {data.group.name}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-2 mb-2">{data.title}</h1>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {data.tags.map((t) => (
            <span
              key={t}
              className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            >
              {t}
            </span>
          ))}
        </div>

        {isClosed && (
          <div className="mb-4 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm text-yellow-800 dark:text-yellow-200">
            This posting is no longer accepting applications.
          </div>
        )}

        {!isClosed && isScheduled && (
          <div className="mb-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-800 dark:text-blue-200">
            This posting opens on {new Date(data.opensAt as Date).toLocaleString()}. You won&apos;t be
            able to apply until then.
          </div>
        )}

        <p className="text-base text-gray-700 dark:text-gray-300 mb-6 whitespace-pre-wrap">
          {data.shortSummary}
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">Description</h2>
        <Markdown>{data.description}</Markdown>

        {data.requirements.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mt-6 mb-2">Requirements</h2>
            <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
              {data.requirements.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-800">
          <ReportButton jobId={jobId} />
        </div>
      </div>

      <aside>
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-4">
          <Link href={`/postings/${data.groupId}`} className="flex items-center gap-3 hover:opacity-80">
            {data.group.icon ? (
              <img src={data.group.icon} alt="" className="h-10 w-10 rounded-full bg-gray-200" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{data.group.name}</div>
              {data.group.memberCount !== undefined && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {data.group.memberCount.toLocaleString()} members
                </div>
              )}
            </div>
          </Link>
        </div>

        {data.compensation && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-4 text-sm">
            <div className="text-gray-500 dark:text-gray-400 mb-1">Compensation</div>
            <div className="font-medium">
              {data.compensation.type === 'unpaid'
                ? 'Volunteer'
                : `${data.compensation.type === 'robux' ? 'R$' : data.compensation.type === 'usd' ? '$' : ''}${data.compensation.amount || 'TBD'}${data.compensation.period ? ` · ${data.compensation.period}` : ''}`}
            </div>
          </div>
        )}

        {!isClosed && !isScheduled && !submitted && !alreadyApplied && (
          <ApplyPanel
            groupId={data.groupId}
            jobId={jobId}
            methods={data.applicationMethods}
            onApplied={() => setSubmitted(true)}
          />
        )}
        {!isClosed && isScheduled && (
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-5 text-sm text-blue-800 dark:text-blue-200">
            Applications open on{' '}
            <span className="font-medium">{new Date(data.opensAt as Date).toLocaleString()}</span>.
          </div>
        )}
        {!submitted && alreadyApplied && (
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-5 text-sm text-blue-800 dark:text-blue-200">
            You&apos;ve already applied to this posting. Track its status in your{' '}
            <Link href="/dashboard/job-applications" className="underline">
              applications
            </Link>
            .
          </div>
        )}
        {submitted && (
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-5 text-sm text-green-800 dark:text-green-200">
            Your application has been submitted. You can track its status in your{' '}
            <Link href="/dashboard/job-applications" className="underline">
              dashboard
            </Link>
            .
          </div>
        )}
      </aside>
    </div>
    </PostingsPublicLayout>
  );
}

PostingDetailPage.getLayout = (page: ReactElement) => page;

export const getServerSideProps: GetServerSideProps<{ seo: PostingsSeo | null }> = async (context) => {
  const jobId = (context.params?.jobId as string) || '';
  try {
    const data = await caller.postings.public.getById({ jobId });
    const canonicalPath = `/postings/${data.groupId}/${jobId}`;
    const canonical = `${POSTINGS_SITE_BASE}${canonicalPath}`;
    const isClosed =
      data.status !== 'active' || (!!data.closesAt && new Date(data.closesAt) < new Date());
    const description =
      (data.shortSummary || '').slice(0, 200) ||
      `Apply to ${data.title} at ${data.group.name} on the ReAdmin job board.`;

    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: data.title,
      description: data.description || data.shortSummary || data.title,
      datePosted: new Date(data.createdAt).toISOString(),
      directApply: true,
      url: canonical,
      hiringOrganization: {
        '@type': 'Organization',
        name: data.group.name,
        ...(data.group.icon ? { logo: data.group.icon } : {}),
      },
    };
    const employmentType = data.tags?.includes('Full-time')
      ? 'FULL_TIME'
      : data.tags?.includes('Part-time')
        ? 'PART_TIME'
        : null;
    if (employmentType) jsonLd.employmentType = employmentType;
    if (data.closesAt) jsonLd.validThrough = new Date(data.closesAt).toISOString();
    if (data.compensation?.type === 'usd' && data.compensation.amount) {
      jsonLd.baseSalary = {
        '@type': 'MonetaryAmount',
        currency: 'USD',
        value: {
          '@type': 'QuantitativeValue',
          value: data.compensation.amount,
          unitText: 'MONTH',
        },
      };
    }

    return {
      props: {
        seo: {
          title: `${data.title} at ${data.group.name} — ReAdmin Postings`,
          description,
          canonicalPath,
          image: data.branding?.logoUrl || data.group.icon || null,
          noindex: data.visibility !== 'public' || isClosed,
          jsonLd,
        },
      },
    };
  } catch {
    return { props: { seo: null } };
  }
};

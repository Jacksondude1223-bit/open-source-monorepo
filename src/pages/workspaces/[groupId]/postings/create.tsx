'use client';

import { useRouter } from 'next/router';
import Link from 'next/link';
import { ReactElement, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeading from '~/components/layouts/PageHeading';
import { WorkspaceLayout } from '~/components/page_components/WorkspaceLayout';
import {
  EMPTY_POSTING,
  PostingForm,
  PostingFormValue,
} from '~/components/page_components/workspaces/postings/PostingForm';
import { trpc } from '~/utils/trpc';

export default function CreatePostingPage() {
  const router = useRouter();
  const { groupId } = router.query as { groupId: string };
  const [value, setValue] = useState<PostingFormValue>(EMPTY_POSTING);

  const create = trpc.postings.workspace.create.useMutation({
    onSuccess: (res) => {
      toast.success('Posting created');
      router.push(`/workspaces/${groupId}/postings/${res.jobId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  function submit() {
    if (!value.title || !value.shortSummary || !value.description) {
      toast.error('Title, summary and description are required.');
      return;
    }
    if (value.applicationMethods.length === 0) {
      toast.error('Add at least one application method.');
      return;
    }
    create.mutate({
      groupId,
      title: value.title,
      shortSummary: value.shortSummary,
      description: value.description,
      requirements: value.requirements,
      tags: value.tags,
      compensation: value.compensation,
      applicationMethods: value.applicationMethods,
      visibility: value.visibility,
      opensAt: value.opensAt ? new Date(value.opensAt) : null,
      closesAt: value.closesAt ? new Date(value.closesAt) : null,
    });
  }

  return (
    <>
      <PageHeading title="New job posting" description="Create a new staff recruitment posting.">
        <Link
          href={`/workspaces/${groupId}/postings`}
          className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-medium px-4 py-2 rounded-md"
        >
          Cancel
        </Link>
      </PageHeading>

      <div className="mt-6">
        <PostingForm value={value} onChange={setValue} groupId={groupId} />
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={submit}
          disabled={create.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-md disabled:opacity-60"
        >
          {create.isPending ? 'Creating…' : 'Create posting'}
        </button>
      </div>
    </>
  );
}

CreatePostingPage.getLayout = (page: ReactElement) => <WorkspaceLayout>{page}</WorkspaceLayout>;

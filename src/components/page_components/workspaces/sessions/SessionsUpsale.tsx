/* eslint-disable @next/next/no-img-element */
import { WorkspaceLayout } from "~/components/page_components/WorkspaceLayout";
import { useWorkspace } from "~/components/contexts/workspace";
import WorkspaceUpsale from "../settings/billing/Upsale";
import { JSX } from "react";

export default function SessionsUpsale({
  children
}: { children: JSX.Element }) {
  const workspace = useWorkspace();

  if (!workspace?.premium?.is) {
    return (
      <WorkspaceLayout disableMl={false}>

        <div className='flex flex-col gap-2 mt-2'>
          <h1 className='my-4 text-2xl font-bold text-center'>Advanced session logging</h1>
          <img src="https://readmin.app/app/sessions.png" className='self-center align-middle max-h-[500px]  rounded-lg shadow-lg border border-gray-500' alt="activity upsale image" />
          <WorkspaceUpsale />
        </div>

      </WorkspaceLayout>
    )
  }

  return (
    <WorkspaceLayout>
      {children}
    </WorkspaceLayout>
  )
}
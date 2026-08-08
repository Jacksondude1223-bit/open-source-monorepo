/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @next/next/no-img-element */
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Fragment, ReactElement, useState } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import WorkspaceUserSidebarLayout from '~/components/page_components/workspaces/users/user/WorkspaceUserSidebarLayout';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import { Attachment } from '../../..';
import { DataGrid } from '@mui/x-data-grid';
import { PaperClipIcon, TrashIcon } from '@heroicons/react/24/outline';
import { DocumentTextIcon, NoSymbolIcon, ArrowTrendingUpIcon, ClockIcon } from '@heroicons/react/20/solid';
import Button from '~/components/forms/Button';
import StatCard from '~/components/ui/StatCard';
import toast from 'react-hot-toast';
import { getProcessedUserObjectType } from '~/services/roblox.service';
import ReactTimeago from 'react-timeago';
import CreateEmployeeHistoryModal from '~/components/page_components/workspaces/employee-history/CreateHistory.modal';
import { Dialog, DialogContent, DialogTitle, Fab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { BRAND_NAME } from '~/utils/brand';

/**
 * Evidence attached to a history record.
 *
 * This used to be a DataGridPro master-detail row that expanded underneath the
 * record. Detail panels are a paid feature, so the attachments now open in a
 * dialog instead — same evidence, one click, no licence.
 */
function EvidenceCell({ evidence }: { evidence?: string[] }) {
  const [open, setOpen] = useState(false);

  if (!evidence || evidence.length === 0) {
    return <span className="text-sm text-gray-400 dark:text-gray-500">None</span>;
  }

  return (
    <>
      <Button
        variant="discrete"
        icon={PaperClipIcon}
        onClick={() => setOpen(true)}
      >
        {`${evidence.length} file${evidence.length === 1 ? '' : 's'}`}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Evidence</DialogTitle>
        <DialogContent>
          <div className="flex flex-row flex-wrap gap-2 py-2">
            {evidence.map((attachment: string) => (
              <Attachment key={attachment} attachment={attachment} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function actionsRender(params: any) {
  const workspace = useWorkspace();
  const [deleting, setDeleting] = useState(false);

  const context = trpc.useUtils();
  const deletePunishment = trpc.workspaces.workspace.history.deleteHistory.useMutation();
  const approveHistory = trpc.workspaces.workspace.history.approvePunishment.useMutation();

  return (
    <div className='mt-2 flex flex-row gap-2 flex-wrap'>
      {workspace?.department?.permissions?.writeUps?.delete && (
        <Button onClick={() => {
          if (deleting == true) {
            const createPromise = new Promise<void>((resolve, reject) => {
              deletePunishment.mutateAsync({ groupId: workspace.groupId, punishmentId: params.row.id }).then(() => {
                resolve();
                context.workspaces.workspace.history.getHistory.invalidate({ groupId: workspace.groupId });
              }).catch(reject)
            })
            toast.promise(createPromise,
              {
                loading: 'Deleting...',
                success: 'Deleted!',
                error: 'Failed to delete',
              });
          } else {
            setDeleting(true);
            setTimeout(() => {
              setDeleting(false);
            }, 1000)
          }

        }} variant={deleting ? 'danger' : 'discrete'} icon={TrashIcon} children={deleting ? 'Are you sure?' : ''} />
      )}
      {(workspace?.department?.permissions?.writeUps?.approver && params?.row?.pendingApproval == true) && ( // this is a hacky way to check if the item is pending approval
        <Fragment>
          <Button variant='discrete_success' onClick={() => {
            const promise = new Promise<void>((resolve, reject) => {
              approveHistory.mutateAsync({ groupId: workspace.groupId, punishmentId: params.row.id }).then(() => {
                resolve();
                context.workspaces.workspace.history.getHistory.invalidate({ groupId: workspace.groupId });
              }).catch(reject)
            })
            toast.promise(promise,
              {
                loading: 'Approving...',
                success: 'Approved!',
                error: 'Failed to approve',
              });
          }}>Approve</Button>
        </Fragment>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter();
  const { groupId, userId }: { groupId: string; userId: string } =
    router.query as any;
  const workspace = useWorkspace();
  const { data: userInfo } = trpc.workspaces.workspace.activity.users.getUserBaseInfo.useQuery({ groupId, userId });

  const { data: history, isLoading } = trpc.workspaces.workspace.history.getHistory.useQuery({ groupId, userId })

  const context = trpc.useUtils();
  const [creating, setCreating] = useState(false);

  const userRender = (name: string) => {
    // eslint-disable-next-line react/display-name
    return (params: any) => {
      return (
        <Link className='flex flex-row gap-2' href={`/workspaces/${groupId}/users/${params.row[name].id}`} target="_blank">
          <img className='w-8 h-8 rounded-full' src={params.row[name].thumbnail} alt={`Thumbnail for ${params.row[name].name}`} />
          <div className="flex flex-col ml-1">
            <p className='ml-2'>{params.row[name].name} <span className='text-gray-500'>{params.row[name].displayName !== params.row[name].name ? `(${params.row[name].displayName})` : ''}</span></p>
            <p className='ml-2'>{params.row[name].id}</p>
          </div>
        </Link>
      )
    }
  };

  if (!workspace) {
    return <LoadingPage />;
  }
  if (!workspace.department.permissions.activity.view) {
    router.push(`/workspaces/${groupId}`)
    return <></>;
  }

  return (
    <>
      <Head>
        <title>{workspace?.premium?.is ? '' : `${BRAND_NAME} `}{workspace?.groupName || ''} {userInfo?.robloxInfo?.name || ''} Write Ups</title>
      </Head>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard accent="blue" icon={DocumentTextIcon} label="Total Records" loading={isLoading} value={(history?.length || 0).toLocaleString()} hint="all history" />
          <StatCard accent="amber" icon={ClockIcon} label="Write Ups" loading={isLoading} value={(history?.filter(h => h.type === 'writeup').length || 0).toLocaleString()} hint="logged" />
          <StatCard accent="rose" icon={NoSymbolIcon} label="Terminations" loading={isLoading} value={(history?.filter(h => h.type === 'termination').length || 0).toLocaleString()} hint="logged" />
          <StatCard accent="green" icon={ArrowTrendingUpIcon} label="Promotions" loading={isLoading} value={(history?.filter(h => h.type === 'promotion').length || 0).toLocaleString()} hint="logged" />
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 shadow-sm dark:border-gray-700/80">
        <DataGrid
          loading={isLoading}
          slotProps={{
            loadingOverlay: {
              variant: 'skeleton',
              noRowsVariant: 'skeleton',
            },
          }}
          className='dark:bg-gray-800'
          rows={history?.map(logItem => {
            return {
              id: logItem._id,
              recipient: logItem.userInfo as getProcessedUserObjectType,
              actioner: logItem.punisherInfo as getProcessedUserObjectType,
              reason: logItem.reason || ((logItem as any).reasonHidden ? 'Reason hidden' : ''),
              type: { promotion: 'Promotion', writeup: 'Write Up', termination: 'Termination', suspension: 'Suspension', demotion: 'Demotion' }[logItem.type],
              expires: logItem.expires,
              distribution: logItem.distribution,
              created: logItem.created,
              evidence: logItem.evidence,
              pendingApproval: logItem.pendingApproval,
            }
          }) || []} columns={[
            { field: 'recipient', headerName: 'Recipient', width: 300, valueGetter: (params: getProcessedUserObjectType) => params.name, renderCell: userRender('recipient') },
            { field: 'actioner', headerName: 'Actioner', width: 300, valueGetter: (params: getProcessedUserObjectType) => params.name, renderCell: userRender('actioner') },
            { field: 'reason', headerName: 'Reason', width: 500 },
            { field: 'type', headerName: 'Type', width: 150, renderCell: (params) => {
              const colors: Record<string, string> = {
                Promotion: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
                'Write Up': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
                Termination: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
                Suspension: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
                Demotion: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
              };
              return (<span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[params.value] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>{params.value}</span>)
            } },
            { field: 'distribution', headerName: 'Distribution', width: 100 },
            { field: 'expires', headerName: 'Expires', width: 150, renderCell: (params) => (<ReactTimeago date={params.value} />) },
            { field: 'created', headerName: 'Created', width: 150, renderCell: (params) => (<ReactTimeago date={params.value} />) },
            { field: 'evidence', headerName: 'Evidence', width: 150, sortable: false, filterable: false, renderCell: (params) => (<EvidenceCell evidence={params.value} />) },
            { field: 'actions', headerName: 'Action', width: 300, sortable: false, renderCell: actionsRender }
          ]} />
        </div>

        <CreateEmployeeHistoryModal groupId={groupId} userId={userId} open={creating} setOpen={setCreating} showPastHistory={false} />
        <Fab disabled={creating} onClick={() => { setCreating(true) }} style={{ position: 'fixed', bottom: 12, right: 12 }} color="primary" aria-label="add"><AddIcon /></Fab>



      </div>


    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <WorkspaceUserSidebarLayout>{page}</WorkspaceUserSidebarLayout>
);

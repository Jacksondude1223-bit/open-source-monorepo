/* eslint-disable @next/next/no-img-element */
import PageHeading from '~/components/layouts/PageHeading';
import Card from '~/components/ui/Card';
import MediaObject from '~/components/ui/MediaObject';
import Button from '~/components/forms/Button';
import { JSX, useState } from 'react';
import Modal from '~/components/ui/Modal';
import TextLabel from '~/components/forms/TextLabel';
import { ChatBubbleOvalLeftIcon, TrashIcon } from '@heroicons/react/20/solid';
import TextLoadingPlaceholder from '~/components/ui/TextLoadingPlaceholder';
import ReactTimeago from 'react-timeago';
import { trpc } from '~/utils/trpc';
import LoadingPage from '~/components/layouts/LoadingPage';
import toast from 'react-hot-toast';
import { useWorkspace } from '~/components/contexts/workspace';

export type UsersInactivity = {
  success: boolean;
  inactivity: Inactivity[];
};

export type Inactivity = {
  _id: string;
  groupId: string;
  userId: string;
  request: Request;
  active: boolean;
  starts: Date;
  ends: Date;
  reason: string;
  created: Date;
  user: User;
};

export type Request =
  | false
  | {
    approved: false;
    reason: string;
    adminUser: string;
    user?: User;
  }
  | {
    approved: true;
    adminUser: string;
    user?: User;
  };

export type User = {
  description: string;
  created: Date;
  isBanned: boolean;
  externalAppDisplayName: null;
  hasVerifiedBadge: boolean;
  id: number;
  name: string;
  displayName: string;
  thumbnail: string;
};

export function InactivityThing({
  groupId,
  request,
}: {
  groupId: string;
  request: Inactivity;
}) {
  const deleteMutation =
    trpc.workspaces.workspace.activity.inactivity.deleteInactivityRequest.useMutation();
  const updateMutation = trpc.workspaces.workspace.activity.inactivity.updateInactivityRequestStatus.useMutation();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const context = trpc.useUtils();
  const workspace = useWorkspace();
  const { manageInactivity } = workspace.department.permissions.activity;

  return (
    <Card className="flex flex-row justify-between">
      <MediaObject
        src={request.user.thumbnail}
        title={request.user.name}
        description={
          <p>
            {request.reason}<br />
            {' '}{new Date(request.starts) <= new Date() ? ( // Means start is before now
              <>Until </>
            ) : (
              <>
                {new Date(request.starts).toLocaleDateString()} to{' '}
              </>
            )}
            {new Date(request.ends).toLocaleDateString()}
          </p>
        }
      />
      <div className="flex flex-col gap-2">
        <div className="flex flex-row gap-2 justify-end">
          {request.request == false ? ( // The request is pending
            <>
              {manageInactivity && (<>
                <Button
                  variant="danger"
                  size="medium"
                  className="h-min self-center align-middle"
                  onClick={async () => {
                    setDeclineOpen(true);
                  }}
                >
                  Decline
                </Button>
                <Button
                  variant="primary"
                  size="medium"
                  className="h-min self-center align-middle"
                  onClick={async () => {
                    updateMutation.mutateAsync(
                      {
                        groupId,
                        id: request._id,
                        status: 'accept',
                      },
                    ).then(() => {
                      toast.success('Successfully accepted inactivity');
                      context.workspaces.workspace.activity.inactivity.getMyInactivity.invalidate({ groupId });
                      context.workspaces.workspace.activity.inactivity.getEveryonesInactivity.invalidate({ groupId });
                    }).catch(e => {
                      toast.error(`Something went wrong ${e}`)
                    })
                  }}
                >
                  Accept
                </Button>
              </>)}
            </>
          ) : request.request.approved == true ? ( // It has been approved
            <div className='flex flex-row'>
              <img
                src={request.request.user?.thumbnail}
                alt={'User Icon'}
                className="w-6 h-6 rounded-full"
              />
              <p className='w-full text-right whitespace-nowrap'>Approved by {request.request.user?.name}</p>
            </div>
          ) : (
            // It has been declined
            <div className='flex flex-row'>
              <img
                src={request.request?.user?.thumbnail}
                alt={'User Icon'}
                className="w-6 h-6 rounded-full"
              />
              <p className='w-full text-right whitespace-nowrap'>Rejected by {request.request.user?.name} for {request?.request?.reason}</p>
            </div>
          )}
        </div>
        <Button
          variant="light_danger"
          icon={TrashIcon}
          className="w-min h-min self-end justify-end"
          onClick={() => {
            setDeleteOpen(true);
          }}
        />
      </div>

      <Modal open={declineOpen} setOpen={setDeclineOpen}>
        <PageHeading title="Decline Inactivity Request" />
        <form
          className="flex flex-col gap-2"
          onSubmit={async (f) => {
            f.preventDefault();
            const target = f.target as any;
            const reason = target.reason.value;

            updateMutation.mutateAsync(
              {
                groupId,
                id: request._id,
                reason,
                status: 'decline',
              },
            ).then(() => {
              toast.success('Successfully declined inactivity');
              context.workspaces.workspace.activity.inactivity.getMyInactivity.invalidate({ groupId });
              context.workspaces.workspace.activity.inactivity.getEveryonesInactivity.invalidate({ groupId });
              setDeclineOpen(false);
            }).catch(e => {
              toast.error(`Something went wrong ${e}`)
            })
          }}
        >
          <TextLabel
            id="reason"
            label="Reason for declining request"
            icon={ChatBubbleOvalLeftIcon}
            placeholder="Type here"
          />
          <p className="-mt-1.5 text-sm text-gray-500">
            Note that the user will be able to see this reason.
          </p>
          <div className="flex flex-row justify-end gap-2">
            <Button
              variant="primary"
              size="medium"
              type="button"
              onClick={() => {
                setDeclineOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" size="medium" type="submit">
              Decline
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleteOpen} setOpen={setDeleteOpen}>
        <PageHeading title="Delete Inactivity Request" />
        <form
          className="flex flex-col gap-2"
          onSubmit={async (f) => {
            f.preventDefault();
            await deleteMutation
              .mutateAsync({
                groupId,
                id: request._id,
              })
              .then(() => {
                toast.success('Successfully deleted inactivity');
                context.workspaces.workspace.activity.inactivity.getMyInactivity.invalidate({ groupId });
                context.workspaces.workspace.activity.inactivity.getEveryonesInactivity.invalidate({ groupId });
                setDeleteOpen(false);
              })
              .catch((e) => {
                alert(e.message);
              });
          }}
        >
          {deleteMutation.isPending || deleteMutation.isSuccess ? (
            <>
              <LoadingPage />
            </>
          ) : (
            <>
              <p>
                Are you sure that you want to delete {request.user.name}&apos;s
                inactivity request?
              </p>
              <div className="flex flex-row justify-end gap-2">
                <Button
                  variant="primary"
                  size="medium"
                  type="button"
                  onClick={() => {
                    setDeleteOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="danger" size="medium" type="submit">
                  Delete
                </Button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </Card >
  );
}

export default function WorkspaceUsersInactivity({
  groupId,
}: {
  groupId: string;
}): JSX.Element {
  const { data: inactivites } =
    trpc.workspaces.workspace.activity.inactivity.getEveryonesInactivity.useQuery(
      { groupId },
    );
  if (!inactivites) {
    return (
      <div>
        <PageHeading title="Inactivities" />
        <TextLoadingPlaceholder rows={3} header={false} />
      </div>
    );
  }

  if (inactivites.length == 0) {
    return (
      <>
        <PageHeading title="Inactivities" />
        <p className="-mt-4 mb-2">
          There are currently no inactivity requests.
        </p>
      </>
    );
  }

  return (
    <div>
      <PageHeading title="Inactivities" />
      <div className="flex flex-col gap-2">
        {inactivites.map((request: any) => (
          <InactivityThing
            key={request._id}
            request={request}
            groupId={groupId}
          />
        ))}
      </div>
    </div>
  );
}

/* eslint-disable @next/next/no-img-element */
import PageHeading from '~/components/layouts/PageHeading';
import Card from '~/components/ui/Card';
import MediaObject from '~/components/ui/MediaObject';
import ReactTimeago from 'react-timeago';
import Button from '~/components/forms/Button';
import { TrashIcon } from '@heroicons/react/24/solid';
import { JSX, useState } from 'react';
import Modal from '~/components/ui/Modal';
import TextLoadingPlaceholder from '~/components/ui/TextLoadingPlaceholder';
import { trpc } from '~/utils/trpc';
import LoadingPage from '~/components/layouts/LoadingPage';
import toast from 'react-hot-toast';

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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const context = trpc.useUtils();

  return (
    <Card key={request._id} className="flex flex-row justify-between">
      <MediaObject
        src={request.user.thumbnail}
        title={request.user.name}
        description={
          <p>
            {request.reason} -{' '}
            <ReactTimeago date={request.starts} /> to{' '}
            <ReactTimeago date={request.ends} />
          </p>
        }
      />
      <div className="flex flex-col gap-2">
        <div className="flex flex-row gap-2">
          {request.request == false ? ( // The request is pending
            <p>Your request is still pending</p>
          ) : (
            // The request has been approved or declined
            <>
              {request.request.approved == true ? ( // It has been approved
                <>
                  <img
                    src={request.request.user?.thumbnail}
                    alt={'User Icon'}
                    className="w-6 h-6 rounded-full"
                  />
                  <p>Approved by {request.request.user?.name}</p>
                </>
              ) : (
                // It has been declined
                <>
                  <img
                    src={request.request?.user?.thumbnail}
                    alt={'User Icon'}
                    className="w-6 h-6 rounded-full"
                  />
                  <p>
                    Rejected by {request.request.user?.name} for{' '}
                    {request.request?.reason}
                  </p>
                </>
              )}
            </>
          )}
        </div>
        <Button
          onClick={() => {
            setDeleteOpen(true);
          }}
          variant="light_danger"
          icon={TrashIcon}
          className="w-min h-min self-end justify-end"
        />
      </div>

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
    </Card>
  );
}

export default function WorkspaceUserInactivity({
  groupId,
}: {
  groupId: string;
}): JSX.Element {
  const { data: inactivites } =
    trpc.workspaces.workspace.activity.inactivity.getMyInactivity.useQuery({
      groupId,
    });

  if (!inactivites) {
    return (
      <div>
        <PageHeading title="Your Inactivity" />
        <TextLoadingPlaceholder rows={3} header={false} />
      </div>
    );
  }

  if (inactivites.length == 0) {
    return (
      <>
        <PageHeading title="Your Inactivity" />
        <p className="-mt-4 mb-2">You have no inactivity requests.</p>
      </>
    );
  }

  return (
    <div>
      <PageHeading title="Your Inactivities" />
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

import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { v4 } from 'uuid';
import { trpc } from '~/utils/trpc';
import { useWorkspace } from '~/components/contexts/workspace';

type AlertType = {
  id: string;
  type: 'primary' | 'warning' | 'danger';
  title?: string;
  message: string;
  link?: string;
  linkMessage?: string;
  closable?: boolean;
  imageUrl?: string;
};

export function Alert({ notif, forceVisible, extraText, attribution }: { notif: AlertType, forceVisible?: boolean, extraText?: string, attribution?: string }) {
  const windowDefined = typeof window !== 'undefined';
  const [displayable, setDisplayable] = useState<boolean>(
    forceVisible || notif.closable
      ? !windowDefined ||
      !(window.localStorage.getItem(`${notif.id}-closed`) == 'true')
      : true,
  );

  return !displayable ? (
    <></>
  ) : (
    <div
      key={notif.id}
      className={`rounded-md p-4 ${notif.type == 'primary'
          ? 'bg-blue-50'
          : notif.type == 'warning'
            ? 'bg-yellow-50'
            : 'bg-red-50'
        }`}
    >
      <div className="flex flex-row w-full">
        <div className="flex flex-col w-full">
          <div className="ml-3 fle flex flex-row">
            <div className="shrink-0">
              {notif.type == 'primary' ? (
                <InformationCircleIcon
                  className={`h-5 w-5 ${notif.type == 'primary'
                      ? 'text-blue-400'
                      : notif.type == 'warning'
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}
                  aria-hidden="true"
                />
              ) : (
                <ExclamationTriangleIcon
                  className={`h-5 w-5 ${notif.type == 'warning' ? 'text-yellow-400' : 'text-red-400'
                    }`}
                  aria-hidden="true"
                />
              )}
            </div>
            <span className="flex flex-row gap-2 ml-2">
              {notif.title && (
                <p
                  className={`text-sm font-medium ${notif.type == 'primary'
                      ? 'text-blue-700'
                      : notif.type == 'warning'
                        ? 'text-yellow-700'
                        : 'text-red-700'
                    }`}
                >
                  {notif.title}
                </p>
              )}
            </span>
          </div>
          <div className="flex flex-col justify-between mt-2 w-full">
            <div className="mt-3 text-sm md:ml-6 md:mt-0 flex flex-row justify-between gap-2 flex-wrap">
              <div>
                <p
                  className={`text-sm ${notif.type == 'primary'
                      ? 'text-blue-700'
                      : notif.type == 'warning'
                        ? 'text-yellow-700'
                        : 'text-red-700'
                    }`}
                >
                  {notif.message}
                </p>
              </div>
              {notif.link && (
                <Link
                  target="_blank"
                  href={notif.link}
                  className={`font-medium whitespace-nowrap self-center align-middle  ${notif.type == 'primary'
                      ? 'text-blue-700 hover:text-blue-600'
                      : notif.type == 'warning'
                        ? 'text-yellow-700 hover:text-yellow-600'
                        : 'text-red-700 hover:text-red-600'
                    }`}
                >
                  {notif.linkMessage}
                </Link>
              )}
            </div>
            {extraText && (
              <p className="font-bold text-black">{extraText}</p>
            )}
            {notif.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={notif.imageUrl}
                alt=""
                className="mt-3 max-h-48 w-auto rounded-md object-cover"
              />
            )}
            {attribution && (
              <p
                className={`mt-2 text-xs italic ${notif.type == 'primary'
                    ? 'text-blue-600/80'
                    : notif.type == 'warning'
                      ? 'text-yellow-600/80'
                      : 'text-red-600/80'
                  }`}
              >
                Posted by {attribution}. Not affiliated with or sent by ReAdmin.
              </p>
            )}
          </div>
        </div>
        {notif.closable && (
          <button
            type="button"
            className={`ml-2 h-min inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-hidden focus:ring-2 ${notif.type == 'primary'
                ? 'focus:ring-blue-500'
                : notif.type == 'warning'
                  ? 'focus:ring-yellow-500'
                  : 'focus:ring-red-500'
              } focus:ring-offset-2`}
            onClick={() => {
              window.localStorage.setItem(`${notif.id}-closed`, 'true');
              setDisplayable(false);
            }}
          >
            <span className="sr-only">Close</span>
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function AuthedAlerts() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as { groupId: string };
  const { data: alerts } = trpc.user.alerts.useQuery({
    groupId,
  }, {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  return (
    <div className="mb-2 flex flex-col gap-2">
      {safeAlerts.map((notif) => (
        <Alert key={notif.id} notif={notif} />
      ))}
    </div>
  );
}

// Workspace-scoped banners created by workspace admins in
// Settings → Banners. Filtered server-side by the member's department.
export function WorkspaceBanners() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as { groupId: string };
  const workspace = useWorkspace();
  const { data: banners } = trpc.workspaces.workspace.settings.banners.getActiveBanners.useQuery(
    { groupId },
    {
      enabled: !!groupId,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    },
  );

  const safeBanners = Array.isArray(banners) ? banners : [];
  if (!groupId || safeBanners.length === 0) return <></>;

  const workspaceName = workspace?.groupName || 'this workspace';

  return (
    <div className="mb-2 flex flex-col gap-2">
      {safeBanners.map((notif) => (
        <Alert key={notif.id} notif={notif} attribution={workspaceName} />
      ))}
    </div>
  );
}

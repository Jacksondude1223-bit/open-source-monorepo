/* eslint-disable @next/next/no-img-element */
import { useMemo } from 'react';
import {
  ArrowTopRightOnSquareIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import { getBaseUrl, trpc } from '~/utils/trpc';

type DiscordAccount = {
  id: string;
  username: string;
  globalName?: string | null;
  avatar?: string | null;
  primary: boolean;
};

function getAvatarUrl(account: DiscordAccount) {
  if (account.avatar) {
    return `https://cdn.discordapp.com/avatars/${account.id}/${account.avatar}.png?size=64`;
  }
  // Default avatar based on the new username system.
  const index = (BigInt(account.id) >> 22n) % 6n;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function formatUsername(account: DiscordAccount) {
  if (account.globalName) {
    return account.globalName;
  }
  return `@${account.username}`;
}

export default function DiscordConnections() {
  const { data: accounts, isLoading } = trpc.user.getDiscordAccounts.useQuery();
  const setPrimaryMutation = trpc.user.setPrimaryDiscordAccount.useMutation();
  const unlinkMutation = trpc.user.unlinkDiscordAccount.useMutation();
  const utils = trpc.useUtils();

  const addAccountUrl = useMemo(() => {
    const clientId = process.env?.NEXT_PUBLIC_DISCORD_CLIENT_ID || '';
    const redirectUri = encodeURIComponent(`${getBaseUrl()}/auth/discord`);
    return `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&scope=identify&redirect_uri=${redirectUri}&state=linkDiscordAccount`;
  }, []);

  const refresh = () =>
    Promise.all([
      utils.user.getDiscordAccounts.invalidate(),
      utils.user.info.invalidate(),
    ]);

  const handleSetPrimary = async (discordId: string) => {
    try {
      await setPrimaryMutation.mutateAsync({ discordId });
      await refresh();
      toast.success('Primary Discord account updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update primary account');
    }
  };

  const handleUnlink = async (account: DiscordAccount) => {
    if (!confirm(`Remove ${formatUsername(account)} from your account?`)) {
      return;
    }
    try {
      await unlinkMutation.mutateAsync({ discordId: account.id });
      await refresh();
      toast.success('Discord account removed');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove account');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Linked Discord Accounts
          </h3>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Connect one or more Discord accounts so you can log in with Discord and receive
            workspace notifications. Your primary account is used for direct messages.
          </p>
        </div>
        <Button
          href={addAccountUrl}
          variant="primary"
          size="medium"
          className="shrink-0"
        >
          <span className="flex items-center gap-1.5">
            <PlusIcon className="h-4 w-4" />
            Add Account
          </span>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-18 animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
            />
          ))}
        </div>
      ) : !accounts || accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center dark:border-gray-700 dark:bg-gray-800/40">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
            <ArrowTopRightOnSquareIcon className="h-6 w-6" />
          </span>
          <h4 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
            No Discord accounts linked
          </h4>
          <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            Link a Discord account to enable Discord login and notifications.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {accounts.map((account) => (
            <li
              key={account.id}
              className={`flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors ${
                account.primary
                  ? 'border-blue-200 bg-blue-50/60 dark:border-blue-800/60 dark:bg-blue-900/15'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/60'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative shrink-0">
                  <img
                    src={getAvatarUrl(account)}
                    alt=""
                    className="h-11 w-11 rounded-full border-2 border-white shadow-sm dark:border-gray-800"
                  />
                  {account.primary && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white ring-2 ring-white dark:ring-gray-800">
                      <StarIconSolid className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-gray-900 dark:text-white">
                      {formatUsername(account)}
                    </p>
                    {account.primary && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                        Primary
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    @{account.username} · {account.id}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {!account.primary && (
                  <Button
                    variant="discrete"
                    size="small"
                    onClick={() => handleSetPrimary(account.id)}
                    disabled={setPrimaryMutation.isPending}
                  >
                    <span className="flex items-center gap-1">
                      <StarIcon className="h-4 w-4" />
                      Set Primary
                    </span>
                  </Button>
                )}
                <Button
                  variant="light_danger"
                  size="small"
                  onClick={() => handleUnlink(account)}
                  disabled={unlinkMutation.isPending}
                >
                  <span className="flex items-center gap-1">
                    <TrashIcon className="h-4 w-4" />
                    Remove
                  </span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

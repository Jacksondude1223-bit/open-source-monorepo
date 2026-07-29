/* eslint-disable @next/next/no-img-element */
import { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOptions, ComboboxOption, Label } from '@headlessui/react';
import { UserIcon } from '@heroicons/react/24/solid';
import { RouterOutput, trpc } from '~/utils/trpc';
import classNames from '~/utils/classNames';
import { useUser } from '../contexts/user';
import { useWorkspace } from '../contexts/workspace';
import { Workspace } from '~/services/NewMongoTypes';

const DEFAULT_THUMBNAIL = 'https://cdn.readmin.app/readmin-public/backon-hair.png';

function DropdownItem(
  {
    user
  }: {
    user: RouterOutput['roblox']['searchRobloxUsersByUsernameWithIdNameCombo'][0];
  }
) {
  const workspace = useWorkspace();

  return (
    <ComboboxOption
      key={user.userId}
      value={user.userId}
      className={({ active }) =>
        classNames(
          'relative cursor-default select-none py-2 pl-3 pr-9',
          active ? `bg-${workspace?.brandColor || 'blue'}-600 text-white` : 'text-gray-900 transition dark:text-gray-100'
        )
      }
    >
      {({ }) => (
        <div className="flex flex-row gap-2">
          <img
            className={`w-8 h-8 rounded-full bg-${workspace?.brandColor || 'blue'}-500`}
            src={user.thumbnail || DEFAULT_THUMBNAIL}
            alt={`${user.name} Icon`}
          />
          <span className="block truncate">{user.name || 'Unknown'}</span>
        </div>
      )}
    </ComboboxOption>
  )
}

export default function RobloxUserSearch({
  placeholder = '',
  label,
  id = 'robloxusersearch',
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onSelectUser = () => { },
  defaultUser = '0',
  required = false,
  className = '',
  color = 'red',
  size = 'medium',
  groupId = '0',
  enableIcon = true,
  easySelf = false,
}: PropsWithChildren<{
  enableIcon?: boolean;
  defaultUser?: string;
  placeholder?: string;
  label?: string;
  required?: boolean;
  id?: string;
  className?: string;
  color?: Workspace['brandColor']|'gray';
  size?: 'small' | 'medium';
  groupId?: string;
  easySelf?: boolean;
  onSelectUser?: (userId: string) => void | Promise<void>;
}>) {
  const authedUser = useUser();
  const [username, setUsername] = useState('');
  const [debouncedUsername, setDebouncedUsername] = useState('');
  const [exactResults, setExactResults] = useState<RouterOutput['roblox']['searchRobloxUsersByUsernameWithIdNameCombo']>([]);
  const [selectedUserB, setSelectedUser] = useState<string | null>(defaultUser);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const workspace = useWorkspace();

  // Prevent rapid-fire Enter / repeated selection from firing onSelectUser
  // multiple times before the consumer's async work (e.g. a mutation) resolves.
  const handleSelectUser = async (userId: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSelectUser(userId);
      setUsername('');
      setExactResults([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Debounce the username so we don't fire a tRPC query on every keystroke.
  // Without this the input feels frozen on slower networks while requests
  // queue up behind one another.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedUsername(username.trim()), 300);
    return () => clearTimeout(handle);
  }, [username]);

  // Clear any stale exact-match results as soon as the user keeps typing.
  useEffect(() => {
    if (exactResults.length > 0) setExactResults([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  if (!('user' in authedUser)) {
    return (
      <div
        className={`mt-1 flex flex-row gap-1 w-full rounded-md border border-gray-300 bg-white ${size == 'small' ? 'py-2' : 'py-4'
          } pl-3 pr-10 shadow-sm overflow-visible focus:border-${color || 'blue'}-500 focus:outline-hidden focus:ring-1 focus:ring-${workspace?.brandColor || 'blue'}-500 sm:text-sm`}
      >
        <p className='font-bold text-gray-500'>Loading user info, please wait</p>
      </div>
    )
  }

  const { data: results, isFetching: isFetchingResults } = trpc.roblox.searchRobloxUsersByUsernameWithIdNameCombo.useQuery({
    username: debouncedUsername,
    groupId,
  }, {
    enabled: debouncedUsername.length >= 3,
    staleTime: 30_000,
  });
  // Lazy client for the exact-match Enter fallback.
  const trpcUtils = trpc.useUtils();
  // Only fetch full processed user for the currently-selected user (not every dropdown item)
  const { data: processedUser, isPending: isLoadingProcessedUser } = trpc.roblox.getRobloxUserProcesedQuery.useQuery({
    userId: selectedUserB?.toString() || '0',
  }, {
    enabled: selectedUserB !== null && selectedUserB !== '0',
  });

  if (defaultUser !== '0' && isLoadingProcessedUser) {
    return (
      <div
        className={`mt-1 flex flex-row gap-1 w-full rounded-md border border-gray-300 bg-white ${size == 'small' ? 'py-2' : 'py-4'
          } pl-3 pr-10 shadow-sm overflow-visible focus:border-${color || 'blue'}-500 focus:outline-hidden focus:ring-1 focus:ring-${workspace?.brandColor || 'blue'}-500 sm:text-sm`}
      >
        <p className='font-bold text-gray-500'>Loading user info, please wait</p>
      </div>
    )
  }

  return (
    <>
      <Combobox
        className={className}
        as="div"
        value={selectedUserB}
        onChange={async (userId) => {
          if (userId == null) {
            return;
          }
          if (isSubmitting) return;
          setSelectedUser(userId);
          await handleSelectUser(userId);
        }}
      >
        {label && (
          <Label className="block text-sm font-medium text-gray-700 transition dark:text-gray-300">
            {label}
          </Label>
        )}
        <div className="relative mt-1">
          <input className="hidden" value={processedUser?.id || selectedUserB || ''} id={id} />
          <input
            required={required}
            type="text"
            value={processedUser?.name || ''}
            onChange={() => { }}
            className="hidden"
          />
          <div
            className={`flex flex-row gap-1 w-full rounded-md border border-gray-300 bg-white transition dark:bg-gray-800 ${size == 'small' ? 'py-1' : 'py-2'
              } pl-3 pr-10 shadow-sm overflow-visible focus:border-${color || 'blue'}-500 focus:outline-hidden focus:ring-1 focus:ring-${color || 'blue'}-500 transition dark:border-gray-600 sm:text-sm`}
          >
            {enableIcon && (
              <>
                {(processedUser && Object.keys(processedUser).length !== 0) ? (
                  <img
                    src={processedUser.thumbnail}
                    alt="User Icon"
                    className={`${size == 'small' ? 'w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8' : 'w-12 h-12 min-w-12 min-h-12 max-w-12 max-h-12'
                      } rounded-full bg-linear-to-tr from-${color || 'blue'}-800 to-${color || 'blue'}-700 self-center aspect-square`}
                  />
                ) : (
                  <div
                    className={`${size == 'small' ? 'w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8' : 'w-12 h-12 min-w-12 min-h-12 max-w-12 max-h-12'
                      } rounded-full bg-linear-to-br from-${color || 'blue'}-100 to-${color || 'blue'}-200 dark:from-${color || 'blue'}-800 dark:to-${color || 'blue'}-900 flex items-center justify-center self-center aspect-square`}
                  >
                    <UserIcon
                      className={`${size == 'small' ? 'w-4 h-4' : 'w-6 h-6'} text-${color || 'blue'}-400 dark:text-${color || 'blue'}-500`}
                    />
                  </div>
                )}
              </>
            )}
            <ComboboxInput
              className="w-full h-full self-center border-0 rounded-lg transition dark:bg-gray-800 px-2 py-2"
              disabled={isSubmitting}
              onChange={(event) => { if (event.target.value.endsWith(' ')) { return; } setUsername(event.target.value) }}
              onKeyDown={async (event) => {
                if (event.key !== 'Enter') return;
                if (isSubmitting) { event.preventDefault(); return; }
                const hasVisibleResults = (results?.length ?? 0) > 0 || exactResults.length > 0;
                if (hasVisibleResults) return;
                if (isFetchingResults) return;
                const trimmed = username.trim();
                if (trimmed.length === 0) return;
                event.preventDefault();
                try {
                  const exact = await trpcUtils.roblox.findRobloxUserByExactName.fetch({ username: trimmed, groupId });
                  const first = exact[0];
                  if (!first) return;
                  if (exact.length === 1) {
                    // Single exact match — auto-select.
                    setSelectedUser(first.userId);
                    await handleSelectUser(first.userId);
                  } else {
                    // Multiple matches — render them in the dropdown for the user to pick.
                    setExactResults(exact);
                  }
                } catch {
                  // Swallow — exact-match is best-effort.
                }
              }}
              displayValue={() => processedUser?.name || ''}
              placeholder={processedUser?.name || placeholder}
            />
            {((isFetchingResults && debouncedUsername.length >= 3) || isSubmitting) && (
              <div
                className="self-center mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent"
                aria-label={isSubmitting ? 'Submitting' : 'Searching'}
              />
            )}
          </div>
          <ComboboxButton className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-hidden">
            <ChevronUpDownIcon
              className="h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
          </ComboboxButton>
          <ComboboxOptions className="absolute z-100 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white transition dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-hidden sm:text-sm">
            {(easySelf && username == '') && (
              <DropdownItem key={authedUser.user?.dbUser.robloxId || ''} user={{ userId: authedUser.user?.dbUser.robloxId || '', name: authedUser.user?.dbUser.name || '', thumbnail: DEFAULT_THUMBNAIL }} />
            )}
            {(results && results.length > 0 ? results : exactResults).map((user) => (
              <DropdownItem key={user.userId} user={user} />
            ))}
            {(debouncedUsername.length >= 3 && !isFetchingResults && (results?.length ?? 0) === 0 && exactResults.length === 0) && (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
                No matches. Press Enter to look up an exact username.
              </div>
            )}
          </ComboboxOptions >
        </div>
      </Combobox>
    </>
  );
}
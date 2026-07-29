/* eslint-disable @next/next/no-img-element */
import { ArrowPathIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/20/solid';
import { PlusCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import { ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import MultiSelectDropdown from '~/components/forms/MultiSelectDropdown';
import TextLabel from '~/components/forms/TextLabel';
import Toggle from '~/components/forms/Toggle';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import WorkspaceUpsale from '~/components/page_components/workspaces/settings/billing/Upsale';
import Card from '~/components/ui/Card';
import LoadingAnimation from '~/components/ui/LoadingAnimation';
import Modal from '~/components/ui/Modal';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import { debounce } from 'lodash';
import { keepPreviousData } from '@tanstack/react-query';
import ReactTimeago from 'react-timeago';
import { RankingKey } from '~/services/NewMongoTypes';
import { AuthenticatedUserContext, useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import EmptyCardCreateState from '~/components/ui/EmptyCardCreateState';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';

// Helper to safely stringify ObjectId or fallback
function getEventKey(evt: any) {
  return evt._id?.toString ? evt._id.toString() : String(evt._id);
}

function RankingKeyCard({ groupId, rankingKey }: { groupId: string; rankingKey: RankingKey }) {
  const [showingKey, setShowingKey] = useState(false);
  const [showingDeleteModal, setShowDeletingModal] = useState(false);
  const [selectedRanks, setSelectedRanks] = useState([]);
  const { data: robloxOAuth } = trpc.workspaces.workspace.settings.integrations.get_roblox_oauth.useQuery({ groupId });
  const context = trpc.useUtils();
  const { data: groupRanks } = trpc.roblox.getGroupRoles.useQuery({ groupId });
  const { data: userRank } = trpc.roblox.getRobloxUserGroupRank.useQuery({ groupId, userId: (robloxOAuth ? robloxOAuth.sub : 0).toString() });
  const reloadQueue = trpc.workspaces.workspace.settings.rankingKeys.reloadQueue.useMutation();
  const editKey = trpc.workspaces.workspace.settings.rankingKeys.edit.useMutation();
  const deleteKey = trpc.workspaces.workspace.settings.rankingKeys.delete.useMutation();



  return (
    <Card className="flex flex-col gap-3 z-50 overflow-visible">
      <form onSubmit={(f) => {
        f.preventDefault();
        const target = f.target as any;
        const name = target.name.value;
        const rankingEnabled = target.rankingEnabled.checked;
        const enableShouting = target.enableShouting.checked;
        const enableJoinRequestManagement = target.enableJoinRequestManagement.checked;
        const enableExile = target.enableExile.checked;

        editKey.mutateAsync({
          groupId,
          keyId: rankingKey.id,
          name, rankingEnabled, selectedRanks, enableShouting, enableJoinRequestManagement, enableExile
        }).then(() => {
          context.workspaces.workspace.settings.rankingKeys.get.invalidate({ groupId });
          toast.success('Successfully updated key settings');
        }).catch(() => {
          toast.error('Failed to update key settings');
        })
      }}>
        <div className="flex flex-row gap-2">
          <TextLabel defaultValue={rankingKey.name} required={true} className="w-full" label="Name" id="name" placeholder="Short description of this key" />
          <Button icon={TrashIcon} className="h-min self-end" variant="light_danger" onClick={() => { setShowDeletingModal(true) }}></Button>
        </div>
        <div className="flex items-center gap-2 mt-3 rounded-lg bg-gray-100 dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-700">
          <p className='text-xs font-mono break-all flex-1 text-gray-600 dark:text-gray-400'>{showingKey ? rankingKey.key : '\u2022'.repeat(32)}</p>
          <Button type="button" icon={showingKey ? EyeSlashIcon : EyeIcon} className="h-min shrink-0" variant="discrete" onClick={() => { setShowingKey(!showingKey) }}></Button>
          <Button type="button" icon={ArrowPathIcon} className="h-min shrink-0" variant="discrete" onClick={() => {
            reloadQueue.mutateAsync({
              groupId,
              keyId: rankingKey.id,
            }).then(() => {
              context.workspaces.workspace.settings.rankingKeys.get.invalidate({ groupId });
            })
          }}></Button>
        </div>

        <Toggle id="rankingEnabled" value={rankingKey.rankingEnabled} title="Enable ranking actions for this key" description="" />
        <MultiSelectDropdown id="allowedRanks" onSelectChoice={setSelectedRanks} defaultValue={rankingKey.allowedRanks.map(a => a.toString())} label="Allow ranking for these ranks" choices={groupRanks?.filter(rank => {
          const userRole = userRank?.rankId || 255;
          if (rank.rank == 0 || rank.rank == 255) {
            return false;
          }
          if (rank.rank >= userRole) {
            return false;
          }
          return true;
        })?.map(rank => {
          return {
            name: rank.name,
            id: rank.id.toString(),
          }
        }) || []} />
        <Toggle id="enableShouting" value={rankingKey.enableShouting} title="Enable shout actions for this key" description="" />
        <Toggle id="enableJoinRequestManagement" value={rankingKey.enableJoinRequestManagement} title="Enable join request actions for this key" description="" />
        <Toggle id="enableExile" value={rankingKey.enableExile} title="Enable exiling for this key" description="" />
        <Button variant="primary" type="submit" className='w-full mt-2'>Save Key Settings</Button>
      </form>

      <Modal open={showingDeleteModal} setOpen={setShowDeletingModal}>
        <PageHeading title="Delete this ranking key?" />
        <p className="text-sm text-gray-600 dark:text-gray-400">This will permanently remove all ranking logs and any pending actions for this key.</p>
        <div className='mt-4 flex flex-row gap-3'>
          <Button className="w-full" variant='danger' onClick={() => {
            deleteKey.mutateAsync({
              groupId,
              keyId: rankingKey.id
            }).then(() => {
              context.workspaces.workspace.settings.rankingKeys.get.invalidate({ groupId });
              setShowDeletingModal(false);
            })
          }}>Delete Key</Button>
          <Button className="w-full" variant="primary" onClick={() => { setShowDeletingModal(false) }}>Cancel</Button>
        </div>
      </Modal>
    </Card>
  );
}

function RankingKeyEventsList({ groupId }: { groupId: string }) {
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'created' | 'status' | 'actionType' | 'userId'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: keys } = trpc.workspaces.workspace.settings.rankingKeys.get.useQuery({ groupId });
  const keyIds = keys?.map(k => k.id) || [];
  const keyId = keyIds[0];

  // Track intentional page-0 resets
  const userInitiatedReset = useRef(false);

  // Debounce search — lodash debounce avoids useEffect page-reset bugs
  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => {
      setSearch(value);
      userInitiatedReset.current = true;
      setPaginationModel(prev => ({ ...prev, page: 0 }));
    }, 400),
    []
  );

  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    debouncedSetSearch(value.trim());
  }, [debouncedSetSearch]);

  const { data, isLoading, isFetching } = trpc.workspaces.workspace.settings.rankingKeys.getEvents.useQuery(
    {
      groupId,
      keyId: keyId || '',
      skip: paginationModel.page * paginationModel.pageSize,
      limit: paginationModel.pageSize,
      search,
      sortField,
      sortOrder,
    },
    { enabled: !!keyId, placeholderData: keepPreviousData }
  );

  // Memoize rowCount so it never becomes undefined during loading
  const rowCountRef = useRef(data?.total ?? 0);
  const rowCount = useMemo(() => {
    if (data?.total !== undefined) {
      rowCountRef.current = data.total;
    }
    return rowCountRef.current;
  }, [data?.total]);

  // Keep rows stable during loading
  const rowsRef = useRef<any[]>([]);
  const rows = useMemo(() => {
    if (!data?.events) return rowsRef.current;
    const newRows = data.events.map(evt => ({
      id: getEventKey(evt),
      status: evt.status,
      actionType: evt.actionType,
      userId: evt.userId,
      created: evt.created,
      failure: evt.failure,
    }));
    rowsRef.current = newRows;
    return newRows;
  }, [data?.events]);

  // Guard pagination changes — block resets while fetching, allow user-initiated resets
  const handlePaginationModelChange = useCallback((newModel: GridPaginationModel) => {
    // Block any page-0 reset that we didn't initiate
    if (newModel.page === 0 && paginationModel.page > 0 && !userInitiatedReset.current) {
      return;
    }
    // Also block if we're currently fetching and the page is going backwards
    if (isFetching && newModel.page < paginationModel.page && !userInitiatedReset.current) {
      return;
    }
    userInitiatedReset.current = false;
    setPaginationModel(newModel);
  }, [paginationModel.page, isFetching]);

  if (!keyId) return null;

  function statusDisplay(status: string) {
    if (status === 'complete') return <span className="inline-flex items-center gap-1 text-green-600 font-semibold"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Success</span>;
    if (status === 'failed') return <span className="inline-flex items-center gap-1 text-red-600 font-semibold"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>Failed</span>;
    return <span className="inline-flex items-center gap-1 text-yellow-600 font-semibold"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" /></svg>Pending</span>;
  }

  const columns: GridColDef[] = [
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => statusDisplay(params.value),
    },
    {
      field: 'actionType',
      headerName: 'Action',
      width: 120,
      //@ts-expect-error it exists
      valueGetter: (params) => params?.row?.actionType,
      renderCell: (params) => <span style={{ textTransform: 'capitalize' }}>{params.value}</span>,
    },
    {
      field: 'userId',
      headerName: 'Affected User',
      width: 220,
      renderCell: (params) => (
        <div style={{ display: 'flex', alignItems: 'center', minHeight: 40 }}>
          <TextReturnForUserId userId={params.value} includeImage={true} />
        </div>
      ),
      sortable: false,
    },
    {
      field: 'created',
      headerName: 'Date',
      width: 180,
      renderCell: (params) => <span><ReactTimeago date={params.value} /></span>,
    },
    {
      field: 'failure',
      headerName: 'Error',
      width: 600,
      renderCell: (params) => (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          {params.value ? <span style={{ color: '#dc2626' }}>{params.value.reason}</span> : <span style={{ color: '#aaa' }}>—</span>}
        </div>
      ),
      sortable: false,
    },
  ];

  // Handle sorting changes
  const handleSortModelChange = (sortModel: any) => {
    if (sortModel.length > 0) {
      const { field, sort } = sortModel[0];
      setSortField(field as 'created' | 'status' | 'actionType' | 'userId');
      setSortOrder(sort as 'asc' | 'desc');
      userInitiatedReset.current = true;
      setPaginationModel(prev => ({ ...prev, page: 0 }));
    }
  };

  return (
    <div className="mt-12 relative">
      <Header>Recent Ranking API Events</Header>

      {/* Search Bar */}
      <div className="mt-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search by user or action type..."
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchInput && (
              <button
                onClick={() => handleSearchInput('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-2 text-sm">
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
              {data?.total || 0} total events
            </span>
            {search && (
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                Filtered: "{search}"
              </span>
            )}
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded">
              Sort: {sortField} ({sortOrder})
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 shadow relative">
        <DataGridPro
          autoHeight
          rows={rows}
          columns={columns}
          loading={isLoading || isFetching}
          pageSizeOptions={[10, 25, 50]}
          pagination
          paginationMode="server"
          sortingMode="server"
          onSortModelChange={handleSortModelChange}
          sortModel={[{ field: sortField, sort: sortOrder }]}
          rowCount={rowCount}
          paginationModel={paginationModel}
          onPaginationModelChange={handlePaginationModelChange}
          disableRowSelectionOnClick
          className='rounded-lg'
        />
        {(isFetching && !isLoading) && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
            <LoadingAnimation />
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser() as AuthenticatedUserContext;
  const workspace = useWorkspace();

  const { data: keys } = trpc.workspaces.workspace.settings.rankingKeys.get.useQuery({ groupId });
  const createKey = trpc.workspaces.workspace.settings.rankingKeys.create.useMutation();
  const utils = trpc.useUtils();
  const [isCreating, setIsCreating] = useState(false);


  if (!user || !workspace) {
    return <LoadingPage />;
  }

  if (!workspace?.premium?.is) {
    return (
      <>
        <PageHeading title={`${workspace?.groupName} Ranking API Keys`} />
        <div className='flex flex-col items-center gap-4 mt-6'>
          <h2 className='text-xl font-semibold text-center text-gray-900 dark:text-gray-100'>Automate Roblox group actions</h2>
          <p className='text-sm text-gray-500 text-center max-w-md'>Use the ReAdmin Ranking API to programmatically rank users, manage join requests, and more.</p>
          <img
            src="https://cdn.readmin.app/readmin-public/ManageServersUpsale.jpeg"
            className='max-h-[400px] rounded-xl shadow-lg border border-gray-200 dark:border-gray-700'
            alt="ranking api preview"
          />
          <WorkspaceUpsale />
        </div>
      </>
    );
  }

  if (!workspace.department.permissions.admin) {
    return (
      <>
        <PageHeading title={`${workspace?.groupName} Ranking API Keys`} />
        <div className="text-center py-12 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 mt-4">
          <p className='text-sm font-medium text-gray-600 dark:text-gray-400'>Only workspace admins can manage ranking API keys</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeading title={`${workspace?.groupName} Ranking API Keys`} description={'Automate Roblox group actions through the ReAdmin API'} className='flex flex-row pb-2 gap-2 justify-between' />

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {keys?.map((rankingKey) => (
          <RankingKeyCard groupId={groupId} key={rankingKey.id} rankingKey={rankingKey} />
        ))}

        {isCreating ? <LoadingAnimation /> : (
          <EmptyCardCreateState
            icon={PlusCircleIcon}
            buttonText={"Create Ranking Key"}
            cbFunction={() => {
              setIsCreating(true);
              createKey.mutateAsync({ groupId }).then(() => {
                utils.workspaces.workspace.settings.rankingKeys.get.invalidate({ groupId }).then(() => {
                  setIsCreating(false);
                })
              });
            }} />
        )}
      </div>

      <RankingKeyEventsList groupId={groupId} />
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);

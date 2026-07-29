/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router';
import { ReactElement, useState, useMemo, useCallback } from 'react';
import Button from '~/components/forms/Button';
import PageHeading from '~/components/layouts/PageHeading';
import { AdminLayout } from '~/components/page_components/AdminLayout';
import { useUser } from '~/components/contexts/user';
import { trpc } from '~/utils/trpc';
import { NoSymbolIcon, TrashIcon, UserIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import Modal from '~/components/ui/Modal';
import TextLabel from '~/components/forms/TextLabel';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { ArrayToValueType, RouterOutput } from '~/server/routers/_app';
import RobloxUserSearch from '~/components/ui/RobloxUserSearch';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import { DataGridPro, GridColDef, GridActionsCellItem, GridRowParams, GridToolbarContainer, GridToolbarFilterButton, GridToolbarDensitySelector, GridToolbarExport, GridToolbarColumnsButton } from '@mui/x-data-grid-pro';
import { Box, TextField, Chip, Avatar, Typography, IconButton, Tooltip } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Enhanced User Avatar Component
function UserAvatar({ robloxId }: { robloxId: string }) {
  const { data: processedUser } = trpc.roblox.getRobloxUserProcesedQuery.useQuery({
    userId: robloxId || '0',
  });

  return (
    <Box display="flex" alignSelf="center" alignItems="center" gap={1}>
      <Avatar
        src={processedUser?.thumbnail || 'https://cdn.readmin.app/readmin-public/backon-hair.png'}
        alt={processedUser?.name || 'User'}
        sx={{ width: 32, height: 32 }}
      />
      <Box display="flex" flexDirection="column" >
        <Typography variant="body2" fontWeight="medium">
          {processedUser?.name || 'Loading...'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {robloxId}
        </Typography>
      </Box>
    </Box>
  );
}

// Premium Status Chip Component
function PremiumStatusChip({ workspace }: { workspace: ArrayToValueType<RouterOutput['admin']['workspaces']['getWorkspaces']> }) {
  if (workspace.premium?.is) {
    return (
      <Chip
        label={`Premium by ${workspace.premium.managedBy?.robloxId || 'Unknown'}`}
        color="success"
        size="small"
        variant="filled"
      />
    );
  }
  return (
    <Chip
      label="Free"
      color="default"
      size="small"
      variant="outlined"
    />
  );
}

// Ban Status Component
function BanStatus({ workspace }: { workspace: ArrayToValueType<RouterOutput['admin']['workspaces']['getWorkspaces']> }) {
  if (workspace.banStatus?.is) {
    return (
      <Chip
        label={`Banned: ${workspace.banStatus.reason}`}
        color="error"
        size="small"
        variant="filled"
      />
    );
  }
  return (
    <Chip
      label="Active"
      color="success"
      size="small"
      variant="outlined"
    />
  );
}

// Custom Toolbar Component
function CustomToolbar({ searchText, onSearchChange }: { searchText: string; onSearchChange: (value: string) => void }) {
  return (
    <GridToolbarContainer sx={{ p: 2, gap: 2 }}>
      <TextField
        size="small"
        placeholder="Search workspaces..."
        value={searchText}
        onChange={(e) => onSearchChange(e.target.value)}
        InputProps={{
          startAdornment: <MagnifyingGlassIcon className="w-4 h-4 mr-1 text-gray-400" />,
        }}
        sx={{ minWidth: 300 }}
      />
      <Box sx={{ flex: 1 }} />
      <GridToolbarFilterButton />
      <GridToolbarColumnsButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport />
    </GridToolbarContainer>
  );
}

// Action Modal Component
function ActionModals({
  workspace,
  isBanning,
  setIsBanning,
  isDeleting,
  setIsDeleting,
  isTransferring,
  setIsTransferring,
  transferMutation,
  banMutation,
  deleteWorkspace,
  utils
}: {
  workspace: ArrayToValueType<RouterOutput['admin']['workspaces']['getWorkspaces']>;
  isBanning: boolean;
  setIsBanning: (value: boolean) => void;
  isDeleting: boolean;
  setIsDeleting: (value: boolean) => void;
  isTransferring: boolean;
  setIsTransferring: (value: boolean) => void;
  transferMutation: any;
  banMutation: any;
  deleteWorkspace: any;
  utils: any;
}) {
  return (
    <>
      <Modal open={isTransferring} setOpen={() => setIsTransferring(false)}>
        <form onSubmit={async (form) => {
          form.preventDefault();
          const userId = (form.target as any).userId.value;
          if (!userId) return toast.error('Must select a user');
          await transferMutation.mutateAsync({ groupId: workspace.groupId, userId });
          setIsTransferring(false);
          toast.success('Workspace transferred');
          utils.admin.workspaces.getWorkspaces.invalidate();
        }}>
          <PageHeading title={`Transferring ${workspace?.groupName} to New Owner`} />
          <RobloxUserSearch label="New Owner" id="userId" groupId={workspace.groupId} size="small" color="blue" />
          <div className="flex flex-row gap-2 mt-2">
            <Button variant="primary" className="w-full" type="reset" onClick={() => setIsTransferring(false)}>
              Cancel
            </Button>
            <Button variant="danger" className="w-full" type="submit">
              Transfer Workspace
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={isBanning} setOpen={() => setIsBanning(false)}>
        <form onSubmit={async (form) => {
          form.preventDefault();
          const reason = (form.target as any).reason.value;
          if (!reason) return toast.error('Must type a reason');
          await banMutation.mutateAsync({ groupId: workspace.groupId, reason });
          setIsBanning(false);
          toast.success('Workspace banned');
          utils.admin.workspaces.getWorkspaces.invalidate();
        }}>
          <PageHeading title={`Banning ${workspace?.groupName}`} />
          <TextLabel placeholder="Why are you banning this workspace" label="Ban reason" id="reason" />
          <div className="flex flex-row gap-2 mt-2">
            <Button variant="primary" className="w-full" type="reset" onClick={() => setIsBanning(false)}>
              Cancel
            </Button>
            <Button variant="danger" className="w-full" type="submit">
              Ban Workspace
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={isDeleting} setOpen={() => setIsDeleting(false)}>
        <form onSubmit={async (form) => {
          form.preventDefault();
          await deleteWorkspace.mutateAsync({ groupId: workspace.groupId });
          setIsDeleting(false);
          toast.success('Workspace deleted');
          utils.admin.workspaces.getWorkspaces.invalidate();
        }}>
          <PageHeading title={`Deleting ${workspace?.groupName}`} />
          <div className="flex flex-row gap-2 mt-2">
            <Button variant="primary" className="w-full" type="reset" onClick={() => setIsDeleting(false)}>
              Cancel
            </Button>
            <Button variant="danger" className="w-full" type="submit">
              Delete Workspace
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default function DashboardPage() {
  const user = useUser();
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<ArrayToValueType<RouterOutput['admin']['workspaces']['getWorkspaces']> | null>(null);
  const [isBanning, setIsBanning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const { data: workspaces, isLoading } = trpc.admin.workspaces.getWorkspaces.useQuery();
  const transferMutation = trpc.admin.workspaces.transferWorkspace.useMutation();
  const unbanMutation = trpc.admin.workspaces.unbanWorkspace.useMutation();
  const banMutation = trpc.admin.workspaces.banWorkspace.useMutation();
  const deleteWorkspace = trpc.admin.workspaces.deleteWorkspace.useMutation();
  const utils = trpc.useUtils();

  // Create dark theme for MUI
  const theme = createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#3b82f6',
      },
      background: {
        default: '#111827',
        paper: '#1f2937',
      },
    },
  });

  // Filter workspaces based on search
  const filteredWorkspaces = useMemo(() => {
    if (!workspaces || !searchText) return workspaces || [];

    const search = searchText.toLowerCase();
    return workspaces.filter((workspace) =>
      workspace.groupId?.toLowerCase().includes(search) ||
      workspace?.groupName?.toLowerCase().includes(search) ||
      workspace.owner?.robloxId?.toLowerCase().includes(search) ||
      (workspace.premium?.managedBy?.robloxId?.toLowerCase().includes(search)) ||
      (workspace.banStatus?.reason?.toLowerCase().includes(search))
    );
  }, [workspaces, searchText]);

  // Define columns for DataGrid
  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'groupId',
      headerName: 'Group ID',
      width: 120,
      renderCell: (params) => (
        <Link
          className="text-blue-400 hover:text-blue-300 transition-colors"
          target="_blank"
          href={`https://roblox.com/groups/${params.value}/a`}
        >
          {params.value}
        </Link>
      ),
    },
    {
      field: 'groupName',
      headerName: 'Group Name',
      width: 200,
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'owner',
      headerName: 'Owner',
      width: 200,
      renderCell: (params) => <UserAvatar robloxId={params.value?.robloxId || ''} />,
      sortable: false,
    },
    {
      field: 'premium',
      headerName: 'Premium Status',
      width: 180,
      renderCell: (params) => <PremiumStatusChip workspace={params.row} />,
      sortable: false,
    },
    {
      field: 'created',
      headerName: 'Created',
      width: 160,
      type: 'dateTime',
      valueGetter: (value) => new Date(value),
      renderCell: (params) => (
        <Typography variant="body2">
          {new Date(params.value).toLocaleDateString()}
        </Typography>
      ),
    },
    {
      field: 'banStatus',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => <BanStatus workspace={params.row} />,
      sortable: false,
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 120,
      cellClassName: 'actions',
      getActions: (params: GridRowParams) => {
        const workspace = params.row as ArrayToValueType<RouterOutput['admin']['workspaces']['getWorkspaces']>;
        const actions = [
          <GridActionsCellItem
            key="transfer"
            icon={
              <Tooltip title="Transfer Workspace">
                <UserIcon className="w-4 h-4" />
              </Tooltip>
            }
            label="Transfer"
            onClick={() => {
              setSelectedWorkspace(workspace);
              setIsTransferring(true);
            }}
          />,
        ];

        if (workspace.banStatus?.is) {
          actions.push(
            <GridActionsCellItem
              key="unban"
              icon={
                <Tooltip title="Unban Workspace">
                  <Box sx={{ color: 'success.main' }}>✓</Box>
                </Tooltip>
              }
              label="Unban"
              onClick={async () => {
                await unbanMutation.mutateAsync({ groupId: workspace.groupId });
                toast.success('Workspace unbanned');
                utils.admin.workspaces.getWorkspaces.invalidate();
              }}
            />
          );
        } else {
          actions.push(
            <GridActionsCellItem
              key="ban"
              icon={
                <Tooltip title="Ban Workspace">
                  <NoSymbolIcon className="w-4 h-4" />
                </Tooltip>
              }
              label="Ban"
              onClick={() => {
                setSelectedWorkspace(workspace);
                setIsBanning(true);
              }}
            />
          );
        }

        if ('user' in user && (user?.user?.dbUser?.name === 'sloss2003' || user?.user?.dbUser?.name === 'TheAnthonomous')) {
          actions.push(
            <GridActionsCellItem
              key="delete"
              icon={
                <Tooltip title="Delete Workspace">
                  <TrashIcon className="w-4 h-4 text-red-400" />
                </Tooltip>
              }
              label="Delete"
              onClick={() => {
                setSelectedWorkspace(workspace);
                setIsDeleting(true);
              }}
            />
          );
        }

        return actions;
      },
    },
  ], [user, unbanMutation, utils]);

  if ('loading' in user || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user || !user?.user) {
    router.push('/');
    return <></>;
  }

  return (
    <ThemeProvider theme={theme}>
      <div className="space-y-6">
        <PageHeading title={`ReAdmin Workspaces (${filteredWorkspaces.length.toLocaleString()})`} />

        <Box sx={{ height: 'calc(100vh - 200px)', width: '100%' }}>
          <DataGridPro
            rows={filteredWorkspaces}
            columns={columns}
            getRowId={(row) => row.groupId}
            loading={isLoading}
            disableRowSelectionOnClick
            pageSizeOptions={[25, 50, 100]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25 },
              },
              sorting: {
                sortModel: [{ field: 'created', sort: 'desc' }],
              },
            }}
            slots={{
              toolbar: () => (
                <CustomToolbar
                  searchText={searchText}
                  onSearchChange={setSearchText}
                />
              ),
            }}
            sx={{
              backgroundColor: 'background.paper',
              '& .MuiDataGrid-cell': {
                borderColor: 'rgba(255, 255, 255, 0.1)',
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
          />
        </Box>

        {selectedWorkspace && (
          <ActionModals
            workspace={selectedWorkspace}
            isBanning={isBanning}
            setIsBanning={setIsBanning}
            isDeleting={isDeleting}
            setIsDeleting={setIsDeleting}
            isTransferring={isTransferring}
            setIsTransferring={setIsTransferring}
            transferMutation={transferMutation}
            banMutation={banMutation}
            deleteWorkspace={deleteWorkspace}
            utils={utils}
          />
        )}
      </div>
    </ThemeProvider>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <AdminLayout>{page}</AdminLayout>
);

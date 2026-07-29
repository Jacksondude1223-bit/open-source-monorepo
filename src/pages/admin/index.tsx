'use client';
/* eslint-disable @next/next/no-img-element */
import { NoSymbolIcon, EyeIcon, UserIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import { ReactElement, useState, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import PageHeading from '~/components/layouts/PageHeading';
import { AdminLayout } from '~/components/page_components/AdminLayout';
import { useUser } from '~/components/contexts/user';
import { trpc } from '~/utils/trpc';
import { User } from '~/services/NewMongoTypes';
import Modal from '~/components/ui/Modal';
import TextLabel from '~/components/forms/TextLabel';
import Toggle from '~/components/forms/Toggle';
import Link from 'next/link';
import NoSSR from '~/components/NoSSR';
import { DataGrid, GridColDef, GridPaginationModel, GridSortModel, GridToolbar } from '@mui/x-data-grid';
import { Box, Chip, TextField, Tooltip } from '@mui/material';
import UserDetailsModal from '~/components/page_components/admin/UserDetailsModal';
import { debounce } from 'lodash';

export default function DashboardPage() {
  const user = useUser();
  const router = useRouter();

  const utils = trpc.useUtils();

  // State for DataGrid
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // State for modals
  const [isBanning, setIsBanning] = useState<false | User>(false);
  const [userDetailsId, setUserDetailsId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<false | User>(false);
  const [gdprDelete, setGdprDelete] = useState(false);
  // Mutations
  const banMutation = trpc.admin.users.banUser.useMutation();
  const unbanMutation = trpc.admin.users.unbanUser.useMutation();
  const impersonateMutation = trpc.admin.users.impersonateUser.useMutation();
  const deleteMutation = trpc.admin.users.deleteUser.useMutation();

  // Track intentional page-0 resets
  const userInitiatedReset = useRef(false);

  // Create debounced search function
  const debouncedSetSearchTerm = useMemo(
    () => debounce((value: string) => {
      setSearchTerm(value);
      userInitiatedReset.current = true;
      setPaginationModel(prev => ({ ...prev, page: 0 }));
    }, 300),
    []
  );

  // Query users with pagination and search
  const { data: usersData, isLoading } = trpc.admin.users.getUsers.useQuery({
    page: paginationModel.page,
    pageSize: paginationModel.pageSize,
    searchTerm: searchTerm || undefined,
    sortField: sortModel[0]?.field as 'created' | 'name' | 'robloxId' | undefined,
    sortDirection: sortModel[0]?.sort || undefined,
  });

  // Memoize rowCount so it never becomes undefined during loading
  const rowCountRef = useRef(usersData?.pagination?.total ?? 0);
  const totalUsers = useMemo(() => {
    if (usersData?.pagination?.total !== undefined) {
      rowCountRef.current = usersData.pagination.total;
    }
    return rowCountRef.current;
  }, [usersData?.pagination?.total]);

  // Keep rows stable during loading
  const usersRef = useRef<any[]>([]);
  const users = useMemo(() => {
    if (!usersData?.users) return usersRef.current;
    usersRef.current = usersData.users;
    return usersData.users;
  }, [usersData?.users]);

  // Guard pagination changes
  const handlePaginationModelChange = useCallback((newModel: GridPaginationModel) => {
    if (newModel.page === 0 && paginationModel.page > 0 && !userInitiatedReset.current) {
      return;
    }
    userInitiatedReset.current = false;
    setPaginationModel(newModel);
  }, [paginationModel.page]);
  // Handle user actions
  const handleBanUser = useCallback(async (userId: string) => {
    if (!userId) return;
    const userToBan = usersData?.users.find(u => u._id?.toString() === userId);
    if (userToBan) {
      setIsBanning(userToBan);
    }
  }, [usersData]);

  const handleUnbanUser = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      await unbanMutation.mutateAsync({ userId });
      toast.success('User unbanned successfully');
      utils.admin.users.getUsers.invalidate();
    } catch (error) {
      toast.error('Failed to unban user');
    }
  }, [unbanMutation, utils]);
  const handleViewDetails = useCallback((userId: string) => {
    if (userId) {
      setUserDetailsId(userId);
    }
  }, []);
  const handleImpersonateUser = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      const result = await impersonateMutation.mutateAsync({ userId });

      // Set the new session token in cookies
      document.cookie = `ReAdmin_Session=${result.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      window.localStorage.setItem('token', result.token);

      // Show success message and redirect
      toast.success(`Now impersonating ${result.user.name}`);

      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (error) {
      toast.error('Failed to impersonate user');
    }
  }, [impersonateMutation]);

  const handleDeleteUser = useCallback(async (userId: string) => {
    if (!userId) return;
    const userToDelete = usersData?.users.find(u => u._id?.toString() === userId);
    if (userToDelete) {
      setIsDeleting(userToDelete);
    }
  }, [usersData]);

  const confirmDeleteUser = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      await deleteMutation.mutateAsync({ userId, gdprDelete });
      toast.success(gdprDelete ? 'User deleted and added to GDPR do-not-track list' : 'User deleted successfully');
      utils.admin.users.getUsers.invalidate();
      setIsDeleting(false);
      setGdprDelete(false); // Reset the toggle
    } catch (error) {
      toast.error('Failed to delete user');
    }
  }, [deleteMutation, utils, gdprDelete]);

  // Define DataGrid columns
  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'robloxId',
      headerName: 'Roblox ID',
      width: 120,
      renderCell: (params) => (
        <Link
          href={`https://roblox.com/users/${params.value}/profile`}
          target="_blank"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          {params.value}
        </Link>
      ),
    },
    {
      field: 'name',
      headerName: 'Username',
      width: 150,
      flex: 1,
    },
    {
      field: 'stripeId',
      headerName: 'Stripe ID',
      width: 120,
      renderCell: (params) => params.value || 'N/A',
    },
    {
      field: 'created',
      headerName: 'Created',
      width: 180,
      type: 'dateTime',
      valueGetter: (params) => new Date(params),
      renderCell: (params) => new Date(params.value).toLocaleString(),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => {
        const user = params.row as User;
        return user.isModerated ? (
          <Chip
            label={user.isModerated.type === 'ban' ? 'Banned' : 'Warning'}
            color="error"
            size="small"
          />
        ) : (
          <Chip
            label="Active"
            color="success"
            size="small"
          />
        );
      },
    },
    {
      field: 'moderation',
      headerName: 'Moderation',
      width: 200,
      flex: 1,
      renderCell: (params) => {
        const user = params.row as User;
        if (!user.isModerated) return 'N/A';
        return (
          <div className="text-sm">
            <div className="font-medium">{user.isModerated.reason}</div>
            <div className="text-gray-500">by {user.isModerated.bannedBy}</div>
          </div>
        );
      },
    }, {
      field: 'actions',
      headerName: 'Actions',
      width: 280,
      sortable: false,
      renderCell: (params) => {
        const user = params.row as User;
        return (
          <div className="flex gap-1">
            <Tooltip title="View Details">
              <Button
                size="small"
                onClick={() => handleViewDetails(user._id?.toString() || '')}
                className="text-blue-600 hover:text-blue-800"
                icon={EyeIcon}
              />
            </Tooltip>

            <Tooltip title="Impersonate User">
              <Button
                size="small"
                onClick={() => handleImpersonateUser(user._id?.toString() || '')}
                disabled={impersonateMutation.isPending}
                className="text-purple-600 hover:text-purple-800"
                icon={UserIcon}
              />
            </Tooltip>

            <Tooltip title="Delete User">
              <Button
                size="small"
                onClick={() => handleDeleteUser(user._id?.toString() || '')}
                disabled={deleteMutation.isPending}
                className="text-red-600 hover:text-red-800"
                icon={TrashIcon}
              />
            </Tooltip>

            {user.isModerated ? (
              <Button
                variant="success"
                size="small"
                onClick={() => handleUnbanUser(user._id?.toString() || '')}
                disabled={unbanMutation.isPending}
              >
                Unban
              </Button>
            ) : (
              <Button
                variant="danger"
                size="small"
                icon={NoSymbolIcon}
                onClick={() => handleBanUser(user._id?.toString() || '')}
              >
                Ban
              </Button>
            )}
          </div>
        );
      },
    },], [handleBanUser, handleUnbanUser, handleViewDetails, handleImpersonateUser, handleDeleteUser, unbanMutation.isPending, impersonateMutation.isPending, deleteMutation.isPending]);

  if ('loading' in user) {
    return <></>;
  }
  if (!user || !user?.user) {
    router.push('/');
    return <></>;
  }

  return (
    <>
      <PageHeading title={`ReAdmin Users (${totalUsers.toLocaleString()})`} />
      <NoSSR>
        <Box sx={{ height: 'calc(100vh - 200px)', width: '100%' }}>
          {/* Search Bar */}
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search by username, Roblox ID, or Stripe ID..."
              onChange={(e) => debouncedSetSearchTerm(e.target.value)}
              sx={{ maxWidth: 400 }}
            />
          </Box>

          {/* DataGrid */}          <DataGrid
            rows={users}
            columns={columns}
            getRowId={(row) => row._id?.toString() || 'unknown'}
            paginationModel={paginationModel}
            onPaginationModelChange={handlePaginationModelChange}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            loading={isLoading}
            rowCount={totalUsers}
            paginationMode="server"
            sortingMode="server"
            pageSizeOptions={[10, 25, 50, 100]}
            slots={{
              toolbar: GridToolbar,
            }}
            slotProps={{
              toolbar: {
                showQuickFilter: false, // We have our own search
              },
            }}
            sx={{
              '& .MuiDataGrid-cell': {
                borderBottom: '1px solid #e0e0e0',
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: '#f5f5f5',
              },
            }}
          />
        </Box>

        {/* User Details Modal */}
        <UserDetailsModal
          open={userDetailsId !== null}
          onClose={() => setUserDetailsId(null)}
          userId={userDetailsId}
        />

        {/* Ban Modal */}
        <Modal
          open={isBanning !== false}
          setOpen={() => setIsBanning(false)}
        >
          {isBanning !== false && (
            <form onSubmit={async form => {
              form.preventDefault();
              const reason = (form.target as any).reason.value;
              const banning = (form.target as any).banning.checked;
              if (!reason) return toast.error('Must type a reason')
              await banMutation.mutateAsync({
                userId: !isBanning?._id ? '' : isBanning._id.toString(),
                type: banning ? 'ban' : 'warning',
                reason
              });
              setIsBanning(false);
              toast.success('User banned');
              utils.admin.users.getUsers.invalidate();
            }}>
              <PageHeading title={`Banning ${isBanning?.name || isBanning?.robloxId}`} />
              <TextLabel placeholder="Why are you banning this user" label="Ban reason" id="reason" />
              <Toggle title="Ban" id="banning" description='If disabled you will warn the user and the user can reactivate their account' />
              <div className="flex flex-row gap-2 mt-2">
                <Button variant="primary" className="w-full" type="reset" onClick={() => {
                  setIsBanning(false);
                }}>Cancel</Button>
                <Button variant="danger" className="w-full" type="submit">Ban User</Button>
              </div>
            </form>
          )}
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          open={isDeleting !== false}
          setOpen={() => {
            setIsDeleting(false);
            setGdprDelete(false); // Reset toggle when closing
          }}
        >
          {isDeleting !== false && (
            <div className="p-6">
              <PageHeading title={`Delete User: ${isDeleting?.name || isDeleting?.robloxId}`} />
              <div className="mb-6">
                <p className="text-red-600 font-semibold mb-2">⚠️ WARNING: This action is irreversible!</p>
                <p className="text-gray-700 mb-4">
                  This will permanently delete the user and all associated data including:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
                  <li>User account and profile</li>
                  <li>Department memberships</li>
                  <li>Audit logs and activity history</li>
                  <li>Game sessions and statistics</li>
                  <li>Notes, write-ups, and moderation records</li>
                  <li>Orders and payment history</li>
                  <li>Users stripe account</li>
                  <li>All other associated data</li>
                </ul>

                {/* GDPR Toggle */}
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <Toggle
                    title="GDPR Do-Not-Track"
                    id="gdpr-toggle"
                    value={gdprDelete}
                    onChange={setGdprDelete}
                    description="Add this user to the GDPR do-not-track list to prevent future data collection and ensure compliance with data protection regulations."
                  />
                </div>

                <p className="text-red-600 font-medium">
                  Are you absolutely sure you want to delete user "{isDeleting?.name}" (ID: {isDeleting?.robloxId})?
                </p>
              </div>
              <div className="flex flex-row gap-2">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    setIsDeleting(false);
                    setGdprDelete(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  className="w-full"
                  onClick={() => confirmDeleteUser(isDeleting._id?.toString() || '')}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Deleting...' : (gdprDelete ? 'Delete & Add to GDPR List' : 'Delete User')}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </NoSSR>
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <AdminLayout>{page}</AdminLayout>
);

'use client';

import { useRouter } from 'next/router';
import React, { ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import HubLayout from '~/components/page_components/workspaces/hub/HubLayout';
import { trpc } from '~/utils/trpc';
import TextReturnForUserId from '~/components/ui/TextReturnForUserId';
import { debounce } from 'lodash';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  Chip
} from '@mui/material';
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
export default function WorkspacePage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;

  // Pagination state
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  // Search state with debouncing
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Sort state
  const [sortField, setSortField] = useState<'date' | '_id' | 'url'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Track intentional page-0 resets so we can distinguish them from DataGrid auto-resets
  const userInitiatedReset = useRef(false);

  // Debounce search — uses lodash debounce (same pattern as admin page)
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

  const { data: computed, isFetching } =
    trpc.workspaces.workspace.knowledge.viewOpens.useQuery({
      groupId,
      page: paginationModel.page * paginationModel.pageSize,
      limit: paginationModel.pageSize,
      search,
      sortField,
      sortOrder,
    }, {
      enabled: !!groupId,
    });

  // Memoize rowCount with ref so it never becomes undefined during loading
  // (official MUI DataGrid pattern for server-side pagination)
  const rowCountRef = useRef(computed?.pagination?.total ?? 0);
  const rowCount = useMemo(() => {
    if (computed?.pagination?.total !== undefined) {
      rowCountRef.current = computed.pagination.total;
    }
    return rowCountRef.current;
  }, [computed?.pagination?.total]);

  // Keep rows stable during loading — never pass empty array while fetching
  const rowsRef = useRef<any[]>([]);
  const rows = useMemo(() => {
    if (!computed?.response) return rowsRef.current;

    const newRows = computed.response.map((open: any, index: number) => ({
      id: open._id?.toString() || `row-${index}`,
      _id: open._id?.toString() || '',
      userId: open.userId,
      url: open.url,
      date: open.date,
    }));
    rowsRef.current = newRows;
    return newRows;
  }, [computed?.response]);

  // Guard pagination changes — only allow resets to page 0 if we initiated them
  const handlePaginationModelChange = useCallback((newModel: GridPaginationModel) => {
    if (newModel.page === 0 && paginationModel.page > 0 && !userInitiatedReset.current) {
      // DataGrid is trying to reset us — ignore it
      return;
    }
    userInitiatedReset.current = false;
    setPaginationModel(newModel);
  }, [paginationModel.page]);

  const columns: GridColDef[] = [
    {
      field: '_id',
      headerName: 'ID',
      width: 200,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'userId',
      headerName: 'User',
      width: 200,
      renderCell: (params) => (
        <TextReturnForUserId userId={params.value} includeImage={true} />
      ),
      sortable: false,
    },
    {
      field: 'url',
      headerName: 'URL',
      flex: 1,
      minWidth: 300,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          <Typography
            variant="body2"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {params.value}
          </Typography>
          <IconButton
            size="small"
            onClick={() => window.open(params.value, '_blank')}
            sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
    {
      field: 'date',
      headerName: 'Date',
      width: 180,
      type: 'dateTime',
      valueGetter: (value) => new Date(value),
      renderCell: (params) => (
        <Typography variant="body2">
          {new Date(params.value).toLocaleString()}
        </Typography>
      ),
    },
  ];

  // Handle sorting changes
  const handleSortModelChange = (sortModel: any) => {
    if (sortModel.length > 0) {
      const { field, sort } = sortModel[0];
      setSortField(field as 'date' | '_id' | 'url');
      setSortOrder(sort as 'asc' | 'desc');
      userInitiatedReset.current = true;
      setPaginationModel(prev => ({ ...prev, page: 0 }));
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Search and Stats */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}>
        <TextField
          size="small"
          placeholder="Search by name, URL, or user..."
          value={searchInput}
          onChange={(e) => handleSearchInput(e.target.value)}
          sx={{
            minWidth: 280,
            flex: 1,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: searchInput && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => handleSearchInput('')}
                  edge="end"
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={`${computed?.pagination?.total ?? 0} total`}
            size="small"
            variant="outlined"
          />
          {search && (
            <Chip
              label={`"${search}"`}
              size="small"
              variant="outlined"
              onDelete={() => handleSearchInput('')}
            />
          )}
        </Box>
      </Box>

      {/* Data Grid */}
      <Box sx={{
        flex: 1,
        borderRadius: 2,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
      }}>
        <DataGrid
          rows={rows}
          columns={columns}
          paginationModel={paginationModel}
          onPaginationModelChange={handlePaginationModelChange}
          pageSizeOptions={[10, 25, 50]}
          paginationMode="server"
          sortingMode="server"
          onSortModelChange={handleSortModelChange}
          sortModel={[{ field: sortField, sort: sortOrder }]}
          rowCount={rowCount}
          loading={isFetching}
          disableRowSelectionOnClick
          slots={{
            noRowsOverlay: () => (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: 2,
                  color: 'text.secondary'
                }}
              >
                <SearchIcon sx={{ fontSize: 48, opacity: 0.3 }} />
                <Typography variant="h6">
                  {search ? 'No opens match your search' : 'No opens found'}
                </Typography>
                <Typography variant="body2">
                  {search
                    ? 'Try adjusting your search terms'
                    : 'Resource opens will appear here when team members access knowledge base items'
                  }
                </Typography>
              </Box>
            ),
          }}
        />
      </Box>
    </Box>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <HubLayout disablePadding={true}>{page}</HubLayout>
);

import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, gridClasses } from '@mui/x-data-grid';
import { styled, useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { saveAs } from 'file-saver';
import { utils, write } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const statusColors = {
  draft: 'default',
  submitted: 'info',
  under_review: 'warning',
  approved: 'success',
  rejected: 'error',
  paid: 'primary',
};

const ToolbarContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius * 2,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const StyledDataGrid = styled(DataGrid)(({ theme }) => ({
  border: 'none',
  '& .MuiDataGrid-row:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  [`& .${gridClasses.columnHeaders}`]: {
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
  },
}));

const defaultFilters = {
  status: 'all',
  category: 'all',
  startDate: null,
  endDate: null,
  search: '',
};

const defaultPageSizeOptions = [10, 25, 50, 100];

const ExpenseList = ({ expenses = [], isLoading = false, onFiltersChange, categories = [] }) => {
  const theme = useTheme();
  const [filters, setFilters] = useState(defaultFilters);
  const [pageSize, setPageSize] = useState(defaultPageSizeOptions[0]);
  const [filteredRows, setFilteredRows] = useState(expenses);

  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange(filters);
    }
  }, [filters, onFiltersChange]);

  useEffect(() => {
    const { status, category, startDate, endDate, search } = filters;

    const filtered = expenses.filter((expense) => {
      const matchesStatus = status === 'all' || expense.status === status;
      const matchesCategory = category === 'all' || expense.category === category;
      const matchesDateRange = (() => {
        if (!startDate && !endDate) return true;
        const expenseDate = new Date(expense.expenseDate || expense.createdAt || expense.date);
        if (startDate && expenseDate < new Date(startDate)) return false;
        if (endDate && expenseDate > new Date(endDate)) return false;
        return true;
      })();

      const searchTarget = [
        expense.employeeName,
        expense.employeeEmail,
        expense.category,
        expense.status,
        expense.description,
        expense.amount?.toString(),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !search || searchTarget.includes(search.toLowerCase());

      return matchesStatus && matchesCategory && matchesDateRange && matchesSearch;
    });

    setFilteredRows(filtered);
  }, [expenses, filters]);

  const statusBadge = (params) => {
    const status = params.value;
    const color = statusColors[status] || 'default';

    return <Chip label={status.replace('_', ' ')} color={color} size="small" variant="filled" />;
  };

  const columns = useMemo(
    () => [
      {
        field: 'expenseDate',
        headerName: 'Date',
        flex: 1,
        minWidth: 140,
        valueGetter: (params) => params.value || params.row.createdAt,
        valueFormatter: (params) =>
          params.value ? format(new Date(params.value), 'MMM dd, yyyy') : 'Not set',
        sortComparator: (value1, value2) => new Date(value1) - new Date(value2),
      },
      {
        field: 'employeeName',
        headerName: 'Employee',
        flex: 1.2,
        minWidth: 160,
        valueGetter: (params) => params.row.employeeName || params.row.employee?.name,
      },
      {
        field: 'category',
        headerName: 'Category',
        flex: 1,
        minWidth: 140,
      },
      {
        field: 'amount',
        headerName: 'Amount',
        flex: 1,
        minWidth: 140,
        type: 'number',
        valueFormatter: (params) =>
          new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: params.row.currency || 'USD',
          }).format(Number(params.value) || 0),
      },
      {
        field: 'status',
        headerName: 'Status',
        flex: 1,
        minWidth: 140,
        renderCell: statusBadge,
        sortable: true,
      },
      {
        field: 'description',
        headerName: 'Description',
        flex: 1.5,
        minWidth: 200,
      },
    ],
    [],
  );

  const handleFilterChange = (name) => (event) => {
    const value = event.target.value;
    setFilters((prev) => ({
      ...prev,
      [name]: value === 'all' ? 'all' : value,
    }));
  };

  const handleDateChange = (name) => (event) => {
    setFilters((prev) => ({
      ...prev,
      [name]: event.target.value || null,
    }));
  };

  const handleSearchChange = (event) => {
    setFilters((prev) => ({
      ...prev,
      search: event.target.value,
    }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const exportCSV = () => {
    const worksheet = utils.json_to_sheet(filteredRows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Expenses');
    const excelBuffer = write(workbook, { bookType: 'csv', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `expenses-${Date.now()}.csv`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const tableColumn = ['Date', 'Employee', 'Category', 'Amount', 'Status', 'Description'];
    const tableRows = filteredRows.map((expense) => [
      expense.expenseDate ? format(new Date(expense.expenseDate), 'MMM dd, yyyy') : '',
      expense.employeeName || '',
      expense.category || '',
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: expense.currency || 'USD',
      }).format(Number(expense.amount) || 0),
      expense.status,
      expense.description || '',
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
    });

    doc.save(`expenses-${Date.now()}.pdf`);
  };

  return (
    <Stack spacing={3}>
      <ToolbarContainer elevation={3}>
        <Typography variant="h6" fontWeight={600}>
          Expense list
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Search"
              placeholder="Search by name, status, category..."
              value={filters.search}
              onChange={handleSearchChange}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={filters.status} label="Status" onChange={handleFilterChange('status')}>
                <MenuItem value="all">All statuses</MenuItem>
                {Object.keys(statusColors).map((status) => (
                  <MenuItem key={status} value={status}>
                    {status.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select value={filters.category} label="Category" onChange={handleFilterChange('category')}>
                <MenuItem value="all">All categories</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Stack direction="row" spacing={2}>
              <TextField
                type="date"
                label="Start date"
                value={filters.startDate || ''}
                onChange={handleDateChange('startDate')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                type="date"
                label="End date"
                value={filters.endDate || ''}
                onChange={handleDateChange('endDate')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </Grid>
        </Grid>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems="center">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <Button variant="outlined" onClick={resetFilters}>
              Reset filters
            </Button>
            <Button variant="outlined" onClick={exportCSV}>
              Export CSV
            </Button>
            <Button variant="outlined" onClick={exportPDF}>
              Export PDF
            </Button>
          </Stack>
        </Stack>
      </ToolbarContainer>

      <Paper elevation={3} sx={{ p: 2 }}>
        <StyledDataGrid
          autoHeight
          rows={filteredRows}
          columns={columns}
          disableRowSelectionOnClick
          loading={isLoading}
          pageSizeOptions={defaultPageSizeOptions}
          pagination
          initialState={{
            pagination: {
              paginationModel: {
                pageSize,
              },
            },
            sorting: {
              sortModel: [{ field: 'expenseDate', sort: 'desc' }],
            },
          }}
          onPaginationModelChange={(model) => setPageSize(model.pageSize)}
          sx={{
            '& .MuiDataGrid-cell:focus-within, & .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
          }}
        />
      </Paper>
    </Stack>
  );
};

ExpenseList.propTypes = {
  expenses: PropTypes.arrayOf(PropTypes.object),
  isLoading: PropTypes.bool,
  onFiltersChange: PropTypes.func,
  categories: PropTypes.arrayOf(PropTypes.string),
};

export default ExpenseList;

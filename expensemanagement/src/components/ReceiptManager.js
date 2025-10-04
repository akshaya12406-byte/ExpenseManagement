import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import { useDropzone } from 'react-dropzone';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

const DropzoneContainer = styled('div')(({ theme, isdragactive }) => ({
  border: `2px dashed ${isdragactive === 'true' ? theme.palette.primary.main : theme.palette.grey[400]}`,
  borderRadius: theme.shape.borderRadius * 2,
  padding: theme.spacing(4),
  backgroundColor: theme.palette.background.default,
  textAlign: 'center',
  transition: 'border-color 0.2s ease-in-out',
  cursor: 'pointer',
}));

const ReceiptCard = styled(Card)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius * 1.5,
  position: 'relative',
}));

const buildEndpoint = (baseUrl, expenseId, suffix = '') => {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmed}/expenses/${expenseId}/receipts${suffix}`;
};

const ReceiptManager = ({ expenseId, apiBaseUrl, authToken, onChange }) => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState({ open: false, receipt: null });
  const [zoom, setZoom] = useState(1);

  const axiosInstance = useMemo(
    () =>
      axios.create({
        baseURL: apiBaseUrl,
        headers: authToken
          ? {
              Authorization: `Bearer ${authToken}`,
            }
          : undefined,
        withCredentials: true,
      }),
    [apiBaseUrl, authToken],
  );

  const fetchReceipts = useCallback(async () => {
    if (!expenseId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await axiosInstance.get(`/expenses/${expenseId}/receipts`);
      setReceipts(data.receipts || []);
      if (onChange) {
        onChange(data.receipts || []);
      }
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  }, [axiosInstance, expenseId, onChange]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const handleDrop = useCallback(
    async (files) => {
      if (!files.length) return;

      const invalidFile = files.find(
        (file) => file.size > MAX_FILE_SIZE || !ALLOWED_TYPES.includes(file.type),
      );

      if (invalidFile) {
        setError('Only images (JPG, PNG, WEBP, GIF) or PDFs under 10 MB are allowed.');
        return;
      }

      const formData = new FormData();
      files.forEach((file) => formData.append('receipts', file, file.name));

      setUploading(true);
      setError(null);
      try {
        await axiosInstance.post(buildEndpoint('', expenseId), formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        await fetchReceipts();
      } catch (uploadError) {
        setError(uploadError.response?.data?.message || 'Failed to upload receipts');
      } finally {
        setUploading(false);
      }
    },
    [axiosInstance, expenseId, fetchReceipts],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    multiple: true,
    maxSize: MAX_FILE_SIZE,
    accept: ALLOWED_TYPES.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
  });

  const openPreview = (receipt) => {
    setPreview({ open: true, receipt });
    setZoom(1);
  };

  const closePreview = () => {
    setPreview({ open: false, receipt: null });
    setZoom(1);
  };

  const deleteReceipt = async (receiptId) => {
    if (!window.confirm('Remove this receipt?')) return;
    setError(null);
    try {
      await axiosInstance.delete(buildEndpoint('', expenseId, `/${receiptId}`));
      await fetchReceipts();
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'Failed to remove receipt');
    }
  };

  const replaceReceipt = async (receiptId, file) => {
    const formData = new FormData();
    formData.append('receipt', file);

    setError(null);
    setUploading(true);
    try {
      await axiosInstance.put(buildEndpoint('', expenseId, `/${receiptId}`), formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchReceipts();
    } catch (replaceError) {
      setError(replaceError.response?.data?.message || 'Failed to replace receipt');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      <DropzoneContainer {...getRootProps()} isdragactive={isDragActive.toString()}>
        <input {...getInputProps()} />
        <Stack spacing={1} alignItems="center">
          <FileUploadRoundedIcon color={isDragActive ? 'primary' : 'action'} fontSize="large" />
          <Typography variant="h6">Upload receipts</Typography>
          <Typography variant="body2" color="text.secondary">
            Drag and drop up to 5 files or click to browse. Supported: JPG, PNG, WEBP, GIF, PDF. Max 10 MB per file.
          </Typography>
        </Stack>
      </DropzoneContainer>
      {uploading && <LinearProgress />}
      {loading ? (
        <LinearProgress />
      ) : receipts.length === 0 ? (
        <Alert severity="info">No receipts uploaded yet. Add receipts to strengthen your submission.</Alert>
      ) : (
        <Grid container spacing={2}>
          {receipts.map((receipt) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={receipt.id}>
              <ReceiptCard>
                <CardActionArea onClick={() => openPreview(receipt)}>
                  {receipt.thumbnailUrl && receipt.mimeType.startsWith('image/') ? (
                    <CardMedia
                      component="img"
                      height="160"
                      image={receipt.thumbnailUrl}
                      alt={receipt.originalName}
                    />
                  ) : (
                    <Box sx={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <InsertDriveFileRoundedIcon color="action" fontSize="large" />
                    </Box>
                  )}
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} noWrap>
                      {receipt.originalName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(receipt.size / 1024).toFixed(1)} KB
                    </Typography>
                  </CardContent>
                </CardActionArea>
                <Stack direction="row" justifyContent="flex-end" sx={{ position: 'absolute', top: 8, right: 8 }}>
                  <IconButton color="inherit" size="small" onClick={() => openPreview(receipt)}>
                    <ZoomInRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    color="error"
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteReceipt(receipt.id);
                    }}
                  >
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </ReceiptCard>
              <Box sx={{ mt: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  component="label"
                  fullWidth
                  disabled={uploading}
                >
                  Replace
                  <input
                    type="file"
                    hidden
                    accept={ALLOWED_TYPES.join(',')}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (file.size > MAX_FILE_SIZE || !ALLOWED_TYPES.includes(file.type)) {
                        setError('Only images/PDFs under 10 MB are allowed.');
                        return;
                      }
                      replaceReceipt(receipt.id, file);
                    }}
                  />
                </Button>
              </Box>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={preview.open} onClose={closePreview} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Receipt</Typography>
          <IconButton onClick={closePreview}>
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {preview.receipt ? (
            <Stack spacing={2} alignItems="center">
              {preview.receipt.mimeType.startsWith('image/') ? (
                <Box
                  component="img"
                  src={preview.receipt.fileUrl}
                  alt={preview.receipt.originalName}
                  sx={{ maxWidth: '100%', transform: `scale(${zoom})`, transition: 'transform 0.2s ease-in-out' }}
                />
              ) : (
                <Alert severity="info">
                  This receipt is a PDF. Click the button below to open it in a new tab.
                </Alert>
              )}
              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  variant="outlined"
                  onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.1))}
                  disabled={zoom <= 0.5}
                >
                  Zoom out
                </Button>
                <Typography variant="body2">{Math.round(zoom * 100)}%</Typography>
                <Button variant="outlined" onClick={() => setZoom((prev) => Math.min(3, prev + 0.1))}>
                  Zoom in
                </Button>
              </Stack>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  component="a"
                  href={preview.receipt.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open original
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DeleteRoundedIcon />}
                  color="error"
                  onClick={() => {
                    deleteReceipt(preview.receipt.id);
                    closePreview();
                  }}
                >
                  Delete
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Typography>No receipt selected.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePreview}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

ReceiptManager.propTypes = {
  expenseId: PropTypes.string.isRequired,
  apiBaseUrl: PropTypes.string,
  authToken: PropTypes.string,
  onChange: PropTypes.func,
};

ReceiptManager.defaultProps = {
  apiBaseUrl: process.env.REACT_APP_API_URL || 'http://localhost:4000/api',
  authToken: undefined,
  onChange: undefined,
};

export default ReceiptManager;

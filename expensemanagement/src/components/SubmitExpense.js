import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { styled } from '@mui/material/styles';
import { useDropzone } from 'react-dropzone';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

const steps = ['Basic details', 'Upload receipt', 'OCR & validation', 'Review & submit'];

const DropzoneContainer = styled('div')(({ theme, isdragactive }) => ({
  border: `2px dashed ${isdragactive === 'true' ? theme.palette.primary.main : theme.palette.grey[400]}`,
  borderRadius: theme.shape.borderRadius * 2,
  padding: theme.spacing(5),
  textAlign: 'center',
  backgroundColor: theme.palette.background.default,
  transition: 'border-color 0.2s ease-in-out',
  cursor: 'pointer',
}));

const defaultCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'AUD'];

const SubmitExpense = ({
  categories = [],
  baseCurrency = 'USD',
  conversionRates = {},
  onSubmit,
  onCancel,
  defaultValues = {},
}) => {
  const {
    control,
    handleSubmit,
    watch,
    trigger,
    setValue,
    getValues,
    formState: { errors, isValid },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      amount: '',
      currency: baseCurrency,
      category: '',
      vendor: '',
      description: '',
      expenseDate: new Date().toISOString().slice(0, 10),
      receiptFile: null,
      ocrText: '',
      ...defaultValues,
    },
  });

  const [activeStep, setActiveStep] = useState(0);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [processedReceipt, setProcessedReceipt] = useState(null);
  const [preprocessState, setPreprocessState] = useState({ status: 'idle', error: null });
  const [ocrState, setOcrState] = useState({ status: 'idle', text: '', error: null });
  const [ocrProgress, setOcrProgress] = useState(0);
  const [extractedFields, setExtractedFields] = useState({ amount: null, date: null, vendor: '' });
  const [manualOverride, setManualOverride] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasProcessedOCRRef = useRef(false);

  const amount = watch('amount');
  const currency = watch('currency');

  const rate = useMemo(() => {
    if (currency === baseCurrency) return 1;
    if (conversionRates[currency]) return conversionRates[currency];
    return 1;
  }, [currency, baseCurrency, conversionRates]);

  const convertedAmount = useMemo(() => {
    const numericAmount = Number(amount) || 0;
    return numericAmount * rate;
  }, [amount, rate]);

  const handleNext = async () => {
    const currentStepValidations = [
      ['amount', 'currency', 'category', 'description', 'expenseDate'],
      ['receiptFile'],
      [],
      [],
    ];

    const fieldsToValidate = currentStepValidations[activeStep].filter(Boolean);
    const valid = fieldsToValidate.length ? await trigger(fieldsToValidate) : true;
    if (!valid) return;

    if (activeStep === 1 && !receiptPreview) {
      return;
    }

    if (activeStep === 2 && ocrState.status !== 'success') {
      return;
    }

    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const resetStepper = () => {
    setActiveStep(0);
    setReceiptPreview(null);
    if (processedReceipt?.url) URL.revokeObjectURL(processedReceipt.url);
    setProcessedReceipt(null);
    setPreprocessState({ status: 'idle', error: null });
    setOcrState({ status: 'idle', text: '', error: null });
    setOcrProgress(0);
    setExtractedFields({ amount: null, date: null, vendor: '' });
    setManualOverride(false);
    hasProcessedOCRRef.current = false;
  };

  const preprocessImage = useCallback(async (file) => {
    if (!file.type.startsWith('image/')) {
      return null;
    }

    const imageBitmap = await createImageBitmap(file);
    const MAX_DIMENSION = 2000;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(imageBitmap.width, imageBitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(imageBitmap.width * scale);
    canvas.height = Math.round(imageBitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const contrast = 40;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    let totalBrightness = 0;

    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      totalBrightness += gray;
      const contrasted = factor * (gray - 128) + 128;
      const clamped = Math.max(0, Math.min(255, contrasted));
      data[i] = clamped;
      data[i + 1] = clamped;
      data[i + 2] = clamped;
    }

    const avgBrightness = totalBrightness / (data.length / 4);
    const adjustment = avgBrightness < 110 ? 1.1 : 0.95;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] * adjustment));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * adjustment));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * adjustment));
    }

    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Unable to preprocess image'));
          return;
        }
        const url = URL.createObjectURL(blob);
        resolve({ blob, url });
      }, 'image/png', 0.92);
    });
  }, []);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return;
    const file = acceptedFiles[0];
    if (receiptPreview?.url) URL.revokeObjectURL(receiptPreview.url);
    if (processedReceipt?.url) URL.revokeObjectURL(processedReceipt.url);

    setValue('receiptFile', file, { shouldValidate: true });
    const preview = {
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    };
    setReceiptPreview(preview);
    setPreprocessState({ status: 'processing', error: null });
    setOcrState({ status: 'idle', text: '', error: null });
    setManualOverride(false);
    setExtractedFields({ amount: null, date: null, vendor: '' });
    setOcrProgress(0);
    hasProcessedOCRRef.current = false;

    try {
      const processed = await preprocessImage(file);
      if (processed) {
        setProcessedReceipt(processed);
        setPreprocessState({ status: 'success', error: null });
      } else {
        setProcessedReceipt(null);
        setPreprocessState({ status: 'skipped', error: null });
      }
    } catch (error) {
      console.error('Preprocessing failed:', error);
      setProcessedReceipt(null);
      setPreprocessState({ status: 'error', error: 'Unable to preprocess image. The original will be used.' });
    }
  }, [preprocessImage, processedReceipt, receiptPreview, setValue]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/pdf': ['.pdf'],
    },
  });

  const extractFieldsFromText = useCallback((text) => {
    if (!text) return { amount: null, date: null, vendor: '' };

    const amountPattern = /(?:total|amount|grand\s*total|balance)\D{0,15}(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i;
    const amountMatch = text.match(amountPattern);
    let amountValue = null;
    if (amountMatch?.[1]) {
      const normalized = amountMatch[1].replace(/,/g, '').replace(/\s/g, '');
      amountValue = parseFloat(normalized);
    }

    const datePattern = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\d{4}[/-]\d{1,2}[/-]\d{1,2})/;
    const dateMatch = text.match(datePattern);
    let isoDate = null;
    const parseDateString = (value) => {
      if (!value) return null;
      const parts = value.includes('-') ? value.split('-') : value.split('/');
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    };
    if (dateMatch) {
      isoDate = parseDateString(dateMatch[0].replaceAll('.', '-'));
    }

    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const vendorLine = lines.find((line) => line.length > 2 && /[A-Za-z]/.test(line)) || '';

    return {
      amount: amountValue,
      date: isoDate,
      vendor: vendorLine,
    };
  }, []);

  useEffect(() => {
    if (activeStep !== 2) return;
    if (!receiptPreview || hasProcessedOCRRef.current || preprocessState.status === 'processing') return;
    if (manualOverride) return;

    const processOCR = async () => {
      setOcrState({ status: 'processing', text: '', error: null, warning: null });
      setOcrProgress(0);
      try {
        const { createWorker, setLogger } = await import('tesseract.js');

        const progressLogger = (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        };

        setLogger(progressLogger);
        const worker = await createWorker();

        await worker.loadLanguage('eng');
        await worker.initialize('eng');

        const sourceUrl = processedReceipt?.url || receiptPreview.url;
        const { data } = await worker.recognize(sourceUrl);
        await worker.terminate();
        setLogger(() => {});

        const text = data?.text?.trim() || '';
        const warning = data?.confidence < 60 ? 'Low confidence detected. Please verify the extracted details.' : null;

        setOcrState({ status: 'success', text, error: null, warning });
        setValue('ocrText', text);
        const fields = extractFieldsFromText(text);
        setExtractedFields(fields);
        hasProcessedOCRRef.current = true;
      } catch (error) {
        console.error('OCR processing failed:', error);
        setOcrState({ status: 'error', text: '', error: 'Failed to process receipt. Please try again.' });
      }
    };

    processOCR();
  }, [activeStep, extractFieldsFromText, manualOverride, preprocessState.status, processedReceipt, receiptPreview, setValue]);

  useEffect(() => {
    if (!extractedFields) return;
    const currentAmount = Number(getValues('amount')) || 0;
    if (extractedFields.amount && currentAmount <= 0) {
      setValue('amount', extractedFields.amount.toFixed(2), { shouldValidate: true });
    }
    const currentDate = getValues('expenseDate');
    if (extractedFields.date && (!currentDate || currentDate === defaultValues.expenseDate)) {
      setValue('expenseDate', extractedFields.date, { shouldValidate: true });
    }
    const currentVendor = getValues('vendor');
    if (extractedFields.vendor && !currentVendor) {
      setValue('vendor', extractedFields.vendor, { shouldValidate: true });
    }
  }, [defaultValues.expenseDate, extractedFields, getValues, setValue]);

  const handleRetryOCR = () => {
    hasProcessedOCRRef.current = false;
    setOcrState({ status: 'idle', text: '', error: null });
  };

  const submitExpense = async (formData) => {
    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit({
          ...formData,
          convertedAmount,
          conversionRate: rate,
        });
      }
      resetStepper();
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Controller
                name="amount"
                control={control}
                rules={{
                  required: 'Amount is required',
                  validate: (value) => (Number(value) > 0 ? true : 'Amount must be greater than zero'),
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Amount"
                    fullWidth
                    error={!!errors.amount}
                    helperText={errors.amount?.message}
                    InputProps={{ inputProps: { min: 0, step: '0.01' } }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="currency"
                control={control}
                rules={{ required: 'Currency is required' }}
                render={({ field }) => (
                  <Autocomplete
                    {...field}
                    options={defaultCurrencies}
                    value={field.value}
                    onChange={(_, value) => field.onChange(value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Currency"
                        fullWidth
                        error={!!errors.currency}
                        helperText={errors.currency?.message}
                      />
                    )}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info" variant="outlined">
                Converted amount: <strong>{convertedAmount.toFixed(2)} {baseCurrency}</strong> (rate {rate.toFixed(3)})
              </Alert>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="category"
                control={control}
                rules={{ required: 'Category is required' }}
                render={({ field }) => (
                  <Autocomplete
                    {...field}
                    options={categories}
                    freeSolo
                    value={field.value}
                    onChange={(_, value) => field.onChange(value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Category"
                        fullWidth
                        error={!!errors.category}
                        helperText={errors.category?.message}
                      />
                    )}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="vendor"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Vendor"
                    fullWidth
                    placeholder="Merchant name"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="expenseDate"
                control={control}
                rules={{ required: 'Date is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="date"
                    label="Expense date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    error={!!errors.expenseDate}
                    helperText={errors.expenseDate?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="description"
                control={control}
                rules={{
                  required: 'Description is required',
                  minLength: { value: 5, message: 'Description should be at least 5 characters' },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Description"
                    fullWidth
                    multiline
                    minRows={3}
                    error={!!errors.description}
                    helperText={errors.description?.message}
                  />
                )}
              />
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Stack spacing={3}>
            <DropzoneContainer {...getRootProps()} isdragactive={isDragActive.toString()}>
              <input {...getInputProps()} />
              <CloudUploadRoundedIcon color={isDragActive ? 'primary' : 'action'} fontSize="large" />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Drag & drop receipt here, or click to select
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Supported formats: JPG, PNG, PDF (max 10 MB)
              </Typography>
            </DropzoneContainer>

            {errors.receiptFile && (
              <Alert severity="error">{errors.receiptFile.message}</Alert>
            )}

            {receiptPreview && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <InsertDriveFileRoundedIcon color="primary" />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {receiptPreview.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {(receiptPreview.size / 1024).toFixed(1)} KB · {receiptPreview.type}
                    </Typography>
                    {preprocessState.status === 'processing' && (
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        <LinearProgress />
                        <Typography variant="caption" color="text.secondary">
                          Enhancing image for better OCR...
                        </Typography>
                      </Stack>
                    )}
                    {preprocessState.status === 'error' && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        {preprocessState.error}
                      </Alert>
                    )}
                  </Box>
                  <Button color="secondary" onClick={() => {
                    setReceiptPreview(null);
                    setValue('receiptFile', null, { shouldValidate: true });
                    setOcrState({ status: 'idle', text: '', error: null });
                    if (processedReceipt?.url) URL.revokeObjectURL(processedReceipt.url);
                    setProcessedReceipt(null);
                    setPreprocessState({ status: 'idle', error: null });
                    hasProcessedOCRRef.current = false;
                  }}>
                    Remove
                  </Button>
                </Stack>
                {processedReceipt?.url && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Preview (processed for OCR):
                    </Typography>
                    <Box component="img" src={processedReceipt.url} alt="Processed receipt" sx={{ mt: 1, maxHeight: 220, borderRadius: 2, border: '1px solid', borderColor: 'divider' }} />
                  </Box>
                )}
              </Paper>
            )}
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={3}>
            {!receiptPreview && (
              <Alert severity="info">Please upload a receipt to start OCR processing.</Alert>
            )}

            {receiptPreview && (
              <Stack spacing={2}>
                <Typography variant="subtitle1">OCR status</Typography>
                {ocrState.status === 'processing' && (
                  <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                    <Stack spacing={2} alignItems="center">
                      <CircularProgress />
                      <Typography variant="body2" color="text.secondary">
                        Reading receipt...
                      </Typography>
                      <LinearProgress variant="determinate" value={ocrProgress} sx={{ width: '100%' }} />
                      <Typography variant="caption" color="text.secondary">
                        {ocrProgress}%
                      </Typography>
                    </Stack>
                  </Paper>
                )}

                {ocrState.status === 'error' && (
                  <Alert
                    severity="error"
                    action={
                      <Stack direction="row" spacing={1}>
                        <Button color="inherit" size="small" onClick={handleRetryOCR} startIcon={<ReplayRoundedIcon />}>
                          Retry
                        </Button>
                        <Button color="inherit" size="small" onClick={() => {
                          setManualOverride(true);
                          setOcrState((prev) => ({ ...prev, status: 'manual' }));
                        }}>
                          Continue manually
                        </Button>
                      </Stack>
                    }
                  >
                    {ocrState.error}
                  </Alert>
                )}

                {ocrState.status === 'success' && (
                  <Paper variant="outlined" sx={{ p: 3 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <CheckCircleRoundedIcon color="success" />
                      <Typography variant="subtitle1" fontWeight={600}>
                        OCR completed
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Review extracted details and ensure they match the receipt.
                    </Typography>
                    <TextField
                      value={ocrState.text}
                      onChange={(event) => {
                        setOcrState((prev) => ({ ...prev, text: event.target.value }));
                        setValue('ocrText', event.target.value);
                      }}
                      multiline
                      minRows={6}
                      fullWidth
                    />
                    {ocrState.warning && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        {ocrState.warning}
                      </Alert>
                    )}
                    <Stack spacing={2} sx={{ mt: 3 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Detected fields
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Amount"
                            value={extractedFields.amount ?? ''}
                            onChange={(event) => {
                              const nextAmount = event.target.value;
                              setExtractedFields((prev) => ({ ...prev, amount: Number(nextAmount) || null }));
                              if (nextAmount) {
                                setValue('amount', Number(nextAmount), { shouldValidate: true });
                              }
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Date"
                            value={extractedFields.date ?? ''}
                            onChange={(event) => {
                              const nextDate = event.target.value;
                              setExtractedFields((prev) => ({ ...prev, date: nextDate }));
                              if (nextDate) {
                                setValue('expenseDate', nextDate, { shouldValidate: true });
                              }
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Vendor"
                            value={extractedFields.vendor ?? ''}
                            onChange={(event) => {
                              const nextVendor = event.target.value;
                              setExtractedFields((prev) => ({ ...prev, vendor: nextVendor }));
                              setValue('vendor', nextVendor, { shouldValidate: true });
                            }}
                          />
                        </Grid>
                      </Grid>
                    </Stack>
                  </Paper>
                )}

                {ocrState.status === 'manual' && (
                  <Alert severity="info">
                    Manual override enabled. Please ensure all fields are filled out before submitting.
                  </Alert>
                )}
              </Stack>
            )}
          </Stack>
        );

      case 3:
      default:
        const values = getValues();
        return (
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Review expense
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Amount</Typography>
                <Typography variant="body1" fontWeight={600}>
                  {Number(values.amount).toFixed(2)} {values.currency} ({convertedAmount.toFixed(2)} {baseCurrency})
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Category</Typography>
                <Chip label={values.category || 'N/A'} color="primary" />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Vendor</Typography>
                <Typography variant="body1">{values.vendor || 'Not provided'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Date</Typography>
                <Typography variant="body1">{values.expenseDate}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                <Typography variant="body1">{values.description}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">OCR text</Typography>
                <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'background.default' }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {values.ocrText || 'No OCR data available'}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Paper>
        );
    }
  };

  return (
    <Box component={Paper} elevation={3} sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Submit a new expense
      </Typography>

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box>{renderStepContent()}</Box>

      <Divider sx={{ my: 4 }} />

      <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button variant="outlined" onClick={handleBack} disabled={activeStep === 0}>
            Back
          </Button>
          {onCancel && (
            <Button variant="text" color="inherit" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Stack>
        {activeStep < steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={(activeStep === 2 && ocrState.status !== 'success' && ocrState.status !== 'manual') || (activeStep === 1 && !receiptPreview)}
          >
            Continue
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit(submitExpense)}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit expense'}
          </Button>
        )}
      </Stack>
    </Box>
  );
};

SubmitExpense.propTypes = {
  categories: PropTypes.arrayOf(PropTypes.string),
  baseCurrency: PropTypes.string,
  conversionRates: PropTypes.object,
  onSubmit: PropTypes.func,
  onCancel: PropTypes.func,
  defaultValues: PropTypes.object,
};

export default SubmitExpense;

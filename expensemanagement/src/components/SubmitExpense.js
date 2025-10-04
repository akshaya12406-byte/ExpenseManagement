import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  Chip,
  Divider,
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
      description: '',
      expenseDate: new Date().toISOString().slice(0, 10),
      receiptFile: null,
      ocrText: '',
      ...defaultValues,
    },
  });

  const [activeStep, setActiveStep] = useState(0);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [ocrState, setOcrState] = useState({ status: 'idle', text: '', error: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasProcessedOCRRef = useRef(false);

  const amount = watch('amount');
  const currency = watch('currency');
  const selectedCategory = watch('category');

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
    setOcrState({ status: 'idle', text: '', error: null });
    hasProcessedOCRRef.current = false;
  };

  const onDrop = useCallback((acceptedFiles) => {
    if (!acceptedFiles.length) return;
    const file = acceptedFiles[0];
    setValue('receiptFile', file, { shouldValidate: true });
    setReceiptPreview({
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    });
    setOcrState({ status: 'idle', text: '', error: null });
    hasProcessedOCRRef.current = false;
  }, [setValue]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/pdf': ['.pdf'],
    },
  });

  useEffect(() => {
    if (activeStep !== 2) return;
    if (!receiptPreview || hasProcessedOCRRef.current) return;

    const processOCR = async () => {
      setOcrState({ status: 'processing', text: '', error: null });
      try {
        const { default: Tesseract } = await import('tesseract.js');
        const result = await Tesseract.recognize(receiptPreview.url, 'eng');
        const text = result?.data?.text || '';
        setOcrState({ status: 'success', text, error: null });
        setValue('ocrText', text);
        hasProcessedOCRRef.current = true;
      } catch (error) {
        console.error('OCR processing failed:', error);
        setOcrState({ status: 'error', text: '', error: 'Failed to process receipt. Please try again.' });
      }
    };

    processOCR();
  }, [activeStep, receiptPreview, setValue]);

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
                  </Box>
                  <Button color="secondary" onClick={() => {
                    setReceiptPreview(null);
                    setValue('receiptFile', null, { shouldValidate: true });
                    setOcrState({ status: 'idle', text: '', error: null });
                    hasProcessedOCRRef.current = false;
                  }}>
                    Remove
                  </Button>
                </Stack>
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
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Reading receipt...
                    </Typography>
                  </Paper>
                )}

                {ocrState.status === 'error' && (
                  <Alert
                    severity="error"
                    action={
                      <Button color="inherit" size="small" onClick={handleRetryOCR} startIcon={<ReplayRoundedIcon />}>Retry</Button>
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
                  </Paper>
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
            disabled={(activeStep === 2 && ocrState.status !== 'success') || (activeStep === 1 && !receiptPreview)}
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

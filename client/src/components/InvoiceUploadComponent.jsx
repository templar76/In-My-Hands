import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  LinearProgress,
  Alert
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import { getAuth } from 'firebase/auth';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import ClientLogger from '../utils/ClientLogger';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const InvoiceUploadComponent = ({ onSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      if (f.size > MAX_FILE_SIZE) {
        setError(`File troppo grande. Max ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(1)}MB`);
        return;
      }
      setFile(f);
      setError('');
      setSuccess('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (fileRejections) => {
      const errorMsgs = fileRejections.map(fr =>
        fr.errors.map(e => e.message).join(', ')
      ).join('; ');
      setError(errorMsgs || 'File non accettato');
    },
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'text/xml': ['.xml'],
      'application/xml': ['.xml']
    },
    maxSize: MAX_FILE_SIZE
  });

  const handleUpload = async () => {
    if (!file) return setError('Seleziona un file prima di caricare');

    setUploading(true);
    setProgress(0);
    setError('');
    setSuccess('');

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Utente non autenticato');
      const token = await user.getIdToken();

      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post(
        `${getApiUrl()}/api/invoices/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          },
          onUploadProgress: e => {
            setProgress(Math.round((e.loaded * 100) / e.total));
          }
        }
      );

      ClientLogger.info('Invoice file uploaded successfully', {
        component: 'InvoiceUploadComponent',
        action: 'handleUpload',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        responseData: {
          success: res.data.success,
          invoiceId: res.data.invoiceId,
          message: res.data.message
        }
      });
      setSuccess('Fattura caricata con successo');
      setFile(null);
      setProgress(0);
      
      // Chiama callback di successo dopo un breve delay
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1500);
      
    } catch (err) {
      ClientLogger.error('Error uploading invoice file', {
        component: 'InvoiceUploadComponent',
        action: 'handleUpload',
        fileName: file?.name,
        fileSize: file?.size,
        fileType: file?.type,
        error: err.message,
        status: err.response?.status,
        responseData: err.response?.data
      });
      setError(
        err.response?.data?.error ||
        err.message ||
        'Errore durante il caricamento'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Paper
        {...getRootProps()}
        variant="outlined"
        sx={{
          p: 4,
          textAlign: 'center',
          borderColor: isDragActive ? 'primary.main' : 'grey.400',
          bgcolor: isDragActive ? 'grey.100' : 'transparent',
          cursor: 'pointer',
          mb: 2
        }}
      >
        <input {...getInputProps()} />
        {
          isDragActive
            ? <Typography>Rilascia qui il file...</Typography>
            : <Typography>
                Trascina qui il PDF o XML, oppure clicca per selezionarlo
              </Typography>
        }
        {file && (
          <Typography sx={{ mt: 2 }}>
            File selezionato: <strong>{file.name}</strong>
          </Typography>
        )}
      </Paper>

      {uploading && (
        <Box mb={2}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="body2" align="center">{progress}%</Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Button
        variant="contained"
        disabled={!file || uploading}
        onClick={handleUpload}
        fullWidth
      >
        {uploading ? 'Caricamento...' : 'Carica Fattura'}
      </Button>
    </Box>
  );
};

export default InvoiceUploadComponent;
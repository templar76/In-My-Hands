import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Button,
  Typography,
  Paper,
  LinearProgress,
  Alert
} from '@mui/material';
import { getApiUrl } from '../utils/apiConfig';
import ClientLogger from '../utils/ClientLogger';

// Max file size in bytes (e.g. 10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const API_URL = getApiUrl();

export default function InvoiceUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // gestione drag&drop
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
  const {getRootProps, getInputProps, isDragActive} = useDropzone({
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
        `${API_URL}/api/invoices/upload`,
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

      ClientLogger.info('File uploaded successfully', {
        filePath: res.data.path,
        fileName: file.name,
        fileSize: file.size,
        context: 'InvoiceUpload.handleUpload'
      });
      setSuccess('Fattura caricata con successo');
      setFile(null);
      setProgress(0);
    } catch (err) {
      ClientLogger.error('Invoice upload failed', {
        error: err,
        fileName: file?.name,
        fileSize: file?.size,
        errorResponse: err.response?.data,
        context: 'InvoiceUpload.handleUpload'
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
    <Box p={4} maxWidth={600} mx="auto">
      <Typography variant="h5" gutterBottom>
        Carica la tua fattura
      </Typography>

      <Paper
        {...getRootProps()}
        variant="outlined"
        sx={{
          p: 4,
          textAlign: 'center',
          borderColor: isDragActive ? 'primary.main' : 'grey.400',
          bgcolor: isDragActive ? 'grey.100' : 'transparent',
          cursor: 'pointer'
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
        <Box my={2}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="body2" align="center">{progress}%</Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {success}
        </Alert>
      )}

      <Box mt={3} display="flex" justifyContent="space-between">
        <Button
          variant="contained"
          disabled={!file || uploading}
          onClick={handleUpload}
        >
          Carica
        </Button>
        <Button
          variant="outlined"
          onClick={() => navigate('/dashboard')}
          disabled={uploading}
        >
          Annulla
        </Button>
      </Box>
    </Box>
  );
}
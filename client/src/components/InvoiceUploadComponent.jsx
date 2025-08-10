import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Button,
  Typography,
  Paper,
  LinearProgress,
  Alert
} from '@mui/material';
import { Upload } from '@mui/icons-material'; // Aggiunto import dell'icona Upload
import { getAuth } from 'firebase/auth';
import axiosInstance from '../utils/axiosConfig';
import { getApiUrl } from '../utils/apiConfig'; // ✅ CORRETTO: era '../utils/api'
import ClientLogger from '../utils/ClientLogger'; // ✅ CORRETTO: era '../utils/clientLogger'

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const InvoiceUploadComponent = ({ onSuccess }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles.length > 0) {
      const validFiles = acceptedFiles.filter(f => f.size <= MAX_FILE_SIZE);
      if (validFiles.length !== acceptedFiles.length) {
        setError(`Alcuni file superano il limite di ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(1)}MB`);
      }
      setFiles(validFiles);
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
    multiple: true,
    accept: {
      'application/pdf': ['.pdf'],
      'text/xml': ['.xml'],
      'application/xml': ['.xml'],
      'application/pkcs7-mime': ['.p7m'],
      'application/zip': ['.zip']
    },
    maxSize: MAX_FILE_SIZE
  });

  const handleUpload = async () => {
    if (!files || files.length === 0) {
      return setError('Seleziona almeno un file prima di caricare');
    }

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
      files.forEach(file => {
        formData.append('files', file);
      });

      // Modifica questa parte nella funzione handleUpload
      const res = await axiosInstance.post(
        `/api/invoices/upload-tracked`,
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
      
      // Modifica qui: controlla se i dati sono nell'oggetto data della risposta
      const responseData = res.data.data || res.data;
      if (responseData.jobId) {
        setSuccess(`Elaborazione avviata. Job ID: ${responseData.jobId}`);
        
        if (onSuccess) {
          onSuccess({
            jobId: responseData.jobId,
            totalFiles: responseData.uploadedFiles || responseData.totalFiles
          });
        }
      }

      ClientLogger.info('Invoice files uploaded successfully', {
        component: 'InvoiceUploadComponent',
        action: 'handleUpload',
        filesCount: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        responseData: {
          success: res.data.success,
          jobId: responseData.jobId,
          message: responseData.message
        }
      });
      
      setFiles([]);
      setProgress(0);
      
    } catch (err) {
      ClientLogger.error('Error uploading invoice files', {
        component: 'InvoiceUploadComponent',
        action: 'handleUpload',
        filesCount: files?.length,
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
          p: 3, // Ridotto da 4 a 3
          textAlign: 'center',
          borderColor: isDragActive ? 'primary.main' : 'grey.300',
          bgcolor: isDragActive ? 'primary.50' : 'grey.50',
          cursor: 'pointer',
          mb: 2,
          borderStyle: 'dashed', // Aggiunto stile tratteggiato
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'primary.25'
          }
        }}
      >
        <input {...getInputProps()} />
        <Upload sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        {
          isDragActive
            ? <Typography variant="h6" color="primary">Rilascia qui i file...</Typography>
            : <>
                <Typography variant="h6" gutterBottom>
                  Trascina i file qui o clicca per selezionarli
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Formati supportati: PDF, XML, P7M, ZIP • Max 10MB per file
                </Typography>
              </>
        }
        {files.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              File selezionati: <strong>{files.length}</strong>
            </Typography>
            <Box sx={{ maxHeight: 120, overflowY: 'auto' }}>
              {files.map((file, index) => (
                <Typography key={index} variant="body2" component="div" sx={{ textAlign: 'left' }}>
                  📄 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </Typography>
              ))}
            </Box>
          </Box>
        )}
      </Paper>

      {uploading && (
        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2">Caricamento in corso...</Typography>
            <Typography variant="body2" fontWeight="bold">{progress}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
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

      <Box display="flex" gap={2}>
        <Button
          variant="contained"
          disabled={files.length === 0 || uploading}
          onClick={handleUpload}
          sx={{ flex: 1 }}
          size="large"
        >
          {uploading ? 'Caricamento...' : `Carica ${files.length > 1 ? files.length + ' File' : 'File'}`}
        </Button>
        {files.length > 0 && !uploading && (
          <Button
            variant="outlined"
            onClick={() => {
              setFiles([]);
              setError('');
              setSuccess('');
            }}
            size="large"
          >
            Cancella
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default InvoiceUploadComponent;
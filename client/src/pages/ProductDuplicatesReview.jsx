import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase'; // Importa auth da Firebase
import {
  Box,
  Typography,
  Alert,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress
} from '@mui/material';
import { getApiUrl } from '../utils/apiConfig'; // Importa la funzione helper

const API_URL = getApiUrl();

// Aggiungi questa funzione formatCurrency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

const ProductDuplicatesReview = () => {
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState({ type: '', message: '' });

  const navigate = useNavigate();

  useEffect(() => {
    const fetchDuplicates = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError('Utente non autenticato.');
          setLoading(false);
          return;
        }
        const token = await user.getIdToken();
        const res = await axios.get(`${API_URL}/api/products/duplicates`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setDuplicates(res.data); // [{ standardDesc, items: [ { _id, supplierName, price }, … ] }, …]
      } catch (err) {
        setError(err.response?.data?.error || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDuplicates();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box mx={2} my={4}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const handleMerge = async (groupId) => {
    try {
      setLoading(true);
      const token = await auth.currentUser.getIdToken();
      await axios.post(
        `${API_URL}/api/products/duplicates/${groupId}/merge`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAlert({ type: 'success', message: 'Prodotti uniti con successo.' });
      setDuplicates(prev => prev.filter(g => g.id !== groupId));
    } catch (err) {
      setAlert({ type: 'error', message: 'Merge fallito. Riprova più tardi.' });
    } finally {
      setLoading(false);
    }
  };

  const handleIgnore = async (groupId) => {
    try {
      const token = await auth.currentUser.getIdToken();
      await axios.post(
        `${API_URL}/api/products/duplicates/${groupId}/ignore`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAlert({ type: 'info', message: 'Gruppo ignorato.' });
      setDuplicates(prev => prev.filter(g => g.id !== groupId));
    } catch (err) {
      setAlert({ type: 'error', message: 'Operazione fallita. Riprova.' });
    }
  };

  return (
    <Box p={2}>
      <Typography variant="h4" gutterBottom>
        Verifica Duplicati Prodotti
      </Typography>

      {alert.message && (
        <Alert severity={alert.type} onClose={() => setAlert({ type: '', message: '' })} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

      {duplicates.length === 0 ? (
        <Alert severity="info">Nessun duplicato rilevato.</Alert>
      ) : (
        duplicates.map((group, idx) => (
          <Box key={idx} mb={4} p={2} border="1px solid #e0e0e0" borderRadius={2}>
            <Typography variant="h6" gutterBottom>
              Gruppo #{idx + 1}: “{group.standardDesc}”
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fornitore</TableCell>
                  <TableCell>Prezzo</TableCell>
                  <TableCell>ID Prodotto</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.items.map(item => (
                  <TableRow key={item._id}>
                    <TableCell>{item.supplierName}</TableCell>
                    <TableCell>{formatCurrency(item.price)}</TableCell>
                    <TableCell>{item._id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box mt={2} display="flex" gap={2}>
              <Button variant="contained" color="primary" onClick={() => handleMerge(group.id)}>
                Unisci Gruppo
              </Button>
              <Button variant="outlined" color="secondary" onClick={() => handleIgnore(group.id)}>
                Ignora
              </Button>
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
};

export default ProductDuplicatesReview;
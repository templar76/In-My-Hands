import React, { useState, useEffect } from 'react';
import { Table, Button, TextField } from '@mui/material';
import axios from 'axios';
import { auth } from '../firebase'; // Importa auth da Firebase
import { getApiUrl } from '../utils/apiConfig'; // Importa la funzione helper

const API_URL = getApiUrl();

const DuplicateManager = () => {
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState({});

  useEffect(() => {
    async function fetchDuplicates() {
      try {
        const user = auth.currentUser;
        if (!user) {
          console.error('DuplicateManager: Utente non autenticato per fetchDuplicates.');
          // Potresti voler impostare uno stato di errore qui
          return;
        }
        const token = await user.getIdToken();
        const { data } = await axios.get(
          `${API_URL}/api/products/duplicates`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setCandidates(data);
      } catch (error) {
        console.error('Errore durante il fetch dei duplicati:', error);
        // Potresti voler impostare uno stato di errore qui
      }
    }
    fetchDuplicates();
  }, []);

  const handleMerge = async (prodA, prodB) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.error('DuplicateManager: Utente non autenticato per handleMerge.');
        // Potresti voler impostare uno stato di errore qui
        return;
      }
      const token = await user.getIdToken();
      await axios.post(
        `${API_URL}/api/products/merge`,
        { keepId: prodA._id, removeId: prodB._id },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      // refresh lista - ricarica i duplicati dopo il merge
      async function fetchDuplicates() {
        try {
          const user = auth.currentUser;
          if (!user) {
            console.error('DuplicateManager: Utente non autenticato per fetchDuplicates post-merge.');
            return;
          }
          const token = await user.getIdToken();
          const { data } = await axios.get(
            `${API_URL}/api/products/duplicates`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          setCandidates(data);
        } catch (error) {
          console.error('Errore durante il fetch dei duplicati post-merge:', error);
        }
      }
      fetchDuplicates();
    } catch (error) {
      console.error('Errore durante il merge dei prodotti:', error);
      // Potresti voler impostare uno stato di errore qui
    }
  };

  return (
    <div>
      <h2>Gestione Prodotti Duplicati</h2>
      <Table>
        <thead>
          <tr><th>Prod A</th><th>Prod B</th><th>Azione</th></tr>
        </thead>
        <tbody>
          {candidates.map(({ a, b }) => (
            <tr key={`${a._id}-${b._id}`}>
              <td>{a.description}</td>
              <td>{b.description}</td>
              <td>
                <Button onClick={() => handleMerge(a, b)}>
                  Unisci
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default DuplicateManager;
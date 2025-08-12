// src/utils/authUtils.js
import { getFirebaseToken } from '../store/authSlice';

/**
 * Helper per ottenere il token Firebase in modo sicuro
 * Gestisce l'estrazione del token dall'oggetto restituito da getFirebaseToken
 * 
 * @param {Function} dispatch - La funzione dispatch di Redux
 * @returns {Promise<string>} Il token Firebase
 */
export const getAuthToken = async (dispatch) => {
  try {
    const result = await dispatch(getFirebaseToken()).unwrap();
    // Estrae il token dall'oggetto restituito da getFirebaseToken
    return result.token;
  } catch (error) {
    console.error('Errore durante il recupero del token Firebase:', error);
    throw error;
  }
};
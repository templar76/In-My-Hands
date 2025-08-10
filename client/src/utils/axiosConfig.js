import axios from 'axios';
import { getApiUrl } from './apiConfig';

// Crea un'istanza di Axios con la configurazione di base
const axiosInstance = axios.create({
  baseURL: getApiUrl(),
});

// Configurazione del retry
const MAX_RETRIES = 2; // Ridotto da 3 a 2
const RETRY_DELAY = 3000; // Aumentato da 2 a 3 secondi
const MAX_RETRY_DELAY = 15000; // Massimo ritardo di 15 secondi

// Interceptor per la gestione degli errori
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    
    // Se non è un errore di risposta o la richiesta è già stata ritentata troppe volte, rifiuta
    if (!response || !config || config.retryCount >= MAX_RETRIES) {
      return Promise.reject(error);
    }
    
    // Inizializza il contatore di retry se non esiste
    config.retryCount = config.retryCount || 0;
    
    // Gestisci specificamente gli errori 429
    if (response.status === 429) {
      config.retryCount += 1;
      
      // Calcola il ritardo con backoff esponenziale più aggressivo
      let delay = RETRY_DELAY * Math.pow(3, config.retryCount - 1); // Usa fattore 3 invece di 2
      delay = Math.min(delay, MAX_RETRY_DELAY); // Limita il ritardo massimo
      
      console.log(`Richiesta limitata (429). Riprovo tra ${delay/1000} secondi...`);
      
      // Attendi prima di riprovare
      return new Promise(resolve => {
        setTimeout(() => resolve(axiosInstance(config)), delay);
      });
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
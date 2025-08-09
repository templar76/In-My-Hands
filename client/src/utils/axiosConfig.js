import axios from 'axios';
import { getApiUrl } from './apiConfig';

// Crea un'istanza di Axios con la configurazione di base
const axiosInstance = axios.create({
  baseURL: getApiUrl(),
});

// Configurazione del retry
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 secondi

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
      
      // Calcola il ritardo con backoff esponenziale
      const delay = RETRY_DELAY * Math.pow(2, config.retryCount - 1);
      
      // Attendi prima di riprovare
      return new Promise(resolve => {
        setTimeout(() => resolve(axiosInstance(config)), delay);
      });
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
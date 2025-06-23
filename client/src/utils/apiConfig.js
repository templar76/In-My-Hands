// src/utils/apiConfig.js

export const getApiUrl = () => {
  const urls = process.env.REACT_APP_API_URLS || 'http://localhost:4000';
  const urlArray = urls.split(',');

  // Controlla se l'applicazione è in esecuzione in un browser
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return urlArray[0].trim(); // Usa il primo URL per localhost
    }
    // Usa il secondo URL per l'accesso pubblico, o il primo se ne è fornito solo uno
    return (urlArray[1] || urlArray[0]).trim();
  }
  
  // Fallback per ambienti non browser (es. test Node.js) o se window.location non è disponibile
  // In questo caso, potrebbe essere necessario un meccanismo di configurazione diverso
  // per ora, restituisce il primo URL come default.
  return urlArray[0].trim();
};
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import './index.css';
import App from './App';
import theme from './theme';
import store from './store/store';
import reportWebVitals from './reportWebVitals';
import './firebase';  // assicura l'inizializzazione
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { clearUser, fetchUserProfile } from './store/authSlice'; // Modificato setUser con fetchUserProfile

// Importa e esponi ClientLogger globalmente
import ClientLogger from './utils/ClientLogger';
window.ClientLogger = ClientLogger;

// Listen for Firebase auth state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Se l'utente è autenticato con Firebase, recupera il profilo completo dal backend
    // Questo include tenantId, role, e altre informazioni specifiche dell'applicazione
    store.dispatch(fetchUserProfile());
  } else {
    // Se l'utente non è autenticato (logout o sessione scaduta), pulisci lo stato utente
    store.dispatch(clearUser());
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);

reportWebVitals();

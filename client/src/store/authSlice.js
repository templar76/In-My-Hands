import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { auth } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  //onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { updateUserProfile } from './userSlice'; // Importa l'azione da userSlice
import { getApiUrl } from '../utils/apiConfig'; // Importa la funzione helper
import ClientLogger from '../utils/ClientLogger'; // Import mancante aggiunto

// Async thunks
export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async ({ email, password, subscription }, { rejectWithValue }) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Chiama il backend per creare l'utente e il tenant in MongoDB
      const API_URL = getApiUrl(); 
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyType: 'Default Type',
          companyName: `Tenant di ${firebaseUser.email}`,
          vatNumber: `VAT-${Date.now()}`,
          address: 'Default Address',
          contacts: {
            email: firebaseUser.email,
            phone: '0000000000',
            sdiCode: 'XXXXXXX',
            pec: `${firebaseUser.email.split('@')[0]}.pec@example.com`
          },
          metadata: {},
          admin: {
            displayName: firebaseUser.displayName || '',
            email: firebaseUser.email,
            role: 'admin'
          },
          subscription
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register user on backend');
      }

      const backendUser = await response.json(); // Dati utente dal backend, inclusi tenantId e role

      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        subscription: backendUser.subscription,
        tenantId: backendUser.tenantId,
        role: backendUser.role
      };
    } catch (error) {
      ClientLogger.error('registerUser error:', { code: error.code, message: error.message });
      return rejectWithValue(error.message);
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName
      };
    } catch (error) {
      ClientLogger.error('loginUser error:', { code: error.code, message: error.message });
      return rejectWithValue(error.message);
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      await signOut(auth);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (email, { rejectWithValue }) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Async thunk to fetch user profile when Firebase auth state changes
export const fetchUserProfile = createAsyncThunk(
  'auth/fetchUserProfile',
  async (_, { rejectWithValue, dispatch }) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      return rejectWithValue('No Firebase user currently authenticated.');
    }
    
    // Configurazione del retry con backoff esponenziale
    const MAX_RETRIES = 3;
    const INITIAL_RETRY_DELAY = 1000; // 1 secondo
    let retryCount = 0;
    
    const executeWithRetry = async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const API_URL = getApiUrl();
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          // Gestione specifica per errori 429 (Too Many Requests)
          if (response.status === 429 && retryCount < MAX_RETRIES) {
            retryCount++;
            // Calcola il ritardo con backoff esponenziale
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1);
            ClientLogger.warn(`fetchUserProfile: Rate limit exceeded (429). Retrying in ${delay}ms. Attempt ${retryCount}/${MAX_RETRIES}`);
            
            // Attendi prima di riprovare
            await new Promise(resolve => setTimeout(resolve, delay));
            return executeWithRetry(); // Riprova
          }
          
          if (response.status === 401) {
            ClientLogger.warn('fetchUserProfile: User not found or not authorized in backend (401). Clearing session.');
            dispatch(clearUser()); 
            return rejectWithValue('User not found or not authorized in backend.');
          }
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch user profile: ${response.status}`);
        }
        const userProfile = await response.json();
        return userProfile; 
      } catch (error) {
        // Per altri errori di rete, prova il retry
        if (error.message.includes('network') && retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1);
          ClientLogger.warn(`fetchUserProfile: Network error. Retrying in ${delay}ms. Attempt ${retryCount}/${MAX_RETRIES}`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeWithRetry(); // Riprova
        }
        
        ClientLogger.error('fetchUserProfile error:', { message: error.message });
        dispatch(clearUser()); 
        return rejectWithValue(error.message);
      }
    };
    
    return executeWithRetry();
  }
);

export const signInWithGoogle = createAsyncThunk(
  'auth/signInWithGoogle',
  async (_, { rejectWithValue }) => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      // Call backend to create/get tenant and user record
      const API_URL = getApiUrl();
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyType: 'Default Type',
          companyName: `Tenant di ${firebaseUser.email}`,
          vatNumber: `VAT-${Date.now()}`,
          address: 'Default Address',
          contacts: {
            email: firebaseUser.email,
            phone: '0000000000',
            sdiCode: 'XXXXXXX',
            pec: `${firebaseUser.email.split('@')[0]}.pec@example.com`
          },
          metadata: {},
          admin: {
            displayName: firebaseUser.displayName || '',
            email: firebaseUser.email,
            role: 'admin'
          },
          subscription: { plan: 'free', trialDays: 365 }
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Backend registration failed');
      }
      const backendUser = await response.json();
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        subscription: backendUser.subscription,
        tenantId: backendUser.tenantId,
        role: backendUser.role
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Async thunk to get Firebase ID token
export const getFirebaseToken = createAsyncThunk(
  'auth/getFirebaseToken',
  async (_, { rejectWithValue }) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      return rejectWithValue('Nessun utente Firebase attualmente autenticato.');
    }
    try {
      const token = await firebaseUser.getIdToken(true); // true forza l'aggiornamento del token se scaduto
      return token;
    } catch (error) {
      ClientLogger.error('getFirebaseToken error:', { message: error.message });
      return rejectWithValue(error.message);
    }
  }
);

// Slice
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null, // Conterrà l'intero oggetto utente dal backend, inclusi tenant e role
    isAuthenticated: false,
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
    companyName: null, // Aggiunto per accesso diretto
    role: null,        // Aggiunto per accesso diretto
    isSubscriptionModalOpen: false,
    subscriptionPlan: null, // 'monthly', 'annual'
    registrationToken: null, // Per la fase 2 della registrazione tenant
    registrationTokenStatus: 'idle',
    registrationTokenError: null,
    completeRegistrationStatus: 'idle',
    completeRegistrationError: null,
    passwordResetStatus: 'idle',
    passwordResetError: null,
    tokenRefreshStatus: 'idle', // Aggiunto per il refresh del token
    tokenRefreshError: null   // Aggiunto per il refresh del token
  },
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.tenantId = action.payload?.tenantId || null;
      state.role = action.payload?.role || null;
      state.status = 'succeeded';
      state.error = null;
    },
    clearUser: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.status = 'idle';
      state.error = null;
      state.companyName = null; // Resetta anche questi
      state.role = null;        // Resetta anche questi
    },
    // Potremmo aggiungere un reducer per aggiornare lo stato direttamente se necessario,
    // ma fetchUserProfile.fulfilled gestisce l'impostazione dell'utente.
    _tempSetUserLoading(state) { // Temporaneo per testare stati, se necessario
      state.status = 'loading';
    }
  },
  extraReducers: builder => {
    builder
      .addCase(registerUser.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
        state.tenantId = action.payload.tenantId;
        state.role = action.payload.role;
        state.subscription = action.payload.subscription;
        state.status = 'succeeded';
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(loginUser.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
        // Assumiamo che il login restituisca anche tenantId e role se necessario
        // o che vengano recuperati separatamente (es. da onAuthStateChanged + /api/auth/me)
        state.tenantId = action.payload.tenantId; 
        state.role = action.payload.role;
        state.status = 'succeeded';
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.status = 'idle';
        state.error = null;
        state.companyName = null; // Resetta anche questi
        state.role = null;        // Resetta anche questi
      })
      .addCase(resetPassword.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, state => {
        state.status = 'succeeded';
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(signInWithGoogle.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(signInWithGoogle.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
        state.subscription = action.payload.subscription;
        state.tenantId = action.payload.tenantId;
        state.role = action.payload.role;
        state.status = 'succeeded';
      })
      .addCase(signInWithGoogle.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Reducers for fetchUserProfile
      .addCase(fetchUserProfile.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        ClientLogger.debug('authSlice - fetchUserProfile.fulfilled', { payload: action.payload });
        state.status = 'succeeded';
        state.user = action.payload; // userProfile from backend
        state.isAuthenticated = true;
        state.error = null;

        // Estrai companyName, role e tenantId per un accesso più facile
        if (action.payload) {
          if (action.payload.tenant) {
            state.companyName = action.payload.tenant.companyName || 'N/A';
            ClientLogger.debug('authSlice - companyName set', { companyName: state.companyName });
          } else {
            state.companyName = 'N/A';
            ClientLogger.debug('authSlice - companyName set to N/A (no tenant in payload or companyName missing)');
          }
          if (action.payload.role) {
            state.role = action.payload.role;
            ClientLogger.debug('authSlice - role set', { role: state.role });
          } else {
            state.role = null;
            ClientLogger.debug('authSlice - role set to null (no role in payload)');
          }
          if (action.payload.tenantId) {
            state.tenantId = action.payload.tenantId;
            ClientLogger.debug('authSlice - tenantId set', { tenantId: state.tenantId });
          } else {
            state.tenantId = null;
            ClientLogger.debug('authSlice - tenantId set to null (no tenantId in payload)');
          }
        }
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload; 
        // Lo stato dell'utente viene già cancellato dal thunk stesso in caso di errore
      })
      // Aggiorna il displayName in auth.user quando updateUserProfile da userSlice ha successo
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        if (state.user && action.payload) {
          // Assumiamo che action.payload da updateUserProfile contenga i dati aggiornati dell'utente
          // Esempio: action.payload = { uid: '...', displayName: 'Nuovo Nome', ... } o action.payload.user = { ... }
          const updatedUserData = action.payload.user || action.payload;
          if (updatedUserData.displayName !== undefined) {
            state.user.displayName = updatedUserData.displayName;
          }
        }
      });
  },
});

export const { setUser, clearUser } = authSlice.actions;
export default authSlice.reducer;

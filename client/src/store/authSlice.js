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
    
    // Nella funzione fetchUserProfile, modifica la parte che elabora la risposta
    const executeWithRetry = async () => {
      try {
        const token = await firebaseUser.getIdToken(true); // Forza il refresh del token
        ClientLogger.info('fetchUserProfile: Fetching user profile with token', { 
          uid: firebaseUser.uid,
          tokenLength: token.length
        });
        
        const API_URL = getApiUrl();
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        // Log della risposta HTTP per debug
        ClientLogger.info('fetchUserProfile: API response received', { 
          status: response.status,
          ok: response.ok,
          statusText: response.statusText
        });
        
        if (response.status === 401) {
          ClientLogger.error('fetchUserProfile: Authentication failed (401)', { uid: firebaseUser.uid });
          dispatch(clearUser()); // Pulisci lo stato utente in caso di errore di autenticazione
          return rejectWithValue('Authentication failed. Please login again.');
        }
        
        if (response.status === 429) {
          // Rate limiting, riprova con backoff
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1);
            ClientLogger.warn(`fetchUserProfile: Rate limited (429). Retrying in ${delay}ms. Attempt ${retryCount}/${MAX_RETRIES}`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return executeWithRetry(); // Riprova
          } else {
            throw new Error('Rate limit exceeded. Please try again later.');
          }
        }
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch user profile: ${response.status}`);
        }
        const responseData = await response.json();
        ClientLogger.info('fetchUserProfile: Raw response data', {
          hasData: !!responseData,
          hasDataField: !!responseData.data,
          rawData: JSON.stringify(responseData)
        });

        // Estrai i dati dal campo 'data' se presente
        const userProfile = responseData.data || responseData;
        
        // Log completo del payload ricevuto
        ClientLogger.info('fetchUserProfile: User profile received from backend', {
          hasData: !!userProfile,
          fields: userProfile ? Object.keys(userProfile) : 'none',
          uid: userProfile?.uid,
          email: userProfile?.email ? userProfile.email.substring(0, 3) + '***' : 'missing',
          displayName: userProfile?.displayName,
          tenantId: userProfile?.tenantId,
          role: userProfile?.role,
          hasTenant: !!userProfile?.tenant,
          fullPayload: JSON.stringify(userProfile) // Log completo per debug
        });
        
        // Verifica che i campi essenziali siano presenti
        if (!userProfile.role) {
          ClientLogger.error('fetchUserProfile: Missing role in user profile', { 
            uid: userProfile?.uid,
            payload: JSON.stringify(userProfile)
          });
        }
        
        if (!userProfile.tenantId) {
          ClientLogger.error('fetchUserProfile: Missing tenantId in user profile', { 
            uid: userProfile?.uid,
            payload: JSON.stringify(userProfile)
          });
        }
        
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

// Async thunk to get Firebase ID token with quota exceeded handling
export const getFirebaseToken = createAsyncThunk(
  'auth/getFirebaseToken',
  async (_, { rejectWithValue, getState }) => {
    const state = getState();
    const { quotaExceededUntil, retryCount = 0 } = state.auth;
    
    // Check if we're in quota exceeded cooldown period
    if (quotaExceededUntil && Date.now() < quotaExceededUntil) {
      return rejectWithValue('Firebase quota exceeded - in cooldown period');
    }
    
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      return rejectWithValue('Nessun utente Firebase attualmente autenticato.');
    }
    
    try {
      const token = await firebaseUser.getIdToken(true); // true forza l'aggiornamento del token se scaduto
      return { token, retryCount: 0 }; // Reset retry count on success
    } catch (error) {
      ClientLogger.error('getFirebaseToken error:', { message: error.message, retryCount });
      
      // Handle quota exceeded error with exponential backoff
      if (error.code === 'auth/quota-exceeded') {
        const maxRetries = 5;
        const baseDelay = 1000; // 1 second
        const exponentialDelay = Math.min(baseDelay * Math.pow(2, retryCount), 300000); // Max 5 minutes
        
        if (retryCount < maxRetries) {
          // Set cooldown period
          const cooldownUntil = Date.now() + exponentialDelay;
          return rejectWithValue({
            message: `Firebase quota exceeded - retry ${retryCount + 1}/${maxRetries} in ${exponentialDelay/1000}s`,
            code: 'auth/quota-exceeded',
            retryCount: retryCount + 1,
            cooldownUntil
          });
        } else {
          // Max retries reached, set longer cooldown (1 hour)
          const longCooldownUntil = Date.now() + 3600000; // 1 hour
          return rejectWithValue({
            message: 'Firebase quota exceeded - max retries reached, cooldown for 1 hour',
            code: 'auth/quota-exceeded',
            retryCount: 0,
            cooldownUntil: longCooldownUntil
          });
        }
      }
      
      return rejectWithValue({ message: error.message, code: error.code });
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
    tenantId: null,    // Aggiunto per accesso diretto
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
    tokenRefreshError: null,   // Aggiunto per il refresh del token
    // Firebase quota exceeded handling
    quotaExceededUntil: null, // Timestamp until which Firebase calls are disabled
    retryCount: 0,           // Current retry count for exponential backoff
    firebaseToken: null,     // Cached Firebase token
    firebaseTokenStatus: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    firebaseTokenError: null,    // Firebase token specific error
    fallbackMode: false      // When true, app works without Firebase token
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
      state.tenantId = null;    // Resetta anche questi
    },
    // Potremmo aggiungere un reducer per aggiornare lo stato direttamente se necessario,
    // ma fetchUserProfile.fulfilled gestisce l'impostazione dell'utente.
    _tempSetUserLoading(state) { // Temporaneo per testare stati, se necessario
      state.status = 'loading';
    },
    // Reset Firebase quota exceeded state
    resetFirebaseQuotaState(state) {
      state.quotaExceededUntil = null;
      state.retryCount = 0;
      state.fallbackMode = false;
      state.firebaseTokenError = null;
    },
    // Enable fallback mode manually
    enableFallbackMode(state) {
      state.fallbackMode = true;
    },
    // Disable fallback mode manually
    disableFallbackMode(state) {
      state.fallbackMode = false;
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
        state.tenantId = null;    // Resetta anche questi
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
        ClientLogger.info('authSlice - fetchUserProfile.fulfilled START', { 
          hasPayload: !!action.payload,
          payloadFields: action.payload ? Object.keys(action.payload) : 'none'
        });
        
        state.status = 'succeeded';
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
    
        // Estrai companyName, role e tenantId per un accesso più facile
        ClientLogger.info('authSlice - Processing payload', {
          uid: action.payload.uid,
          email: action.payload.email ? action.payload.email.substring(0, 3) + '***' : 'missing',
          displayName: action.payload.displayName,
          tenantId: action.payload.tenantId,
          role: action.payload.role,
          hasTenant: !!action.payload.tenant,
          tenantCompanyName: action.payload.tenant?.companyName
        });
    
        // Gestione del campo tenant (potrebbe essere chiamato tenant o tenantInPayload)
        const tenantData = action.payload.tenant || action.payload.tenantInPayload;
    
        if (tenantData) {
          state.companyName = tenantData.companyName || 'N/A';
          ClientLogger.info('authSlice - companyName set from tenant data', { companyName: state.companyName });
        } else {
          state.companyName = 'N/A';
          ClientLogger.warn('authSlice - companyName set to N/A (no tenant data in payload)');
        }
    
        // Gestione del ruolo
        if (action.payload.role) {
          state.role = action.payload.role;
          ClientLogger.info('authSlice - role set', { role: state.role });
        } else {
          // Se il ruolo non è presente nel payload, imposta un valore di default
          state.role = 'operator'; // Valore di default se non specificato
          ClientLogger.warn('authSlice - role set to default "operator" (no role in payload)');
        }
    
        // Gestione del tenantId
        if (action.payload.tenantId) {
          state.tenantId = action.payload.tenantId;
          ClientLogger.info('authSlice - tenantId set', { tenantId: state.tenantId });
        } else {
          state.tenantId = null;
          ClientLogger.warn('authSlice - tenantId set to null (no tenantId in payload)');
        }
    
        ClientLogger.info('authSlice - Final state after fetchUserProfile.fulfilled', {
          isAuthenticated: state.isAuthenticated,
          hasUser: !!state.user,
          companyName: state.companyName,
          role: state.role,
          tenantId: state.tenantId
        });
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
      })
      // Reducers for getFirebaseToken
      .addCase(getFirebaseToken.pending, (state) => {
        state.firebaseTokenStatus = 'loading';
        state.firebaseTokenError = null;
      })
      .addCase(getFirebaseToken.fulfilled, (state, action) => {
        state.firebaseTokenStatus = 'succeeded';
        state.firebaseToken = action.payload.token;
        state.retryCount = action.payload.retryCount;
        state.firebaseTokenError = null;
        state.quotaExceededUntil = null; // Clear any previous quota exceeded state
        state.fallbackMode = false; // Exit fallback mode on success
      })
      .addCase(getFirebaseToken.rejected, (state, action) => {
        state.firebaseTokenStatus = 'failed';
        state.firebaseTokenError = action.payload;
        
        // Handle quota exceeded specific error
        if (typeof action.payload === 'object' && action.payload.code === 'auth/quota-exceeded') {
          state.quotaExceededUntil = action.payload.cooldownUntil;
          state.retryCount = action.payload.retryCount;
          state.fallbackMode = true; // Enable fallback mode
          
          ClientLogger.warn('Firebase quota exceeded - entering fallback mode', {
            cooldownUntil: new Date(action.payload.cooldownUntil).toISOString(),
            retryCount: action.payload.retryCount
          });
        } else {
          // For other errors, don't enter fallback mode
          state.fallbackMode = false;
        }
      });
  },
});

export const { 
  setUser, 
  clearUser, 
  resetFirebaseQuotaState, 
  enableFallbackMode, 
  disableFallbackMode 
} = authSlice.actions;
export default authSlice.reducer;

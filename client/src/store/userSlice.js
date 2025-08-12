import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getFirebaseToken } from './authSlice'; // Assicurati che authSlice esporti questa funzione o un modo per ottenere il token
import { getApiUrl } from '../utils/apiConfig'; // Importa la funzione helper

const API_URL = getApiUrl();

// Helper function to get auth token
const getAuthToken = async (thunkAPI) => {
  const result = await thunkAPI.dispatch(getFirebaseToken()).unwrap();
  if (!result || !result.token) {
    return thunkAPI.rejectWithValue('Nessun token di autenticazione disponibile.');
  }
  return result.token;
};

// Async thunk per recuperare gli utenti del tenant
export const fetchTenantUsers = createAsyncThunk(
  'user/fetchTenantUsers',
  async (tenantId, thunkAPI) => {
    try {
      const token = await getAuthToken(thunkAPI);
      const response = await fetch(`${API_URL}/api/tenants/${tenantId}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Errore nel recupero degli utenti del tenant');
      }
      return await response.json();
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

// Async thunk per aggiornare il profilo utente (es. displayName)
export const updateUserProfile = createAsyncThunk(
  'user/updateUserProfile',
  async ({ uid, displayName }, thunkAPI) => {
    try {
      const token = await getAuthToken(thunkAPI);
      const response = await fetch(`${API_URL}/api/auth/users/${uid}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Errore nell\'aggiornamento del profilo');
      }
      return await response.json(); // Dovrebbe ritornare l'utente aggiornato
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

// Async thunk per cambiare la password
export const changePassword = createAsyncThunk(
  'user/changePassword',
  async ({ currentPassword, newPassword }, thunkAPI) => {
    try {
      const token = await getAuthToken(thunkAPI);
      // L'UID dell'utente corrente dovrebbe essere gestito dal backend tramite il token
      const response = await fetch(`${API_URL}/api/auth/users/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Errore nel cambio password');
      }
      return await response.json(); // Messaggio di successo
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

// Async thunk per rimuovere un utente dal tenant
export const removeUserFromTenant = createAsyncThunk(
  'user/removeUserFromTenant',
  async ({ tenantId, userId }, thunkAPI) => {
    try {
      const token = await getAuthToken(thunkAPI);
      const response = await fetch(`${API_URL}/api/tenants/${tenantId}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Errore nella rimozione dell\'utente');
      }
      return { userId }; // Ritorna l'ID dell'utente rimosso per aggiornare lo store
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

// Async thunk per aggiornare il ruolo di un utente nel tenant
export const updateUserRole = createAsyncThunk(
  'user/updateUserRole',
  async ({ tenantId, userId, newRole }, thunkAPI) => {
    try {
      const token = await getAuthToken(thunkAPI);
      const response = await fetch(`${API_URL}/api/tenants/${tenantId}/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Errore nell\'aggiornamento del ruolo utente');
      }
      return await response.json(); // Ritorna l'utente aggiornato
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);

const initialState = {
  tenantUsers: [],
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  profileUpdateStatus: 'idle',
  profileUpdateError: null,
  passwordChangeStatus: 'idle',
  passwordChangeError: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    resetUserState: (state) => {
      state.tenantUsers = [];
      state.status = 'idle';
      state.error = null;
      state.profileUpdateStatus = 'idle';
      state.profileUpdateError = null;
      state.passwordChangeStatus = 'idle';
      state.passwordChangeError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Tenant Users
      .addCase(fetchTenantUsers.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchTenantUsers.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.tenantUsers = action.payload;
      })
      .addCase(fetchTenantUsers.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Update User Profile
      .addCase(updateUserProfile.pending, (state) => {
        state.profileUpdateStatus = 'loading';
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.profileUpdateStatus = 'succeeded';
        // Qui potresti voler aggiornare anche l'utente in authSlice se necessario
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.profileUpdateStatus = 'failed';
        state.profileUpdateError = action.payload;
      })
      // Change Password
      .addCase(changePassword.pending, (state) => {
        state.passwordChangeStatus = 'loading';
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.passwordChangeStatus = 'succeeded';
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.passwordChangeStatus = 'failed';
        state.passwordChangeError = action.payload;
      })
      // Remove User From Tenant
      .addCase(removeUserFromTenant.pending, (state) => {
        state.status = 'loading'; // o un altro stato specifico se preferisci
      })
      .addCase(removeUserFromTenant.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.tenantUsers = state.tenantUsers.filter(user => user.uid !== action.payload.userId);
      })
      .addCase(removeUserFromTenant.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload; // o un errore specifico
      })
      // Update User Role
      .addCase(updateUserRole.pending, (state) => {
        state.status = 'loading'; // o un altro stato specifico
      })
      .addCase(updateUserRole.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // Prova ad accedere a action.payload.user, altrimenti usa action.payload
        const userFromPayload = action.payload.user || action.payload;
        // Assicurati che userFromPayload sia un oggetto e abbia uid prima di procedere
        if (userFromPayload && typeof userFromPayload === 'object' && userFromPayload.uid) {
          state.tenantUsers = state.tenantUsers.map(user =>
            user.uid === userFromPayload.uid ? { ...user, ...userFromPayload } : user
          );
        } else {
          // Logga un avviso se il payload non è come previsto
          ClientLogger.warn('updateUserRole.fulfilled: il payload non contiene un oggetto utente valido o uid:', { payload: action.payload });
          // Potresti voler impostare uno stato di errore qui se il payload è inaspettato
          // state.error = 'Payload inatteso dall\'aggiornamento del ruolo utente.';
        }
        state.error = null; // Resetta eventuali errori precedenti relativi a questa operazione
      })
      .addCase(updateUserRole.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload; // o un errore specifico per l'aggiornamento del ruolo
      });
  },
});

export const { resetUserState } = userSlice.actions;
export default userSlice.reducer;
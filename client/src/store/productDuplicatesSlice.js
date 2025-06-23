

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getApiUrl } from '../utils/apiConfig'; // Importa la funzione helper

const API_URL = getApiUrl();

// Fetches all duplicate product groups from the backend
export const fetchProductDuplicates = createAsyncThunk(
  'productDuplicate/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_URL}/api/products/duplicates`);
      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch duplicate product groups');
      }
      const data = await response.json();
      return data; // expected: Array<{ groupId: string, items: Array<Product> }>
    } catch (err) {
      return rejectWithValue(err.toString());
    }
  }
);

// Merges a duplicate group by keeping primaryProductId
export const mergeDuplicateGroup = createAsyncThunk(
  'productDuplicate/merge',
  async ({ groupId, primaryProductId }, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_URL}/api/products/duplicates/${groupId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryProductId }),
      });
      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to merge duplicate products');
      }
      return { groupId, primaryProductId };
    } catch (err) {
      return rejectWithValue(err.toString());
    }
  }
);

// Ignores a duplicate group so it won't be shown again
export const ignoreDuplicateGroup = createAsyncThunk(
  'productDuplicate/ignore',
  async (groupId, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_URL}/api/products/duplicates/${groupId}/ignore`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to ignore duplicate group');
      }
      return groupId;
    } catch (err) {
      return rejectWithValue(err.toString());
    }
  }
);

const productDuplicatesSlice = createSlice({
  name: 'productDuplicate',
  initialState: {
    groups: [],
    status: 'idle',
    error: null
  },
  reducers: {
    // Add any synchronous reducers here if needed in the future
  },
  extraReducers: builder => {
    builder
      // fetch
      .addCase(fetchProductDuplicates.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProductDuplicates.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.groups = action.payload;
      })
      .addCase(fetchProductDuplicates.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // merge
      .addCase(mergeDuplicateGroup.fulfilled, (state, action) => {
        state.groups = state.groups.filter(g => g.groupId !== action.payload.groupId);
      })
      // ignore
      .addCase(ignoreDuplicateGroup.fulfilled, (state, action) => {
        state.groups = state.groups.filter(g => g.groupId !== action.payload);
      });
  }
});

export default productDuplicatesSlice.reducer;
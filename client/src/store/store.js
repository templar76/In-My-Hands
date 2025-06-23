import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import userReducer from './userSlice'; // Importa il nuovo reducer
import duplicatesReducer from './productDuplicatesSlice'; // Import duplicates reducer
// import other reducers

const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer, // Aggiungi il userReducer qui
    productDuplicates: duplicatesReducer,
    // invoices, products, etc.
  }
});

export default store;

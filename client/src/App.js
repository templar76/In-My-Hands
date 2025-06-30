import React, { Suspense, lazy, useState } from 'react';
// Aggiungi import
import customTheme from './theme/customTheme';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ThemeProvider, CssBaseline} from '@mui/material';
import { I18nextProvider } from 'react-i18next';
import InvoiceUpload from './pages/InvoiceUpload';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import i18n from './i18n';

// Pagine
// Lazy-loaded pages
const Home = lazy(() => import('./pages/Home'));
const Products = lazy(() => import('./pages/Products'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const CompleteTenantRegistrationPage = lazy(() => import('./pages/CompleteTenantRegistrationPage')); // Importa la nuova pagina
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));
const SupplierDetail = lazy(() => import('./pages/SupplierDetail'));
const Invoices = lazy(() => import('./pages/Invoices'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));

const AcceptInvitationPage = lazy(() => import('./pages/AcceptInvitationPage'));
const Invitations = lazy(() => import('./pages/Invitations'));
const MyProfilePage = lazy(() => import('./pages/MyProfilePage')); // Importa la pagina del profilo
const ProductDuplicatesReview = lazy(() => import('./pages/ProductDuplicatesReview'));


// Componente per proteggere le rotte private
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  return isAuthenticated ? (
    children
  ) : (
    <Navigate to="/login" replace />
  );
};

function App() {
  const [mode, setMode] = useState('light');
  // Theme configuration with light/dark mode support
  // const theme = createTheme({
  //   palette: {
  //     mode,
  //     primary: { main: '#3F51B5' },
  //     secondary: { main: '#E91E63' },
  //   },
  //   typography: { fontFamily: '"Inter", sans-serif' },
  // });

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={customTheme}>
        <CssBaseline />
        <ErrorBoundary>
          <Layout mode={mode} setMode={setMode}>
            <Suspense fallback={<div>Loading...</div>}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/complete-tenant-registration" element={<CompleteTenantRegistrationPage />} /> {/* Nuova rotta aggiunta */}
                <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/dashboard" replace />
                    </ProtectedRoute>
                  }
                />
                <Route path="/invoices/upload" element={<ProtectedRoute><InvoiceUpload /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
                <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
                <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings mode={mode} setMode={setMode} /></ProtectedRoute>} />
                <Route path="/products/duplicates" element={<ProtectedRoute><ProductDuplicatesReview /></ProtectedRoute>} />
                <Route
                  path="/invitations"
                  element={
                    <ProtectedRoute>
                      <Invitations />
                    </ProtectedRoute>
                  }
                />
                <Route path="/profile" element={<ProtectedRoute><MyProfilePage /></ProtectedRoute>} />
                <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
                <Route path="/invoices/upload" element={<ProtectedRoute><InvoiceUpload /></ProtectedRoute>} />
                <Route path="/suppliers/:supplierId" element={<ProtectedRoute><SupplierDetail /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
                {/* Nella sezione delle routes, aggiungi: */}
                <Route
                  path="/products/:id"
                  element={
                    <ProtectedRoute>
                      <ProductDetail />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </Layout>
        </ErrorBoundary>
      </ThemeProvider>
    </I18nextProvider>
  );
}

export default App;

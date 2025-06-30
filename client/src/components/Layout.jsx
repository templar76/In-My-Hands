// client/src/components/Layout.jsx (VERSIONE FINALE CORRETTA)
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  CssBaseline,
  useTheme,
} from '@mui/material';
import { useResponsive, useSidebarState } from '../hooks/useResponsive';
import ResponsiveSidebar from './ResponsiveSidebar';
import BottomNavigation from './BottomNavigation';
import TopBar from './TopBar';

// Import delle pagine esistenti nel progetto
import Home from '../pages/Home';
import Invoices from '../pages/Invoices';
import Products from '../pages/Products';
import Suppliers from '../pages/Suppliers';
import Alerts from '../pages/Alerts';
import Settings from '../pages/Settings';
import MyProfilePage from '../pages/MyProfilePage';
import Invitations from '../pages/Invitations';
import InvoiceUpload from '../pages/InvoiceUpload';
import ProductDetail from '../pages/ProductDetail';
import ProductDuplicatesReview from '../pages/ProductDuplicatesReview';
import SupplierDetail from '../pages/SupplierDetail';
import Login from '../pages/Login';
import Register from '../pages/Register';
import NotFound from '../pages/NotFound';
import ResetPassword from '../pages/ResetPassword';
import AcceptInvitationPage from '../pages/AcceptInvitationPage';
import CompleteTenantRegistrationPage from '../pages/CompleteTenantRegistrationPage';

const Layout = ({ children }) => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Responsive hooks
  const {
    isDesktop,
    showBottomNav,
    showSidebar,
    showMobileHeader,
    sidebarWidth,
    headerHeight,
    contentPadding,
  } = useResponsive();
  
  const {
    sidebarOpen,
    handleSidebarToggle,
    handleSidebarClose,
    shouldShowOverlay,
  } = useSidebarState();
  
  // User state dal Redux store
  const user = useSelector(state => state.auth.user);
  
  // Recupera il ruolo dell'utente
  const userRole = user ? user.role : null;
  
  // Definizioni menu (adattate alle pagine esistenti)
  const menuPermissions = {
    admin: ['Dashboard', 'Fatture', 'Prodotti', 'Fornitori', 'Alert', 'Settings', 'Invitations'],
    operator: ['Dashboard', 'Prodotti', 'Alert'],
  };
  
  const allMenuItems = [
    { text: 'Dashboard', icon: 'HomeIcon', path: '/dashboard' },
    { text: 'Fatture', icon: 'ReceiptIcon', path: '/invoices' },
    { text: 'Prodotti', icon: 'ShoppingCartIcon', path: '/products' },
    { text: 'Fornitori', icon: 'PeopleIcon', path: '/suppliers' },
    { text: 'Alert', icon: 'NotificationsIcon', path: '/alerts' },
    { text: 'Settings', icon: 'SettingsIcon', path: '/settings' },
    { text: 'Invitations', icon: 'PersonAddIcon', path: '/invitations' },
  ];
  
  // Filtra le voci di menu in base al ruolo dell'utente
  const menuItems = user && userRole && menuPermissions[userRole]
    ? allMenuItems.filter(item => menuPermissions[userRole].includes(item.text))
    : [];
  
  // Se l'utente non è autenticato, non mostrare AppBar e Drawer
  if (!user) {
    return (
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <CssBaseline />
        {children}
      </Box>
    );
  }
  
  // Funzione per renderizzare la pagina corrente (con pagine esistenti)
  const renderCurrentPage = () => {
    switch (location.pathname) {
      case '/':
      case '/dashboard':
        return <Home />;
      case '/invoices':
        return <Invoices />;
      case '/products':
        return <Products />;
      case '/products/duplicates':
        return <ProductDuplicatesReview />;
      case '/product-detail':
        return <ProductDetail />;
      case '/suppliers':
        return <Suppliers />;
      case '/supplier-detail':
        return <SupplierDetail />;
      case '/alerts':
        return <Alerts />;
      case '/settings':
        return <Settings />;
      case '/profile':
        return <MyProfilePage />;
      case '/invitations':
        return <Invitations />;
      case '/upload':
        return <InvoiceUpload />;
      case '/login':
        return <Login />;
      case '/register':
        return <Register />;
      case '/reset-password':
        return <ResetPassword />;
      case '/accept-invitation':
        return <AcceptInvitationPage />;
      case '/complete-registration':
        return <CompleteTenantRegistrationPage />;
      default:
        return <NotFound />;
    }
  };
  
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      
      {/* Mobile Header */}
      {showMobileHeader && (
        <TopBar
          onMenuClick={handleSidebarToggle}
          user={user}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: theme.zIndex.appBar,
          }}
        />
      )}
      
      {/* Sidebar per Desktop e Drawer per Tablet */}
      {showSidebar && (
        <ResponsiveSidebar
          open={isDesktop || sidebarOpen}
          onClose={handleSidebarClose}
          variant={isDesktop ? 'permanent' : 'temporary'}
          menuItems={menuItems}
          user={user}
          currentPath={location.pathname}
          onNavigate={(path) => {
            navigate(path);
            if (!isDesktop) {
              handleSidebarClose();
            }
          }}
          sx={{
            width: sidebarWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: sidebarWidth,
              boxSizing: 'border-box',
              marginTop: showMobileHeader ? `${headerHeight}px` : 0,
              height: showMobileHeader ? `calc(100vh - ${headerHeight}px)` : '100vh',
            },
          }}
        />
      )}
      
      {/* Overlay per mobile quando sidebar è aperta */}
      {shouldShowOverlay && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: theme.zIndex.drawer - 1,
          }}
          onClick={handleSidebarClose}
        />
      )}
      
      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          marginLeft: isDesktop && showSidebar ? 0 : 0,
          marginTop: showMobileHeader ? `${headerHeight}px` : 0,
          marginBottom: showBottomNav ? '80px' : 0,
          minHeight: showMobileHeader 
            ? `calc(100vh - ${headerHeight}px${showBottomNav ? ' - 80px' : ''})`
            : showBottomNav 
              ? 'calc(100vh - 80px)' 
              : '100vh',
          transition: theme.transitions.create(['margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Box
          sx={{
            flex: 1,
            p: contentPadding / 8, // Converti in unità theme
            overflow: 'auto',
          }}
        >
          {renderCurrentPage()}
        </Box>
      </Box>
      
      {/* Bottom Navigation per Mobile */}
      {showBottomNav && (
        <BottomNavigation
          menuItems={menuItems.slice(0, 5)} // Mostra solo i primi 5 item
          currentPath={location.pathname}
          onNavigate={navigate}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: theme.zIndex.appBar,
          }}
        />
      )}
    </Box>
  );
};

export default Layout;


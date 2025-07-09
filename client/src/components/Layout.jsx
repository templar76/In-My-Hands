// src/components/Layout.jsx
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Avatar from '@mui/material/Avatar';
import Collapse from '@mui/material/Collapse';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import { logoutUser } from '../store/authSlice';
import { styled, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiAppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Drawer from '@mui/material/Drawer';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import HomeIcon from '@mui/icons-material/Home';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PeopleIcon from '@mui/icons-material/People';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { Receipt } from '@mui/icons-material';
import { memo } from 'react';

const drawerWidth = 240;

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

// Definisci qui le autorizzazioni per ruolo
const menuPermissions = {
  admin: ['Dashboard','Fatture', 'Prodotti', 'Fornitori', 'Alert', 'Settings', 'Utenti'], // Cambiato da 'Inviti' a 'Utenti'
  operator: ['Dashboard', 'Prodotti', 'Alert'],
};

// Wrap heavy components
const Layout = memo(({ children, mode, setMode }) => {
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
    { text: 'Dashboard', icon: <HomeIcon />, path: '/dashboard' },
    { text: 'Fatture', icon: <Receipt/>, path: '/invoices' },
    { text: 'Prodotti',
      icon: <ShoppingCartIcon />,
      children: [
        { text: 'Tutti i Prodotti', path: '/products' },
        { text: 'Prodotti Duplicati', path: '/products/duplicates' }
      ]},
    { text: 'Fornitori', icon: <PeopleIcon />, path: '/suppliers' },
    { text: 'Alert', icon: <NotificationsIcon />, path: '/alerts' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
    { text: 'Utenti', icon: <PersonAddIcon />, path: '/users' }, // Cambiato da 'Inviti' a 'Utenti'
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
});

export default Layout;

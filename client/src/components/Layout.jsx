// client/src/components/Layout.jsx (VERSIONE AGGIORNATA)
import React, { useState } from 'react';
import { Box } from '@mui/material';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveSidebar from './ResponsiveSidebar';
import BottomNavigation from './BottomNavigation';
import TopBar from './TopBar';
import AppRoutes from '../routes/AppRoutes'; // Assumendo che esista

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { 
    isMobile, 
    showBottomNav, 
    showSidebar, 
    sidebarVariant,
    sidebarWidth,
    headerHeight,
    contentPadding,
  } = useResponsive();

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  // User data mock - in produzione verrà dal context/store
  const user = {
    name: 'Mario Rossi',
    role: 'Admin',
    avatar: null,
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* Top AppBar per mobile */}
      {isMobile && (
        <TopBar 
          onMenuClick={handleSidebarToggle}
          user={user}
        />
      )}

      {/* Sidebar Responsive */}
      {showSidebar && (
        <ResponsiveSidebar
          open={sidebarVariant === 'permanent' ? true : sidebarOpen}
          onClose={handleSidebarClose}
          variant={sidebarVariant}
          user={user}
        />
      )}

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          // Margini dinamici basati sul layout
          mt: isMobile ? `${headerHeight}px` : 0,
          mb: showBottomNav ? '64px' : 0,
          ml: showSidebar && sidebarVariant === 'permanent' ? `${sidebarWidth}px` : 0,
          // Padding responsive
          p: contentPadding / 8, // Converti da spacing a rem
          // Transizioni smooth
          transition: 'margin 0.3s ease-in-out, padding 0.3s ease-in-out',
        }}
      >
        {/* Content Container */}
        <Box
          sx={{
            flexGrow: 1,
            maxWidth: '100%',
            mx: 'auto',
            width: '100%',
          }}
        >
          {/* Routes Content */}
          <AppRoutes />
        </Box>
      </Box>

      {/* Bottom Navigation per mobile */}
      {showBottomNav && <BottomNavigation />}

      {/* Overlay per mobile quando sidebar è aperta */}
      {isMobile && sidebarOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1200,
          }}
          onClick={handleSidebarClose}
        />
      )}
    </Box>
  );
};

export default Layout;


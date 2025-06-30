// client/src/components/ResponsiveSidebar.jsx
import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Avatar,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Dashboard,
  Receipt,
  Inventory,
  Business,
  NotificationsActive,
  Settings,
  ExitToApp,
  Person,
  ChevronLeft,
  Brightness4,
  Brightness7,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';

const drawerWidth = 280;

const menuItems = [
  { 
    text: 'Dashboard', 
    icon: <Dashboard />, 
    path: '/',
    badge: null,
    description: 'Panoramica generale'
  },
  { 
    text: 'Fatture', 
    icon: <Receipt />, 
    path: '/fatture',
    badge: '12',
    description: 'Gestione fatture'
  },
  { 
    text: 'Prodotti', 
    icon: <Inventory />, 
    path: '/prodotti',
    badge: null,
    description: 'Catalogo prodotti'
  },
  { 
    text: 'Fornitori', 
    icon: <Business />, 
    path: '/fornitori',
    badge: null,
    description: 'Gestione fornitori'
  },
  { 
    text: 'Alert', 
    icon: <NotificationsActive />, 
    path: '/alert',
    badge: '3',
    description: 'Notifiche e avvisi'
  },
  { 
    text: 'Impostazioni', 
    icon: <Settings />, 
    path: '/impostazioni',
    badge: null,
    description: 'Configurazioni'
  },
];

const ResponsiveSidebar = ({ 
  open, 
  onClose, 
  variant,
  user = { name: 'Utente Demo', role: 'Admin', avatar: null }
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsive();

  const handleNavigation = (path) => {
    navigate(path);
    if (variant === 'temporary') {
      onClose();
    }
  };

  const handleLogout = () => {
    // Implementare logica di logout
    console.log('Logout clicked');
  };

  const SidebarHeader = () => (
    <Box sx={{ p: 3, textAlign: 'center', position: 'relative' }}>
      {/* Close button per mobile/tablet */}
      {(isMobile || isTablet) && (
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'text.secondary',
          }}
        >
          <ChevronLeft />
        </IconButton>
      )}
      
      {/* Logo e titolo */}
      <Box sx={{ mb: 2 }}>
        <Typography 
          variant="h5" 
          fontWeight="bold" 
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          In My Hands
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Gestione Aziendale
        </Typography>
      </Box>
    </Box>
  );

  const UserSection = () => (
    <Box sx={{ p: 2 }}>
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          p: 2,
          borderRadius: 2,
          backgroundColor: 'grey.50',
          border: '1px solid',
          borderColor: 'grey.200',
        }}
      >
        <Avatar 
          sx={{ 
            bgcolor: 'primary.main',
            width: 40,
            height: 40,
          }}
        >
          {user.avatar || <Person />}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography 
            variant="subtitle2" 
            fontWeight={600}
            sx={{ 
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip 
              label={user.role} 
              size="small" 
              color="primary" 
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );

  const NavigationMenu = () => (
    <List sx={{ flexGrow: 1, px: 1 }}>
      {menuItems.map((item) => {
        const isSelected = location.pathname === item.path;
        
        return (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <Tooltip 
              title={item.description} 
              placement="right"
              arrow
              disableHoverListener={!isMobile}
            >
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                selected={isSelected}
                sx={{
                  borderRadius: 2,
                  mx: 1,
                  transition: 'all 0.2s ease-in-out',
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    boxShadow: 2,
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                  },
                  '&:hover': {
                    bgcolor: isSelected ? 'primary.dark' : 'grey.100',
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isSelected ? 600 : 500,
                    fontSize: '0.875rem',
                  }}
                />
                {item.badge && (
                  <Chip
                    label={item.badge}
                    size="small"
                    color={isSelected ? "secondary" : "primary"}
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      bgcolor: isSelected ? 'secondary.main' : 'primary.light',
                      color: 'white',
                    }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        );
      })}
    </List>
  );

  const SidebarFooter = () => (
    <Box sx={{ p: 1 }}>
      <Divider sx={{ mb: 2 }} />
      
      {/* Quick Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
        <Tooltip title="Cambia tema" arrow>
          <IconButton size="small" sx={{ color: 'text.secondary' }}>
            <Brightness4 fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Profilo utente" arrow>
          <IconButton size="small" sx={{ color: 'text.secondary' }}>
            <Person fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Logout Button */}
      <ListItem disablePadding>
        <ListItemButton 
          onClick={handleLogout}
          sx={{ 
            borderRadius: 2,
            mx: 1,
            color: 'error.main',
            '&:hover': {
              bgcolor: 'error.light',
              color: 'error.dark',
              '& .MuiListItemIcon-root': {
                color: 'error.dark',
              },
            },
          }}
        >
          <ListItemIcon sx={{ color: 'error.main', minWidth: 40 }}>
            <ExitToApp />
          </ListItemIcon>
          <ListItemText 
            primary="Logout"
            primaryTypographyProps={{
              fontWeight: 500,
              fontSize: '0.875rem',
            }}
          />
        </ListItemButton>
      </ListItem>
    </Box>
  );

  const drawerContent = (
    <Box 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: 'background.paper',
      }}
    >
      <SidebarHeader />
      <Divider />
      <UserSection />
      <Divider />
      <NavigationMenu />
      <SidebarFooter />
    </Box>
  );

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
          boxShadow: variant === 'temporary' ? 4 : 1,
        },
      }}
      ModalProps={{
        keepMounted: true, // Better open performance on mobile
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default ResponsiveSidebar;


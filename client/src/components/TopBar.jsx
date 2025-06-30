// client/src/components/TopBar.jsx
import React from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications,
  AccountCircle,
  Settings,
  ExitToApp,
  Person,
  Search,
} from '@mui/icons-material';

const TopBar = ({ onMenuClick, user = { name: 'Utente Demo', role: 'Admin' } }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [notificationAnchor, setNotificationAnchor] = React.useState(null);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationMenuOpen = (event) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationMenuClose = () => {
    setNotificationAnchor(null);
  };

  const handleLogout = () => {
    handleProfileMenuClose();
    // Implementare logica di logout
    console.log('Logout clicked');
  };

  const notifications = [
    { id: 1, title: 'Nuova fattura ricevuta', time: '2 min fa', unread: true },
    { id: 2, title: 'Alert prezzo prodotto', time: '1 ora fa', unread: true },
    { id: 3, title: 'Backup completato', time: '3 ore fa', unread: false },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <>
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: 'background.paper',
          color: 'text.primary',
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
        elevation={0}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          {/* Left Section */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={onMenuClick}
              sx={{ 
                mr: 2,
                color: 'text.primary',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <MenuIcon />
            </IconButton>
            
            <Box>
              <Typography 
                variant="h6" 
                noWrap 
                component="div" 
                sx={{ 
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                In My Hands
              </Typography>
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ display: 'block', lineHeight: 1 }}
              >
                Dashboard
              </Typography>
            </Box>
          </Box>

          {/* Right Section */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Search Button */}
            <IconButton 
              color="inherit"
              sx={{ 
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <Search />
            </IconButton>

            {/* Notifications */}
            <IconButton 
              color="inherit"
              onClick={handleNotificationMenuOpen}
              sx={{ 
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <Badge badgeContent={unreadCount} color="error">
                <Notifications />
              </Badge>
            </IconButton>

            {/* Profile */}
            <IconButton 
              onClick={handleProfileMenuOpen}
              sx={{ 
                p: 0.5,
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <Avatar 
                sx={{ 
                  bgcolor: 'primary.main',
                  width: 32,
                  height: 32,
                  fontSize: '0.875rem',
                }}
              >
                {user.name.charAt(0)}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        onClick={handleProfileMenuClose}
        PaperProps={{
          elevation: 3,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.1))',
            mt: 1.5,
            minWidth: 200,
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* User Info */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {user.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user.role}
          </Typography>
        </Box>

        <MenuItem onClick={handleProfileMenuClose}>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profilo</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={handleProfileMenuClose}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>Impostazioni</ListItemText>
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <ExitToApp fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>

      {/* Notifications Menu */}
      <Menu
        anchorEl={notificationAnchor}
        open={Boolean(notificationAnchor)}
        onClose={handleNotificationMenuClose}
        PaperProps={{
          elevation: 3,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.1))',
            mt: 1.5,
            minWidth: 280,
            maxHeight: 400,
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 20,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Notifiche
          </Typography>
          {unreadCount > 0 && (
            <Typography variant="caption" color="primary.main">
              {unreadCount} non lette
            </Typography>
          )}
        </Box>

        {/* Notifications List */}
        {notifications.map((notification) => (
          <MenuItem 
            key={notification.id}
            onClick={handleNotificationMenuClose}
            sx={{
              py: 1.5,
              borderLeft: notification.unread ? '3px solid' : '3px solid transparent',
              borderColor: notification.unread ? 'primary.main' : 'transparent',
              backgroundColor: notification.unread ? 'action.hover' : 'transparent',
            }}
          >
            <Box>
              <Typography 
                variant="body2" 
                fontWeight={notification.unread ? 600 : 400}
                sx={{ mb: 0.5 }}
              >
                {notification.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {notification.time}
              </Typography>
            </Box>
          </MenuItem>
        ))}

        <Divider />
        
        <MenuItem 
          onClick={handleNotificationMenuClose}
          sx={{ justifyContent: 'center', color: 'primary.main' }}
        >
          <Typography variant="body2" fontWeight={500}>
            Vedi tutte le notifiche
          </Typography>
        </MenuItem>
      </Menu>
    </>
  );
};

export default TopBar;


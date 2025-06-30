// client/src/components/TopBar.jsx (VERSIONE PULITA)
import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Badge,
  Box,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Menu as MenuIcon,
  Notifications,
  Person,
  Settings,
  ExitToApp,
} from '@mui/icons-material';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  boxShadow: theme.shadows[1],
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const TopBar = ({
  onMenuClick,
  user,
  notifications = 0,
  onNotificationsClick,
  onProfileClick,
  onSettingsClick,
  onLogout,
  ...props
}) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = () => {
    handleProfileMenuClose();
    if (onProfileClick) {
      onProfileClick();
    }
  };

  const handleSettingsClick = () => {
    handleProfileMenuClose();
    if (onSettingsClick) {
      onSettingsClick();
    }
  };

  const handleLogout = () => {
    handleProfileMenuClose();
    if (onLogout) {
      onLogout();
    }
  };

  const getUserDisplayName = () => {
    if (!user) return 'Utente';
    return user.displayName || user.email?.split('@')[0] || 'Utente';
  };

  return (
    <StyledAppBar position="fixed" {...props}>
      <Toolbar>
        {/* Menu Button */}
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          onClick={onMenuClick}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        {/* App Title */}
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ 
            flexGrow: 1,
            fontWeight: 600,
            color: 'primary.main',
          }}
        >
          In My Hands
        </Typography>

        {/* Notifications */}
        <IconButton
          color="inherit"
          onClick={onNotificationsClick}
          sx={{ mr: 1 }}
        >
          <Badge badgeContent={notifications} color="error">
            <Notifications />
          </Badge>
        </IconButton>

        {/* User Profile */}
        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography 
              variant="body2" 
              sx={{ 
                display: { xs: 'none', sm: 'block' },
                fontWeight: 500,
              }}
            >
              {getUserDisplayName()}
            </Typography>
            <IconButton
              onClick={handleProfileMenuOpen}
              size="small"
              aria-controls={open ? 'profile-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={open ? 'true' : undefined}
            >
              <Avatar
                src={user.photoURL}
                sx={{ width: 32, height: 32 }}
              >
                {getUserDisplayName().charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </Box>
        )}

        {/* Profile Menu */}
        <Menu
          id="profile-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleProfileMenuClose}
          onClick={handleProfileMenuClose}
          PaperProps={{
            elevation: 3,
            sx: {
              mt: 1.5,
              minWidth: 200,
              '& .MuiMenuItem-root': {
                px: 2,
                py: 1,
              },
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          {user && (
            <>
              <MenuItem disabled>
                <ListItemIcon>
                  <Avatar
                    src={user.photoURL}
                    sx={{ width: 24, height: 24 }}
                  >
                    {getUserDisplayName().charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={getUserDisplayName()}
                  secondary={user.email}
                  secondaryTypographyProps={{
                    fontSize: '0.75rem',
                    noWrap: true,
                  }}
                />
              </MenuItem>
              <Divider />
            </>
          )}
          
          <MenuItem onClick={handleProfileClick}>
            <ListItemIcon>
              <Person fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Il Mio Profilo" />
          </MenuItem>
          
          <MenuItem onClick={handleSettingsClick}>
            <ListItemIcon>
              <Settings fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Impostazioni" />
          </MenuItem>
          
          <Divider />
          
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <ExitToApp fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Esci" />
          </MenuItem>
        </Menu>
      </Toolbar>
    </StyledAppBar>
  );
};

export default TopBar;


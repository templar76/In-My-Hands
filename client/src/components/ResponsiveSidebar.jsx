// client/src/components/ResponsiveSidebar.jsx (VERSIONE PULITA)
import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Avatar,
  Divider,
  Badge,
  Chip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Home,
  Receipt,
  ShoppingCart,
  People,
  Notifications,
  Settings,
  PersonAdd,
  Business,
  ExitToApp,
} from '@mui/icons-material';

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  '& .MuiDrawer-paper': {
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
  },
}));

const UserSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

const StyledListItemButton = styled(ListItemButton)(({ theme }) => ({
  margin: theme.spacing(0.5, 1),
  borderRadius: theme.shape.borderRadius,
  '&.Mui-selected': {
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.contrastText,
    '& .MuiListItemIcon-root': {
      color: theme.palette.primary.contrastText,
    },
    '&:hover': {
      backgroundColor: theme.palette.primary.main,
    },
  },
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const getIcon = (iconName) => {
  const iconMap = {
    HomeIcon: Home,
    ReceiptIcon: Receipt,
    ShoppingCartIcon: ShoppingCart,
    PeopleIcon: People,
    NotificationsIcon: Notifications,
    SettingsIcon: Settings,
    PersonAddIcon: PersonAdd,
    BusinessIcon: Business,
  };
  
  const IconComponent = iconMap[iconName] || Home;
  return <IconComponent />;
};

const ResponsiveSidebar = ({
  open,
  onClose,
  variant = 'temporary',
  menuItems = [],
  user,
  currentPath = '/',
  onNavigate,
  notifications = {},
  onLogout,
  ...props
}) => {
  const handleItemClick = (path) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  const getUserDisplayName = () => {
    if (!user) return 'Utente';
    return user.displayName || user.email || 'Utente';
  };

  const getUserRole = () => {
    if (!user || !user.role) return '';
    return user.role === 'admin' ? 'Amministratore' : 'Operatore';
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* User Section */}
      {user && (
        <UserSection>
          <Avatar
            src={user.photoURL}
            sx={{ width: 48, height: 48 }}
          >
            {getUserDisplayName().charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap fontWeight={600}>
              {getUserDisplayName()}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user.email}
            </Typography>
            {getUserRole() && (
              <Chip
                label={getUserRole()}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ mt: 0.5, fontSize: '0.7rem' }}
              />
            )}
          </Box>
        </UserSection>
      )}

      {/* Navigation Menu */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <List sx={{ pt: 2 }}>
          {menuItems.map((item) => {
            const isSelected = currentPath === item.path;
            const hasNotifications = notifications[item.path] > 0;
            
            return (
              <ListItem key={item.path} disablePadding>
                <StyledListItemButton
                  selected={isSelected}
                  onClick={() => handleItemClick(item.path)}
                >
                  <ListItemIcon>
                    {hasNotifications ? (
                      <Badge 
                        badgeContent={notifications[item.path]} 
                        color="error"
                        max={99}
                      >
                        {getIcon(item.icon)}
                      </Badge>
                    ) : (
                      getIcon(item.icon)
                    )}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: '0.9rem',
                    }}
                  />
                </StyledListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Logout Section */}
      {user && (
        <>
          <Divider />
          <List>
            <ListItem disablePadding>
              <StyledListItemButton onClick={handleLogout}>
                <ListItemIcon>
                  <ExitToApp />
                </ListItemIcon>
                <ListItemText 
                  primary="Esci"
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                  }}
                />
              </StyledListItemButton>
            </ListItem>
          </List>
        </>
      )}
    </Box>
  );

  return (
    <StyledDrawer
      variant={variant}
      open={open}
      onClose={onClose}
      ModalProps={{
        keepMounted: true, // Better open performance on mobile
      }}
      {...props}
    >
      {drawerContent}
    </StyledDrawer>
  );
};

export default ResponsiveSidebar;


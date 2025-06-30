// client/src/components/BottomNavigation.jsx (VERSIONE PULITA)
import React from 'react';
import {
  BottomNavigation as MuiBottomNavigation,
  BottomNavigationAction,
  Paper,
  Badge,
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
} from '@mui/icons-material';

const StyledBottomNavigation = styled(MuiBottomNavigation)(({ theme }) => ({
  height: 80,
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  '& .MuiBottomNavigationAction-root': {
    minWidth: 'auto',
    padding: theme.spacing(1),
    '&.Mui-selected': {
      color: theme.palette.primary.main,
    },
  },
}));

const StyledBottomNavigationAction = styled(BottomNavigationAction)(({ theme }) => ({
  '& .MuiBottomNavigationAction-label': {
    fontSize: '0.75rem',
    fontWeight: 500,
    marginTop: theme.spacing(0.5),
    '&.Mui-selected': {
      fontSize: '0.75rem',
    },
  },
}));

const getIcon = (iconName, hasNotifications = false) => {
  const iconMap = {
    HomeIcon: Home,
    ReceiptIcon: Receipt,
    ShoppingCartIcon: ShoppingCart,
    PeopleIcon: People,
    NotificationsIcon: Notifications,
    SettingsIcon: Settings,
    PersonAddIcon: PersonAdd,
  };
  
  const IconComponent = iconMap[iconName] || Home;
  
  if (hasNotifications) {
    return (
      <Badge color="error" variant="dot">
        <IconComponent />
      </Badge>
    );
  }
  
  return <IconComponent />;
};

const BottomNavigation = ({ 
  menuItems = [], 
  currentPath = '/', 
  onNavigate,
  notifications = {},
  ...props 
}) => {
  const getCurrentValue = () => {
    const currentItem = menuItems.find(item => item.path === currentPath);
    return currentItem ? menuItems.indexOf(currentItem) : 0;
  };

  const handleChange = (event, newValue) => {
    if (menuItems[newValue] && onNavigate) {
      onNavigate(menuItems[newValue].path);
    }
  };

  if (!menuItems.length) {
    return null;
  }

  return (
    <Paper 
      elevation={8} 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0,
        zIndex: 1000,
      }}
      {...props}
    >
      <StyledBottomNavigation
        value={getCurrentValue()}
        onChange={handleChange}
        showLabels
      >
        {menuItems.map((item, index) => {
          const hasNotifications = notifications[item.path] > 0;
          
          return (
            <StyledBottomNavigationAction
              key={item.path}
              label={item.text}
              icon={getIcon(item.icon, hasNotifications)}
              value={index}
            />
          );
        })}
      </StyledBottomNavigation>
    </Paper>
  );
};

export default BottomNavigation;


// client/src/components/BottomNavigation.jsx
import React from 'react';
import { 
  BottomNavigation, 
  BottomNavigationAction, 
  Paper,
  Badge,
  Box,
  useTheme,
} from '@mui/material';
import {
  Dashboard,
  Receipt,
  Inventory,
  Business,
  NotificationsActive,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const bottomNavItems = [
  { 
    label: 'Home', 
    icon: <Dashboard />, 
    path: '/',
    badge: null,
  },
  { 
    label: 'Fatture', 
    icon: <Receipt />, 
    path: '/fatture',
    badge: 12,
  },
  { 
    label: 'Prodotti', 
    icon: <Inventory />, 
    path: '/prodotti',
    badge: null,
  },
  { 
    label: 'Fornitori', 
    icon: <Business />, 
    path: '/fornitori',
    badge: null,
  },
  { 
    label: 'Alert', 
    icon: <NotificationsActive />, 
    path: '/alert',
    badge: 3,
  },
];

const BottomNavigationComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const currentIndex = bottomNavItems.findIndex(item => item.path === location.pathname);

  const handleChange = (event, newValue) => {
    navigate(bottomNavItems[newValue].path);
  };

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1000,
        borderTop: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.1)',
      }} 
      elevation={0}
    >
      <BottomNavigation
        value={currentIndex}
        onChange={handleChange}
        showLabels
        sx={{
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: '6px 12px 8px',
            transition: 'all 0.2s ease-in-out',
            '&.Mui-selected': {
              color: 'primary.main',
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.75rem',
                fontWeight: 600,
              },
            },
            '&:not(.Mui-selected)': {
              color: 'text.secondary',
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.7rem',
                fontWeight: 500,
              },
            },
            '& .MuiBottomNavigationAction-label': {
              transition: 'all 0.2s ease-in-out',
            },
          },
        }}
      >
        {bottomNavItems.map((item, index) => (
          <BottomNavigationAction
            key={item.label}
            label={item.label}
            icon={
              item.badge ? (
                <Badge 
                  badgeContent={item.badge} 
                  color="error"
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.6rem',
                      height: 16,
                      minWidth: 16,
                      fontWeight: 600,
                    },
                  }}
                >
                  {item.icon}
                </Badge>
              ) : (
                item.icon
              )
            }
            sx={{
              '&.Mui-selected': {
                transform: 'scale(1.1)',
              },
            }}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default BottomNavigationComponent;


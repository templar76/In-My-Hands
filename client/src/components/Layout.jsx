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

export default function Layout({ children }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState({});
  const toggleMenu = (key) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(state => state.auth.user);
  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  const handleLogout = () => {
    dispatch(logoutUser());
    handleMenuClose();
    navigate('/login');
  };

  const handleDrawerOpen = () => {
    setOpen(true);
  };
  const handleDrawerClose = () => {
    setOpen(false);
  };

  // Recupera il ruolo dell'utente, se l'utente esiste
  const userRole = user ? user.role : null;

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
    : []; // Se l'utente non è loggato o il ruolo non ha permessi definiti, nessuna voce di menu

  // Se l'utente non è autenticato, non mostrare AppBar e Drawer
  // ma mostra comunque i children (es. pagina di Login)
  if (!user) {
    return (
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <DrawerHeader /> {/* Mantiene lo spazio per l'AppBar anche se non visibile, per coerenza layout pagine pubbliche */} 
        {children}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      {/* Mostra AppBar solo se l'utente è loggato */} 
      <AppBar position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{ mr: 2, ...(open && { display: 'none' }) }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            In My Hands
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {user && (
            <>
              <Tooltip title="Account menu">
                <IconButton
                  size="small"
                  onMouseEnter={handleMenuOpen}
                  aria-controls={openMenu ? 'account-menu' : undefined}
                  aria-haspopup="true"
                  sx={{ ml: 2 }}
                >
                  <Avatar>
                    {user.displayName
                      ? user.displayName.charAt(0).toUpperCase()
                      : user.email.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                id="account-menu"
                anchorEl={anchorEl}
                open={openMenu}
                onClose={handleMenuClose}
                MenuListProps={{ onMouseLeave: handleMenuClose }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem onClick={() => { navigate('/profile'); handleMenuClose(); }}>
                  Il Mio Profilo
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  Logout
                </MenuItem>
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            <ChevronLeftIcon />
          </IconButton>
        </DrawerHeader>
        <Divider />
        <List>
          {/* Assicurati che menuItems sia un array prima di mappare */} 
          {Array.isArray(menuItems) && menuItems.map(item => (
            item.children
              ? (
                <React.Fragment key={item.text}>
                  <ListItem disablePadding>
                    <ListItemButton onClick={() => toggleMenu(item.text)}>
                      <ListItemIcon>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.text} />
                      {openMenus[item.text] ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>
                  </ListItem>
                  <Collapse in={openMenus[item.text]} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {item.children.map(sub => (
                        <ListItem key={sub.text} disablePadding>
                          <ListItemButton
                            component={Link}
                            to={sub.path}
                            selected={location.pathname === sub.path}
                            sx={{ pl: 4 }}
                          >
                            <ListItemText primary={sub.text} />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
                </React.Fragment>
              )
              : (
                <ListItem key={item.text} disablePadding>
                  <ListItemButton
                    component={Link}
                    to={item.path}
                    selected={location.pathname === item.path}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                  </ListItemButton>
                </ListItem>
              )
          ))}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, transition: theme.transitions.create('margin', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }), marginLeft: open ? `${drawerWidth}px` : '0px' }}
      >
        <DrawerHeader />
        {children}
      </Box>
    </Box>
  );
}

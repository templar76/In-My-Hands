// client/src/hooks/useResponsive.js
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

export const useResponsive = () => {
  const theme = useTheme();
  
  // Breakpoints basati sul tema personalizzato
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // < 768px
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg')); // 768px - 1023px
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg')); // >= 1024px
  
  // Breakpoint specifici per layout
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm')); // < 600px
  const isLargeMobile = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600px - 767px
  const isSmallTablet = useMediaQuery(theme.breakpoints.between('md', 'lg')); // 768px - 1023px
  const isLargeDesktop = useMediaQuery(theme.breakpoints.up('xl')); // >= 1200px
  
  // Determina il breakpoint corrente
  const breakpoint = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
  
  // Configurazioni layout responsive
  const layoutConfig = {
    // Navigazione
    showBottomNav: isMobile,
    showSidebar: !isMobile,
    sidebarVariant: isDesktop ? 'permanent' : 'temporary',
    sidebarWidth: isDesktop ? 280 : 260,
    
    // Header
    showMobileHeader: isMobile,
    headerHeight: isMobile ? 64 : 0,
    
    // Content
    contentPadding: isMobile ? 16 : isTablet ? 20 : 24,
    cardSpacing: isMobile ? 2 : 3,
    
    // Grid
    gridColumns: isMobile ? 1 : isTablet ? 2 : 3,
    kpiColumns: isMobile ? 2 : isTablet ? 3 : 4,
    
    // Typography
    titleVariant: isMobile ? 'h5' : 'h4',
    subtitleVariant: isMobile ? 'body2' : 'body1',
    
    // Spacing
    sectionSpacing: isMobile ? 3 : 4,
    componentSpacing: isMobile ? 2 : 3,
  };
  
  // Utility functions
  const getResponsiveValue = (mobile, tablet, desktop) => {
    if (isMobile) return mobile;
    if (isTablet) return tablet;
    return desktop;
  };
  
  const getGridProps = (mobileColumns = 12, tabletColumns = 6, desktopColumns = 4) => ({
    xs: mobileColumns,
    md: tabletColumns,
    lg: desktopColumns,
  });
  
  const getSpacing = (multiplier = 1) => ({
    mobile: theme.spacing(2 * multiplier),
    tablet: theme.spacing(3 * multiplier),
    desktop: theme.spacing(4 * multiplier),
    current: getResponsiveValue(
      theme.spacing(2 * multiplier),
      theme.spacing(3 * multiplier),
      theme.spacing(4 * multiplier)
    ),
  });
  
  // Configurazioni specifiche per componenti
  const componentConfig = {
    // KPI Cards
    kpiCard: {
      height: isMobile ? 120 : 140,
      iconSize: isMobile ? 40 : 48,
      titleVariant: isMobile ? 'h6' : 'h5',
    },
    
    // Data Tables
    table: {
      size: isMobile ? 'small' : 'medium',
      stickyHeader: true,
      pagination: {
        rowsPerPageOptions: isMobile ? [5, 10] : [10, 25, 50],
        defaultRowsPerPage: isMobile ? 5 : 10,
      },
    },
    
    // Forms
    form: {
      spacing: isMobile ? 2 : 3,
      buttonSize: isMobile ? 'medium' : 'large',
      fullWidth: isMobile,
    },
    
    // Dialogs
    dialog: {
      fullScreen: isMobile,
      maxWidth: isTablet ? 'md' : 'lg',
    },
    
    // Charts
    chart: {
      height: isMobile ? 250 : isTablet ? 300 : 350,
      responsive: true,
      maintainAspectRatio: false,
    },
  };
  
  return {
    // Breakpoint flags
    isMobile,
    isTablet,
    isDesktop,
    isSmallMobile,
    isLargeMobile,
    isSmallTablet,
    isLargeDesktop,
    
    // Current breakpoint
    breakpoint,
    
    // Layout configuration
    ...layoutConfig,
    
    // Component configurations
    componentConfig,
    
    // Utility functions
    getResponsiveValue,
    getGridProps,
    getSpacing,
    
    // Theme reference
    theme,
  };
};

// Hook per gestire lo stato della sidebar
export const useSidebarState = () => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const { isMobile, sidebarVariant } = useResponsive();
  
  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };
  
  // Auto-close sidebar on mobile when route changes
  React.useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);
  
  return {
    sidebarOpen,
    setSidebarOpen,
    handleSidebarToggle,
    handleSidebarClose,
    shouldShowOverlay: isMobile && sidebarOpen,
  };
};

// Hook per gestire la navigazione responsive
export const useResponsiveNavigation = () => {
  const { isMobile, isTablet } = useResponsive();
  
  const getNavigationMode = () => {
    if (isMobile) return 'bottom';
    if (isTablet) return 'drawer';
    return 'sidebar';
  };
  
  const shouldCollapseOnNavigate = () => {
    return isMobile || isTablet;
  };
  
  return {
    navigationMode: getNavigationMode(),
    shouldCollapseOnNavigate: shouldCollapseOnNavigate(),
  };
};

export default useResponsive;


// client/src/components/ui/KPICard.jsx
import React from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Avatar,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { 
  TrendingUp, 
  TrendingDown, 
  MoreVert,
  InfoOutlined,
} from '@mui/icons-material';

const StyledCard = styled(Card)(({ theme, accentcolor }) => ({
  position: 'relative',
  overflow: 'hidden',
  height: '100%',
  transition: 'all 0.3s ease-in-out',
  cursor: 'pointer',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '4px',
    height: '100%',
    backgroundColor: accentcolor || theme.palette.primary.main,
    transition: 'width 0.3s ease-in-out',
  },
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
    '&::before': {
      width: '6px',
    },
  },
}));

const TrendIndicator = styled(Box)(({ theme, trend }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.spacing(1),
  backgroundColor: trend === 'up' 
    ? theme.palette.success.light + '20'
    : trend === 'down' 
    ? theme.palette.error.light + '20'
    : theme.palette.grey[100],
  color: trend === 'up' 
    ? theme.palette.success.dark
    : trend === 'down' 
    ? theme.palette.error.dark
    : theme.palette.text.secondary,
  fontSize: '0.75rem',
  fontWeight: 600,
}));

const ValueTypography = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}));

const KPICard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  accentColor, 
  trend, 
  trendValue,
  trendLabel,
  onClick,
  onMenuClick,
  loading = false,
  tooltip,
  badge,
  variant = 'default', // 'default', 'compact', 'detailed'
}) => {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp fontSize="small" />;
    if (trend === 'down') return <TrendingDown fontSize="small" />;
    return null;
  };

  const formatValue = (val) => {
    if (loading) return '---';
    if (typeof val === 'number') {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
      return val.toLocaleString();
    }
    return val;
  };

  const renderCompactVariant = () => (
    <Box display="flex" alignItems="center" gap={2}>
      {icon && (
        <Avatar 
          sx={{ 
            bgcolor: accentColor || 'primary.main',
            width: 40,
            height: 40,
          }}
        >
          {icon}
        </Avatar>
      )}
      <Box flex={1}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <ValueTypography variant="h6">
          {formatValue(value)}
        </ValueTypography>
      </Box>
      {trend && (
        <TrendIndicator trend={trend}>
          {getTrendIcon()}
          {trendValue}
        </TrendIndicator>
      )}
    </Box>
  );

  const renderDefaultVariant = () => (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box flex={1}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            {tooltip && (
              <Tooltip title={tooltip} arrow>
                <InfoOutlined fontSize="small" color="action" />
              </Tooltip>
            )}
            {badge && (
              <Chip 
                label={badge} 
                size="small" 
                color="primary" 
                variant="outlined"
              />
            )}
          </Box>
          <ValueTypography variant="h4" component="div">
            {formatValue(value)}
          </ValueTypography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {subtitle}
            </Typography>
          )}
        </Box>
        
        <Box display="flex" alignItems="flex-start" gap={1}>
          {icon && (
            <Avatar 
              sx={{ 
                bgcolor: accentColor || 'primary.main',
                width: 48,
                height: 48,
                boxShadow: 2,
              }}
            >
              {icon}
            </Avatar>
          )}
          {onMenuClick && (
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                onMenuClick(e);
              }}
            >
              <MoreVert />
            </IconButton>
          )}
        </Box>
      </Box>

      {(trend || trendValue) && (
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <TrendIndicator trend={trend}>
            {getTrendIcon()}
            <span>{trendValue}</span>
          </TrendIndicator>
          {trendLabel && (
            <Typography variant="caption" color="text.secondary">
              {trendLabel}
            </Typography>
          )}
        </Box>
      )}
    </>
  );

  const renderDetailedVariant = () => (
    <>
      {renderDefaultVariant()}
      <Box mt={2} pt={2} borderTop={1} borderColor="divider">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Ultimo aggiornamento
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date().toLocaleDateString('it-IT')}
          </Typography>
        </Box>
      </Box>
    </>
  );

  const renderContent = () => {
    switch (variant) {
      case 'compact':
        return renderCompactVariant();
      case 'detailed':
        return renderDetailedVariant();
      default:
        return renderDefaultVariant();
    }
  };

  return (
    <StyledCard 
      accentcolor={accentColor}
      onClick={onClick}
      sx={{
        opacity: loading ? 0.7 : 1,
        pointerEvents: loading ? 'none' : 'auto',
      }}
    >
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {renderContent()}
      </CardContent>
    </StyledCard>
  );
};

// Componente wrapper per griglia di KPI
export const KPIGrid = ({ children, spacing = 3 }) => (
  <Box 
    display="grid" 
    gridTemplateColumns={{
      xs: 'repeat(1, 1fr)',
      sm: 'repeat(2, 1fr)',
      md: 'repeat(3, 1fr)',
      lg: 'repeat(4, 1fr)',
    }}
    gap={spacing}
  >
    {children}
  </Box>
);

// Componenti KPI predefiniti
export const RevenueKPI = ({ value, trend, trendValue, ...props }) => (
  <KPICard
    title="Fatturato"
    value={value}
    icon="€"
    accentColor="#10B981"
    trend={trend}
    trendValue={trendValue}
    trendLabel="vs mese scorso"
    {...props}
  />
);

export const InvoicesKPI = ({ value, trend, trendValue, ...props }) => (
  <KPICard
    title="Fatture"
    value={value}
    icon="📄"
    accentColor="#6366F1"
    trend={trend}
    trendValue={trendValue}
    trendLabel="questo mese"
    {...props}
  />
);

export const SuppliersKPI = ({ value, trend, trendValue, ...props }) => (
  <KPICard
    title="Fornitori Attivi"
    value={value}
    icon="🏢"
    accentColor="#F59E0B"
    trend={trend}
    trendValue={trendValue}
    trendLabel="fornitori"
    {...props}
  />
);

export const AlertsKPI = ({ value, trend, trendValue, ...props }) => (
  <KPICard
    title="Alert Attivi"
    value={value}
    icon="🔔"
    accentColor="#EF4444"
    trend={trend}
    trendValue={trendValue}
    trendLabel="notifiche"
    {...props}
  />
);

export default KPICard;


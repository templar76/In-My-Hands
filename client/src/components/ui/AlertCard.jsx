// client/src/components/ui/AlertCard.jsx
import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Chip,
  Avatar,
  Button,
  Collapse,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Warning,
  Error,
  Info,
  CheckCircle,
  Close,
  ExpandMore,
  Schedule,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material';

const StyledCard = styled(Card)(({ theme, severity }) => {
  const colors = {
    error: theme.palette.error,
    warning: theme.palette.warning,
    info: theme.palette.info,
    success: theme.palette.success,
  };
  
  const color = colors[severity] || colors.info;
  
  return {
    position: 'relative',
    overflow: 'hidden',
    transition: 'all 0.3s ease-in-out',
    border: `1px solid ${color.light}`,
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      width: '4px',
      height: '100%',
      backgroundColor: color.main,
    },
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[4],
    },
  };
});

const ExpandButton = styled(IconButton)(({ theme, expanded }) => ({
  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest,
  }),
}));

const AlertCard = ({
  title,
  message,
  severity = 'info', // 'error', 'warning', 'info', 'success'
  timestamp,
  onClose,
  onAction,
  actionLabel = 'Risolvi',
  expandable = false,
  details,
  value,
  trend,
  trendValue,
  category,
}) => {
  const [expanded, setExpanded] = React.useState(false);

  const getIcon = () => {
    switch (severity) {
      case 'error':
        return <Error />;
      case 'warning':
        return <Warning />;
      case 'success':
        return <CheckCircle />;
      default:
        return <Info />;
    }
  };

  const getSeverityColor = () => {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'success':
        return 'success';
      default:
        return 'info';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ora';
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffHours < 24) return `${diffHours} ore fa`;
    return `${diffDays} giorni fa`;
  };

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  return (
    <StyledCard severity={severity}>
      <CardContent sx={{ pb: expandable || onAction ? 1 : 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Avatar
            sx={{
              bgcolor: `${getSeverityColor()}.light`,
              color: `${getSeverityColor()}.dark`,
              width: 40,
              height: 40,
            }}
          >
            {getIcon()}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                {title}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {category && (
                  <Chip
                    label={category}
                    size="small"
                    color={getSeverityColor()}
                    variant="outlined"
                    sx={{ fontSize: '0.7rem' }}
                  />
                )}
                {onClose && (
                  <IconButton size="small" onClick={onClose}>
                    <Close fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {message}
            </Typography>

            {/* Value and Trend */}
            {(value || trend) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                {value && (
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    {value}
                  </Typography>
                )}
                {trend && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {trend === 'up' ? (
                      <TrendingUp fontSize="small" color="success" />
                    ) : (
                      <TrendingDown fontSize="small" color="error" />
                    )}
                    <Typography
                      variant="caption"
                      color={trend === 'up' ? 'success.main' : 'error.main'}
                      fontWeight={600}
                    >
                      {trendValue}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* Timestamp */}
            {timestamp && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Schedule fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  {formatTimestamp(timestamp)}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Expandable Details */}
        {expandable && (
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              {details && (
                <Typography variant="body2" color="text.secondary">
                  {details}
                </Typography>
              )}
            </Box>
          </Collapse>
        )}

        {/* Actions */}
        {(expandable || onAction) && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
            {onAction && (
              <Button
                size="small"
                variant="contained"
                color={getSeverityColor()}
                onClick={onAction}
                sx={{ textTransform: 'none' }}
              >
                {actionLabel}
              </Button>
            )}
            
            {expandable && (
              <ExpandButton
                expanded={expanded}
                onClick={handleExpandClick}
                aria-expanded={expanded}
                aria-label="mostra dettagli"
                size="small"
              >
                <ExpandMore />
              </ExpandButton>
            )}
          </Box>
        )}
      </CardContent>
    </StyledCard>
  );
};

// Componenti Alert predefiniti
export const PriceAlert = ({ product, oldPrice, newPrice, percentage, ...props }) => (
  <AlertCard
    title="Variazione Prezzo"
    message={`Il prezzo di ${product} è ${percentage > 0 ? 'aumentato' : 'diminuito'} del ${Math.abs(percentage)}%`}
    severity={percentage > 10 ? 'error' : percentage > 5 ? 'warning' : 'info'}
    value={`€${newPrice}`}
    trend={percentage > 0 ? 'up' : 'down'}
    trendValue={`${percentage > 0 ? '+' : ''}${percentage}%`}
    category="PREZZO"
    details={`Prezzo precedente: €${oldPrice} → Nuovo prezzo: €${newPrice}`}
    expandable
    {...props}
  />
);

export const StockAlert = ({ product, currentStock, minStock, ...props }) => (
  <AlertCard
    title="Scorte in Esaurimento"
    message={`Le scorte di ${product} sono sotto la soglia minima`}
    severity="warning"
    value={`${currentStock} pz`}
    category="SCORTE"
    details={`Scorte attuali: ${currentStock} pz - Soglia minima: ${minStock} pz`}
    expandable
    actionLabel="Riordina"
    {...props}
  />
);

export const SupplierAlert = ({ supplier, type, ...props }) => (
  <AlertCard
    title="Aggiornamento Fornitore"
    message={`${supplier} - ${type}`}
    severity="info"
    category="FORNITORE"
    actionLabel="Visualizza"
    {...props}
  />
);

export const InvoiceAlert = ({ invoice, status, ...props }) => (
  <AlertCard
    title="Stato Fattura"
    message={`Fattura ${invoice} - ${status}`}
    severity={status === 'Errore' ? 'error' : status === 'In attesa' ? 'warning' : 'success'}
    category="FATTURA"
    actionLabel="Controlla"
    {...props}
  />
);

// Container per lista di alert
export const AlertList = ({ alerts, onAlertAction, onAlertClose }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    {alerts.map((alert) => (
      <AlertCard
        key={alert.id}
        {...alert}
        onAction={onAlertAction ? () => onAlertAction(alert) : undefined}
        onClose={onAlertClose ? () => onAlertClose(alert.id) : undefined}
      />
    ))}
  </Box>
);

export default AlertCard;


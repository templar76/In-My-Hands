import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Alert } from '../ui/alert';
import { Badge } from '../ui/badge';
import {
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  Download,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { getFirebaseToken } from '../../store/authSlice';
import ClientLogger from '../../utils/ClientLogger';

const AlertListManager = ({ 
  className = '',
  onProductClick,
  showExportButton = true,
  showRefreshButton = true,
  pageSize = 10
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth);
  
  // Stati principali
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState({
    totalAlerts: 0,
    activeAlerts: 0,
    triggeredToday: 0,
    triggeredThisWeek: 0
  });
  
  // Filtri e paginazione
  const [page, setPage] = useState(1);
  const [limit] = useState(pageSize);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog per modifica alert
  const [editDialog, setEditDialog] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [editFormData, setEditFormData] = useState({
    alertType: 'price_threshold',
    thresholdPrice: '',
    variationThreshold: '10',
    isActive: true
  });

  // Gestione click prodotto
  const handleProductClick = useCallback((productId) => {
    if (onProductClick) {
      onProductClick(productId);
    } else if (productId) {
      navigate(`/products/${productId}`);
    }
  }, [navigate, onProductClick]);

  // Fetch degli alert
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const token = await dispatch(getFirebaseToken()).unwrap();
      
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts?page=${page}&limit=${limit}&search=${searchTerm}&type=${filterType}&status=${filterStatus}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      ClientLogger.info('Alerts fetched successfully', {
        component: 'AlertListManager',
        action: 'fetchAlerts',
        alertsCount: data.alerts?.length || 0,
        page,
        limit,
        searchTerm,
        filterType,
        filterStatus
      });
      
      setAlerts(data.alerts || []);
      setStats(data.stats || {});
      
    } catch (error) {
      ClientLogger.error('Error fetching alerts', {
        component: 'AlertListManager',
        action: 'fetchAlerts',
        error: error.message,
        page,
        limit,
        searchTerm,
        filterType,
        filterStatus
      });
      setError('Errore nel caricamento degli alert');
    } finally {
      setLoading(false);
    }
  }, [dispatch, page, limit, searchTerm, filterType, filterStatus]);

  // Toggle stato alert
  const handleToggleAlert = useCallback(async (alertId, currentStatus) => {
    try {
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/${alertId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      await fetchAlerts();
      setSuccess('Stato alert aggiornato con successo!');
    } catch (error) {
      ClientLogger.error('Error toggling alert status', {
        component: 'AlertListManager',
        action: 'handleToggleAlert',
        alertId,
        currentStatus,
        error: error.message
      });
      setError('Errore nell\'aggiornamento dello stato dell\'alert');
    }
  }, [dispatch, fetchAlerts]);

  // Eliminazione alert
  const handleDeleteAlert = useCallback(async (alertId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo alert?')) {
      return;
    }
    
    try {
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/${alertId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      await fetchAlerts();
      setSuccess('Alert eliminato con successo!');
    } catch (error) {
      ClientLogger.error('Error deleting alert', {
        component: 'AlertListManager',
        action: 'handleDeleteAlert',
        alertId,
        error: error.message
      });
      setError('Errore nell\'eliminazione dell\'alert');
    }
  }, [dispatch, fetchAlerts]);

  // Apertura dialog modifica
  const handleEditAlert = (alert) => {
    setSelectedAlert(alert);
    setEditFormData({
      alertType: alert.type || alert.alertType,
      thresholdPrice: alert.thresholdPrice?.toString() || '',
      variationThreshold: alert.variationThreshold?.toString() || '10',
      isActive: alert.isActive
    });
    setEditDialog(true);
  };

  // Salvataggio modifica
  const handleSaveEdit = useCallback(async () => {
    try {
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/${selectedAlert._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alertType: editFormData.alertType,
          thresholdPrice: editFormData.alertType === 'price_threshold' ? parseFloat(editFormData.thresholdPrice) : undefined,
          variationThreshold: editFormData.alertType === 'price_variation' ? parseInt(editFormData.variationThreshold) : undefined,
          isActive: editFormData.isActive
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setEditDialog(false);
      await fetchAlerts();
      setSuccess('Alert aggiornato con successo!');
    } catch (error) {
      ClientLogger.error('Error updating alert', {
        component: 'AlertListManager',
        action: 'handleSaveEdit',
        alertId: selectedAlert?._id,
        alertType: editFormData.alertType,
        error: error.message
      });
      setError('Errore nell\'aggiornamento dell\'alert');
    }
  }, [dispatch, fetchAlerts, selectedAlert, editFormData]);

  // Invio email di test
  const handleSendTestEmail = useCallback(async (alertId) => {
    try {
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/${alertId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setSuccess('Email di test inviata con successo!');
    } catch (error) {
      ClientLogger.error('Error sending test email', {
        component: 'AlertListManager',
        action: 'handleSendTestEmail',
        alertId,
        error: error.message
      });
      setError('Errore nell\'invio dell\'email di test');
    }
  }, [dispatch]);

  // Esportazione alert
  const handleExportAlerts = useCallback(async () => {
    try {
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/export`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `alerts_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccess('Export completato con successo!');
    } catch (error) {
      ClientLogger.error('Error exporting alerts', {
        component: 'AlertListManager',
        action: 'handleExportAlerts',
        error: error.message
      });
      setError('Errore nell\'esportazione degli alert');
    }
  }, [dispatch]);

  // Reset filtri
  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    setFilterStatus('all');
    setPage(1);
  };

  // Utility functions
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Effect per fetch iniziale
  useEffect(() => {
    if (isAuthenticated) {
      fetchAlerts();
    }
  }, [fetchAlerts, isAuthenticated]);

  // Auto-clear messaggi dopo 5 secondi
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (loading) {
    return (
      <div className={`flex justify-center items-center min-h-[400px] ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header con azioni */}
      {(showExportButton || showRefreshButton) && (
        <div className="flex justify-end items-center mb-4 gap-2">
          {showExportButton && (
            <Button
              variant="outline"
              onClick={handleExportAlerts}
              disabled={alerts.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Esporta CSV
            </Button>
          )}
          {showRefreshButton && (
            <Button
              variant="outline"
              onClick={fetchAlerts}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Aggiorna
            </Button>
          )}
        </div>
      )}

      {/* Messaggi di feedback */}
      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
          <div className="flex justify-between items-center">
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="ml-2 text-green-600 hover:text-green-800">
              ×
            </button>
          </div>
        </Alert>
      )}
      
      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50 text-red-800">
          <div className="flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-2 text-red-600 hover:text-red-800">
              ×
            </button>
          </div>
        </Alert>
      )}

      {/* Filtri */}
      <Card className="mb-6">
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="search">Cerca prodotto</Label>
              <Input
                id="search"
                placeholder="Cerca prodotto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Tipo Alert</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="price_threshold">Soglia Prezzo</SelectItem>
                  <SelectItem value="price_variation">Variazione Prezzo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Stato</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="active">Attivi</SelectItem>
                  <SelectItem value="inactive">Disattivi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Button
                variant="outline"
                onClick={handleResetFilters}
                className="w-full"
              >
                Reset Filtri
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabella Alert */}
      <Card>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prodotto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Configurazione</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Attivazioni</TableHead>
                  <TableHead>Ultima Attivazione</TableHead>
                  <TableHead className="text-center">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert._id}>
                    <TableCell>
                      {alert.product ? (
                        <div
                          onClick={() => handleProductClick(alert.product._id)}
                          className="cursor-pointer p-2 rounded hover:bg-gray-50 transition-colors"
                        >
                          <div className="text-sm font-semibold text-blue-600 hover:underline leading-tight">
                            {alert.product.codeInternal || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {alert.product.descriptionStd || 'Descrizione non disponibile'}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-sm font-semibold text-red-600">
                            Codice non trovato
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Prodotto non disponibile
                          </div>
                        </div>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Badge 
                        variant={(alert.type || alert.alertType) === 'price_threshold' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {(alert.type || alert.alertType) === 'price_threshold' ? 'Soglia' : 'Variazione'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      {(alert.type || alert.alertType) === 'price_threshold' ? ( 
                        <div className="text-sm">
                          Soglia: {formatCurrency(alert.thresholdPrice)}
                        </div>
                      ) : (
                        <div className="text-sm">
                          Variazione: {alert.variationThreshold}%
                        </div>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Badge 
                        variant={alert.isActive ? 'default' : 'secondary'}
                        className={`text-xs flex items-center gap-1 w-fit ${
                          alert.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {alert.isActive ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
                        {alert.isActive ? 'Attivo' : 'Disattivo'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        {alert.triggerHistory?.length || 0}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {alert.triggerHistory && alert.triggerHistory.length > 0 ? (
                        <div className="text-sm">
                          {formatDate(alert.triggerHistory[alert.triggerHistory.length - 1].triggeredAt)}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          Mai
                        </div>
                      )}
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="flex gap-1 justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleAlert(alert._id, alert.isActive)}
                          className={`h-8 w-8 p-0 ${
                            alert.isActive ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'
                          }`}
                          title={alert.isActive ? 'Disattiva' : 'Attiva'}
                        >
                          {alert.isActive ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditAlert(alert)}
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                          title="Modifica"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendTestEmail(alert._id)}
                          className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700"
                          title="Test Email"
                          disabled={!alert.isActive}
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAlert(alert._id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          title="Elimina"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {alerts.length === 0 && (
            <div className="text-center py-8">
              <div className="text-base text-gray-600 mb-2">
                Nessun alert trovato
              </div>
              <div className="text-sm text-gray-500">
                Crea il tuo primo alert dalla pagina di dettaglio di un prodotto
              </div>
            </div>
          )}
          
          {/* Paginazione */}
          {alerts.length > 0 && (
            <div className="flex justify-center mt-6">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="px-3"
                >
                  Precedente
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.ceil(stats.totalAlerts / limit) }, (_, i) => i + 1)
                    .filter(pageNum => {
                      const totalPages = Math.ceil(stats.totalAlerts / limit);
                      if (totalPages <= 7) return true;
                      if (pageNum === 1 || pageNum === totalPages) return true;
                      if (pageNum >= page - 1 && pageNum <= page + 1) return true;
                      return false;
                    })
                    .map((pageNum, index, array) => {
                      const prevPageNum = array[index - 1];
                      const showEllipsis = prevPageNum && pageNum - prevPageNum > 1;
                      
                      return (
                        <React.Fragment key={pageNum}>
                          {showEllipsis && (
                            <span className="px-2 text-gray-500">...</span>
                          )}
                          <Button
                            variant={page === pageNum ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        </React.Fragment>
                      );
                    })
                  }
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= Math.ceil(stats.totalAlerts / limit)}
                  className="px-3"
                >
                  Successivo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog per modifica alert */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica Alert</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo Alert</Label>
              <Select 
                value={editFormData.alertType} 
                onValueChange={(value) => setEditFormData({...editFormData, alertType: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_threshold">Soglia Prezzo</SelectItem>
                  <SelectItem value="price_variation">Variazione Prezzo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {editFormData.alertType === 'price_threshold' ? (
              <div className="space-y-2">
                <Label htmlFor="threshold-price">Prezzo soglia (€)</Label>
                <Input
                  id="threshold-price"
                  type="number"
                  value={editFormData.thresholdPrice}
                  onChange={(e) => setEditFormData({...editFormData, thresholdPrice: e.target.value})}
                  min={0}
                  step={0.01}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="variation-threshold">Soglia variazione (%)</Label>
                <Input
                  id="variation-threshold"
                  type="number"
                  value={editFormData.variationThreshold}
                  onChange={(e) => setEditFormData({...editFormData, variationThreshold: e.target.value})}
                  min={1}
                  max={100}
                />
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Switch
                id="alert-active"
                checked={editFormData.isActive}
                onCheckedChange={(checked) => setEditFormData({...editFormData, isActive: checked})}
              />
              <Label htmlFor="alert-active">Alert attivo</Label>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleSaveEdit}>
              Salva
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlertListManager;
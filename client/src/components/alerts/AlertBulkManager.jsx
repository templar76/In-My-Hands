import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { CheckSquare, Square, Trash2, Power, PowerOff, Edit, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useDispatch, useSelector } from 'react-redux';
import { getFirebaseToken } from '../../store/authSlice';
// Aggiungi questa importazione all'inizio del file
import { getAuthToken } from '../../utils/authUtils';

const AlertBulkManager = ({ alerts, onRefresh }) => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const [selectedAlerts, setSelectedAlerts] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkUpdates, setBulkUpdates] = useState({});
  const [loading, setLoading] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  const handleSelectAll = () => {
    if (selectedAlerts.size === alerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(alerts.map(alert => alert._id)));
    }
  };

  const handleSelectAlert = (alertId) => {
    const newSelected = new Set(selectedAlerts);
    if (newSelected.has(alertId)) {
      newSelected.delete(alertId);
    } else {
      newSelected.add(alertId);
    }
    setSelectedAlerts(newSelected);
  };

  const executeBulkAction = async () => {
    if (selectedAlerts.size === 0) {
      toast.error('Seleziona almeno un alert');
      return;
    }

    if (!bulkAction) {
      toast.error('Seleziona un\'azione da eseguire');
      return;
    }

    try {
      setLoading(true);
      const token = await dispatch(getFirebaseToken()).unwrap();
      
      const requestBody = {
        alertIds: Array.from(selectedAlerts),
        action: bulkAction
      };

      if (bulkAction === 'update' && Object.keys(bulkUpdates).length > 0) {
        requestBody.updates = bulkUpdates;
      }

      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`${data.message} (${data.modifiedCount} alert modificati)`);
        setSelectedAlerts(new Set());
        setBulkAction('');
        setBulkUpdates({});
        setShowBulkDialog(false);
        onRefresh();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'operazione bulk');
      }
    } catch (error) {
      console.error('Error in bulk operation:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportAlerts = async (format = 'json', includeHistory = false) => {
    try {
      setLoading(true);
      const token = await dispatch(getFirebaseToken()).unwrap();
      
      const params = new URLSearchParams({
        format,
        includeHistory: includeHistory.toString()
      });

      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `alert-report-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Report esportato con successo');
      } else {
        throw new Error('Errore nell\'esportazione');
      }
    } catch (error) {
      console.error('Error exporting alerts:', error);
      toast.error('Errore nell\'esportazione del report');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'activate': return <Power className="h-4 w-4" />;
      case 'deactivate': return <PowerOff className="h-4 w-4" />;
      case 'delete': return <Trash2 className="h-4 w-4" />;
      case 'update': return <Edit className="h-4 w-4" />;
      default: return null;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'activate': return 'text-green-600';
      case 'deactivate': return 'text-yellow-600';
      case 'delete': return 'text-red-600';
      case 'update': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Gestione Massiva Alert</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportAlerts('json', false)}
              disabled={loading}
            >
              <Download className="h-4 w-4 mr-2" />
              JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportAlerts('csv', false)}
              disabled={loading}
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selezione Alert */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedAlerts.size === alerts.length && alerts.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label className="text-sm font-medium">
                Seleziona tutti ({selectedAlerts.size}/{alerts.length})
              </Label>
            </div>
            {selectedAlerts.size > 0 && (
              <Badge variant="secondary">
                {selectedAlerts.size} alert selezionati
              </Badge>
            )}
          </div>

          {/* Lista Alert con checkbox */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert._id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  selectedAlerts.has(alert._id) ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                }`}
              >
                <Checkbox
                  checked={selectedAlerts.has(alert._id)}
                  onCheckedChange={() => handleSelectAlert(alert._id)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {alert.product?.description || 'Prodotto non disponibile'}
                    </span>
                    <Badge variant={alert.isActive ? 'default' : 'secondary'}>
                      {alert.isActive ? 'Attivo' : 'Inattivo'}
                    </Badge>
                    <Badge variant="outline">{alert.type}</Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    {alert.product?.codeInternal || 'N/A'} • {alert.notificationMethod}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{alert.triggerCount} trigger</p>
                  {alert.thresholdPrice && (
                    <p className="text-xs text-gray-500">€{alert.thresholdPrice}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Azioni Bulk */}
        {selectedAlerts.size > 0 && (
          <div className="border-t pt-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBulkAction('activate');
                  setShowBulkDialog(true);
                }}
                className="text-green-600"
              >
                <Power className="h-4 w-4 mr-2" />
                Attiva
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBulkAction('deactivate');
                  setShowBulkDialog(true);
                }}
                className="text-yellow-600"
              >
                <PowerOff className="h-4 w-4 mr-2" />
                Disattiva
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBulkAction('update');
                  setShowBulkDialog(true);
                }}
                className="text-blue-600"
              >
                <Edit className="h-4 w-4 mr-2" />
                Modifica
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBulkAction('delete');
                  setShowBulkDialog(true);
                }}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Elimina
              </Button>
            </div>
          </div>
        )}

        {/* Dialog di conferma */}
        <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className={getActionColor(bulkAction)}>
                  {getActionIcon(bulkAction)}
                </span>
                Conferma Operazione Massiva
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Stai per eseguire l'azione <strong>{bulkAction}</strong> su <strong>{selectedAlerts.size}</strong> alert.
              </p>

              {bulkAction === 'update' && (
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">Impostazioni Base</TabsTrigger>
                    <TabsTrigger value="advanced">Avanzate</TabsTrigger>
                  </TabsList>
                  <TabsContent value="basic" className="space-y-3">
                    <div>
                      <Label htmlFor="checkFrequency">Frequenza Controllo</Label>
                      <Select
                        value={bulkUpdates.checkFrequency || ''}
                        onValueChange={(value) => setBulkUpdates(prev => ({ ...prev, checkFrequency: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona frequenza" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="realtime">Tempo reale</SelectItem>
                          <SelectItem value="hourly">Ogni ora</SelectItem>
                          <SelectItem value="daily">Giornaliero</SelectItem>
                          <SelectItem value="weekly">Settimanale</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="notificationMethod">Metodo Notifica</Label>
                      <Select
                        value={bulkUpdates.notificationMethod || ''}
                        onValueChange={(value) => setBulkUpdates(prev => ({ ...prev, notificationMethod: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona metodo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="pec">PEC</SelectItem>
                          <SelectItem value="both">Entrambi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>
                  <TabsContent value="advanced" className="space-y-3">
                    <div>
                      <Label htmlFor="thresholdPrice">Soglia Prezzo (€)</Label>
                      <Input
                        id="thresholdPrice"
                        type="number"
                        step="0.01"
                        value={bulkUpdates.thresholdPrice || ''}
                        onChange={(e) => setBulkUpdates(prev => ({ 
                          ...prev, 
                          thresholdPrice: e.target.value ? parseFloat(e.target.value) : undefined 
                        }))}
                        placeholder="Es. 10.50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="variationThreshold">Soglia Variazione (%)</Label>
                      <Input
                        id="variationThreshold"
                        type="number"
                        step="0.1"
                        value={bulkUpdates.variationThreshold || ''}
                        onChange={(e) => setBulkUpdates(prev => ({ 
                          ...prev, 
                          variationThreshold: e.target.value ? parseFloat(e.target.value) : undefined 
                        }))}
                        placeholder="Es. 15.0"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              {bulkAction === 'delete' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">
                    ⚠️ <strong>Attenzione:</strong> Questa operazione è irreversibile. 
                    Gli alert selezionati verranno eliminati definitivamente.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowBulkDialog(false)}
                  disabled={loading}
                >
                  Annulla
                </Button>
                <Button
                  onClick={executeBulkAction}
                  disabled={loading}
                  className={bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}
                >
                  {loading ? 'Elaborazione...' : 'Conferma'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AlertBulkManager;
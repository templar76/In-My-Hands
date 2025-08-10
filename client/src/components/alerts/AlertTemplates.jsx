import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { TrendingDown, TrendingUp, AlertTriangle, Zap, Target, Bell, Plus, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

const AlertTemplates = ({ onTemplateApplied }) => {
  const { user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [customTemplate, setCustomTemplate] = useState({
    name: '',
    description: '',
    type: 'price_threshold',
    thresholdPrice: '',
    variationThreshold: '',
    checkFrequency: 'daily',
    notificationMethod: 'email',
    isActive: true
  });
  const [loading, setLoading] = useState(false);

  const predefinedTemplates = [
    {
      id: 'price-drop-aggressive',
      name: 'Calo Prezzo Aggressivo',
      description: 'Monitora cali di prezzo significativi (>20%) per opportunità di acquisto',
      icon: <TrendingDown className="h-5 w-5 text-green-600" />,
      color: 'green',
      config: {
        type: 'price_variation',
        variationThreshold: -20,
        checkFrequency: 'hourly',
        notificationMethod: 'email',
        isActive: true
      },
      category: 'Opportunità'
    },
    {
      id: 'price-increase-warning',
      name: 'Allarme Aumento Prezzi',
      description: 'Avvisa quando i prezzi aumentano oltre il 15% per gestire i costi',
      icon: <TrendingUp className="h-5 w-5 text-red-600" />,
      color: 'red',
      config: {
        type: 'price_variation',
        variationThreshold: 15,
        checkFrequency: 'daily',
        notificationMethod: 'email',
        isActive: true
      },
      category: 'Controllo Costi'
    },
    {
      id: 'threshold-budget',
      name: 'Soglia Budget',
      description: 'Monitora quando i prezzi superano una soglia specifica del budget',
      icon: <Target className="h-5 w-5 text-blue-600" />,
      color: 'blue',
      config: {
        type: 'price_threshold',
        thresholdPrice: 100,
        checkFrequency: 'daily',
        notificationMethod: 'email',
        isActive: true
      },
      category: 'Budget'
    },
    {
      id: 'critical-supplier',
      name: 'Fornitore Critico',
      description: 'Monitoraggio intensivo per fornitori strategici con controlli frequenti',
      icon: <AlertTriangle className="h-5 w-5 text-orange-600" />,
      color: 'orange',
      config: {
        type: 'price_variation',
        variationThreshold: 10,
        checkFrequency: 'realtime',
        notificationMethod: 'both',
        isActive: true
      },
      category: 'Strategico'
    },
    {
      id: 'market-volatility',
      name: 'Volatilità Mercato',
      description: 'Rileva variazioni rapide di prezzo per prodotti volatili',
      icon: <Zap className="h-5 w-5 text-purple-600" />,
      color: 'purple',
      config: {
        type: 'price_variation',
        variationThreshold: 5,
        checkFrequency: 'hourly',
        notificationMethod: 'email',
        isActive: true
      },
      category: 'Mercato'
    },
    {
      id: 'routine-monitoring',
      name: 'Monitoraggio Routine',
      description: 'Controllo standard per prodotti regolari con soglie moderate',
      icon: <Bell className="h-5 w-5 text-gray-600" />,
      color: 'gray',
      config: {
        type: 'price_variation',
        variationThreshold: 25,
        checkFrequency: 'weekly',
        notificationMethod: 'email',
        isActive: true
      },
      category: 'Standard'
    }
  ];

  const categories = [...new Set(predefinedTemplates.map(t => t.category))];

  const applyTemplate = async (template, productIds = []) => {
    if (productIds.length === 0) {
      toast.error('Seleziona almeno un prodotto per applicare il template');
      return;
    }

    try {
      setLoading(true);
      const token = await user.getIdToken();
      
      const alertsToCreate = productIds.map(productId => ({
        productId,
        ...template.config
      }));

      const promises = alertsToCreate.map(alertData => 
        fetch('/api/alerts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(alertData)
        })
      );

      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.ok).length;
      
      if (successCount > 0) {
        toast.success(`${successCount} alert creati con template "${template.name}"`);
        onTemplateApplied?.();
      } else {
        toast.error('Errore nella creazione degli alert');
      }
    } catch (error) {
      console.error('Error applying template:', error);
      toast.error('Errore nell\'applicazione del template');
    } finally {
      setLoading(false);
    }
  };

  const createCustomTemplate = async () => {
    if (!customTemplate.name.trim()) {
      toast.error('Inserisci un nome per il template');
      return;
    }

    try {
      setLoading(true);
      // In una implementazione reale, salveresti il template personalizzato nel database
      toast.success(`Template "${customTemplate.name}" creato con successo`);
      setShowCreateDialog(false);
      setCustomTemplate({
        name: '',
        description: '',
        type: 'price_threshold',
        thresholdPrice: '',
        variationThreshold: '',
        checkFrequency: 'daily',
        notificationMethod: 'email',
        isActive: true
      });
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Errore nella creazione del template');
    } finally {
      setLoading(false);
    }
  };

  const getColorClasses = (color) => {
    const colorMap = {
      green: 'border-green-200 bg-green-50 hover:bg-green-100',
      red: 'border-red-200 bg-red-50 hover:bg-red-100',
      blue: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
      orange: 'border-orange-200 bg-orange-50 hover:bg-orange-100',
      purple: 'border-purple-200 bg-purple-50 hover:bg-purple-100',
      gray: 'border-gray-200 bg-gray-50 hover:bg-gray-100'
    };
    return colorMap[color] || colorMap.gray;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Template Alert Prezzi</span>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Crea Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Crea Template Personalizzato</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="templateName">Nome Template</Label>
                    <Input
                      id="templateName"
                      value={customTemplate.name}
                      onChange={(e) => setCustomTemplate(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Es. Monitoraggio Speciale"
                    />
                  </div>
                  <div>
                    <Label htmlFor="templateDescription">Descrizione</Label>
                    <Textarea
                      id="templateDescription"
                      value={customTemplate.description}
                      onChange={(e) => setCustomTemplate(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descrivi l'utilizzo del template..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="templateType">Tipo Alert</Label>
                    <Select
                      value={customTemplate.type}
                      onValueChange={(value) => setCustomTemplate(prev => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="price_threshold">Soglia Prezzo</SelectItem>
                        <SelectItem value="price_variation">Variazione Prezzo</SelectItem>
                        <SelectItem value="stock">Disponibilità</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {customTemplate.type === 'price_threshold' && (
                    <div>
                      <Label htmlFor="templateThreshold">Soglia Prezzo (€)</Label>
                      <Input
                        id="templateThreshold"
                        type="number"
                        step="0.01"
                        value={customTemplate.thresholdPrice}
                        onChange={(e) => setCustomTemplate(prev => ({ ...prev, thresholdPrice: e.target.value }))}
                        placeholder="Es. 50.00"
                      />
                    </div>
                  )}
                  {customTemplate.type === 'price_variation' && (
                    <div>
                      <Label htmlFor="templateVariation">Variazione (%) </Label>
                      <Input
                        id="templateVariation"
                        type="number"
                        step="0.1"
                        value={customTemplate.variationThreshold}
                        onChange={(e) => setCustomTemplate(prev => ({ ...prev, variationThreshold: e.target.value }))}
                        placeholder="Es. 15.0"
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="templateFrequency">Frequenza Controllo</Label>
                    <Select
                      value={customTemplate.checkFrequency}
                      onValueChange={(value) => setCustomTemplate(prev => ({ ...prev, checkFrequency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
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
                    <Label htmlFor="templateNotification">Metodo Notifica</Label>
                    <Select
                      value={customTemplate.notificationMethod}
                      onValueChange={(value) => setCustomTemplate(prev => ({ ...prev, notificationMethod: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="pec">PEC</SelectItem>
                        <SelectItem value="both">Entrambi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="templateActive"
                      checked={customTemplate.isActive}
                      onCheckedChange={(checked) => setCustomTemplate(prev => ({ ...prev, isActive: checked }))}
                    />
                    <Label htmlFor="templateActive">Attiva immediatamente</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateDialog(false)}
                      disabled={loading}
                    >
                      Annulla
                    </Button>
                    <Button onClick={createCustomTemplate} disabled={loading}>
                      {loading ? 'Creazione...' : 'Crea Template'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-6">
            Utilizza i template predefiniti per configurare rapidamente alert per scenari comuni di monitoraggio prezzi.
          </p>
          
          {categories.map(category => (
            <div key={category} className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {predefinedTemplates
                  .filter(template => template.category === category)
                  .map((template) => (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-all duration-200 ${getColorClasses(template.color)} ${
                        selectedTemplate?.id === template.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            {template.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm mb-1">{template.name}</h4>
                            <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                              {template.description}
                            </p>
                            <div className="flex flex-wrap gap-1 mb-3">
                              <Badge variant="outline" className="text-xs">
                                {template.config.type === 'price_threshold' ? 'Soglia' : 'Variazione'}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {template.config.checkFrequency}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {template.config.notificationMethod}
                              </Badge>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs h-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // In una implementazione reale, apriresti un dialog per selezionare i prodotti
                                  toast.info('Seleziona i prodotti per applicare questo template');
                                }}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Applica
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                }
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {selectedTemplate.icon}
              {selectedTemplate.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-500">Tipo</Label>
                  <p className="text-sm font-medium">
                    {selectedTemplate.config.type === 'price_threshold' ? 'Soglia Prezzo' : 'Variazione Prezzo'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">Frequenza</Label>
                  <p className="text-sm font-medium">{selectedTemplate.config.checkFrequency}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">Notifica</Label>
                  <p className="text-sm font-medium">{selectedTemplate.config.notificationMethod}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">Soglia</Label>
                  <p className="text-sm font-medium">
                    {selectedTemplate.config.thresholdPrice ? 
                      `€${selectedTemplate.config.thresholdPrice}` : 
                      `${selectedTemplate.config.variationThreshold}%`
                    }
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    // In una implementazione reale, apriresti un dialog per selezionare i prodotti
                    toast.info('Funzionalità di selezione prodotti in sviluppo');
                  }}
                  disabled={loading}
                >
                  Applica a Prodotti Selezionati
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedTemplate(null)}
                >
                  Chiudi
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AlertTemplates;
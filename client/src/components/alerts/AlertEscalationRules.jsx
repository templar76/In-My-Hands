import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  AlertTriangle, 
  Clock, 
  Users, 
  Mail, 
  Phone, 
  MessageSquare, 
  Plus, 
  Edit, 
  Trash2, 
  Settings,
  Timer,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { useDispatch, useSelector } from 'react-redux';
import { getFirebaseToken } from '../../store/authSlice';

const AlertEscalationRules = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const [rules, setRules] = useState([]);
  const [throttlingConfig, setThrottlingConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    triggerConditions: {
      alertType: '',
      severity: 'medium',
      consecutiveFailures: 3,
      timeWindow: 30
    },
    escalationSteps: [
      {
        level: 1,
        delay: 5,
        recipients: [],
        methods: ['email'],
        message: ''
      }
    ],
    isActive: true
  });

  const fetchRules = async () => {
    try {
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/escalation-rules`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRules(data.rules || []);
        setThrottlingConfig(data.throttling || {});
      }
    } catch (error) {
      console.error('Error fetching escalation rules:', error);
      // Mock data per la demo
      setRules([
        {
          id: '1',
          name: 'Escalation Critica',
          description: 'Per alert critici che richiedono attenzione immediata',
          triggerConditions: {
            alertType: 'price_threshold',
            severity: 'high',
            consecutiveFailures: 2,
            timeWindow: 15
          },
          escalationSteps: [
            {
              level: 1,
              delay: 0,
              recipients: ['admin@company.com'],
              methods: ['email', 'sms'],
              message: 'Alert critico rilevato'
            },
            {
              level: 2,
              delay: 10,
              recipients: ['manager@company.com'],
              methods: ['email', 'phone'],
              message: 'Escalation livello 2 - Alert non risolto'
            }
          ],
          isActive: true,
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Escalation Standard',
          description: 'Per alert di routine con escalation graduale',
          triggerConditions: {
            alertType: 'price_variation',
            severity: 'medium',
            consecutiveFailures: 5,
            timeWindow: 60
          },
          escalationSteps: [
            {
              level: 1,
              delay: 15,
              recipients: ['team@company.com'],
              methods: ['email'],
              message: 'Alert di variazione prezzo'
            }
          ],
          isActive: true,
          createdAt: new Date().toISOString()
        }
      ]);
      
      setThrottlingConfig({
        enabled: true,
        maxAlertsPerHour: 10,
        maxAlertsPerDay: 100,
        cooldownPeriod: 300,
        intelligentThrottling: true,
        priorityBypass: true
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const addEscalationStep = () => {
    const newStep = {
      level: newRule.escalationSteps.length + 1,
      delay: 15,
      recipients: [],
      methods: ['email'],
      message: ''
    };
    setNewRule(prev => ({
      ...prev,
      escalationSteps: [...prev.escalationSteps, newStep]
    }));
  };

  const removeEscalationStep = (index) => {
    setNewRule(prev => ({
      ...prev,
      escalationSteps: prev.escalationSteps.filter((_, i) => i !== index)
    }));
  };

  const updateEscalationStep = (index, field, value) => {
    setNewRule(prev => ({
      ...prev,
      escalationSteps: prev.escalationSteps.map((step, i) => 
        i === index ? { ...step, [field]: value } : step
      )
    }));
  };

  const saveRule = async () => {
    try {
      setLoading(true);
      const token = await dispatch(getFirebaseToken()).unwrap();
      
      const url = editingRule ? `${process.env.REACT_APP_API_URLS}/api/alerts/escalation-rules/${editingRule.id}` : `${process.env.REACT_APP_API_URLS}/api/alerts/escalation-rules`;
      const method = editingRule ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newRule)
      });

      if (response.ok) {
        toast.success(editingRule ? 'Regola aggiornata' : 'Regola creata');
        setShowCreateDialog(false);
        setEditingRule(null);
        resetForm();
        fetchRules();
      } else {
        throw new Error('Errore nel salvataggio');
      }
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Errore nel salvataggio della regola');
    } finally {
      setLoading(false);
    }
  };

  const deleteRule = async (ruleId) => {
    try {
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/escalation-rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Regola eliminata');
        fetchRules();
      } else {
        throw new Error('Errore nell\'eliminazione');
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Errore nell\'eliminazione della regola');
    }
  };

  const updateThrottlingConfig = async (config) => {
    try {
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/throttling-config`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        toast.success('Configurazione throttling aggiornata');
        setThrottlingConfig(config);
      } else {
        throw new Error('Errore nell\'aggiornamento');
      }
    } catch (error) {
      console.error('Error updating throttling config:', error);
      toast.error('Errore nell\'aggiornamento della configurazione');
    }
  };

  const resetForm = () => {
    setNewRule({
      name: '',
      description: '',
      triggerConditions: {
        alertType: '',
        severity: 'medium',
        consecutiveFailures: 3,
        timeWindow: 30
      },
      escalationSteps: [
        {
          level: 1,
          delay: 5,
          recipients: [],
          methods: ['email'],
          message: ''
        }
      ],
      isActive: true
    });
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'phone': return <Phone className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="rules" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rules">Regole Escalation</TabsTrigger>
          <TabsTrigger value="throttling">Throttling Intelligente</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Regole di Escalation
                </span>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { resetForm(); setEditingRule(null); }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nuova Regola
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingRule ? 'Modifica Regola' : 'Crea Nuova Regola'} di Escalation
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      {/* Informazioni Base */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="ruleName">Nome Regola</Label>
                          <Input
                            id="ruleName"
                            value={newRule.name}
                            onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Es. Escalation Critica"
                          />
                        </div>
                        <div>
                          <Label htmlFor="ruleDescription">Descrizione</Label>
                          <Input
                            id="ruleDescription"
                            value={newRule.description}
                            onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Descrizione della regola"
                          />
                        </div>
                      </div>

                      {/* Condizioni di Trigger */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Condizioni di Attivazione</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <Label htmlFor="alertType">Tipo Alert</Label>
                            <Select
                              value={newRule.triggerConditions.alertType}
                              onValueChange={(value) => setNewRule(prev => ({
                                ...prev,
                                triggerConditions: { ...prev.triggerConditions, alertType: value }
                              }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Tutti i tipi</SelectItem>
                                <SelectItem value="price_threshold">Soglia Prezzo</SelectItem>
                                <SelectItem value="price_variation">Variazione Prezzo</SelectItem>
                                <SelectItem value="stock">Disponibilità</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="severity">Severità</Label>
                            <Select
                              value={newRule.triggerConditions.severity}
                              onValueChange={(value) => setNewRule(prev => ({
                                ...prev,
                                triggerConditions: { ...prev.triggerConditions, severity: value }
                              }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Bassa</SelectItem>
                                <SelectItem value="medium">Media</SelectItem>
                                <SelectItem value="high">Alta</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="consecutiveFailures">Fallimenti Consecutivi</Label>
                            <Input
                              id="consecutiveFailures"
                              type="number"
                              min="1"
                              value={newRule.triggerConditions.consecutiveFailures}
                              onChange={(e) => setNewRule(prev => ({
                                ...prev,
                                triggerConditions: { ...prev.triggerConditions, consecutiveFailures: parseInt(e.target.value) }
                              }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="timeWindow">Finestra Temporale (min)</Label>
                            <Input
                              id="timeWindow"
                              type="number"
                              min="1"
                              value={newRule.triggerConditions.timeWindow}
                              onChange={(e) => setNewRule(prev => ({
                                ...prev,
                                triggerConditions: { ...prev.triggerConditions, timeWindow: parseInt(e.target.value) }
                              }))}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Passi di Escalation */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold">Passi di Escalation</h3>
                          <Button variant="outline" size="sm" onClick={addEscalationStep}>
                            <Plus className="h-4 w-4 mr-2" />
                            Aggiungi Passo
                          </Button>
                        </div>
                        <div className="space-y-4">
                          {newRule.escalationSteps.map((step, index) => (
                            <Card key={index} className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium">Livello {step.level}</h4>
                                {newRule.escalationSteps.length > 1 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeEscalationStep(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <Label>Ritardo (minuti)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={step.delay}
                                    onChange={(e) => updateEscalationStep(index, 'delay', parseInt(e.target.value))}
                                  />
                                </div>
                                <div>
                                  <Label>Destinatari (email)</Label>
                                  <Input
                                    value={step.recipients.join(', ')}
                                    onChange={(e) => updateEscalationStep(index, 'recipients', e.target.value.split(', ').filter(r => r.trim()))}
                                    placeholder="email1@example.com, email2@example.com"
                                  />
                                </div>
                                <div>
                                  <Label>Metodi</Label>
                                  <div className="flex gap-2 mt-1">
                                    {['email', 'sms', 'phone'].map(method => (
                                      <label key={method} className="flex items-center gap-1 text-sm">
                                        <Checkbox
                                          checked={step.methods.includes(method)}
                                          onCheckedChange={(checked) => {
                                            const newMethods = checked 
                                              ? [...step.methods, method]
                                              : step.methods.filter(m => m !== method);
                                            updateEscalationStep(index, 'methods', newMethods);
                                          }}
                                        />
                                        {method}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3">
                                <Label>Messaggio Personalizzato</Label>
                                <Input
                                  value={step.message}
                                  onChange={(e) => updateEscalationStep(index, 'message', e.target.value)}
                                  placeholder="Messaggio per questo livello di escalation"
                                />
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="ruleActive"
                          checked={newRule.isActive}
                          onCheckedChange={(checked) => setNewRule(prev => ({ ...prev, isActive: checked }))}
                        />
                        <Label htmlFor="ruleActive">Regola attiva</Label>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowCreateDialog(false)}
                        >
                          Annulla
                        </Button>
                        <Button onClick={saveRule} disabled={loading}>
                          {loading ? 'Salvataggio...' : (editingRule ? 'Aggiorna' : 'Crea Regola')}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rules.map((rule) => (
                  <Card key={rule.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-lg">{rule.name}</h3>
                          <Badge variant={rule.isActive ? "success" : "secondary"} className="ml-2">
                            {rule.isActive ? "Attiva" : "Inattiva"}
                          </Badge>
                        </div>
                        <p className="text-gray-600 text-sm mb-3">{rule.description}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <h4 className="text-sm font-medium mb-1">Condizioni</h4>
                            <div className="space-y-1 text-sm">
                              {rule.triggerConditions.alertType && (
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-600">Tipo:</span>
                                  <span>{rule.triggerConditions.alertType}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <span className="text-gray-600">Severità:</span>
                                <Badge className={getSeverityColor(rule.triggerConditions.severity)}>
                                  {rule.triggerConditions.severity}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-gray-600">Fallimenti:</span>
                                <span>{rule.triggerConditions.consecutiveFailures} in {rule.triggerConditions.timeWindow} min</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="md:col-span-2">
                            <h4 className="text-sm font-medium mb-1">Escalation</h4>
                            <div className="space-y-2">
                              {rule.escalationSteps.map((step, index) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                  <Badge variant="outline" className="h-5 w-5 flex items-center justify-center p-0">
                                    {step.level}
                                  </Badge>
                                  <Clock className="h-3.5 w-3.5 text-gray-500" />
                                  <span>{step.delay}m</span>
                                  <Users className="h-3.5 w-3.5 text-gray-500 ml-2" />
                                  <span className="truncate max-w-[150px]">
                                    {step.recipients.length > 0 ? step.recipients.join(', ') : 'Nessun destinatario'}
                                  </span>
                                  <div className="flex gap-1 ml-2">
                                    {step.methods.map(method => (
                                      <span key={method} className="text-gray-600">{getMethodIcon(method)}</span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingRule(rule);
                            setNewRule({
                              ...rule,
                              triggerConditions: { ...rule.triggerConditions },
                              escalationSteps: [...rule.escalationSteps]
                            });
                            setShowCreateDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
                
                {rules.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nessuna regola di escalation configurata</p>
                    <p className="text-sm">Crea la prima regola per gestire l'escalation degli alert</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="throttling" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Configurazione Throttling Intelligente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {throttlingConfig && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="throttlingEnabled"
                      checked={throttlingConfig.enabled}
                      onCheckedChange={(checked) => 
                        updateThrottlingConfig({ ...throttlingConfig, enabled: checked })
                      }
                    />
                    <Label htmlFor="throttlingEnabled" className="font-medium">
                      Abilita Throttling Intelligente
                    </Label>
                  </div>

                  {throttlingConfig.enabled && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="maxAlertsPerHour">Max Alert per Ora</Label>
                          <Input
                            id="maxAlertsPerHour"
                            type="number"
                            min="1"
                            value={throttlingConfig.maxAlertsPerHour}
                            onChange={(e) => 
                              updateThrottlingConfig({ 
                                ...throttlingConfig, 
                                maxAlertsPerHour: parseInt(e.target.value) 
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="maxAlertsPerDay">Max Alert per Giorno</Label>
                          <Input
                            id="maxAlertsPerDay"
                            type="number"
                            min="1"
                            value={throttlingConfig.maxAlertsPerDay}
                            onChange={(e) => 
                              updateThrottlingConfig({ 
                                ...throttlingConfig, 
                                maxAlertsPerDay: parseInt(e.target.value) 
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="cooldownPeriod">Periodo Cooldown (sec)</Label>
                          <Input
                            id="cooldownPeriod"
                            type="number"
                            min="1"
                            value={throttlingConfig.cooldownPeriod}
                            onChange={(e) => 
                              updateThrottlingConfig({ 
                                ...throttlingConfig, 
                                cooldownPeriod: parseInt(e.target.value) 
                              })
                            }
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="intelligentThrottling"
                            checked={throttlingConfig.intelligentThrottling}
                            onCheckedChange={(checked) => 
                              updateThrottlingConfig({ 
                                ...throttlingConfig, 
                                intelligentThrottling: checked 
                              })
                            }
                          />
                          <Label htmlFor="intelligentThrottling">
                            Throttling basato su ML
                          </Label>
                        </div>
                        <p className="text-sm text-gray-600 ml-6">
                          Utilizza algoritmi di machine learning per identificare pattern e ridurre
                          alert ridondanti o correlati.
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="priorityBypass"
                            checked={throttlingConfig.priorityBypass}
                            onCheckedChange={(checked) => 
                              updateThrottlingConfig({ 
                                ...throttlingConfig, 
                                priorityBypass: checked 
                              })
                            }
                          />
                          <Label htmlFor="priorityBypass">
                            Bypass per Alert ad Alta Priorità
                          </Label>
                        </div>
                        <p className="text-sm text-gray-600 ml-6">
                          Gli alert critici e ad alta priorità bypassano automaticamente 
                          le limitazioni di throttling.
                        </p>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                          <Timer className="h-4 w-4" />
                          Statistiche Throttling Correnti
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-blue-600 font-medium">Alert Ora Corrente:</span>
                            <div className="text-blue-800">7 / {throttlingConfig.maxAlertsPerHour}</div>
                          </div>
                          <div>
                            <span className="text-blue-600 font-medium">Alert Oggi:</span>
                            <div className="text-blue-800">23 / {throttlingConfig.maxAlertsPerDay}</div>
                          </div>
                          <div>
                            <span className="text-blue-600 font-medium">Alert Soppressi:</span>
                            <div className="text-blue-800">2 nelle ultime 24h</div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AlertEscalationRules;
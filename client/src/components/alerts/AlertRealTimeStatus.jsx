import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Server,
  Zap,
  Eye,
  EyeOff
} from 'lucide-react';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

const AlertRealTimeStatus = ({ className = '' }) => {
  const {
    isConnected,
    connectionStatus,
    reconnectAttempts,
    alertUpdates,
    performanceMetrics,
    systemStatus,
    connect,
    disconnect,
    subscribeToAlerts,
    unsubscribeFromAlerts,
    subscribeToMetrics,
    unsubscribeFromMetrics,
    clearAlertUpdates,
    getRecentAlertsByType
  } = useWebSocketContext();

  const [isSubscribedToAlerts, setIsSubscribedToAlerts] = useState(false);
  const [isSubscribedToMetrics, setIsSubscribedToMetrics] = useState(false);
  const [selectedAlertTypes, setSelectedAlertTypes] = useState(['all']);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-subscribe to alerts and metrics when connected
  useEffect(() => {
    if (isConnected && !isSubscribedToAlerts) {
      subscribeToAlerts();
      setIsSubscribedToAlerts(true);
    }
    if (isConnected && !isSubscribedToMetrics) {
      subscribeToMetrics();
      setIsSubscribedToMetrics(true);
    }
  }, [isConnected, isSubscribedToAlerts, isSubscribedToMetrics, subscribeToAlerts, subscribeToMetrics]);

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'connecting':
      case 'reconnecting':
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'disconnected':
      case 'error':
      case 'failed':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
      case 'reconnecting':
        return 'bg-yellow-500';
      case 'disconnected':
      case 'error':
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getAlertTypeIcon = (type) => {
    switch (type) {
      case 'triggered':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'status_changed':
        return <Activity className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSystemStatusIcon = () => {
    if (!systemStatus) return <Server className="h-4 w-4 text-gray-500" />;
    
    switch (systemStatus.status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Server className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleToggleAlertSubscription = () => {
    if (isSubscribedToAlerts) {
      unsubscribeFromAlerts();
      setIsSubscribedToAlerts(false);
    } else {
      subscribeToAlerts();
      setIsSubscribedToAlerts(true);
    }
  };

  const handleToggleMetricsSubscription = () => {
    if (isSubscribedToMetrics) {
      unsubscribeFromMetrics();
      setIsSubscribedToMetrics(false);
    } else {
      subscribeToMetrics();
      setIsSubscribedToMetrics(true);
    }
  };

  const filteredAlertUpdates = selectedAlertTypes.includes('all') 
    ? alertUpdates 
    : alertUpdates.filter(update => selectedAlertTypes.includes(update.type));

  const recentTriggeredAlerts = getRecentAlertsByType('triggered', 5);
  const recentStatusChanges = getRecentAlertsByType('status_changed', 5);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Connection Status Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {getConnectionStatusIcon()}
              Stato Connessione Real-Time
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`} />
              <Badge variant={isConnected ? 'default' : 'destructive'}>
                {connectionStatus === 'connected' && 'Connesso'}
                {connectionStatus === 'connecting' && 'Connessione...'}
                {connectionStatus === 'reconnecting' && `Riconnessione... (${reconnectAttempts})`}
                {connectionStatus === 'disconnected' && 'Disconnesso'}
                {connectionStatus === 'error' && 'Errore'}
                {connectionStatus === 'failed' && 'Fallito'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={isConnected ? disconnect : connect}
                disabled={connectionStatus === 'connecting' || connectionStatus === 'reconnecting'}
              >
                {isConnected ? 'Disconnetti' : 'Connetti'}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleAlertSubscription}
                disabled={!isConnected}
              >
                {isSubscribedToAlerts ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {isSubscribedToAlerts ? 'Disabilita Alert' : 'Abilita Alert'}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleMetricsSubscription}
                disabled={!isConnected}
              >
                {isSubscribedToMetrics ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {isSubscribedToMetrics ? 'Disabilita Metriche' : 'Abilita Metriche'}
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAlertUpdates}
            >
              Pulisci Cronologia
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      {systemStatus && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              {getSystemStatusIcon()}
              Stato Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Badge variant={systemStatus.status === 'healthy' ? 'default' : 'destructive'}>
                  {systemStatus.status === 'healthy' && 'Sano'}
                  {systemStatus.status === 'warning' && 'Attenzione'}
                  {systemStatus.status === 'critical' && 'Critico'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {systemStatus.message || 'Sistema operativo'}
                </span>
              </div>
              
              {systemStatus.uptime && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Uptime: {Math.floor(systemStatus.uptime / 3600)}h {Math.floor((systemStatus.uptime % 3600) / 60)}m
                  </span>
                </div>
              )}
              
              {systemStatus.activeAlerts !== undefined && (
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Alert Attivi: {systemStatus.activeAlerts}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      {performanceMetrics && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Metriche Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {performanceMetrics.cpu?.toFixed(1) || 0}%
                </div>
                <div className="text-sm text-muted-foreground">CPU</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {performanceMetrics.memory?.toFixed(1) || 0}%
                </div>
                <div className="text-sm text-muted-foreground">Memoria</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {performanceMetrics.alertsPerMinute || 0}
                </div>
                <div className="text-sm text-muted-foreground">Alert/min</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {performanceMetrics.responseTime || 0}ms
                </div>
                <div className="text-sm text-muted-foreground">Risposta</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Updates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Aggiornamenti Real-Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger 
                value="all"
                onClick={() => setSelectedAlertTypes(['all'])}
              >
                Tutti ({alertUpdates.length})
              </TabsTrigger>
              <TabsTrigger 
                value="triggered"
                onClick={() => setSelectedAlertTypes(['triggered'])}
              >
                Attivati ({recentTriggeredAlerts.length})
              </TabsTrigger>
              <TabsTrigger 
                value="status_changed"
                onClick={() => setSelectedAlertTypes(['status_changed'])}
              >
                Cambi Stato ({recentStatusChanges.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-4">
              <ScrollArea className="h-96">
                {filteredAlertUpdates.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Nessun aggiornamento disponibile
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAlertUpdates.map((update) => (
                      <div key={update.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        {getAlertTypeIcon(update.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {update.type === 'triggered' ? 'Attivato' : 'Stato Cambiato'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(update.timestamp), { 
                                addSuffix: true, 
                                locale: it 
                              })}
                            </span>
                          </div>
                          
                          <div className="text-sm">
                            {update.data.productName && (
                              <div className="font-medium">{update.data.productName}</div>
                            )}
                            {update.data.triggerReason && (
                              <div className="text-muted-foreground">{update.data.triggerReason}</div>
                            )}
                            {update.data.currentPrice && (
                              <div className="text-sm">
                                Prezzo: €{update.data.currentPrice}
                                {update.data.previousPrice && (
                                  <span className="text-muted-foreground ml-2">
                                    (era €{update.data.previousPrice})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="triggered" className="mt-4">
              <ScrollArea className="h-96">
                {recentTriggeredAlerts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Nessun alert attivato di recente
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentTriggeredAlerts.map((update) => (
                      <div key={update.id} className="flex items-start gap-3 p-3 border rounded-lg bg-orange-50">
                        <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium">{update.data.productName || 'Prodotto'}</div>
                          <div className="text-sm text-muted-foreground">{update.data.triggerReason}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(update.timestamp), { 
                              addSuffix: true, 
                              locale: it 
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="status_changed" className="mt-4">
              <ScrollArea className="h-96">
                {recentStatusChanges.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Nessun cambio di stato recente
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentStatusChanges.map((update) => (
                      <div key={update.id} className="flex items-start gap-3 p-3 border rounded-lg bg-blue-50">
                        <Activity className="h-4 w-4 text-blue-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium">{update.data.alertId || 'Alert'}</div>
                          <div className="text-sm text-muted-foreground">
                            Stato: {update.data.newStatus} 
                            {update.data.oldStatus && ` (era ${update.data.oldStatus})`}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(update.timestamp), { 
                              addSuffix: true, 
                              locale: it 
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AlertRealTimeStatus;
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Bell,
  BarChart3,
  Settings,
  Users,
  FileText,
  Activity,
  Zap,
  Target,
  TrendingUp,
  Shield,
  Wifi
} from 'lucide-react';
import AlertDashboard from './AlertDashboard';
import AlertBulkManager from './AlertBulkManager';
import AlertTemplates from './AlertTemplates';
import AlertPerformanceMetrics from './AlertPerformanceMetrics';
import AlertEscalationRules from './AlertEscalationRules';
import AlertRealTimeStatus from './AlertRealTimeStatus';
import AlertReporting from './AlertReporting';
import useWebSocket from '../../hooks/useWebSocket';

const AlertManagementDashboard = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { isConnected, alertUpdates, performanceMetrics } = useWebSocket();

  // Get recent alert counts for badges
  const recentTriggeredCount = alertUpdates.filter(
    update => update.type === 'triggered' && 
    new Date(update.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ).length;

  const recentStatusChanges = alertUpdates.filter(
    update => update.type === 'status_changed' && 
    new Date(update.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ).length;

  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      component: AlertDashboard,
      description: 'Panoramica generale degli alert e statistiche'
    },
    {
      id: 'bulk-manager',
      label: 'Gestione Bulk',
      icon: Settings,
      component: AlertBulkManager,
      description: 'Operazioni massive su alert multipli'
    },
    {
      id: 'templates',
      label: 'Template',
      icon: Target,
      component: AlertTemplates,
      description: 'Template predefiniti per scenari comuni'
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: Zap,
      component: AlertPerformanceMetrics,
      description: 'Metriche di performance del sistema'
    },
    {
      id: 'escalation',
      label: 'Escalation',
      icon: Shield,
      component: AlertEscalationRules,
      description: 'Regole di escalation e throttling intelligente'
    },
    {
      id: 'realtime',
      label: 'Real-Time',
      icon: Wifi,
      component: AlertRealTimeStatus,
      badge: recentTriggeredCount + recentStatusChanges,
      description: 'Aggiornamenti in tempo reale via WebSocket'
    },
    {
      id: 'reporting',
      label: 'Report',
      icon: FileText,
      component: AlertReporting,
      description: 'Reporting avanzato e export dati'
    }
  ];

  const getCurrentTabInfo = () => {
    return tabs.find(tab => tab.id === activeTab);
  };

  const currentTab = getCurrentTabInfo();
  const CurrentComponent = currentTab?.component;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sistema Alert Prezzi</h1>
          <p className="text-muted-foreground">
            Monitoraggio avanzato dei prezzi e gestione alert intelligente
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Real-time Connesso' : 'Real-time Disconnesso'}
            </span>
          </div>
          
          {/* Performance Indicator */}
          {performanceMetrics && (
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {performanceMetrics.alertsPerMinute || 0} alert/min
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Alert Attivi</p>
                <p className="text-2xl font-bold">
                  {performanceMetrics?.activeAlerts || 0}
                </p>
              </div>
              <Bell className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Attivati Oggi</p>
                <p className="text-2xl font-bold text-orange-600">
                  {recentTriggeredCount}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cambi Stato</p>
                <p className="text-2xl font-bold text-purple-600">
                  {recentStatusChanges}
                </p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Performance</p>
                <p className="text-2xl font-bold text-green-600">
                  {performanceMetrics?.responseTime || 0}ms
                </p>
              </div>
              <Zap className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {currentTab && <currentTab.icon className="h-5 w-5" />}
                {currentTab?.label}
              </CardTitle>
              {currentTab?.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {currentTab.description}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger 
                    key={tab.id} 
                    value={tab.id}
                    className="flex items-center gap-2 relative"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {tab.badge && tab.badge > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                      >
                        {tab.badge > 99 ? '99+' : tab.badge}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-6">
                {CurrentComponent && activeTab === tab.id && (
                  <CurrentComponent />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Footer Info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Sistema Alert Prezzi v2.0</span>
              <span>•</span>
              <span>Monitoraggio Real-time Attivo</span>
              <span>•</span>
              <span>Analytics Avanzate</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span>Ultimo aggiornamento:</span>
              <span>{new Date().toLocaleTimeString('it-IT')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AlertManagementDashboard;
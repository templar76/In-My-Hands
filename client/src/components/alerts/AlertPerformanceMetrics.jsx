import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Activity, 
  Clock, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  BarChart3,
  PieChart,
  RefreshCw
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPieChart, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

const AlertPerformanceMetrics = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('24h');

  const fetchMetrics = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const token = await user.getIdToken();
      
      const response = await fetch(`/api/alerts/performance-metrics?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
        if (showToast) {
          toast.success('Metriche aggiornate');
        }
      } else {
        throw new Error('Errore nel caricamento delle metriche');
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Errore nel caricamento delle metriche');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [timeRange]);

  // Mock data per la demo
  const mockMetrics = {
    systemHealth: {
      status: 'healthy',
      uptime: '99.8%',
      lastCheck: new Date().toISOString(),
      responseTime: 145,
      errorRate: 0.2
    },
    alertStats: {
      totalChecks: 15420,
      successfulChecks: 15389,
      failedChecks: 31,
      averageResponseTime: 145,
      checksPerHour: 642
    },
    performance: {
      cpuUsage: 23,
      memoryUsage: 67,
      diskUsage: 45,
      networkLatency: 12
    },
    alertTrends: [
      { time: '00:00', checks: 45, alerts: 2, errors: 0 },
      { time: '04:00', checks: 38, alerts: 1, errors: 1 },
      { time: '08:00', checks: 67, alerts: 5, errors: 0 },
      { time: '12:00', checks: 89, alerts: 8, errors: 2 },
      { time: '16:00', checks: 76, alerts: 6, errors: 1 },
      { time: '20:00', checks: 54, alerts: 3, errors: 0 }
    ],
    responseTimeHistory: [
      { time: '00:00', responseTime: 120 },
      { time: '04:00', responseTime: 135 },
      { time: '08:00', responseTime: 165 },
      { time: '12:00', responseTime: 180 },
      { time: '16:00', responseTime: 155 },
      { time: '20:00', responseTime: 140 }
    ],
    alertTypeDistribution: [
      { name: 'Soglia Prezzo', value: 45, color: '#3b82f6' },
      { name: 'Variazione Prezzo', value: 35, color: '#ef4444' },
      { name: 'Disponibilità', value: 20, color: '#10b981' }
    ],
    topProducts: [
      { name: 'Prodotto A', alerts: 23, avgPrice: 45.67 },
      { name: 'Prodotto B', alerts: 18, avgPrice: 32.45 },
      { name: 'Prodotto C', alerts: 15, avgPrice: 78.90 },
      { name: 'Prodotto D', alerts: 12, avgPrice: 56.78 },
      { name: 'Prodotto E', alerts: 9, avgPrice: 23.45 }
    ]
  };

  const currentMetrics = metrics || mockMetrics;

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5" />;
      case 'warning': return <AlertCircle className="h-5 w-5" />;
      case 'critical': return <XCircle className="h-5 w-5" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  const getPerformanceColor = (value, type) => {
    if (type === 'cpu' || type === 'memory' || type === 'disk') {
      if (value < 50) return 'text-green-600';
      if (value < 80) return 'text-yellow-600';
      return 'text-red-600';
    }
    if (type === 'latency') {
      if (value < 50) return 'text-green-600';
      if (value < 100) return 'text-yellow-600';
      return 'text-red-600';
    }
    return 'text-gray-600';
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
      {/* Header con controlli */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Metriche Performance Alert</h2>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1 border rounded-md text-sm"
          >
            <option value="1h">Ultima ora</option>
            <option value="24h">Ultime 24 ore</option>
            <option value="7d">Ultimi 7 giorni</option>
            <option value="30d">Ultimi 30 giorni</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
        </div>
      </div>

      {/* Stato Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className={getStatusColor(currentMetrics.systemHealth.status)}>
              {getStatusIcon(currentMetrics.systemHealth.status)}
            </span>
            Stato Sistema
            <Badge 
              variant={currentMetrics.systemHealth.status === 'healthy' ? 'default' : 'destructive'}
              className="ml-2"
            >
              {currentMetrics.systemHealth.status === 'healthy' ? 'Operativo' : 'Problemi'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{currentMetrics.systemHealth.uptime}</div>
              <div className="text-sm text-gray-500">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{currentMetrics.systemHealth.responseTime}ms</div>
              <div className="text-sm text-gray-500">Tempo Risposta</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{currentMetrics.systemHealth.errorRate}%</div>
              <div className="text-sm text-gray-500">Tasso Errori</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{currentMetrics.alertStats.checksPerHour}</div>
              <div className="text-sm text-gray-500">Controlli/Ora</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="trends">Tendenze</TabsTrigger>
          <TabsTrigger value="analysis">Analisi</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold">{currentMetrics.alertStats.totalChecks.toLocaleString()}</div>
                    <div className="text-sm text-gray-500">Controlli Totali</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold">{currentMetrics.alertStats.successfulChecks.toLocaleString()}</div>
                    <div className="text-sm text-gray-500">Controlli Riusciti</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <div className="text-2xl font-bold">{currentMetrics.alertStats.failedChecks}</div>
                    <div className="text-sm text-gray-500">Controlli Falliti</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-600" />
                  <div>
                    <div className="text-2xl font-bold">{currentMetrics.alertStats.averageResponseTime}ms</div>
                    <div className="text-sm text-gray-500">Tempo Medio</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Distribuzione Tipi Alert */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Distribuzione Tipi Alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={currentMetrics.alertTypeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {currentMetrics.alertTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {/* Metriche Sistema */}
          <Card>
            <CardHeader>
              <CardTitle>Utilizzo Risorse Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">CPU</span>
                    <span className={`text-sm font-bold ${getPerformanceColor(currentMetrics.performance.cpuUsage, 'cpu')}`}>
                      {currentMetrics.performance.cpuUsage}%
                    </span>
                  </div>
                  <Progress value={currentMetrics.performance.cpuUsage} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Memoria</span>
                    <span className={`text-sm font-bold ${getPerformanceColor(currentMetrics.performance.memoryUsage, 'memory')}`}>
                      {currentMetrics.performance.memoryUsage}%
                    </span>
                  </div>
                  <Progress value={currentMetrics.performance.memoryUsage} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Disco</span>
                    <span className={`text-sm font-bold ${getPerformanceColor(currentMetrics.performance.diskUsage, 'disk')}`}>
                      {currentMetrics.performance.diskUsage}%
                    </span>
                  </div>
                  <Progress value={currentMetrics.performance.diskUsage} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Latenza Rete</span>
                    <span className={`text-sm font-bold ${getPerformanceColor(currentMetrics.performance.networkLatency, 'latency')}`}>
                      {currentMetrics.performance.networkLatency}ms
                    </span>
                  </div>
                  <Progress value={currentMetrics.performance.networkLatency} max={200} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tempo di Risposta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Tempo di Risposta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={currentMetrics.responseTimeHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          {/* Tendenze Alert */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Tendenze Alert nel Tempo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={currentMetrics.alertTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="checks" 
                      stackId="1" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.6}
                      name="Controlli"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="alerts" 
                      stackId="2" 
                      stroke="#ef4444" 
                      fill="#ef4444" 
                      fillOpacity={0.6}
                      name="Alert Attivati"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="errors" 
                      stackId="3" 
                      stroke="#f59e0b" 
                      fill="#f59e0b" 
                      fillOpacity={0.6}
                      name="Errori"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          {/* Top Prodotti */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Prodotti con Più Alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {currentMetrics.topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-gray-500">Prezzo medio: €{product.avgPrice}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">{product.alerts}</div>
                      <div className="text-sm text-gray-500">alert</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AlertPerformanceMetrics;
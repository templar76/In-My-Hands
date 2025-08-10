import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { AlertTriangle, TrendingUp, Bell, Activity, Mail, MessageSquare, Calendar, Target } from 'lucide-react';
import { toast } from 'sonner';
import { useDispatch, useSelector } from 'react-redux';
import { getFirebaseToken } from '../../store/authSlice';

const AlertDashboard = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [pecStatus, setPecStatus] = useState(null);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  useEffect(() => {
    fetchAlertStats();
    checkPECStatus();
  }, [period]);

  const fetchAlertStats = async () => {
    try {
      setLoading(true);
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/stats?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        throw new Error('Errore nel caricamento delle statistiche');
      }
    } catch (error) {
      console.error('Error fetching alert stats:', error);
      toast.error('Errore nel caricamento delle statistiche');
    } finally {
      setLoading(false);
    }
  };

  const checkPECStatus = async () => {
    try {
      const token = await dispatch(getFirebaseToken()).unwrap();
      const response = await fetch(`${process.env.REACT_APP_API_URLS}/api/alerts/pec/test`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPecStatus({ status: 'active', message: data.message });
      } else {
        const errorData = await response.json();
        setPecStatus({ status: 'inactive', message: errorData.message });
      }
    } catch (error) {
      setPecStatus({ status: 'error', message: 'Errore nella verifica PEC' });
    }
  };

  const formatChartData = (data, labelKey, valueKey) => {
    return data.map(item => ({
      name: item[labelKey] || 'N/A',
      value: item[valueKey] || 0
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Nessuna statistica disponibile</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con controlli */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Alert Prezzi</h1>
          <p className="text-gray-600">Monitoraggio e statistiche degli alert di prezzo</p>
        </div>
        <div className="flex gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 giorni</SelectItem>
              <SelectItem value="30d">30 giorni</SelectItem>
              <SelectItem value="90d">90 giorni</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchAlertStats} variant="outline">
            Aggiorna
          </Button>
        </div>
      </div>

      {/* Statistiche principali */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Alert Totali</p>
                <p className="text-2xl font-bold text-gray-900">{stats.stats.total}</p>
              </div>
              <Bell className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Alert Attivi</p>
                <p className="text-2xl font-bold text-green-600">{stats.stats.active}</p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Alert Scattati</p>
                <p className="text-2xl font-bold text-orange-600">{stats.stats.triggered}</p>
                <p className="text-xs text-gray-500">Ultimi {period}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Stato PEC</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(pecStatus?.status)}`}></div>
                  <p className="text-sm font-medium">
                    {pecStatus?.status === 'active' ? 'Attivo' : 
                     pecStatus?.status === 'inactive' ? 'Non configurato' : 'Errore'}
                  </p>
                </div>
              </div>
              <MessageSquare className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grafici e analisi */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="types">Per Tipo</TabsTrigger>
          <TabsTrigger value="notifications">Notifiche</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grafico alert per tipo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Alert per Tipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={formatChartData(stats.stats.byType, '_id', 'count')}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {formatChartData(stats.stats.byType, '_id', 'count').map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Alert più attivi */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Alert Più Attivi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.stats.mostTriggered.map((alert, index) => (
                    <div key={alert._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {alert.product?.description || 'Prodotto non disponibile'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {alert.product?.codeInternal || 'N/A'}
                        </p>
                        <Badge variant="outline" className="mt-1">
                          {alert.type}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{alert.triggerCount}</p>
                        <p className="text-xs text-gray-500">trigger</p>
                      </div>
                    </div>
                  ))}
                  {stats.stats.mostTriggered.length === 0 && (
                    <p className="text-center text-gray-500 py-4">Nessun alert attivato nel periodo selezionato</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribuzione Alert per Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={formatChartData(stats.stats.byType, '_id', 'count')}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Metodi di Notifica
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={formatChartData(stats.stats.byNotificationMethod, '_id', 'count')}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {formatChartData(stats.stats.byNotificationMethod, '_id', 'count').map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Efficacia Alert</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Tasso di Attivazione</span>
                    <span className="text-lg font-bold">
                      {stats.stats.total > 0 ? ((stats.stats.triggered / stats.stats.total) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ 
                        width: `${stats.stats.total > 0 ? (stats.stats.triggered / stats.stats.total) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {stats.stats.triggered} alert attivati su {stats.stats.total} totali
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stato Configurazione</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Email Standard</span>
                    <Badge variant="default">Attivo</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Notifiche PEC</span>
                    <Badge variant={pecStatus?.status === 'active' ? 'default' : 'secondary'}>
                      {pecStatus?.status === 'active' ? 'Attivo' : 'Non configurato'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Monitoraggio Automatico</span>
                    <Badge variant="default">Attivo</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AlertDashboard;
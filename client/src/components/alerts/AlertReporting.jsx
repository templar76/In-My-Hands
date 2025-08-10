import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import {
  Download,
  FileText,
  BarChart3,
  Calendar,
  Filter,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Mail,
  Bell,
  Target,
  DollarSign,
  Package
} from 'lucide-react';
import { DatePickerWithRange } from '../ui/date-range-picker';
import { toast } from 'sonner';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const AlertReporting = ({ className = '' }) => {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [reportType, setReportType] = useState('summary');
  const [exportFormat, setExportFormat] = useState('json');
  const [includeHistory, setIncludeHistory] = useState(false);
  const [selectedAlertTypes, setSelectedAlertTypes] = useState(['all']);
  const [selectedStatuses, setSelectedStatuses] = useState(['all']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  const alertTypes = [
    { value: 'all', label: 'Tutti i tipi' },
    { value: 'price_threshold', label: 'Soglia Prezzo' },
    { value: 'price_change', label: 'Cambio Prezzo' },
    { value: 'availability', label: 'Disponibilità' },
    { value: 'supplier_change', label: 'Cambio Fornitore' }
  ];

  const alertStatuses = [
    { value: 'all', label: 'Tutti gli stati' },
    { value: 'active', label: 'Attivi' },
    { value: 'triggered', label: 'Attivati' },
    { value: 'paused', label: 'In Pausa' },
    { value: 'expired', label: 'Scaduti' }
  ];

  const reportTypes = [
    { value: 'summary', label: 'Riepilogo Generale' },
    { value: 'detailed', label: 'Report Dettagliato' },
    { value: 'analytics', label: 'Analytics Avanzate' },
    { value: 'performance', label: 'Performance Sistema' },
    { value: 'trends', label: 'Analisi Trend' }
  ];

  const exportFormats = [
    { value: 'json', label: 'JSON' },
    { value: 'csv', label: 'CSV' },
    { value: 'excel', label: 'Excel' },
    { value: 'pdf', label: 'PDF' }
  ];

  // Predefined date ranges
  const predefinedRanges = [
    {
      label: 'Ultimi 7 giorni',
      range: { from: subDays(new Date(), 7), to: new Date() }
    },
    {
      label: 'Ultimi 30 giorni',
      range: { from: subDays(new Date(), 30), to: new Date() }
    },
    {
      label: 'Questo mese',
      range: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) }
    },
    {
      label: 'Ultimi 3 mesi',
      range: { from: subDays(new Date(), 90), to: new Date() }
    }
  ];

  // Colors for charts
  const chartColors = {
    primary: '#3b82f6',
    secondary: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#6366f1',
    success: '#22c55e'
  };

  const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#22c55e'];

  // Load analytics data
  useEffect(() => {
    loadAnalytics();
  }, [dateRange, selectedAlertTypes, selectedStatuses]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        alertTypes: selectedAlertTypes.includes('all') ? '' : selectedAlertTypes.join(','),
        statuses: selectedStatuses.includes('all') ? '' : selectedStatuses.join(',')
      });

      const response = await fetch(`/api/alerts/analytics?${params}`);
      if (!response.ok) throw new Error('Errore nel caricamento analytics');
      
      const data = await response.json();
      setAnalytics(data.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Errore nel caricamento delle analytics');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const params = new URLSearchParams({
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        reportType,
        format: exportFormat,
        includeHistory: includeHistory.toString(),
        alertTypes: selectedAlertTypes.includes('all') ? '' : selectedAlertTypes.join(','),
        statuses: selectedStatuses.includes('all') ? '' : selectedStatuses.join(',')
      });

      const response = await fetch(`/api/alerts/export?${params}`);
      if (!response.ok) throw new Error('Errore nella generazione del report');

      // Handle different export formats
      if (exportFormat === 'json') {
        const data = await response.json();
        setReportData(data.data);
        downloadJSON(data.data, `alert-report-${format(new Date(), 'yyyy-MM-dd')}.json`);
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alert-report-${format(new Date(), 'yyyy-MM-dd')}.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      toast.success('Report generato con successo');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Errore nella generazione del report');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleAlertTypeChange = (type, checked) => {
    if (type === 'all') {
      setSelectedAlertTypes(checked ? ['all'] : []);
    } else {
      const newTypes = checked 
        ? [...selectedAlertTypes.filter(t => t !== 'all'), type]
        : selectedAlertTypes.filter(t => t !== type);
      setSelectedAlertTypes(newTypes.length === 0 ? ['all'] : newTypes);
    }
  };

  const handleStatusChange = (status, checked) => {
    if (status === 'all') {
      setSelectedStatuses(checked ? ['all'] : []);
    } else {
      const newStatuses = checked 
        ? [...selectedStatuses.filter(s => s !== 'all'), status]
        : selectedStatuses.filter(s => s !== status);
      setSelectedStatuses(newStatuses.length === 0 ? ['all'] : newStatuses);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const formatPercentage = (value) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Configurazione Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Range Selection */}
          <div className="space-y-2">
            <Label>Periodo di Analisi</Label>
            <div className="flex flex-wrap gap-2 mb-3">
              {predefinedRanges.map((range) => (
                <Button
                  key={range.label}
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange(range.range)}
                  className={dateRange.from?.getTime() === range.range.from.getTime() && 
                           dateRange.to?.getTime() === range.range.to.getTime() ? 
                           'bg-primary text-primary-foreground' : ''}
                >
                  {range.label}
                </Button>
              ))}
            </div>
            <DatePickerWithRange
              date={dateRange}
              onDateChange={setDateRange}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Report Type */}
            <div className="space-y-2">
              <Label>Tipo Report</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Export Format */}
            <div className="space-y-2">
              <Label>Formato Export</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {exportFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Include History */}
            <div className="space-y-2">
              <Label>Opzioni</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeHistory"
                  checked={includeHistory}
                  onCheckedChange={setIncludeHistory}
                />
                <Label htmlFor="includeHistory" className="text-sm">
                  Includi Storico
                </Label>
              </div>
            </div>

            {/* Generate Button */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button
                onClick={generateReport}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isGenerating ? 'Generazione...' : 'Genera Report'}
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-4">
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Alert Types Filter */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Tipi di Alert
                </Label>
                <div className="space-y-2">
                  {alertTypes.map((type) => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type.value}`}
                        checked={selectedAlertTypes.includes(type.value)}
                        onCheckedChange={(checked) => handleAlertTypeChange(type.value, checked)}
                      />
                      <Label htmlFor={`type-${type.value}`} className="text-sm">
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Stati Alert
                </Label>
                <div className="space-y-2">
                  {alertStatuses.map((status) => (
                    <div key={status.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status.value}`}
                        checked={selectedStatuses.includes(status.value)}
                        onCheckedChange={(checked) => handleStatusChange(status.value, checked)}
                      />
                      <Label htmlFor={`status-${status.value}`} className="text-sm">
                        {status.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Dashboard */}
      {analytics && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Panoramica</TabsTrigger>
            <TabsTrigger value="trends">Trend</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="details">Dettagli</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Alert Totali</p>
                      <p className="text-2xl font-bold">{analytics.totalAlerts || 0}</p>
                    </div>
                    <Bell className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Alert Attivati</p>
                      <p className="text-2xl font-bold text-orange-600">{analytics.triggeredAlerts || 0}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Tasso Successo</p>
                      <p className="text-2xl font-bold text-green-600">
                        {analytics.successRate ? formatPercentage(analytics.successRate) : '0%'}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Tempo Risposta</p>
                      <p className="text-2xl font-bold">{analytics.avgResponseTime || 0}ms</p>
                    </div>
                    <Clock className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alert Types Distribution */}
            {analytics.alertTypeDistribution && (
              <Card>
                <CardHeader>
                  <CardTitle>Distribuzione per Tipo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analytics.alertTypeDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {analytics.alertTypeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            {analytics.alertTrends && (
              <Card>
                <CardHeader>
                  <CardTitle>Trend Alert nel Tempo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={analytics.alertTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="triggered" 
                        stroke={chartColors.danger} 
                        name="Attivati"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="created" 
                        stroke={chartColors.primary} 
                        name="Creati"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="resolved" 
                        stroke={chartColors.success} 
                        name="Risolti"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            {analytics.topTriggeredProducts && (
              <Card>
                <CardHeader>
                  <CardTitle>Prodotti con Più Alert</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.topTriggeredProducts.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="productName" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill={chartColors.warning} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            {analytics.notificationStats && (
              <Card>
                <CardHeader>
                  <CardTitle>Statistiche Notifiche</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <Mail className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                      <div className="text-2xl font-bold">{analytics.notificationStats.email || 0}</div>
                      <div className="text-sm text-muted-foreground">Email Inviate</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <div className="text-2xl font-bold">{analytics.notificationStats.pec || 0}</div>
                      <div className="text-sm text-muted-foreground">PEC Inviate</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                      <div className="text-2xl font-bold">{analytics.notificationStats.failed || 0}</div>
                      <div className="text-sm text-muted-foreground">Fallite</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Report Data Preview */}
      {reportData && (
        <Card>
          <CardHeader>
            <CardTitle>Anteprima Report Generato</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto">
                {JSON.stringify(reportData, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AlertReporting;
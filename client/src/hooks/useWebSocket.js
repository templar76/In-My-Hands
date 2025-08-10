import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

const useWebSocket = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);
  const [alertUpdates, setAlertUpdates] = useState([]);
  const [performanceMetrics, setPerformanceMetrics] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(async () => {
    if (!user || socketRef.current?.connected) {
      return;
    }

    try {
      setConnectionStatus('connecting');
      const token = await user.getIdToken();
      
      const socket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000', {
        path: '/socket.io/',
        auth: {
          token
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true
      });

      socketRef.current = socket;

      // Connection events
      socket.on('connect', () => {
        console.log('WebSocket connected:', socket.id);
        setIsConnected(true);
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        toast.success('Connesso al sistema di monitoraggio real-time');
      });

      socket.on('connected', (data) => {
        console.log('WebSocket connection confirmed:', data);
        setLastMessage({
          type: 'connection_confirmed',
          data,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, don't reconnect automatically
          toast.error('Disconnesso dal server');
        } else {
          // Client-side disconnect, attempt to reconnect
          handleReconnect();
        }
      });

      socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setConnectionStatus('error');
        toast.error('Errore di connessione al sistema real-time');
        handleReconnect();
      });

      // Alert events
      socket.on('alert_triggered', (data) => {
        console.log('Alert triggered:', data);
        setAlertUpdates(prev => [{
          id: Date.now(),
          type: 'triggered',
          data,
          timestamp: new Date().toISOString()
        }, ...prev.slice(0, 49)]); // Keep last 50 updates
        
        // Show toast notification for important alerts
        if (data.severity === 'high' || data.alertType === 'price_threshold') {
          toast.warning(`Alert attivato: ${data.productName || 'Prodotto'}`, {
            description: data.triggerReason || 'Soglia superata'
          });
        }
      });

      socket.on('alert_status_changed', (data) => {
        console.log('Alert status changed:', data);
        setAlertUpdates(prev => [{
          id: Date.now(),
          type: 'status_changed',
          data,
          timestamp: new Date().toISOString()
        }, ...prev.slice(0, 49)]);
      });

      socket.on('alert_status_response', (data) => {
        console.log('Alert status response:', data);
        setLastMessage({
          type: 'alert_status',
          data,
          timestamp: new Date().toISOString()
        });
      });

      // Performance metrics
      socket.on('performance_metrics_update', (data) => {
        console.log('Performance metrics update:', data);
        setPerformanceMetrics(data);
      });

      // System status
      socket.on('system_status_update', (data) => {
        console.log('System status update:', data);
        setSystemStatus(data);
        
        if (data.status === 'warning' || data.status === 'critical') {
          toast.warning(`Stato sistema: ${data.status}`, {
            description: data.message || 'Controllare le metriche di sistema'
          });
        }
      });

      // Subscription confirmations
      socket.on('subscription_confirmed', (data) => {
        console.log('Subscription confirmed:', data);
        setLastMessage({
          type: 'subscription_confirmed',
          data,
          timestamp: new Date().toISOString()
        });
      });

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      setConnectionStatus('error');
      handleReconnect();
    }
  }, [user]);

  const handleReconnect = useCallback(() => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      setConnectionStatus('failed');
      toast.error('Impossibile riconnettersi al sistema real-time');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
    
    setConnectionStatus('reconnecting');
    setReconnectAttempts(prev => prev + 1);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [reconnectAttempts, connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setReconnectAttempts(0);
  }, []);

  // Subscription methods
  const subscribeToAlerts = useCallback((options = {}) => {
    if (!socketRef.current?.connected) {
      console.warn('Cannot subscribe to alerts: WebSocket not connected');
      return;
    }

    const { alertIds = [], productIds = [], alertTypes = [] } = options;
    
    socketRef.current.emit('subscribe_alerts', {
      alertIds,
      productIds,
      alertTypes
    });

    console.log('Subscribed to alerts:', options);
  }, []);

  const unsubscribeFromAlerts = useCallback((options = {}) => {
    if (!socketRef.current?.connected) {
      return;
    }

    const { alertIds = [], productIds = [], alertTypes = [] } = options;
    
    socketRef.current.emit('unsubscribe_alerts', {
      alertIds,
      productIds,
      alertTypes
    });

    console.log('Unsubscribed from alerts:', options);
  }, []);

  const subscribeToMetrics = useCallback(() => {
    if (!socketRef.current?.connected) {
      console.warn('Cannot subscribe to metrics: WebSocket not connected');
      return;
    }

    socketRef.current.emit('subscribe_metrics');
    console.log('Subscribed to performance metrics');
  }, []);

  const unsubscribeFromMetrics = useCallback(() => {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit('unsubscribe_metrics');
    console.log('Unsubscribed from performance metrics');
  }, []);

  const getAlertStatus = useCallback((alertId) => {
    if (!socketRef.current?.connected) {
      console.warn('Cannot get alert status: WebSocket not connected');
      return;
    }

    socketRef.current.emit('get_alert_status', { alertId });
    console.log('Requested alert status for:', alertId);
  }, []);

  // Clear old alert updates
  const clearAlertUpdates = useCallback(() => {
    setAlertUpdates([]);
  }, []);

  // Get recent alerts by type
  const getRecentAlertsByType = useCallback((type, limit = 10) => {
    return alertUpdates
      .filter(update => update.type === type)
      .slice(0, limit);
  }, [alertUpdates]);

  // Auto-connect when user is available
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  return {
    // Connection state
    isConnected,
    connectionStatus,
    reconnectAttempts,
    
    // Data
    lastMessage,
    alertUpdates,
    performanceMetrics,
    systemStatus,
    
    // Methods
    connect,
    disconnect,
    subscribeToAlerts,
    unsubscribeFromAlerts,
    subscribeToMetrics,
    unsubscribeFromMetrics,
    getAlertStatus,
    clearAlertUpdates,
    getRecentAlertsByType,
    
    // Utilities
    socket: socketRef.current
  };
};

export default useWebSocket;
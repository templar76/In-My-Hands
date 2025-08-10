import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import logger from '../utils/logger.js';

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.alertSubscriptions = new Map();
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      },
      path: '/socket.io/'
    });

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        // Verify Firebase token
        const decodedToken = await admin.auth().verifyIdToken(token);
        socket.userId = decodedToken.uid;
        socket.tenantId = decodedToken.tenantId;
        
        logger.info('WebSocket client authenticated', {
          userId: socket.userId,
          tenantId: socket.tenantId,
          socketId: socket.id
        });
        
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed', {
          error: error.message,
          socketId: socket.id
        });
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    logger.info('WebSocket service initialized');
  }

  handleConnection(socket) {
    const { userId, tenantId } = socket;
    
    // Store client connection
    this.connectedClients.set(socket.id, {
      socket,
      userId,
      tenantId,
      connectedAt: new Date()
    });

    logger.info('Client connected to WebSocket', {
      userId,
      tenantId,
      socketId: socket.id,
      totalConnections: this.connectedClients.size
    });

    // Join user-specific room
    socket.join(`user:${userId}`);
    socket.join(`tenant:${tenantId}`);

    // Handle alert subscriptions
    socket.on('subscribe_alerts', (data) => {
      this.handleAlertSubscription(socket, data);
    });

    socket.on('unsubscribe_alerts', (data) => {
      this.handleAlertUnsubscription(socket, data);
    });

    // Handle alert status requests
    socket.on('get_alert_status', (data) => {
      this.handleAlertStatusRequest(socket, data);
    });

    // Handle performance metrics subscription
    socket.on('subscribe_metrics', () => {
      socket.join(`metrics:${tenantId}`);
      logger.info('Client subscribed to metrics', { userId, socketId: socket.id });
    });

    socket.on('unsubscribe_metrics', () => {
      socket.leave(`metrics:${tenantId}`);
      logger.info('Client unsubscribed from metrics', { userId, socketId: socket.id });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Send initial connection confirmation
    socket.emit('connected', {
      message: 'Connected to alert monitoring system',
      timestamp: new Date().toISOString(),
      features: {
        realTimeAlerts: true,
        performanceMetrics: true,
        alertHistory: true
      }
    });
  }

  handleAlertSubscription(socket, data) {
    const { userId, tenantId } = socket;
    const { alertIds = [], productIds = [], alertTypes = [] } = data;

    const subscriptionKey = `${userId}:${tenantId}`;
    
    if (!this.alertSubscriptions.has(subscriptionKey)) {
      this.alertSubscriptions.set(subscriptionKey, {
        socketId: socket.id,
        alertIds: new Set(),
        productIds: new Set(),
        alertTypes: new Set()
      });
    }

    const subscription = this.alertSubscriptions.get(subscriptionKey);
    
    // Add new subscriptions
    alertIds.forEach(id => subscription.alertIds.add(id));
    productIds.forEach(id => subscription.productIds.add(id));
    alertTypes.forEach(type => subscription.alertTypes.add(type));

    // Join specific alert rooms
    alertIds.forEach(alertId => {
      socket.join(`alert:${alertId}`);
    });

    productIds.forEach(productId => {
      socket.join(`product:${productId}`);
    });

    logger.info('Client subscribed to alerts', {
      userId,
      tenantId,
      socketId: socket.id,
      alertIds: alertIds.length,
      productIds: productIds.length,
      alertTypes: alertTypes.length
    });

    socket.emit('subscription_confirmed', {
      alertIds,
      productIds,
      alertTypes,
      timestamp: new Date().toISOString()
    });
  }

  handleAlertUnsubscription(socket, data) {
    const { userId, tenantId } = socket;
    const { alertIds = [], productIds = [], alertTypes = [] } = data;

    const subscriptionKey = `${userId}:${tenantId}`;
    const subscription = this.alertSubscriptions.get(subscriptionKey);

    if (subscription) {
      // Remove subscriptions
      alertIds.forEach(id => {
        subscription.alertIds.delete(id);
        socket.leave(`alert:${id}`);
      });
      
      productIds.forEach(id => {
        subscription.productIds.delete(id);
        socket.leave(`product:${id}`);
      });
      
      alertTypes.forEach(type => subscription.alertTypes.delete(type));

      logger.info('Client unsubscribed from alerts', {
        userId,
        tenantId,
        socketId: socket.id,
        alertIds: alertIds.length,
        productIds: productIds.length,
        alertTypes: alertTypes.length
      });
    }
  }

  handleAlertStatusRequest(socket, data) {
    const { alertId } = data;
    
    // In a real implementation, you would fetch the current status from the database
    // For now, we'll simulate a response
    socket.emit('alert_status_response', {
      alertId,
      status: 'active',
      lastCheck: new Date().toISOString(),
      nextCheck: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
      triggerCount: Math.floor(Math.random() * 10),
      timestamp: new Date().toISOString()
    });
  }

  handleDisconnection(socket, reason) {
    const { userId, tenantId } = socket;
    
    // Remove client from connected clients
    this.connectedClients.delete(socket.id);
    
    // Clean up subscriptions
    const subscriptionKey = `${userId}:${tenantId}`;
    this.alertSubscriptions.delete(subscriptionKey);

    logger.info('Client disconnected from WebSocket', {
      userId,
      tenantId,
      socketId: socket.id,
      reason,
      totalConnections: this.connectedClients.size
    });
  }

  // Methods to broadcast alert events
  broadcastAlertTriggered(alertData) {
    const { alertId, productId, userId, tenantId, alertType } = alertData;
    
    // Broadcast to specific alert subscribers
    this.io.to(`alert:${alertId}`).emit('alert_triggered', {
      ...alertData,
      timestamp: new Date().toISOString(),
      type: 'alert_triggered'
    });

    // Broadcast to product subscribers
    this.io.to(`product:${productId}`).emit('alert_triggered', {
      ...alertData,
      timestamp: new Date().toISOString(),
      type: 'alert_triggered'
    });

    // Broadcast to user
    this.io.to(`user:${userId}`).emit('alert_triggered', {
      ...alertData,
      timestamp: new Date().toISOString(),
      type: 'alert_triggered'
    });

    logger.info('Alert triggered event broadcasted', {
      alertId,
      productId,
      userId,
      tenantId,
      alertType
    });
  }

  broadcastAlertStatusChange(alertData) {
    const { alertId, productId, userId, tenantId, status, previousStatus } = alertData;
    
    const statusChangeData = {
      ...alertData,
      timestamp: new Date().toISOString(),
      type: 'alert_status_changed'
    };

    this.io.to(`alert:${alertId}`).emit('alert_status_changed', statusChangeData);
    this.io.to(`product:${productId}`).emit('alert_status_changed', statusChangeData);
    this.io.to(`user:${userId}`).emit('alert_status_changed', statusChangeData);

    logger.info('Alert status change broadcasted', {
      alertId,
      status,
      previousStatus,
      userId,
      tenantId
    });
  }

  broadcastPerformanceMetrics(tenantId, metrics) {
    this.io.to(`metrics:${tenantId}`).emit('performance_metrics_update', {
      ...metrics,
      timestamp: new Date().toISOString(),
      type: 'performance_metrics'
    });

    logger.debug('Performance metrics broadcasted', {
      tenantId,
      metricsKeys: Object.keys(metrics)
    });
  }

  broadcastSystemStatus(status) {
    this.io.emit('system_status_update', {
      ...status,
      timestamp: new Date().toISOString(),
      type: 'system_status'
    });

    logger.info('System status update broadcasted', {
      status: status.status,
      connectedClients: this.connectedClients.size
    });
  }

  // Utility methods
  getConnectedClientsCount() {
    return this.connectedClients.size;
  }

  getClientsByTenant(tenantId) {
    return Array.from(this.connectedClients.values())
      .filter(client => client.tenantId === tenantId);
  }

  getClientsByUser(userId) {
    return Array.from(this.connectedClients.values())
      .filter(client => client.userId === userId);
  }

  disconnectClient(socketId, reason = 'Server disconnect') {
    const client = this.connectedClients.get(socketId);
    if (client) {
      client.socket.disconnect(reason);
      logger.info('Client forcibly disconnected', {
        socketId,
        userId: client.userId,
        reason
      });
    }
  }

  // Health check
  getHealthStatus() {
    return {
      status: 'healthy',
      connectedClients: this.connectedClients.size,
      activeSubscriptions: this.alertSubscriptions.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

// Initialize function for compatibility
const initializeWebSocketService = (server) => {
  websocketService.initialize(server);
  return websocketService;
};

export { websocketService as io, initializeWebSocketService as initializeWebSocket, initializeWebSocketService };
export default websocketService;
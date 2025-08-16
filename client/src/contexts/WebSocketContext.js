import React, { createContext, useContext } from 'react';
import useWebSocket from '../hooks/useWebSocket';

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const webSocketData = useWebSocket();
  
  return (
    <WebSocketContext.Provider value={webSocketData}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
};
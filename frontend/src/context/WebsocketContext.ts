import { createContext, useContext } from 'react';
import type { RefObject } from 'react';
import type { Client } from 'webstomp-client';

export interface WebSocketContextType {
  stompClient: RefObject<Client | null>;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

export const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

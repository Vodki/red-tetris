'use client'

import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [grid, setGrid] = useState([]);
  const [score, setScore] = useState();
  const [gameOn, setGameOn] = useState(false);
  const [level, setLevel] = useState();
  const [socket, setSocket] = useState(null);
  const [listeners] = useState(new Map());


  useEffect(() => {
    const ws = io('http://localhost:3000', {
      reconnection: true,
      reconnectionDelay: 1000,
      autoConnect: true
    });
    
    ws.on('connect', () => {
      console.log('Connected to WS server');
      ws.emit('new-game');
    });
    
    ws.on('GameUpdate', (message) => {
      try {
        console.log(message)
        setGrid(message.grid)
        setScore(message.score)
        setGameOn(!message.gameOn)
        setLevel(message.level)
      }
      catch (error) {
        console.error('Error handling message:', error)
      }
    });
    ws.on('disconnect', () => {
      console.log('WebSocket Disconnected')
    });
    
    ws.on('newRoomResponse', (response) => {
      const { correlationId, error, exist } = response;
      console.log('ws.on response', response)
      const handler = listeners.get(correlationId);
      
      if (handler) {
        error ? handler.reject(error) : handler.resolve(exist);
        listeners.delete(correlationId);
      }
    });

    ws.on('joinRoomResponse', (response) => {
      const { correlationId, error, exist } = response;
      console.log('ws.on response', response)
      const handler = listeners.get(correlationId);
      
      if (handler) {
        error ? handler.reject(error) : handler.resolve(exist);
        listeners.delete(correlationId);
      }
    });


    ws.onAny((message) => {
      console.log('onAny:', message)
    })

    setSocket(ws)
    return () => ws.disconnect();
  }, []);

  const sendMessage = (type, data) => {
    if (socket?.connected) { 
      socket.emit(type, data);
      console.log('message sent :', type)
    } else {
      console.error('Websocket connection not ready')
    }
  };

  const sendWithPromise = (type, data) => {
    return new Promise((resolve, reject) => {
      if (!socket?.connected) {
        reject('WebSocket connection not ready');
        return;
      }

      const correlationId = Math.random().toString(36).substr(2, 9);
      
      listeners.set(correlationId, { resolve, reject });
      socket.emit(type, { 
        roomName: data, // Pass room name as a property
        correlationId 
      });
    });
  };

  return (
    <SocketContext.Provider value={{
      grid,
      score,
      gameOn,
      level,
      sendMessage,
      sendWithPromise,
      socket
    }}>
      {children}
    </SocketContext.Provider>
  );
};
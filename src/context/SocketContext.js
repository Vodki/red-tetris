'use client'

import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';


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
  const [host, setHost] = useState("");
  const [players, setPlayers] = useState([]);
  const [allPlayersDone, setAllPlayersDone] = useState(true);

  useEffect(() => {
    const ws = io('http://localhost:3000', {
      reconnection: true,
      reconnectionDelay: 1000,
      autoConnect: true
    });
    
    ws.on('connect', () => {
      ws.emit('new-game');
    });
    
    ws.on('GameUpdate', (message) => {
      try {
        setGrid(message.grid)
        setScore(message.score)
        setGameOn(!message.gameOver)
        setLevel(message.level)
      }
      catch (error) {
        console.error('Error handling message:', error)
      }
    });
    ws.on('disconnect', () => {
    });
    
    ws.on('newRoomResponse', (response) => {
      const { correlationId, error, canCreate, message } = response;
      const handler = listeners.get(correlationId);
      if (handler) {
        error ? handler.reject(error) : handler.resolve(canCreate);
        listeners.delete(correlationId);
      }
      if (canCreate == false) {
        toast.error(message)
      }
    });

    ws.on('joinRoomResponse', (response) => {
      const { correlationId, error, canJoin, message } = response;
      const handler = listeners.get(correlationId);

      if (handler) {
        error ? handler.reject(error) : handler.resolve(canJoin);
        listeners.delete(correlationId);
      }
      if (canJoin == false) {
        toast.error(message)
      }
    });

    ws.on('allPlayersDone', (data) => {
      setAllPlayersDone(data);
    })

    ws.on('roomUpdate', (data) => {
      setHost(data.host);
      setPlayers(data.players);
    })

    ws.on('GameShadow', (data) => {
      console.log('GameShadow:', data)
    })

    // ws.onAny((message) => {
    //   console.log('onAny:', message)
    // })

    setSocket(ws)
    return () => ws.disconnect();
  }, []);

  const sendMessage = (type, data) => {
    if (socket?.connected) { 
      socket.emit(type, data);
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
      socket,
      host,
      players,
      allPlayersDone,
    }}>
      {children}
    </SocketContext.Provider>
  );
};
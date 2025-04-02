import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export const useWebSocket = () => {
  const [grid, setGrid] = useState([]);
  const [score, setScore] = useState();
  const [gameOn, setGameOn] = useState(false);
  const [level, setLevel] = useState();
  const [socket, setSocket] = useState(null);
  
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
    
    ws.onAny((message) => {
      console.log(message)
    })

    setSocket(ws)
    return () => ws.disconnect();
  }, []);  

  const sendMessage = useCallback((type, data) => {
    if (socket?.connected) { // Check if socket is connected
      socket.emit(type, data);
      console.log('message sent :', type)
    } else {
      console.error('Websocket connection not ready')
    }
  }, [socket]);

  return { grid, score, gameOn, level, sendMessage };
};

export default useWebSocket;
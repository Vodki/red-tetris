'use client'

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useSocket } from "@/context/SocketContext";
import { useRouter } from "next/navigation";

export default function Home() {
  
  const { sendMessage, sendWithPromise } = useSocket();
  const router = useRouter();
  const [username, setUsername] = useState("")
  const [room, setRoom] = useState("");
  const [usernameSend, setUsernameSend] = useState(false)

  const roomCreation = async () => {
    try {
      console.log('before response')
      const response = await sendWithPromise('newRoom', room)
      console.log('response = ', response)
      if (!response.exist) {
        router.push(`${room}/${username}`)
      }
    } catch (error) {
      console.error('New Room Creation Failed');
    }
  }

  const roomJoin = async () => {
    try {
      console.log('before response')
      const response = await sendWithPromise('joinRoom', room)
      console.log('response = ', response)
      if (!response.exist) {
        router.push(`${room}/${username}`)
      }
    } catch (error) {
      console.error('New Room Creation Failed');
    }
  }

  if (!username.trim() || !usernameSend) {
    return (
      <div>
        <h1>Welcome to Red Tetris</h1>
        <div>
          Please choose an username
        </div>
        <Input
          className="border-gray-950"
          placeholder='Username'
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Button
        className='disabled:opacity-50 disabled:cursor-not-allowed'
        disabled={!username.trim()}
        onClick={(e) => {
          setUsernameSend(true);
          sendMessage('setUsername', username);
          }
        }
        >Submit</Button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-4xl">Welcome to Red Tetris {username}</h1>
      <Input
          className="border-gray-950"
          placeholder='Room'
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        />
      <Button onClick={roomCreation}>Create a room</Button>
      <Button onClick={roomJoin}>Join a room</Button>
      <Button>Change Username</Button>
      <Input
          className="border-gray-950"
          placeholder='Room'
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
    </div>
  );
}

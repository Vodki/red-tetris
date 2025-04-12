import { io } from "socket.io"

export async function GET(request) {
    const url = new URL(request.url)
    const roomName = url.searchParams.get('roomName')

    if (!roomName) {
        return new Response(JSON.stringify({ error: 'roomName query parameter is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    
    const exist = io.sockets.adapter.rooms.has(roomName)

    return Response.json([
        { roomExists: exist }
      ]);
}
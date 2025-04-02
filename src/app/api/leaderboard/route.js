export async function GET() {
    return Response.json([
        { username: "Player1", score: 1000 },
        { username: "Player2", score: 800 }
      ]);
  }
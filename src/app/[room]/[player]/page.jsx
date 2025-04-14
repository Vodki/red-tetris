"use client"

import Tetris from "@/components/Tetris";
import { useParams } from "next/navigation";

export default function Player() {
  const params = useParams();
  const room = params.room;
  const username = params.player;

    return (
      <div>
        <Tetris room={room} username={username} />
      </div>
    );
  }
  
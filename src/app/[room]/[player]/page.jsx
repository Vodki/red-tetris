"use client";

import { useParams } from "next/navigation";
import Tetris from "@/components/Tetris";

/**
 * `http://<server>:<port>/<room>/<player_name>` - the URL described by the
 * subject. Reaching it directly is enough to create or join the game.
 */
export default function PlayerPage() {
	const params = useParams() || {};
	const room = decodeURIComponent(String(params.room || ""));
	const username = decodeURIComponent(String(params.player || ""));

	return <Tetris room={room} username={username} />;
}

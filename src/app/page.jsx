"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
	adjectives,
	animals,
	colors,
	uniqueNamesGenerator,
} from "unique-names-generator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSocket } from "@/context/SocketContext";
import { useToast } from "@/components/ui/toast";
import { GAME_MODE_LABELS } from "@/game/pure/rules";
import "./page.css";

export const NAME_PATTERN = /^[a-zA-Z0-9_-]{1,20}$/;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{1,30}$/;

/**
 * A random player name that the server will always accept.
 *
 * Three dictionary words can exceed the 30 character limit, so shorter
 * combinations are tried in turn until one fits.
 */
export const generateUsername = () => {
	const suffix = String(Math.floor(Math.random() * 90 + 10));
	const candidates = [
		[adjectives, colors, animals],
		[colors, animals],
		[animals],
	].map(
		(dictionaries) =>
			`${uniqueNamesGenerator({
				dictionaries,
				separator: "_",
				style: "capital",
				length: dictionaries.length,
			})}${suffix}`
	);

	return candidates.find((name) => USERNAME_PATTERN.test(name)) || `Player${suffix}`;
};

/**
 * Lobby. It never talks to the game itself: it only builds the
 * `/<room>/<player_name>` URL, which is where a game is actually joined.
 */
export default function Home() {
	const router = useRouter();
	const toast = useToast();
	const { rooms, connected } = useSocket();
	const [username, setUsername] = useState("");
	const [room, setRoom] = useState("");

	useEffect(() => {
		setUsername(generateUsername());
	}, []);

	const goToRoom = useCallback(
		(roomName) => {
			if (!USERNAME_PATTERN.test(username)) {
				toast.error("Player names may only contain letters, digits, - and _ (max 30).");
				return;
			}
			if (!NAME_PATTERN.test(roomName)) {
				toast.error("Room names may only contain letters, digits, - and _ (max 20).");
				return;
			}
			router.push(`/${encodeURIComponent(roomName)}/${encodeURIComponent(username)}`);
		},
		[router, toast, username]
	);

	const handleSubmit = (event) => {
		event.preventDefault();
		goToRoom(room);
	};

	return (
		<main className="lobby">
			<section className="lobby-card">
				<h1 className="lobby-title">Red Tetris</h1>
				<p className="lobby-subtitle">
					Pick a name, pick a room. The first player in a room hosts it.
				</p>

				<form className="lobby-form" onSubmit={handleSubmit}>
					<div className="lobby-field">
						<Label htmlFor="username">Player name</Label>
						<div className="lobby-row">
							<Input
								id="username"
								placeholder="Player name"
								value={username}
								maxLength={30}
								onChange={(event) => setUsername(event.target.value)}
							/>
							<Button
								type="button"
								variant="outline"
								onClick={() => setUsername(generateUsername())}
							>
								Random
							</Button>
						</div>
					</div>

					<div className="lobby-field">
						<Label htmlFor="room">Room</Label>
						<div className="lobby-row">
							<Input
								id="room"
								placeholder="Room name"
								value={room}
								maxLength={20}
								onChange={(event) => setRoom(event.target.value)}
							/>
							<Button type="submit" disabled={!room.trim() || !username.trim()}>
								Play
							</Button>
						</div>
					</div>
				</form>

				<div className="lobby-rooms">
					<h2 className="lobby-rooms-title">
						{connected ? "Open rooms" : "Connecting to the server…"}
					</h2>
					{rooms.length === 0 ? (
						<p className="lobby-empty">No room yet — create the first one.</p>
					) : (
						<ul className="lobby-rooms-list">
							{rooms.map((openRoom) => (
								<li key={openRoom.name} className="lobby-room">
									<span className="lobby-room-name">{openRoom.name}</span>
									<span className="lobby-room-meta">
										{openRoom.players} player{openRoom.players > 1 ? "s" : ""} ·{" "}
										{GAME_MODE_LABELS[openRoom.mode] || openRoom.mode}
									</span>
									<Button
										type="button"
										variant="outline"
										disabled={openRoom.isRunning}
										onClick={() => goToRoom(openRoom.name)}
									>
										{openRoom.isRunning ? "In game" : "Join"}
									</Button>
								</li>
							))}
						</ul>
					)}
				</div>
			</section>
		</main>
	);
}

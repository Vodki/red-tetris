"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/context/SocketContext";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { GAME_MODES, GAME_MODE_LABELS } from "@/game/pure/rules";
import GameStats from "./GameStats";
import Grid from "./Grid";
import Leaderboard from "./Leaderboard";
import NextPiece from "./NextPiece";
import Spectrum from "./Spectrum";
import "./Tetris.css";

const KEY_COMMANDS = {
	ArrowLeft: "MoveLeft",
	ArrowRight: "MoveRight",
	ArrowUp: "Rotate",
	ArrowDown: "MoveDown",
	" ": "HardDrop",
};

const Tetris = ({ room: roomName, username }) => {
	const {
		connected,
		game,
		room,
		spectrums,
		winner,
		allPlayersDone,
		leaderboard,
		socket,
		sendInput,
		enterRoom,
		leaveRoom,
		startGame,
		setMode,
		refreshLeaderboard,
	} = useSocket();
	const router = useRouter();
	const toast = useToast();
	const [status, setStatus] = useState("connecting");
	// Remembers which room we already asked to enter, so a re-render never
	// fires a second join for the same room on the same connection.
	const attempted = useRef("");

	const socketId = socket ? socket.id : null;
	const isHost = Boolean(socketId) && room.host === socketId;

	// A dropped connection must be able to enter the room again.
	useEffect(() => {
		if (!connected) attempted.current = "";
	}, [connected]);

	// Joining from the URL: the first player to reach the room creates it.
	useEffect(() => {
		if (!connected || !roomName || !username) return undefined;

		const key = `${roomName}/${username}`;
		if (attempted.current === key) return undefined;
		attempted.current = key;

		let cancelled = false;
		setStatus("joining");

		enterRoom(roomName, username)
			.then(() => {
				if (!cancelled) setStatus("ready");
			})
			.catch((error) => {
				if (cancelled) return;
				setStatus("rejected");
				toast.error(error.message);
				router.push("/");
			});

		return () => {
			cancelled = true;
		};
	}, [connected, roomName, username, enterRoom, router, toast]);

	useEffect(() => {
		refreshLeaderboard();
	}, [refreshLeaderboard, allPlayersDone]);

	const handleKeyDown = useCallback(
		(event) => {
			const command = KEY_COMMANDS[event.key];
			if (!command || !game.running || game.gameOver) return;
			event.preventDefault();
			sendInput(command);
		},
		[sendInput, game.running, game.gameOver]
	);

	useEffect(() => {
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	const handleLeave = useCallback(() => {
		leaveRoom(roomName);
		router.push("/");
	}, [leaveRoom, roomName, router]);

	const opponents = useMemo(
		() => room.players.filter((player) => player.socketId !== socketId),
		[room.players, socketId]
	);

	const spectrumOf = useCallback(
		(player) => {
			const live = spectrums.get(player.socketId);
			return live ? live.spectrum : player.spectrum;
		},
		[spectrums]
	);

	const scoreOf = useCallback(
		(player) => {
			const live = spectrums.get(player.socketId);
			return live ? live.score : player.score;
		},
		[spectrums]
	);

	const isWinner = Boolean(winner) && winner.socketId === socketId;

	const outcome = () => {
		if (!game.gameOver) return "";
		if (isWinner) return "You won!";
		if (winner) return `You lost — ${winner.username} won.`;
		return "Game over";
	};

	if (status !== "ready") {
		return (
			<main className="tetris-page tetris-page-centered">
				<p className="tetris-status">
					{status === "rejected" ? "Could not join the room." : "Connecting…"}
				</p>
			</main>
		);
	}

	return (
		<main className="tetris-page">
			<header className="tetris-header">
				<Button type="button" onClick={handleLeave}>
					Leave room
				</Button>
				<div className="tetris-room-info">
					<span className="tetris-room-name">Room “{roomName}”</span>
					<span className="tetris-room-mode">{GAME_MODE_LABELS[room.mode]}</span>
					<span className="tetris-room-players">
						{room.players.length} player{room.players.length > 1 ? "s" : ""}
					</span>
				</div>
			</header>

			<div className="tetris-layout">
				<aside className="tetris-sidebar">
					<GameStats
						score={game.score}
						level={game.level}
						lines={game.lines}
						username={username}
					/>
					<NextPiece piece={game.nextPiece} />

					{isHost ? (
						<div className="tetris-host-panel">
							<p className="tetris-host-note">
								You are the host{room.players.length > 1 ? " — you start the round for everyone." : "."}
							</p>
							<div className="tetris-modes">
								{GAME_MODES.map((mode) => (
									<Button
										key={mode}
										type="button"
										variant={room.mode === mode ? "default" : "outline"}
										disabled={room.isRunning}
										onClick={() => setMode(roomName, mode)}
									>
										{GAME_MODE_LABELS[mode]}
									</Button>
								))}
							</div>
							<Button
								type="button"
								className="w-full"
								disabled={!allPlayersDone || room.isRunning}
								onClick={() => startGame(roomName)}
							>
								{game.lines > 0 || game.gameOver ? "Restart game" : "Start game"}
							</Button>
						</div>
					) : (
						!game.running && <p className="tetris-waiting">Waiting for the host to start the game.</p>
					)}

					<div className="tetris-controls">
						<h3 className="tetris-controls-title">Controls</h3>
						<ul className="tetris-controls-list">
							<li><span>←  →</span> Move</li>
							<li><span>↑</span> Rotate</li>
							<li><span>↓</span> Soft drop</li>
							<li><span>Space</span> Hard drop</li>
						</ul>
					</div>
				</aside>

				<section className="tetris-board">
					<Grid grid={game.grid} />
					<h2 className="tetris-outcome">{outcome()}</h2>
				</section>

				<aside className="tetris-opponents">
					<h3 className="tetris-opponents-title">
						{opponents.length > 0 ? "Opponents" : "No opponent yet"}
					</h3>
					<div className="tetris-opponents-list">
						{opponents.map((player) => (
							<div key={player.socketId} className="tetris-opponent">
								<span className="tetris-opponent-name">
									{player.username}
									{player.isHost ? " (host)" : ""}
								</span>
								<Spectrum spectrum={spectrumOf(player)} />
								<span className="tetris-opponent-score">
									{scoreOf(player)}
									{winner && winner.socketId === player.socketId ? " — won" : ""}
								</span>
							</div>
						))}
					</div>
					<Leaderboard entries={leaderboard} />
				</aside>
			</div>
		</main>
	);
};

export default Tetris;

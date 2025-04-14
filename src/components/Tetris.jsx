"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSocket } from "@/context/SocketContext";
import { createEmptyGrid } from "../utils/gridUtils";
import { Button } from "./ui/button";
import Leaderboard from "./Leaderboard";
import "./Leaderboard.css";
import GameStats from "./GameStats";
import "./GameStats.css";
import Grid from "./Grid";
import { useRouter } from "next/router";
import { Toaster } from "sonner";

const Tetris = ({ room, username }) => {
	const defaultGrid = createEmptyGrid();
	const { grid, sendMessage, score, level, gameOn, host, players, socket } =
		useSocket();
	const [leaderboard, setLeaderboard] = useState([]);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const response = await fetch("../../api/leaderboard");

				if (!response.ok) {
					throw new Error(`HTTP error! Status: ${response.status}`);
				}

				const result = await response.json();
				setLeaderboard(result);
			} catch (error) {
				console.error("Fetch Error:", error);
			}
		};

		fetchData();
	}, [gameOn]);

	const currentGrid = grid && grid.length > 0 ? grid : defaultGrid;

	const handleKeyDown = useCallback(
		(event) => {
			if (!gameOn) return;
			switch (event.key) {
				case "ArrowUp":
					sendMessage("gameInput", "Rotate");
					event.preventDefault();
					break;
				case "ArrowRight":
					sendMessage("gameInput", "MoveRight");
					event.preventDefault();
					break;
				case "ArrowLeft":
					sendMessage("gameInput", "MoveLeft");
					event.preventDefault();
					break;
				case "ArrowDown":
					sendMessage("gameInput", "MoveDown");
					event.preventDefault();
					break;
				case " ":
					sendMessage("gameInput", "HardDrop");
					event.preventDefault();
					break;
				default:
					break;
			}
		},
		[sendMessage, gameOn]
	);

	useEffect(() => {
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [handleKeyDown]);

	const handleStart = useCallback(() => {
		if (!gameOn) sendMessage("start", room);
	}, [sendMessage, gameOn, room, username]);

	if (!username.trim()) {
		useRouter("/");
	}

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "row",
				justifyContent: "space-around",
				alignItems: "center",
				columnGap: "3rem",
			}}
		>
			<Toaster position="bottom-right" richColors/>
			<div className="flex flex-col">
				<Leaderboard entries={leaderboard} />
				<Button
					className="disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={gameOn}
					onClick={handleStart}
				>
					Start Game / Restart
				</Button>
			</div>
			<Grid grid={currentGrid} isOponent={false} />
			<div className="grid-rows-1 gap-4 items-center">
				{players
					?.filter((player) => player.socketId !== socket.id)
					.map((player, index) => (
						<div className="row-span-1 flex flex-col items-center" key={index}>
              <h4>{player.username}</h4>
							<Grid grid={defaultGrid} isOponent={true} />
						</div>
					))}
			</div>
			<div>
				<GameStats level={level || 0} score={score || 0} />
			</div>
		</div>
	);
};

export default Tetris;

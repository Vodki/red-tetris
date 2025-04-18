"use client";

import React, { useCallback, useEffect } from "react";
import { useSocket } from "@/context/SocketContext";
import { createEmptyGrid } from "../utils/gridUtils";
import { Button } from "./ui/button";
import GameStats from "./GameStats";
import "./GameStats.css";
import Grid from "./Grid";
import { useRouter } from "next/navigation";

const Tetris = ({ room, username }) => {
	const defaultGrid = createEmptyGrid();
	const {
		grid,
		sendMessage,
		score,
		gameOn,
		host,
		players,
		socket,
		allPlayersDone,
		grids,
		scores,
		gameOver,
	} = useSocket();
	const router = useRouter();

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

	useEffect(() => {
		const checkSocket = () => {
			if (socket === null) {
				router.push("/");
			}
		};

		checkSocket();
	}, [socket, router]);

	const handleGoHome = () => {
		sendMessage("leaveRoom", room);
		router.push("/");
	};

	return (
		<div>
			<Button type="button" onClick={handleGoHome} className="mt-2 ms-2">
				Homepage
			</Button>
			<div
				style={{
					display: "flex",
					flexDirection: "row",
					justifyContent: "space-around",
					alignItems: "center",
					columnGap: "3rem",
				}}
			>
				<div className="flex flex-col items-center">
					<div className="mb-4">
						<GameStats score={score || 0} />
					</div>
					{socket && host === socket.id ? (
						<>
							{players.length > 1 && (
								<p>
									You are the host. The game start for
									everyone if you push this button :
								</p>
							)}
							<Button
								className="disabled:opacity-50 disabled:cursor-not-allowed w-full"
								disabled={!allPlayersDone}
								onClick={handleStart}
							>
								Start Game / Restart
							</Button>
						</>
					) : (
						<p>Waiting for the host to start the game.</p>
					)}
				</div>
				<div>
					<Grid grid={currentGrid} isOpponent={false} />
					{socket &&
						<h2 className="text-center font-semibold">{gameOver.get(socket.id)
							? "Game Over"
							: ""}
						</h2>
					}
				</div>
				<div className="grid-rows items-center">
					{players
						?.filter((player) => player.socketId !== socket.id)
						.map((player, index, array) => (
							<React.Fragment key={player.socketId}>
								<div className="flex flex-col items-center">
									<h4>{player.username}</h4>
									<Grid
										grid={
											grids.get(player.socketId) ??
											defaultGrid
										}
										isOpponent={true}
									/>
									<p>
										Score:{" "}
										{scores.get(player.socketId) ?? "0"}{" "}
										{gameOver.get(player.socketId)
											? " - Game Over"
											: ""}
									</p>
								</div>
								{array.length > 1 &&
									index < array.length - 1 && (
										<div
											className="h-px w-full bg-gray-300 my-2"
											style={{
												display: "block",
											}}
										/>
									)}
							</React.Fragment>
						))}
				</div>
			</div>
		</div>
	);
};

export default Tetris;

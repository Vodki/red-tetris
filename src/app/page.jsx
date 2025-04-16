"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useSocket } from "@/context/SocketContext";
import { useRouter } from "next/navigation";
import {
	uniqueNamesGenerator,
	adjectives,
	colors,
	animals,
} from "unique-names-generator";
import { toast } from "sonner";


export default function Home() {
	const { sendMessage, sendWithPromise } = useSocket();
	const router = useRouter();
	const [username, setUsername] = useState("");
	const [newUsername, setNewUsername] = useState("");
	const [room, setRoom] = useState("");
	const [usernameSend, setUsernameSend] = useState(false);
	const [isChangingUsername, setIsChangingUsername] = useState(false);

	const roomCreation = async () => {
		try {
			const canCreate = await sendWithPromise("newRoom", room);
			if (canCreate == true) {
				router.push(`${room}/${username}`);
			}
		} catch (error) {
			console.error(error.message);
		}
	};

	const roomJoin = async () => {
		try {
			const canJoin = await sendWithPromise("joinRoom", room);
			if (canJoin == true) {
				router.push(`${room}/${username}`);
			}
		} catch (error) {
			console.error(error.message);
		}
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		if (username.trim()) {
			setUsernameSend(true);
			sendMessage("setUsername", username);
		}
	};

	const handleChangeUsername = () => {
		if (newUsername.trim()) {
			sendMessage("setUsername", newUsername);
			setUsername(newUsername);
			setNewUsername("");
			setIsChangingUsername(false);
		}
	};

	const handleGeneratePseudo = () => {
		const generatedName =
			uniqueNamesGenerator({
				dictionaries: [adjectives, colors, animals],
				separator: "_",
				style: "capital",
				length: 3,
			}) + Math.floor(Math.random() * 90 + 10);

		setUsername(generatedName);
	};

	if (!username.trim() || !usernameSend) {
		return (
			<div className="flex justify-center items-center h-screen">
				<div className="flex flex-col items-center gap-4 w-1/3 p-4 border border-gray-300 rounded-lg shadow-md">
					<h1 className="text-4xl text-center">
						Welcome to Red Tetris
					</h1>
					<div className="grid w-full item-center gap-1.5">
						<Label htmlFor="please choose a username">
							Please choose a username
						</Label>
						<form onSubmit={handleSubmit}>
							<div className="flex w-full items-center space-x-2">
								<Input
									className="border-gray-950"
									placeholder="Username"
									value={username}
									onChange={(e) =>
										setUsername(e.target.value)
									}
                  maxLength={30}
								/>
								<Button onClick={handleGeneratePseudo}>
									Create a random Username
								</Button>
								<Button
									className="disabled:opacity-50 disabled:cursor-not-allowed"
									disabled={!username.trim()}
									type="submit"
								>
									Submit
								</Button>
							</div>
						</form>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex justify-center items-center h-screen">
			<div className="flex flex-col items-center gap-4 w-1/3 p-4 border border-gray-300 rounded-lg shadow-md">
				<h1 className="text-4xl text-center">
					Welcome to Red Tetris, {username}
				</h1>
				<div className="flex w-full items-center space-x-2">
					<Input
						className="border-gray-950"
						placeholder="Room"
						value={room}
						onChange={(e) => setRoom(e.target.value)}
					/>
					<Button
						className="disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={!room.trim()}
						onClick={roomCreation}
					>
						Create a room
					</Button>
					<Button
						className="disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={!room.trim()}
						onClick={roomJoin}
					>
						Join a room
					</Button>
				</div>
				<div className="flex w-full items-center space-x-2">
					{isChangingUsername ? (
						<Input
							className="border-gray-950"
							placeholder="New Username"
							value={newUsername}
							onChange={(e) => setNewUsername(e.target.value)}
							onBlur={() => setIsChangingUsername(false)}
              maxLength={30}
						/>
					) : (
						<Input
							className="border-gray-950"
							placeholder="New Username"
							value={username}
							onClick={() => setIsChangingUsername(true)}
							readOnly
						/>
					)}
					<Button onClick={handleGeneratePseudo}>
						Recreate a random Username
					</Button>
					<Button
						className="disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={!newUsername.trim()}
						onClick={handleChangeUsername}
					>
						Change Username
					</Button>
				</div>
			</div>
		</div>
	);
}

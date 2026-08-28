"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { io } from "socket.io-client";
import { useToast } from "@/components/ui/toast";
import { createEmptyGrid } from "@/utils/gridUtils";
import { DEFAULT_MODE } from "@/game/pure/rules";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const REQUEST_TIMEOUT = 8000;

export const initialGame = () => ({
	grid: createEmptyGrid(),
	spectrum: [],
	nextPiece: null,
	score: 0,
	level: 1,
	lines: 0,
	gameOver: false,
	running: false,
});

export const initialRoom = () => ({
	name: "",
	host: null,
	mode: DEFAULT_MODE,
	isRunning: false,
	players: [],
});

export const resolveSocketUrl = () => {
	if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
	if (typeof window !== "undefined") return window.location.origin;
	return "http://localhost:3000";
};

/**
 * Holds the single socket.io connection and mirrors the server state.
 *
 * The client owns no game logic at all: it forwards the player's inputs and
 * renders whatever the server sends back.
 */
export const SocketProvider = ({ children }) => {
	const [socket, setSocket] = useState(null);
	const [connected, setConnected] = useState(false);
	const [game, setGame] = useState(initialGame);
	const [room, setRoom] = useState(initialRoom);
	const [spectrums, setSpectrums] = useState(() => new Map());
	const [winner, setWinner] = useState(null);
	const [allPlayersDone, setAllPlayersDone] = useState(true);
	const [rooms, setRooms] = useState([]);
	const [leaderboard, setLeaderboard] = useState([]);
	const socketRef = useRef(null);
	const toast = useToast();

	useEffect(() => {
		const ws = io(resolveSocketUrl(), {
			reconnection: true,
			reconnectionDelay: 1000,
			autoConnect: true,
		});

		socketRef.current = ws;

		ws.on("connect", () => setConnected(true));
		ws.on("disconnect", () => setConnected(false));

		ws.on("GameUpdate", (message) => setGame((current) => ({ ...current, ...message })));

		ws.on("SpectrumUpdate", (data) =>
			setSpectrums((current) => {
				const next = new Map(current);
				next.set(data.socketId, data);
				return next;
			})
		);

		ws.on("roomUpdate", (data) => setRoom((current) => ({ ...current, ...data })));

		ws.on("roomList", (list) => setRooms(Array.isArray(list) ? list : []));

		ws.on("allPlayersDone", (done) => setAllPlayersDone(Boolean(done)));

		ws.on("gameStarted", () => {
			setWinner(null);
			setSpectrums(new Map());
			setGame(() => ({ ...initialGame(), running: true }));
		});

		ws.on("Winner", (data) => setWinner(data));

		setSocket(ws);

		return () => {
			ws.removeAllListeners();
			ws.disconnect();
			socketRef.current = null;
		};
	}, []);

	/** Fire-and-forget event. */
	const sendMessage = useCallback((event, payload) => {
		const ws = socketRef.current;
		if (!ws || !ws.connected) return false;
		ws.emit(event, payload);
		return true;
	}, []);

	/** Request/response event, built on socket.io acknowledgements. */
	const request = useCallback(
		(event, payload) =>
			new Promise((resolve, reject) => {
				const ws = socketRef.current;
				if (!ws || !ws.connected) {
					reject(new Error("Not connected to the server."));
					return;
				}

				const timer = setTimeout(
					() => reject(new Error("The server did not answer.")),
					REQUEST_TIMEOUT
				);

				ws.emit(event, payload, (response) => {
					clearTimeout(timer);
					if (response && response.ok) resolve(response);
					else reject(new Error((response && response.message) || "Unexpected error."));
				});
			}),
		[]
	);

	/** Creates the room if it does not exist yet, joins it otherwise. */
	const enterRoom = useCallback(
		async (roomName, username) => {
			const response = await request("enterRoom", { roomName, username });
			setRoom((current) => ({ ...current, ...response }));
			setSpectrums(new Map());
			setWinner(null);
			return response;
		},
		[request]
	);

	const leaveRoom = useCallback(
		(roomName) => {
			sendMessage("leaveRoom", roomName);
			setRoom(initialRoom());
			setSpectrums(new Map());
			setGame(initialGame());
			setWinner(null);
		},
		[sendMessage]
	);

	const startGame = useCallback(
		(roomName) => request("start", roomName).catch((error) => toast.error(error.message)),
		[request, toast]
	);

	const setMode = useCallback(
		(roomName, mode) =>
			request("setMode", { roomName, mode }).catch((error) => toast.error(error.message)),
		[request, toast]
	);

	const sendInput = useCallback(
		(command) => sendMessage("gameInput", command),
		[sendMessage]
	);

	const refreshLeaderboard = useCallback(
		() =>
			request("leaderboard")
				.then((response) => {
					setLeaderboard(response.entries || []);
					return response.entries;
				})
				.catch(() => []),
		[request]
	);

	const value = useMemo(
		() => ({
			socket,
			connected,
			game,
			room,
			rooms,
			spectrums,
			winner,
			allPlayersDone,
			leaderboard,
			sendMessage,
			sendInput,
			request,
			enterRoom,
			leaveRoom,
			startGame,
			setMode,
			refreshLeaderboard,
		}),
		[
			socket,
			connected,
			game,
			room,
			rooms,
			spectrums,
			winner,
			allPlayersDone,
			leaderboard,
			sendMessage,
			sendInput,
			request,
			enterRoom,
			leaveRoom,
			startGame,
			setMode,
			refreshLeaderboard,
		]
	);

	return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export default SocketProvider;

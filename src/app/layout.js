import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { SocketProvider } from "@/context/SocketContext";

export const metadata = {
	title: "Red Tetris",
	description: "Networked multiplayer Tetris",
};

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body className="antialiased">
				<ToastProvider>
					<SocketProvider>{children}</SocketProvider>
				</ToastProvider>
			</body>
		</html>
	);
}

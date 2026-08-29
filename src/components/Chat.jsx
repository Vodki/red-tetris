import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "./Chat.css";

export const MAX_CHAT_LENGTH = 200;

/**
 * Bonus: the in-room chat. Players and spectators share the same channel; the
 * server is the only one who knows who said what.
 *
 * Pure flexbox, no <table>, no DOM manipulation - the scroll position is the
 * one thing a ref is allowed to touch.
 */
const Chat = ({ messages = [], onSend, disabled = false, selfId = null }) => {
	const [draft, setDraft] = useState("");
	const listRef = useRef(null);

	// Follow the conversation as it grows.
	useEffect(() => {
		const list = listRef.current;
		if (list) list.scrollTop = list.scrollHeight;
	}, [messages]);

	const handleSubmit = (event) => {
		event.preventDefault();
		const text = draft.trim();
		if (!text || disabled) return;
		if (onSend) onSend(text);
		setDraft("");
	};

	return (
		<div className="chat">
			<h3 className="chat-title">Chat</h3>

			<div className="chat-messages" ref={listRef} aria-label="chat messages">
				{messages.length === 0 ? (
					<p className="chat-empty">Nothing said yet.</p>
				) : (
					messages.map((message, index) => (
						<p
							key={`${message.date}-${index}`}
							className={`chat-message${
								message.socketId === selfId ? " chat-message-self" : ""
							}`}
						>
							<span className="chat-author">
								{message.username}
								{message.spectator ? " 👁" : ""}
							</span>
							<span className="chat-text">{message.text}</span>
						</p>
					))
				)}
			</div>

			<form className="chat-form" onSubmit={handleSubmit}>
				<Input
					aria-label="chat message"
					placeholder={disabled ? "Join a room to chat" : "Say something…"}
					value={draft}
					maxLength={MAX_CHAT_LENGTH}
					disabled={disabled}
					onChange={(event) => setDraft(event.target.value)}
				/>
				<Button type="submit" disabled={disabled || draft.trim().length === 0}>
					Send
				</Button>
			</form>
		</div>
	);
};

export default Chat;

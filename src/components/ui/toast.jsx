"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import "./toast.css";

const ToastContext = createContext(null);

const noop = () => {};

const fallback = {
	notify: noop,
	info: noop,
	success: noop,
	error: noop,
	dismiss: noop,
};

export const useToast = () => useContext(ToastContext) ?? fallback;

/**
 * Minimal, dependency-free notifications.
 *
 * Written on purpose instead of pulling a toast library in: the subject forbids
 * SVG, and every mainstream toast package ships SVG status icons. Layout is
 * pure flexbox, no DOM manipulation, no `this`.
 */
export const ToastProvider = ({ children, duration = 4000 }) => {
	const [toasts, setToasts] = useState([]);
	const nextId = useRef(0);
	const timers = useRef(new Map());

	const dismiss = useCallback((id) => {
		const timer = timers.current.get(id);
		if (timer) {
			clearTimeout(timer);
			timers.current.delete(id);
		}
		setToasts((current) => current.filter((toast) => toast.id !== id));
	}, []);

	const notify = useCallback(
		(message, variant = "info") => {
			if (!message) return null;
			nextId.current += 1;
			const id = nextId.current;

			setToasts((current) => [...current, { id, message: String(message), variant }]);
			timers.current.set(
				id,
				setTimeout(() => dismiss(id), duration)
			);
			return id;
		},
		[dismiss, duration]
	);

	// Clear every pending timer when the provider goes away.
	useEffect(() => {
		const pending = timers.current;
		return () => {
			pending.forEach((timer) => clearTimeout(timer));
			pending.clear();
		};
	}, []);

	// Deliberately independent from `toasts`: consumers keep the very same API
	// object for the lifetime of the provider, so putting it in an effect's
	// dependency list cannot loop.
	const value = useMemo(
		() => ({
			notify,
			dismiss,
			info: (message) => notify(message, "info"),
			success: (message) => notify(message, "success"),
			error: (message) => notify(message, "error"),
		}),
		[notify, dismiss]
	);

	return (
		<ToastContext.Provider value={value}>
			{children}
			<div className="toast-viewport" role="status" aria-live="polite">
				{toasts.map((toast) => (
					<button
						key={toast.id}
						type="button"
						className={`toast toast-${toast.variant}`}
						onClick={() => dismiss(toast.id)}
					>
						<span className="toast-message">{toast.message}</span>
						<span className="toast-close" aria-hidden="true">
							×
						</span>
					</button>
				))}
			</div>
		</ToastContext.Provider>
	);
};

export default ToastProvider;

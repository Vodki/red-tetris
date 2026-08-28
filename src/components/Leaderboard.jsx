import React from "react";
import "./Leaderboard.css";

/**
 * Bonus: the persisted best scores, served by the server's scoreboard.
 * Laid out with flexbox — the subject forbids <table>.
 */
const Leaderboard = ({ entries = [] }) => (
	<div className="leaderboard">
		<h3 className="leaderboard-title">Best scores</h3>
		{entries.length === 0 ? (
			<p className="leaderboard-empty">No score recorded yet.</p>
		) : (
			<ul className="leaderboard-list">
				{entries.map((entry, index) => (
					<li key={`${entry.username}-${entry.date}-${index}`} className="leaderboard-row">
						<span className="leaderboard-rank">{index + 1}</span>
						<span className="leaderboard-name">{entry.username}</span>
						<span className="leaderboard-score">{entry.score}</span>
					</li>
				))}
			</ul>
		)}
	</div>
);

export default Leaderboard;

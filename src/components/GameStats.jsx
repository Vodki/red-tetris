import React from "react";
import "./GameStats.css";

/** Score / level / lines panel. Bonus: the scoring system itself. */
const GameStats = ({ score = 0, level = 1, lines = 0, username }) => (
	<div className="game-stats-container">
		{username && <span className="game-stats-player">{username}</span>}
		<div className="stat-card">
			<span className="stat-label">Score</span>
			<span className="stat-value">{score}</span>
		</div>
		<div className="stat-card">
			<span className="stat-label">Level</span>
			<span className="stat-value">{level}</span>
		</div>
		<div className="stat-card">
			<span className="stat-label">Lines</span>
			<span className="stat-value">{lines}</span>
		</div>
	</div>
);

export default GameStats;

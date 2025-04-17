import React from "react";
import "./GameStats.css";

const GameStats = ({ score }) => {
  return (
    <div className="game-stats-container">
      <div className="stat-card">
        <span className="stat-label">Score</span>
        <span className="stat-value">{score}</span>
      </div>
    </div>
  );
};

export default GameStats;
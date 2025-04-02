import React from "react";
import "./GameStats.css";

const GameStats = ({ level, score }) => {
  return (
    <div className="game-stats-container">
      <div className="stat-card">
        <span className="stat-label">Level</span>
        <span className="stat-value">{level}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Score</span>
        <span className="stat-value">{score}</span>
      </div>
    </div>
  );
};

export default GameStats;
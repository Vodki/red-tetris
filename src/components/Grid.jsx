import React from "react";
import "./Grid.css";

const Grid = React.memo(({ grid }) => (
  <div className="grid">
    {grid.map((row, rowIndex) => (
      <div key={rowIndex} className="row">
        {row.map((cell, cellIndex) => (
          <div
            key={cellIndex}
            className={`cell ${cell !== 0 ? `color-${cell}` : ''}`}
          />
        ))}
      </div>
    ))}
  </div>
));

export default Grid;
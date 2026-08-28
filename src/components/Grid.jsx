import React from "react";
import "./Grid.css";

/**
 * The player's own field. Pure presentation: it renders exactly the grid the
 * server sent. Flexbox rows and cells — no <table>, no canvas, no SVG.
 */
const Grid = React.memo(({ grid = [] }) => (
	<div className="grid" aria-label="playing field">
		{grid.map((row, rowIndex) => (
			<div key={rowIndex} className="row">
				{row.map((cell, cellIndex) => (
					<div
						key={cellIndex}
						className={`cell${cell !== 0 ? ` color-${cell}` : ""}`}
					/>
				))}
			</div>
		))}
	</div>
));

Grid.displayName = "Grid";

export default Grid;

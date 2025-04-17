import React from "react";
import "./Grid.css";

const Grid = React.memo(({ grid, isOpponent }) => (
	<div className="grid">
		{grid.map((row, rowIndex) => (
			<div key={rowIndex} className="row">
				{row.map((cell, cellIndex) => (
					<div
						key={cellIndex}
						className={`
							${isOpponent ? "opponent-cell" : "cell"}
							${cell !== 0 ? (isOpponent ? "opponent-filled" : `color-${cell}`) : ""}
						  `.trim()}
					/>
				))}
			</div>
		))}
	</div>
));

export default Grid;

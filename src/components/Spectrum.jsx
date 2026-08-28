import React from "react";
import { spectrumToGrid } from "@/game/pure/board";
import "./Spectrum.css";

/**
 * The opponents' view required by the subject: only the height of each column
 * is known, never the actual content of their field.
 */
const Spectrum = React.memo(({ spectrum = [], rows = 20 }) => {
	const grid = spectrumToGrid(spectrum.length > 0 ? spectrum : Array(10).fill(0), rows);

	return (
		<div className="spectrum" aria-label="opponent spectrum">
			{grid.map((row, rowIndex) => (
				<div key={rowIndex} className="spectrum-row">
					{row.map((cell, cellIndex) => (
						<div
							key={cellIndex}
							className={`spectrum-cell${cell !== 0 ? " spectrum-cell-filled" : ""}`}
						/>
					))}
				</div>
			))}
		</div>
	);
});

Spectrum.displayName = "Spectrum";

export default Spectrum;

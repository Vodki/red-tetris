import React from "react";
import "./NextPiece.css";

const SIZE = 4;

/**
 * Preview of a piece, rendered from the block offsets sent by the server and
 * centred in a 4×4 box. Used for the next piece of the shared sequence and,
 * with another label, for the bonus "hold" slot.
 */
const NextPiece = React.memo(({ piece, label = "Next", dimmed = false }) => {
	const blocks = piece && Array.isArray(piece.shape) ? piece.shape : [];
	const offsetX = blocks.length > 0 ? Math.min(...blocks.map((block) => block.x)) : 0;
	const offsetY = blocks.length > 0 ? Math.min(...blocks.map((block) => block.y)) : 0;

	const filled = new Set(
		blocks.map((block) => `${block.x - offsetX},${block.y - offsetY}`)
	);

	return (
		<div className={`next-piece${dimmed ? " next-piece-dimmed" : ""}`}>
			<span className="next-piece-label">{label}</span>
			<div className="next-piece-box">
				{Array.from({ length: SIZE }, (_, y) => (
					<div key={y} className="next-piece-row">
						{Array.from({ length: SIZE }, (_, x) => (
							<div
								key={x}
								className={`next-piece-cell${
									filled.has(`${x},${y}`) ? ` color-${piece.color}` : ""
								}`}
							/>
						))}
					</div>
				))}
			</div>
		</div>
	);
});

NextPiece.displayName = "NextPiece";

export default NextPiece;

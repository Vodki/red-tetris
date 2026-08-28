/**
 * Pure game rules: scoring, levelling and game modes.
 */

/** Mandatory rules: pieces fall at a constant speed. */
export const BASE_SPEED = 500;

export const CLASSIC = 'classic';
export const GRAVITY = 'gravity';
export const INVISIBLE = 'invisible';

/** `classic` is the mandatory mode; the other two are bonus game modes. */
export const GAME_MODES = [CLASSIC, GRAVITY, INVISIBLE];

export const DEFAULT_MODE = CLASSIC;

export const GAME_MODE_LABELS = {
  [CLASSIC]: 'Classic',
  [GRAVITY]: 'Increased gravity',
  [INVISIBLE]: 'Invisible pieces',
};

export const isGameMode = (mode) => GAME_MODES.includes(mode);

export const normalizeMode = (mode) => (isGameMode(mode) ? mode : DEFAULT_MODE);

/** Points awarded for clearing 0…4 lines at once, before the level multiplier. */
export const LINE_SCORES = [0, 100, 300, 500, 800];

export const scoreForLines = (lines, level = 1) =>
  (LINE_SCORES[lines] ?? 0) * Math.max(1, level);

/** One level every ten cleared lines. */
export const levelForLines = (clearedLines) => Math.floor(clearedLines / 10) + 1;

/**
 * Falling speed, in milliseconds per frame.
 * Constant in the mandatory modes; only the `gravity` bonus mode speeds up.
 */
export const speedForLevel = (level, mode = DEFAULT_MODE) => {
  if (mode !== GRAVITY) return BASE_SPEED;
  return Math.max(80, BASE_SPEED - (Math.max(1, level) - 1) * 45);
};

/** The pile is hidden in the `invisible` bonus mode. */
export const pileIsHidden = (mode) => mode === INVISIBLE;

/** Number of penalty lines sent to the opponents after clearing `lines` lines. */
export const penaltyForLines = (lines) => Math.max(0, lines - 1);

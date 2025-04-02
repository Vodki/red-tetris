export const createEmptyGrid = (rows = 20, cols = 10) => {
    return Array(rows).fill(0).map(() => Array(cols).fill(0));
  };
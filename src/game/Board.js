export class Board {
    constructor() {
      this.grid = Array.from({ length: 20 }, () => 
        Array.from({ length: 10 }, () => 0)
      );
    }
  
    gridCopy() {
      return this.grid.map(row => [...row]);
    }
  
    addPenality(nb) {
      for (let i = 0; i < this.grid.length - nb; i++) {
        if (i <= nb - 1 && !this.lineIsEmpty(i)) {
          return 0;
        }
        this.grid[i] = this.grid[i + nb].slice();
      }
      for (let i = this.grid.length - nb; i < this.grid.length ; i++) {
        this.grid[i].fill(-1);
      }
      return 1;
    }

    fillBoard(x, y, color) {
      if (x >= 0 && y >= 0 && y < this.grid.length && x < this.grid[0].length) {
        this.grid[y][x] = color;
      }
    }
  
    lineIsEmpty(y) {
      return this.grid[y].every(cell => cell == 0);
    }

    lineIsFull(y) {
      return this.grid[y].every(cell => cell > 0);
    }
  
    clearFullLines() {
      let total = 0;
      const filledLines = [];
      
      // Bottom-up iteration
      for (let i = this.grid.length - 1; i >= 0; i--) {
        if (this.lineIsFull(i)) {
          filledLines.push(i);
          total++;
        } else if (filledLines.length > 0) {
          this.clearLines(filledLines);
          i = this.grid.length; // Reset loop
          filledLines.length = 0;
        }
      }
      
      // Clear any remaining filled lines
      if (filledLines.length > 0) {
        this.clearLines(filledLines);
      }
      
      return total;
    }
  
    clearLines(lines) {
      const linesToClear = new Set(lines);
      const newGrid = this.grid.filter((_, index) => !linesToClear.has(index));
      const removedLines = this.grid.length - newGrid.length;
      
      // Add empty lines at the top
      this.grid = [
        ...Array.from({ length: removedLines }, () => 
          Array(this.grid[0].length).fill(0)
        ),
        ...newGrid
      ];
    }
  }
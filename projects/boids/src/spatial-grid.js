/**
 * SpatialGrid — accelerate neighbor lookups
 */

class SpatialGrid {
  constructor(width, height, cellSize) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.cells = new Array(this.cols * this.rows);
    this.clear();
  }

  clear() {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = [];
    }
  }

  _cellIndex(x, y) {
    const col = Math.floor(x / this.cellSize) % this.cols;
    const row = Math.floor(y / this.cellSize) % this.rows;
    return ((row + this.rows) % this.rows) * this.cols + ((col + this.cols) % this.cols);
  }

  insert(boid) {
    const idx = this._cellIndex(boid.position.x, boid.position.y);
    this.cells[idx].push(boid);
  }

  getNeighbors(boid, radius) {
    const neighbors = [];
    const cells = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(boid.position.x / this.cellSize);
    const cy = Math.floor(boid.position.y / this.cellSize);
    const r2 = radius * radius;

    for (let dy = -cells; dy <= cells; dy++) {
      for (let dx = -cells; dx <= cells; dx++) {
        const col = ((cx + dx) % this.cols + this.cols) % this.cols;
        const row = ((cy + dy) % this.rows + this.rows) % this.rows;
        const idx = row * this.cols + col;
        for (const other of this.cells[idx]) {
          if (other !== boid && boid.position.distSq(other.position) < r2) {
            neighbors.push(other);
          }
        }
      }
    }
    return neighbors;
  }
}

module.exports = { SpatialGrid };

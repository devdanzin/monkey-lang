/**
 * Flock — the main simulation
 * 
 * Three rules:
 * 1. Separation: avoid crowding neighbors
 * 2. Alignment: steer toward average heading of neighbors
 * 3. Cohesion: steer toward average position of neighbors
 */
const { Vec2 } = require('./vec2.js');
const { Boid } = require('./boid.js');
const { SpatialGrid } = require('./spatial-grid.js');

const DEFAULT_CONFIG = {
  width: 800,
  height: 600,
  numBoids: 100,
  maxSpeed: 4,
  maxForce: 0.1,
  separationRadius: 25,
  alignmentRadius: 50,
  cohesionRadius: 50,
  separationWeight: 1.5,
  alignmentWeight: 1.0,
  cohesionWeight: 1.0,
  avoidanceRadius: 100,
  avoidanceWeight: 2.0,
  boundaryMode: 'wrap', // 'wrap' | 'bounce' | 'steer'
  boundaryMargin: 50,
  windX: 0,
  windY: 0,
  predatorSpeed: 3,
  predatorChase: true, // AI predator chases nearest boid
};

class Flock {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.boids = [];
    this.obstacles = []; // {position: Vec2, radius: number}
    this.predators = []; // {position: Vec2}
    this.grid = new SpatialGrid(
      this.config.width, this.config.height,
      Math.max(this.config.separationRadius, this.config.alignmentRadius, this.config.cohesionRadius)
    );
  }

  addBoid(x, y, vx, vy) {
    const boid = new Boid(x, y, vx, vy);
    this.boids.push(boid);
    return boid;
  }

  addRandomBoids(n) {
    for (let i = 0; i < n; i++) {
      const x = Math.random() * this.config.width;
      const y = Math.random() * this.config.height;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      this.addBoid(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed);
    }
  }

  addObstacle(x, y, radius = 20) {
    this.obstacles.push({ position: new Vec2(x, y), radius });
  }

  addPredator(x, y) {
    this.predators.push({ position: new Vec2(x, y) });
  }

  update(dt = 1) {
    // Rebuild spatial grid
    this.grid.clear();
    for (const boid of this.boids) {
      this.grid.insert(boid);
    }

    // Calculate forces for each boid
    for (const boid of this.boids) {
      const sep = this._separation(boid);
      const ali = this._alignment(boid);
      const coh = this._cohesion(boid);
      const avoid = this._avoidance(boid);
      const flee = this._flee(boid);

      boid.applyForce(sep.mul(this.config.separationWeight));
      boid.applyForce(ali.mul(this.config.alignmentWeight));
      boid.applyForce(coh.mul(this.config.cohesionWeight));
      boid.applyForce(avoid.mul(this.config.avoidanceWeight));
      boid.applyForce(flee.mul(3.0)); // strong flee

      // Wind force
      if (this.config.windX !== 0 || this.config.windY !== 0) {
        boid.applyForce(new Vec2(this.config.windX, this.config.windY));
      }

      // Boundary steering (for 'steer' mode)
      if (this.config.boundaryMode === 'steer') {
        boid.applyForce(this._boundarySteer(boid));
      }
    }

    // Update predator AI
    if (this.config.predatorChase) {
      this._updatePredators(dt);
    }

    // Update positions
    for (const boid of this.boids) {
      boid.update(this.config.maxSpeed, dt);
      if (this.config.boundaryMode === 'wrap') {
        boid.wrapEdges(this.config.width, this.config.height);
      } else if (this.config.boundaryMode === 'bounce') {
        this._bounceEdges(boid);
      }
      // 'steer' mode: boids steer away from edges (handled in forces above)
      // but still clamp as safety net
      if (this.config.boundaryMode === 'steer') {
        boid.position.x = Math.max(0, Math.min(this.config.width, boid.position.x));
        boid.position.y = Math.max(0, Math.min(this.config.height, boid.position.y));
      }
    }
  }

  _separation(boid) {
    const neighbors = this.grid.getNeighbors(boid, this.config.separationRadius);
    if (neighbors.length === 0) return new Vec2(0, 0);

    let steer = new Vec2(0, 0);
    for (const other of neighbors) {
      const diff = boid.position.sub(other.position);
      const d = diff.length();
      if (d > 0) steer = steer.add(diff.normalize().div(d)); // weight by distance
    }
    steer = steer.div(neighbors.length);
    if (steer.length() > 0) {
      steer = steer.normalize().mul(this.config.maxSpeed).sub(boid.velocity);
      steer = steer.limit(this.config.maxForce);
    }
    return steer;
  }

  _alignment(boid) {
    const neighbors = this.grid.getNeighbors(boid, this.config.alignmentRadius);
    if (neighbors.length === 0) return new Vec2(0, 0);

    let avgVel = new Vec2(0, 0);
    for (const other of neighbors) {
      avgVel = avgVel.add(other.velocity);
    }
    avgVel = avgVel.div(neighbors.length);
    let steer = avgVel.normalize().mul(this.config.maxSpeed).sub(boid.velocity);
    return steer.limit(this.config.maxForce);
  }

  _cohesion(boid) {
    const neighbors = this.grid.getNeighbors(boid, this.config.cohesionRadius);
    if (neighbors.length === 0) return new Vec2(0, 0);

    let center = new Vec2(0, 0);
    for (const other of neighbors) {
      center = center.add(other.position);
    }
    center = center.div(neighbors.length);
    let desired = center.sub(boid.position);
    if (desired.length() > 0) {
      desired = desired.normalize().mul(this.config.maxSpeed);
      let steer = desired.sub(boid.velocity);
      return steer.limit(this.config.maxForce);
    }
    return new Vec2(0, 0);
  }

  _avoidance(boid) {
    let steer = new Vec2(0, 0);
    for (const obs of this.obstacles) {
      const d = boid.position.dist(obs.position);
      if (d < obs.radius + this.config.avoidanceRadius) {
        const diff = boid.position.sub(obs.position).normalize();
        const urgency = 1 - (d / (obs.radius + this.config.avoidanceRadius));
        steer = steer.add(diff.mul(urgency));
      }
    }
    return steer.limit(this.config.maxForce);
  }

  _flee(boid) {
    let steer = new Vec2(0, 0);
    for (const pred of this.predators) {
      const d = boid.position.dist(pred.position);
      if (d < 150) {
        const diff = boid.position.sub(pred.position).normalize();
        const urgency = 1 - (d / 150);
        steer = steer.add(diff.mul(urgency * 2));
      }
    }
    return steer.limit(this.config.maxForce * 2);
  }

  _bounceEdges(boid) {
    const w = this.config.width;
    const h = this.config.height;
    if (boid.position.x <= 0) { boid.position.x = 0; boid.velocity.x = Math.abs(boid.velocity.x); }
    if (boid.position.x >= w) { boid.position.x = w; boid.velocity.x = -Math.abs(boid.velocity.x); }
    if (boid.position.y <= 0) { boid.position.y = 0; boid.velocity.y = Math.abs(boid.velocity.y); }
    if (boid.position.y >= h) { boid.position.y = h; boid.velocity.y = -Math.abs(boid.velocity.y); }
  }

  _boundarySteer(boid) {
    const margin = this.config.boundaryMargin;
    const w = this.config.width;
    const h = this.config.height;
    const force = this.config.maxForce * 2;
    let steer = new Vec2(0, 0);
    if (boid.position.x < margin) steer.x = force * (1 - boid.position.x / margin);
    if (boid.position.x > w - margin) steer.x = -force * (1 - (w - boid.position.x) / margin);
    if (boid.position.y < margin) steer.y = force * (1 - boid.position.y / margin);
    if (boid.position.y > h - margin) steer.y = -force * (1 - (h - boid.position.y) / margin);
    return steer;
  }

  _updatePredators(dt) {
    for (const pred of this.predators) {
      // Find nearest boid
      let nearest = null;
      let nearestDist = Infinity;
      for (const boid of this.boids) {
        const d = boid.position.dist(pred.position);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = boid;
        }
      }
      if (nearest && nearestDist < 500) {
        // Chase the nearest boid
        const dir = nearest.position.sub(pred.position).normalize();
        pred.position = pred.position.add(dir.mul(this.config.predatorSpeed * dt));
      }
    }
  }

  // ─── Analysis ────────────────────────────────────

  avgSpeed() {
    if (this.boids.length === 0) return 0;
    return this.boids.reduce((sum, b) => sum + b.velocity.length(), 0) / this.boids.length;
  }

  avgNeighborCount(radius) {
    if (this.boids.length === 0) return 0;
    let total = 0;
    for (const boid of this.boids) {
      total += this.grid.getNeighbors(boid, radius).length;
    }
    return total / this.boids.length;
  }

  centerOfMass() {
    if (this.boids.length === 0) return new Vec2(0, 0);
    let center = new Vec2(0, 0);
    for (const boid of this.boids) {
      center = center.add(boid.position);
    }
    return center.div(this.boids.length);
  }

  avgAlignment() {
    if (this.boids.length === 0) return 0;
    let avgVel = new Vec2(0, 0);
    for (const boid of this.boids) {
      avgVel = avgVel.add(boid.velocity.normalize());
    }
    return avgVel.div(this.boids.length).length(); // 0 = random, 1 = perfectly aligned
  }

  stats() {
    return {
      count: this.boids.length,
      avgSpeed: this.avgSpeed(),
      avgAlignment: this.avgAlignment(),
      centerOfMass: this.centerOfMass(),
    };
  }
}

module.exports = { Flock, Boid, Vec2, SpatialGrid, DEFAULT_CONFIG };

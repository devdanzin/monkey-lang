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
    }

    // Update positions
    for (const boid of this.boids) {
      boid.update(this.config.maxSpeed, dt);
      boid.wrapEdges(this.config.width, this.config.height);
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

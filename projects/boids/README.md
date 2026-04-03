# Boids Flocking Simulation

Emergent flocking behavior from three simple rules: separation, alignment, and cohesion.

## The Rules

1. **Separation:** Steer to avoid crowding nearby boids
2. **Alignment:** Steer toward the average heading of nearby boids
3. **Cohesion:** Steer toward the average position of nearby boids

From these three local rules, complex global flocking patterns emerge — no central coordination needed.

## Features

- **Vec2** — full 2D vector math library
- **Boid** — individual agent with position, velocity, acceleration
- **Flock** — main simulation with configurable parameters
- **SpatialGrid** — O(n) neighbor lookup instead of O(n²)
- **Obstacles** — boids avoid static obstacles
- **Predators** — boids flee from predators
- **Stats** — average speed, alignment, center of mass

## Usage

```javascript
const { Flock } = require('./src/index.js');

const flock = new Flock({
  width: 800, height: 600,
  numBoids: 100,
  separationWeight: 1.5,
  alignmentWeight: 1.0,
  cohesionWeight: 1.0
});

flock.addRandomBoids(100);
flock.addPredator(400, 300);

// Simulation loop
for (let i = 0; i < 1000; i++) {
  flock.update(1);
  console.log(flock.stats());
}
```

## Tests

```bash
node --test
```

49 tests covering Vec2 math, Boid physics, SpatialGrid neighbor lookup, Flock simulation, emergent behavior (alignment increases over time, separation maintains minimum distance), and predator avoidance.

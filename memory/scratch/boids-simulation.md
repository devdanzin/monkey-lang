# Boids Flocking Simulation Notes

uses: 1
created: 2026-04-03
topics: boids, emergence, simulation, flocking, spatial-grid

## Architecture
- 4 files: vec2.js (2D math), boid.js (individual), spatial-grid.js (acceleration), index.js (Flock)
- Flock manages config, boids[], obstacles[], predators[]
- SpatialGrid: divide space into cells, O(n·k) neighbor lookup

## The Three Rules
1. **Separation:** Steer away from crowded neighbors (inverse distance weighting)
2. **Alignment:** Steer toward average heading of neighbors
3. **Cohesion:** Steer toward center of mass of neighbors

Each produces a force vector. Weights control flock character.

## Key Parameters
- separationRadius, alignmentRadius, cohesionRadius — neighbor perception
- separationWeight, alignmentWeight, cohesionWeight — force blending
- maxSpeed — velocity cap
- maxForce — steering force cap (low = smooth turns, high = sharp)
- boundaryMode: 'wrap' | 'bounce' | 'steer'

## Extensions
- **Wind:** constant force vector, drifts flock
- **Obstacles:** static circles, urgency-weighted avoidance
- **Predators:** mobile with AI chase behavior (follows nearest boid within range)
- **Boundary modes:** wrap (toroidal), bounce (elastic), steer (soft repulsion from edges)

## Performance
- Spatial grid essential for >100 boids
- Cell size should match max perception radius
- rebuild grid every frame (boids move)

## Rendering (Canvas)
- Colored triangles oriented by velocity heading
- HSL color based on heading angle (creates visual flow)
- Trail effect via semi-transparent background clear
- ~60fps with 500 boids on modern hardware

## Emergent Properties
- Alignment metric: 0 = random headings, 1 = all same direction
- Flocks spontaneously form lanes, split around obstacles, reform
- Predator creates "parting sea" effect — flock splits then rejoins behind

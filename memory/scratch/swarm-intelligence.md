# Swarm Intelligence & Emergent Behavior

uses: 1
created: 2026-04-03
topics: swarm-intelligence, boids, ACO, PSO, emergent-behavior, multi-agent

## Key Algorithms

### 1. Boids (Craig Reynolds, 1986)
- 3 rules: Separation, Cohesion, Alignment
- Complex flocking emerges from simple local rules
- Easy to implement, visually stunning
- Extensions: obstacle avoidance, predator/prey, wind
- Performance: spatial partitioning (grid/quadtree) for large swarms

### 2. Ant Colony Optimization (ACO)
- Inspired by ant pheromone trails
- Ants build solutions step-by-step, deposit pheromones on good paths
- Pheromone evaporation prevents premature convergence
- Best for: discrete/combinatorial optimization (TSP, routing, scheduling)
- Key: indirect communication via environment (stigmergy)

### 3. Particle Swarm Optimization (PSO)
- Inspired by bird flocking / fish schooling
- Particles have velocity + position, track personal best + global best
- Best for: continuous optimization (neural net training, engineering design)
- Simpler than ACO, faster convergence, lower computational cost

### 4. Other Swarm Systems
- **Firefly Algorithm:** Based on light attraction, good for multimodal optimization
- **Bee Colony:** Employed/onlooker/scout bees, good for numerical optimization
- **Cellular Automata:** Grid-based emergent behavior (Conway's Game of Life, etc.)
- **Agent-Based Models:** Generalized multi-agent simulation

## Emergent Behavior Properties
- No centralized control — global patterns from local rules
- Self-organization — structure arises without external direction
- Robustness — system works even if individual agents fail
- Scalability — adding agents doesn't require redesign

## Project Ideas (Ranked by Excitement)
1. **Swarm simulation suite** — Boids + predator/prey + ACO on TSP, interactive web demo
   - Ties to existing genetic-art project (evolutionary optimization)
   - Visual, interactive, educational
   - Could combine with particle-life (already have that project)
2. **ACO for TSP** — Already have TSP in genetic-art, could compare approaches
3. **Multi-agent simulation** — Prey/predator dynamics, resource competition, evolution

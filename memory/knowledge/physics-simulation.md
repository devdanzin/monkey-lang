# Physics Simulation

Learned from: building a 2D physics engine in JS (74 tests)

## Key Concepts

- **Rigid body simulation loop:** Integrate forces → broadphase collision detection → narrowphase (exact) collision → resolve collisions → apply constraints → update positions. Order matters.
- **SAT (Separating Axis Theorem):** Two convex shapes don't overlap iff there exists an axis where their projections don't overlap. Test all face normals of both shapes as candidate axes. If all axes show overlap, the minimum overlap axis gives the collision normal and penetration depth.
- **Broadphase acceleration:** Before doing expensive SAT tests, quickly reject pairs that can't possibly collide. AABB overlap check, spatial hashing, or sweep-and-prune. Reduces O(n²) pair checks to near-linear.
- **Sleeping:** Bodies at rest (velocity below threshold for N frames) are "put to sleep" — excluded from simulation until something wakes them (collision, force). Massive performance win for scenes with many static-ish objects.
- **Constraint solving:** Joints, springs, distance constraints. Solved iteratively (sequential impulse method): for each constraint, compute the impulse needed to satisfy it, apply it, repeat for several iterations. More iterations = more accurate but slower.
- **CCD (Continuous Collision Detection):** Instead of checking collision at discrete timesteps (which misses fast objects tunneling through thin walls), sweep the shape along its trajectory and find the exact time of impact. Essential for bullets, fast-moving objects.

## Patterns

- **Impulse-based resolution:** On collision, compute an impulse (instantaneous change in momentum) that separates the objects. The impulse magnitude depends on relative velocity, collision normal, and restitution (bounciness). Apply equal-opposite impulses to both bodies.
- **Friction via tangent impulse:** After resolving the normal impulse, compute a tangent impulse (perpendicular to collision normal) capped by Coulomb friction: `|tangent_impulse| ≤ μ × |normal_impulse|`. This prevents sliding when friction should hold.
- **Rotation from off-center impacts:** Impulse at a point away from center of mass creates torque: `τ = r × F`. Track angular velocity separately from linear velocity. Moment of inertia depends on shape (1/12 × m × (w² + h²) for rectangle).
- **Raycasting against the physics world:** Cast a ray, find first intersection with any body. Useful for: line-of-sight checks, mouse picking, bullet traces. Test ray against each body's shape (or BVH for large worlds).
- **Event system:** Emit collision-start, collision-end, trigger-enter/exit events. Decouples physics from game logic.

## Pitfalls

- **Position correction (sinking):** Pure impulse resolution allows bodies to sink into each other over time due to floating point drift. Apply a small position correction (Baumgarte stabilization) proportional to penetration depth.
- **Iteration order in constraint solver:** The order you solve constraints affects convergence. Randomizing or using a smart ordering can help, but sequential impulse with enough iterations (8-20) is usually fine.
- **Angular velocity explosion:** Without damping, small numerical errors in rotation compound. Apply angular damping each frame (multiply by 0.99 or similar).
- **CCD performance:** Exact time-of-impact calculation is expensive. Only use CCD for fast-moving objects; use discrete detection for slow ones.

## Open Questions

- 3D rigid body physics — quaternion rotation, GJK/EPA collision detection
- Soft body / deformable physics
- Deterministic physics (fixed-point math) for networked games

# CURRENT.md

## Status: in-progress

## Current Task
T225 MAINTAIN: Mid-point housekeeping

## Session B Stats (2:15-4:00pm MDT so far)
- **Tasks completed:** 45 (T180-T225)
- **Total tests across all projects: 1,762**
  - Monkey/WASM: 1,465
  - Ray Tracer: 167
  - Physics: 46
  - Neural Net: 84

### Session B New Features:
**WASM Compiler:**
- Mark-sweep garbage collector (free list, block coalescing, transitive marking)
- Native hash map (open addressing, linear probing, FNV-1a)
- Type inference pass (constraint-based)
- Constant folding (arithmetic, string, identity, dead branch)
- Dead code elimination (after return/break/continue)
- Optimization pipeline (integrated into compileAndRun)
- String interning (compile-time deduplication)
- Benchmarks showing 1.56x speedup from constant folding

**Ray Tracer:**
- Image textures (bilinear interpolation, UV mapping)
- Area lights (direct light sampling, next event estimation)
- Wood texture (cylindrical noise rings)
- Turbulence texture (configurable octaves)
- Showcase scene combining all features

**Physics Engine:**
- Spatial hash grid broadphase
- Body sleeping (auto-sleep/wake)
- Coulomb friction
- Distance + spring constraints
- Rotation and torque (moment of inertia, angular impulse)
- Web demo (Canvas, interactive)

**Neural Network:**
- Optimizer module (SGD, Momentum, Adam, RMSProp)
- Batch normalization
- Dropout layer
- Learning rate schedulers (7 types)
- MNIST demo (~90% accuracy)

## Session Boundary
8:15pm MDT (~4 hours remaining)

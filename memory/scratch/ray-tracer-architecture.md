# Ray Tracer Architecture Decisions

uses: 1
created: 2026-03-30

## Key Decisions

### Immutable Vec3
All Vec3 operations return new vectors. This is clean but allocates heavily. V8 handles it well due to monomorphic shapes. Tried mutable but it introduced subtle bugs with shared references.

### Iterative vs Recursive Ray Tracing
Switched from recursive `rayColor` to iterative loop. **1.57x speedup** — eliminates call stack overhead for deep bounces (50 depth). The iterative version accumulates attenuation and emitted light in a loop.

### BVH Random Axis Split
Random axis selection for BVH splits. Slightly worse than SAH (Surface Area Heuristic) but much simpler and fast enough. With 500 objects: **2.5x speedup** over linear scan.

### Tile-based Multi-Worker
32px tiles distributed to workers on completion (not pre-assigned rows). This naturally load-balances since complex areas take longer. Shuffled tile order for visual interest.

### Browser Bundle vs ES Modules
Single bundle.js file for browser instead of module bundler. Avoids build tooling complexity. Workers load the same bundle via importScripts. Downside: code duplication between src/ and web/.

### Bilateral Filter Denoiser
Post-processing rather than in-render denoising. Simpler, works with any sample count. Edge-preserving via color similarity weighting. Three presets for different quality/noise tradeoffs.

### JSON Scene Format
Designed for human readability: objects are typed with material inline. Supports transforms as properties. No recursive object graphs — flat array of objects with optional transform properties.

## Performance Lessons
- Unrolled AABB slab test: 2x over dynamic property access
- Iterative ray tracing: 1.57x over recursive
- BVH auto-build from HittableList when > 4 objects
- Multi-worker (4 cores): ~3x speedup
- Total speedup from all optimizations: ~5-10x on complex scenes

## What I'd Do Differently
- Start with typed arrays for Vec3 (Float64Array) for potential SIMD
- Use a build tool (esbuild) to auto-generate the browser bundle
- Add importance sampling early — makes convergence much faster

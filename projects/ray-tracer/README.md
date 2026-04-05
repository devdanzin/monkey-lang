# ray-tracer 🌅

A physically-based path tracer built from scratch in JavaScript. Renders photorealistic images with global illumination, reflections, refractions, and soft shadows.

## Features

### Geometry
- **Spheres** — Implicit surface, exact intersection
- **Triangles** — Möller-Trumbore algorithm, smooth shading with vertex normals
- **Triangle meshes** — OBJ loading support
- **Axis-Aligned Bounding Boxes** — Ray-AABB intersection for BVH

### Materials
- **Lambertian** — Diffuse (matte) surfaces with cosine-weighted hemisphere sampling
- **Metal** — Perfect and rough (fuzzy) reflections
- **Dielectric** — Glass/water with refraction, Fresnel reflectance (Schlick's approximation)
- **Emissive** — Light-emitting materials for area lights

### Rendering
- **Monte Carlo path tracing** — Unbiased global illumination
- **Multi-sample anti-aliasing** — Configurable samples per pixel
- **Bounding Volume Hierarchy** — O(log n) ray-scene intersection via SAH
- **Depth-of-field** — Thin lens model with aperture control
- **Motion blur** — Time-sampled ray generation
- **Gamma correction** — sRGB output

### Textures
- **Solid color** — Flat albedo
- **Checker pattern** — 3D procedural checkerboard
- **Image textures** — UV-mapped bitmap textures
- **Perlin noise** — Procedural marble/turbulence effects

### Camera
- Configurable field of view, aspect ratio, look-at target
- Aperture and focus distance for depth of field
- Up vector for arbitrary orientation

## Architecture

```
src/
├── vec3.js          — 3D vector math (dot, cross, reflect, refract, random)
├── ray.js           — Ray representation with time parameter
├── sphere.js        — Sphere intersection and UV coordinates
├── triangle.js      — Triangle intersection (Möller-Trumbore)
├── hittable.js      — Abstract hittable interface, HitRecord, HittableList
├── aabb.js          — Axis-Aligned Bounding Box
├── bvh.js           — Bounding Volume Hierarchy with SAH
├── material.js      — Lambertian, Metal, Dielectric, Emissive materials
├── texture.js       — SolidColor, Checker, Image, Perlin textures
├── camera.js        — Camera with DOF and motion blur
├── renderer.js      — Path tracer core loop
├── scene.js         — Scene description and loading
├── ppm.js           — PPM image output
└── *.test.js        — 91 tests
```

## Rendering Pipeline

```
Camera → Ray Generation → BVH Traversal → Intersection Test
    ↓
Material Scatter → Recursive Path Trace → Color Accumulation
    ↓
Gamma Correction → PPM/PNG Output
```

## Math

The engine uses `Vec3` for all 3D operations:
- **Addition/Subtraction** — Vector arithmetic
- **Dot product** — Projection, angle computation
- **Cross product** — Normal computation, coordinate frames
- **Reflection** — `v - 2*dot(v,n)*n`
- **Refraction** — Snell's law with total internal reflection
- **Random sampling** — Unit sphere, hemisphere, disk

## Tests

```bash
node --test src/*.test.js
```

91 tests across 3 files:
- **vec3.test.js** (38) — Vector math, ray construction
- **geometry.test.js** (20) — Sphere, AABB, HittableList intersection
- **material.test.js** (16) — Camera, Lambertian, Metal, Dielectric, textures
- **advanced.test.js** (17) — BVH, triangles, linear/BVH consistency

## Design Decisions

- **Pure JavaScript** — No WebGL, no GPU. CPU-only for learning
- **Immutable approach** — Vector operations return new vectors
- **Monte Carlo** — True path tracing, not Whitted-style ray tracing
- **BVH** — Essential for scenes with many objects
- **PPM output** — Simplest image format, no dependencies

## References

- Shirley, P. (2020). *Ray Tracing in One Weekend* series
- Pharr, M., Jakob, W., & Humphreys, G. (2016). *Physically Based Rendering*
- Möller, T. & Trumbore, B. (1997). "Fast, Minimum Storage Ray-Triangle Intersection"

## License

MIT

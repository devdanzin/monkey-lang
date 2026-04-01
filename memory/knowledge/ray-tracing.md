# Ray Tracing

Learned from: building a path tracer in JS (194 tests, live demo)

## Key Concepts

- **Path tracing core loop:** For each pixel, cast rays, bounce off surfaces (up to maxDepth), accumulate color × attenuation. Sky/environment is the terminal light source for rays that escape.
- **Importance sampling:** Instead of scattering rays randomly from a hit point, bias them toward light sources using a mixture PDF (cosine-weighted hemisphere + light-directed). Dramatically reduces noise for the same sample count. The PDF value divides the BRDF to maintain unbiasedness.
- **BVH (Bounding Volume Hierarchy):** SAH (Surface Area Heuristic) construction. Recursively split objects by the axis/position that minimizes expected intersection cost: `cost = traversal_cost + SA_left/SA_parent × N_left + SA_right/SA_parent × N_right`. Turns O(n) intersection tests into O(log n).
- **Materials as scattering functions:** Each material (Lambertian, Metal, Dielectric, etc.) returns an attenuation color and a scattered ray. Dielectrics use Schlick's approximation for Fresnel reflectance.
- **Microfacet BRDF:** GGX/Trowbridge-Reitz distribution for rough metallic surfaces. Three components: distribution function D, geometry/shadowing G (Smith), and Fresnel F. More physically accurate than simple metal reflection.
- **Bokeh depth of field:** Camera generates rays from a random point within a lens disk. Focus plane at a set distance — objects closer/farther get circular blur (bokeh). Lens radius controls blur amount.

## Patterns

- **Iterative vs recursive ray bouncing:** Loop with currentRay/currentAttenuation instead of recursion. Avoids stack overflow on deep paths, easier to reason about.
- **Epsilon offset (0.001):** When casting secondary rays from a hit point, offset tmin to avoid self-intersection (shadow acne). Universal pattern in ray tracing.
- **CSG (Constructive Solid Geometry):** Union, intersection, difference of shapes. Implemented by tracking ray intervals through each primitive and combining them with set operations.
- **Scene serialization:** JSON scene format for export/import. Enables sharing scenes, benchmarking with consistent inputs.
- **Denoising as post-process:** Bilateral filter and box blur to clean up noisy low-sample renders. Cheaper than more samples.

## Pitfalls

- **Importance sampling requires matching PDF:** If you bias ray directions toward lights, you MUST divide by the PDF to keep the estimator unbiased. Forgetting this causes brightness artifacts.
- **BVH construction performance:** SAH evaluation over all split candidates is O(n²) per node. For large scenes, binned SAH (evaluate a fixed number of bins) is necessary.
- **Floating point in geometric intersections:** Numerical precision issues show up as dark speckles, light leaks, and shadow artifacts. The epsilon offset helps but isn't perfect for grazing angles.
- **Volume rendering (participating media):** ConstantMedium uses probabilistic scattering — a ray might pass through or scatter at a random depth. Getting the density right is tricky; too dense = opaque, too sparse = invisible.

## Open Questions

- Spectral rendering (wavelength-dependent) vs RGB — when is it worth the complexity?
- Bidirectional path tracing and MLT (Metropolis Light Transport) for difficult light paths
- GPU acceleration via WebGPU compute shaders — how much faster for this architecture?

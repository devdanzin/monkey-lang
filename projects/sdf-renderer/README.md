# sdf-renderer

A signed distance function ray marcher — sphere marching, soft shadows, ambient occlusion, and Phong shading.

## Features

### SDF Library
- **Primitives**: sphere, box, plane, torus, cylinder, capsule, rounded box
- **CSG**: union, intersection, subtraction, smooth union/subtraction/intersection
- **Transforms**: translate, rotate (X/Y/Z), scale, domain repetition
- **Normal estimation**: numerical gradient of SDF

### Ray Marcher
- **Sphere marching** with configurable max steps and surface threshold
- **Soft shadows** with penumbra parameter
- **Ambient occlusion** via multi-step distance sampling
- **Phong shading** (ambient + diffuse + specular)
- **Gamma correction**
- **Antialiasing** via multi-sample jittered rays

### Output
- PPM (Portable PixMap) image format
- Configurable resolution and camera

## Usage

```javascript
import { Renderer } from './src/renderer.js';
import { vec3 } from './src/vec3.js';
import { sdSphere, sdPlane, opUnion, opSmoothUnion, opTranslate, sdBox } from './src/sdf.js';

const scene = (p) => opUnion(
  sdPlane(p),
  opSmoothUnion(
    sdSphere(opTranslate(p, vec3(-1, 1, 0)), 1),
    sdBox(opTranslate(p, vec3(1, 1, 0)), vec3(0.8, 0.8, 0.8)),
    0.3
  )
);

const renderer = new Renderer({
  width: 640, height: 480, samples: 4,
  eye: vec3(0, 3, 6), target: vec3(0, 0.5, 0)
});

renderer.renderToFile(scene, 'output.ppm');
```

## Tests

| Module | Tests | Description |
|--------|-------|-------------|
| SDF | 32 | Primitives, CSG, transforms, normals |
| Renderer | 17 | Marching, shadows, AO, camera, output |
| **Total** | **49** | |

```bash
node --test
```

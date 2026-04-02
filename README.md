# Gargantua Cinematic Black Hole

A real-time, shader-driven black hole renderer inspired by the visual language of **Interstellar**.

This project focuses on a practical balance between:

- relativistic inspiration
- cinematic readability
- GPU-friendly rendering
- clean open source project structure

It is **not** a full scientific Kerr black hole simulator. It is a simplified implementation designed to feel convincing, dramatic, and hackable.

## Inspiration

The project is inspired by the black hole **Gargantua** from *Interstellar*, whose look was developed with support from physicist **Kip Thorne** and the visual effects team at **Double Negative**.

The goal here is to translate that idea into a compact project that can run locally in a browser and serve as a strong foundation for future physical fidelity improvements.

## What this project renders

- central black hole shadow
- gravitational-style ray bending approximation
- glowing accretion disk
- brighter relativistic side of the disk
- top and bottom visual wrap from curved-light approximation
- photon-ring style glow
- procedural background stars
- interactive free orbit camera with mouse drag and scroll zoom

## Technologies

- **Three.js** for scene bootstrapping and camera controls
- **GLSL shaders** for black hole rendering
- **Vite** for local development and build tooling
- **WebGL** for GPU execution

## Why this stack

This stack was chosen because it is:

- easy to run locally
- lightweight
- GitHub-friendly
- ideal for shader experimentation
- fast enough for real-time iteration
- simple to extend with UI, post-processing, and physical parameters

## How to run

### 1. Install dependencies

```bash
npm install
```

### 2. Start development server

```bash
npm run dev
```

### 3. Build production version

```bash
npm run build
```

### 4. Preview production build

```bash
npm run preview
```

## Camera controls

The camera is interactive and always orbits around the black hole at the center of the scene.

- **Left click + drag**: rotate around the black hole
- **Mouse wheel / trackpad scroll**: zoom in and out
- **Target**: locked to the black hole center
- **Pan**: disabled to preserve composition

This is implemented with `OrbitControls`.

## Project structure

```text
interstellar-black-hole/
├─ index.html
├─ package.json
├─ README.md
└─ src/
   ├─ main.js
   ├─ styles.css
   └─ shaders/
      ├─ blackHole.vert.glsl
      └─ blackHole.frag.glsl
```

## Implementation notes

### Rendering model

The renderer uses a fullscreen shader. Each pixel launches a view ray from the current camera.

Inside the fragment shader:

1. a ray direction is created from camera basis vectors
2. the ray is iteratively bent toward the black hole using a gravity-inspired heuristic
3. a volumetric accretion disk is sampled during stepping
4. rays crossing the event-horizon radius are absorbed
5. surviving rays sample a procedural star field background
6. a photon-ring style glow is added near strong bending zones

### What is physically inspired

- inward ray bending based on distance to the black hole
- black hole shadow region
- thin rotating accretion disk around the equatorial plane
- Doppler-like asymmetry that brightens one side of the disk
- stronger emission closer to the inner disk radius

### What is artistically approximated

- geodesic bending strength
- event horizon scale in scene units
- volumetric disk density profile
- disk turbulence and glow
- background lensing and photon ring intensity

## Limitations

This is a simplified cinematic renderer. It does **not** currently include:

- exact Kerr geodesic integration
- true relativistic redshift equations
- exact gravitational lensing of a real skybox
- physically derived accretion disk temperature models
- post-processing bloom pipeline
- physically calibrated tone mapping

## Next steps

- replace heuristic bending with better null-geodesic approximation
- add parameter controls for disk thickness, mass, spin, and glow
- add a physically lensed environment map
- implement post-processing bloom and chromatic scattering
- support higher-quality temporal sampling
- experiment with a spinning black hole frame-dragging approximation

## License suggestion

For GitHub publishing, MIT is a strong default unless you want stricter reuse control.

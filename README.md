# Real-Time Path Tracing

An experimental GPU path tracer implemented in **WebGL2** and **GLSL**.

This project was developed as part of my Computer Engineering undergraduate thesis, **"Real-Time Path Tracing Implementation"**.

Its primary objective is to explore the feasibility of bringing physically-based path tracing closer to real-time applications under the constraints of WebGL2. The project investigates Monte Carlo rendering techniques, GPU acceleration strategies, and physically-based shading while serving as an experimental platform for future research.

Although the long-term vision is fully interactive real-time rendering, the current implementation focuses on validating the rendering pipeline, acceleration structures, and light transport algorithms. Due to the computational cost of physically-based global illumination and the limitations of WebGL2, the renderer currently operates as a **progressive renderer**, refining the image over time rather than maintaining interactive frame rates.

---

## Motivation

Real-time path tracing remains one of the most demanding problems in computer graphics.

While modern GPUs increasingly support hardware-accelerated ray tracing, implementing a physically-based renderer entirely in WebGL2 presents significant computational and architectural challenges. This project investigates those challenges by implementing the complete rendering pipeline from scratch and evaluating the trade-offs between rendering quality, algorithmic complexity, and performance.

Rather than presenting a production-ready rendering engine, this repository documents the current stage of an ongoing research effort whose long-term goal is interactive physically-based rendering.

---

## Highlights

- Experimental GPU path tracer built from scratch
- Physically Based Rendering (PBR)
- Global illumination via Monte Carlo path tracing
- GPU-accelerated rendering using a Bounding Volume Hierarchy (BVH)
- Undergraduate Computer Engineering thesis project

---

## Features

Current implementation includes:

### Rendering

- Monte Carlo path tracing
- Progressive sample accumulation
- Multiple light bounces
- Gamma correction
- Jittered pixel sampling

### Materials

- Lambert diffuse BRDF
- Cook-Torrance microfacet BRDF
- Metallic/Roughness PBR workflow
- Fresnel-Schlick approximation

### Light Transport

- Next Event Estimation (NEE)
- Multiple Importance Sampling (MIS)
- Russian Roulette path termination
- Cosine-weighted hemisphere sampling
- GGX importance sampling

### Acceleration

- Bounding Volume Hierarchy (BVH)
- GPU stackless BVH traversal
- Ray-triangle intersection tests

### Assets & Pipeline

- glTF scene loading
- GPU data textures
- WebGL2 + GLSL fragment shader renderer

---

## Current Status

The project successfully implements a complete physically-based path tracing pipeline, including Monte Carlo light transport, physically-based materials, acceleration structures, and GPU ray traversal.

While the original objective was to investigate the feasibility of real-time path tracing in WebGL2, the current implementation prioritizes algorithm validation and performance analysis over interactive rendering. It serves as the foundation for future work aimed at closing the gap between progressive and real-time rendering.

---

## Future Work

Planned improvements include:

- Interactive camera controls with accumulation reset
- Additional PBR material models
- Glass, transmission, and dielectric materials
- Advanced denoising strategies
- Temporal accumulation techniques
- BVH construction optimizations
- Parallel BVH construction algorithms
- GPU-based BVH construction
- Improved memory layouts and data structures
- Migration to Rust + wgpu
- Performance comparison between WebGL2 and wgpu implementations

---

## Thesis

This repository contains the implementation accompanying my undergraduate thesis:

**Real-Time Path Tracing Implementation**

The thesis investigates the challenges of bringing physically-based global illumination closer to interactive rendering using web technologies. In addition to the implementation itself, it explores the theoretical foundations of modern physically-based rendering, including the graphics rendering pipeline, light transport, BRDFs, Monte Carlo integration, sampling strategies, physically-based material models, acceleration structures, and GPU-oriented rendering techniques.

---

## Technologies

- WebGL2
- GLSL ES 3.00
- TypeScript
- Three.js
- Vite

---

## Running

```bash
npm install
npm run dev
```

---

## Gallery

<img width="512" height="512" alt="Cornell Box" src="https://github.com/user-attachments/assets/d82d393e-0ef5-46ca-84c4-f15ba0bdcfd7" />

<img width="512" height="512" alt="Dragon Scene" src="https://github.com/user-attachments/assets/742fc5de-903f-4ec1-9ee9-dc2cab436b4b" />

<img width="512" height="512" alt="Sponza Scene" src="https://github.com/user-attachments/assets/c42a6156-3415-4a36-be91-68f6fae1bd6f" />

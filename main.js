import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/controls/OrbitControls.js';

const vertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCameraPos;
uniform vec3 uCameraForward;
uniform vec3 uCameraRight;
uniform vec3 uCameraUp;
uniform float uFov;
uniform float uAspect;

const int MAX_STEPS = 96;
const float FAR_DIST = 140.0;
const float HORIZON_RADIUS = 1.12;
const float DISK_INNER_RADIUS = 1.55;
const float DISK_OUTER_RADIUS = 5.8;
const float STEP_SIZE = 0.18;
const float BEND_STRENGTH = 0.12;

float hash31(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.yzx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

vec3 temperatureColor(float t) {
  vec3 cool = vec3(1.0, 0.46, 0.12);
  vec3 warm = vec3(1.0, 0.78, 0.38);
  vec3 hot = vec3(1.15, 1.28, 1.55);
  vec3 base = mix(cool, warm, smoothstep(0.0, 0.55, t));
  return mix(base, hot, smoothstep(0.55, 1.0, t));
}

float starField(vec3 rd) {
  vec3 p = normalize(rd) * 220.0;
  vec3 cell = floor(p);
  float sparkle = 0.0;

  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 offset = vec3(float(x), float(y), float(z));
        vec3 c = cell + offset;
        float h = hash31(c);
        if (h > 0.986) {
          vec3 starPos = c + vec3(hash31(c + 1.1), hash31(c + 2.7), hash31(c + 7.2));
          vec3 local = p - starPos;
          float d = dot(local, local);
          float intensity = smoothstep(0.08, 0.0, d) * mix(0.4, 2.2, hash31(c + 9.3));
          sparkle += intensity;
        }
      }
    }
  }

  return sparkle;
}

vec3 backgroundColor(vec3 rd) {
  vec3 dir = normalize(rd);
  float stars = starField(dir);

  float nebulaBand = pow(max(0.0, 1.0 - abs(dir.y * 1.35)), 6.0);
  float angle = atan(dir.z, dir.x);
  float swirl = sin(angle * 4.0 + uTime * 0.02) * 0.5 + 0.5;
  float dust = smoothstep(0.42, 0.95, nebulaBand * swirl);

  vec3 deep = vec3(0.004, 0.007, 0.016);
  vec3 milky = vec3(0.08, 0.11, 0.18) * dust * 0.45;
  vec3 starColor = vec3(0.95, 0.98, 1.0) * stars;

  return deep + milky + starColor;
}

float diskNoise(vec2 p) {
  vec2 q = p;
  q *= rot(0.4);
  float n = sin(q.x * 14.0 + uTime * 0.28) * sin(q.y * 7.0 - uTime * 0.18);
  n += sin(q.x * 28.0 - uTime * 0.15) * 0.5;
  n += cos(q.y * 19.0 + uTime * 0.21) * 0.35;
  return n * 0.5 + 0.5;
}

float diskDensity(vec3 p) {
  float r = length(p.xz);
  float radialMask = smoothstep(DISK_OUTER_RADIUS, DISK_OUTER_RADIUS - 0.75, r)
                   * smoothstep(DISK_INNER_RADIUS, DISK_INNER_RADIUS + 0.25, r);

  float thickness = mix(0.025, 0.18, smoothstep(DISK_INNER_RADIUS, DISK_OUTER_RADIUS, r));
  float vertical = exp(-abs(p.y) / max(thickness, 0.001));

  float theta = atan(p.z, p.x);
  vec2 uv = vec2(theta * 0.8, r * 1.65);
  float turbulence = diskNoise(uv);
  float filaments = sin(theta * 18.0 + r * 8.0 - uTime * 0.6) * 0.5 + 0.5;
  float breakup = mix(0.65, 1.35, turbulence * filaments);

  return radialMask * vertical * breakup;
}

vec3 diskEmission(vec3 p, vec3 dir) {
  float r = length(p.xz);
  float heat = 1.0 - smoothstep(DISK_INNER_RADIUS, DISK_OUTER_RADIUS, r);
  heat = pow(heat, 0.65);

  vec3 tangent = normalize(vec3(-p.z, 0.0, p.x) + 1e-5);
  float orbitSpeed = mix(0.35, 0.94, 1.0 - smoothstep(DISK_INNER_RADIUS, DISK_OUTER_RADIUS, r));
  float doppler = dot(tangent, -normalize(dir));
  float boosted = 1.0 + doppler * orbitSpeed * 1.25;
  float shifted = clamp(heat * 0.7 + boosted * 0.25, 0.0, 1.0);

  vec3 color = temperatureColor(shifted);
  float brightness = mix(0.28, 3.2, heat) * boosted;
  return color * brightness;
}

vec3 getRayDirection(vec2 uv) {
  float tanHalfFov = tan(radians(uFov) * 0.5);
  vec2 screen = uv * 2.0 - 1.0;
  screen.x *= uAspect;

  return normalize(
    uCameraForward + screen.x * tanHalfFov * uCameraRight + screen.y * tanHalfFov * uCameraUp
  );
}

void main() {
  vec3 ro = uCameraPos;
  vec3 rd = getRayDirection(vUv);

  vec3 position = ro;
  vec3 direction = rd;
  vec3 accum = vec3(0.0);
  float transmittance = 1.0;
  float swallowed = 0.0;

  for (int i = 0; i < MAX_STEPS; i++) {
    float r = length(position);

    if (r < HORIZON_RADIUS) {
      swallowed = 1.0;
      transmittance = 0.0;
      break;
    }

    if (r > FAR_DIST) {
      break;
    }

    vec3 gravityDir = -position / (r + 1e-5);
    float bend = BEND_STRENGTH / (r * r + 0.22);
    direction = normalize(direction + gravityDir * bend);
    position += direction * STEP_SIZE;

    float density = diskDensity(position);
    if (density > 0.001) {
      vec3 emission = diskEmission(position, direction);
      float alpha = clamp(density * 0.055, 0.0, 0.24);
      accum += emission * alpha * transmittance;
      transmittance *= (1.0 - alpha * 0.9);
    }
  }

  vec3 bg = backgroundColor(direction);
  float closestApproach = length(cross(ro, rd));
  float ring = smoothstep(1.9, 1.1, closestApproach) * smoothstep(0.35, 0.95, transmittance + 0.15);
  vec3 photonRing = vec3(1.0, 0.72, 0.35) * ring * 1.8;

  vec3 color = accum + bg * transmittance + photonRing;
  color *= (1.0 - swallowed);

  float vignette = 1.0 - dot(vUv - 0.5, vUv - 0.5) * 0.9;
  color *= vignette;

  color = color / (vec3(1.0) + color);
  color = pow(color, vec3(0.92));

  gl_FragColor = vec4(color, 1.0);
}
`;

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 2.8, 12);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.85;
controls.zoomSpeed = 0.95;
controls.enablePan = false;
controls.minDistance = 4.5;
controls.maxDistance = 30;
controls.minPolarAngle = 0.1;
controls.maxPolarAngle = Math.PI - 0.1;

const uniforms = {
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uTime: { value: 0 },
  uCameraPos: { value: new THREE.Vector3() },
  uCameraForward: { value: new THREE.Vector3() },
  uCameraRight: { value: new THREE.Vector3() },
  uCameraUp: { value: new THREE.Vector3() },
  uFov: { value: camera.fov },
  uAspect: { value: camera.aspect }
};

const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader,
  fragmentShader,
  depthTest: false,
  depthWrite: false
});

const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
scene.add(quad);

const clock = new THREE.Clock();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();

function updateCameraUniforms() {
  camera.updateMatrixWorld();
  camera.getWorldDirection(forward).normalize();
  right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();

  uniforms.uCameraPos.value.copy(camera.position);
  uniforms.uCameraForward.value.copy(forward);
  uniforms.uCameraRight.value.copy(right);
  uniforms.uCameraUp.value.copy(up);
  uniforms.uFov.value = camera.fov;
  uniforms.uAspect.value = camera.aspect;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  uniforms.uAspect.value = camera.aspect;
}

window.addEventListener('resize', onResize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateCameraUniforms();
  uniforms.uTime.value = clock.getElapsedTime();
  renderer.render(scene, camera);
}

updateCameraUniforms();
animate();

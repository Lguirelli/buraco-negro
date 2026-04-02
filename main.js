import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setClearColor(0x000000, 1);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 3.5, 12);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 0.9;
controls.minDistance = 5;
controls.maxDistance = 28;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = Math.PI - 0.12;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.35,
  0.9,
  0.18
);
composer.addPass(bloomPass);

const ambient = new THREE.AmbientLight(0xffffff, 0.12);
scene.add(ambient);

const warmLight = new THREE.PointLight(0xff9b4a, 16, 80, 2);
warmLight.position.set(0, 0, 0);
scene.add(warmLight);

const coolLight = new THREE.PointLight(0x4f7dff, 2.0, 120, 2);
coolLight.position.set(-14, 8, -10);
scene.add(coolLight);

const blackHoleGroup = new THREE.Group();
scene.add(blackHoleGroup);

const diskGroup = new THREE.Group();
scene.add(diskGroup);

const clock = new THREE.Clock();

const diskVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const diskFragmentShader = `
  precision highp float;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  uniform float uTime;
  uniform float uInnerRadius;
  uniform float uOuterRadius;
  uniform float uOpacity;
  uniform float uBrightness;
  uniform float uStretch;
  uniform float uSpin;
  uniform vec3 uColorHot;
  uniform vec3 uColorWarm;
  uniform vec3 uColorCool;

  float ringMask(float r, float innerR, float outerR, float blur) {
    float inner = smoothstep(innerR, innerR + blur, r);
    float outer = 1.0 - smoothstep(outerR - blur, outerR, r);
    return inner * outer;
  }

  void main() {
    vec2 p = vUv - 0.5;
    p.y *= uStretch;

    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);

    float mask = ringMask(r, uInnerRadius, uOuterRadius, 0.06);

    float streaks =
      sin(a * 22.0 + r * 26.0 - uTime * uSpin) * 0.5 +
      sin(a * 47.0 - r * 18.0 - uTime * (uSpin * 0.65)) * 0.25;

    float turbulence =
      sin((p.x + p.y) * 18.0 + uTime * 0.9) * 0.15 +
      cos((p.x - p.y) * 24.0 - uTime * 1.1) * 0.12;

    float pattern = clamp(0.72 + streaks * 0.28 + turbulence, 0.0, 1.4);

    float hotCore = 1.0 - smoothstep(uInnerRadius + 0.015, uInnerRadius + 0.17, r);
    float warmBand = 1.0 - smoothstep(uInnerRadius + 0.12, uOuterRadius - 0.04, r);
    float outerGlow = smoothstep(uInnerRadius + 0.05, uOuterRadius, r);

    vec3 color = mix(uColorCool, uColorWarm, clamp(warmBand, 0.0, 1.0));
    color = mix(color, uColorHot, clamp(hotCore, 0.0, 1.0));

    float alpha = mask * pattern * uOpacity;
    color *= mix(0.7, 1.35, pattern);
    color *= mix(0.85, 1.2, outerGlow);
    color *= uBrightness;

    gl_FragColor = vec4(color, alpha);
  }
`;

function createDiskMaterial(options) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: diskVertexShader,
    fragmentShader: diskFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uInnerRadius: { value: options.innerRadius },
      uOuterRadius: { value: options.outerRadius },
      uOpacity: { value: options.opacity },
      uBrightness: { value: options.brightness },
      uStretch: { value: options.stretch },
      uSpin: { value: options.spin },
      uColorHot: { value: new THREE.Color(options.colorHot) },
      uColorWarm: { value: new THREE.Color(options.colorWarm) },
      uColorCool: { value: new THREE.Color(options.colorCool) }
    }
  });
}

const diskGeometry = new THREE.PlaneGeometry(16, 16, 1, 1);

const mainDiskMaterial = createDiskMaterial({
  innerRadius: 0.24,
  outerRadius: 0.82,
  opacity: 0.92,
  brightness: 1.5,
  stretch: 1.0,
  spin: 3.8,
  colorHot: 0xfff3c6,
  colorWarm: 0xffa43c,
  colorCool: 0x2a1206
});

const diskGlowMaterial = createDiskMaterial({
  innerRadius: 0.19,
  outerRadius: 0.96,
  opacity: 0.28,
  brightness: 1.8,
  stretch: 1.0,
  spin: 2.4,
  colorHot: 0xfff0cf,
  colorWarm: 0xffb15b,
  colorCool: 0x3b1604
});

const mainDisk = new THREE.Mesh(diskGeometry, mainDiskMaterial);
mainDisk.rotation.x = -Math.PI * 0.5;
mainDisk.scale.set(1.0, 1.0, 1.0);
diskGroup.add(mainDisk);

const glowDisk = new THREE.Mesh(diskGeometry, diskGlowMaterial);
glowDisk.rotation.x = -Math.PI * 0.5;
glowDisk.position.y = -0.02;
glowDisk.scale.set(1.18, 1.18, 1.18);
diskGroup.add(glowDisk);

const blackHole = new THREE.Mesh(
  new THREE.SphereGeometry(2.05, 128, 128),
  new THREE.MeshBasicMaterial({ color: 0x000000 })
);
blackHole.renderOrder = 10;
blackHoleGroup.add(blackHole);

const shadowHalo = new THREE.Mesh(
  new THREE.RingGeometry(2.15, 3.25, 256),
  new THREE.MeshBasicMaterial({
    color: 0x120803,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false
  })
);
shadowHalo.rotation.x = -Math.PI * 0.5;
shadowHalo.renderOrder = 2;
blackHoleGroup.add(shadowHalo);

const photonRing = new THREE.Mesh(
  new THREE.RingGeometry(2.18, 2.55, 256),
  new THREE.MeshBasicMaterial({
    color: 0xffd37e,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide,
    depthWrite: false
  })
);
photonRing.rotation.x = -Math.PI * 0.5;
photonRing.renderOrder = 9;
blackHoleGroup.add(photonRing);

const lensShellMaterial = new THREE.ShaderMaterial({
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    precision highp float;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    uniform float uTime;

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 3.2);
      float pulse = 0.9 + sin(uTime * 1.4) * 0.06;
      vec3 color = vec3(0.11, 0.22, 0.55) * fresnel * pulse;
      gl_FragColor = vec4(color, fresnel * 0.18);
    }
  `
});

const lensShell = new THREE.Mesh(
  new THREE.SphereGeometry(3.1, 128, 128),
  lensShellMaterial
);
lensShell.renderOrder = 8;
blackHoleGroup.add(lensShell);

const topBandMaterial = new THREE.MeshBasicMaterial({
  color: 0xffd68b,
  transparent: true,
  opacity: 0.78,
  depthWrite: false
});

const bottomBandMaterial = new THREE.MeshBasicMaterial({
  color: 0xffb34a,
  transparent: true,
  opacity: 0.36,
  depthWrite: false
});

const topBand = new THREE.Mesh(
  new THREE.TorusGeometry(2.92, 0.18, 24, 220),
  topBandMaterial
);
topBand.scale.set(1.45, 0.24, 1.0);
topBand.position.y = 1.18;
topBand.renderOrder = 6;
blackHoleGroup.add(topBand);

const bottomBand = new THREE.Mesh(
  new THREE.TorusGeometry(2.92, 0.18, 24, 220),
  bottomBandMaterial
);
bottomBand.scale.set(1.45, 0.18, 1.0);
bottomBand.position.y = -1.08;
bottomBand.renderOrder = 4;
blackHoleGroup.add(bottomBand);

function createStars(count = 5000, radius = 250) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const r = radius * (0.65 + Math.random() * 0.35);
    const theta = Math.random() * Math.PI * 2.0;
    const phi = Math.acos(2.0 * Math.random() - 1.0);

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);

    positions.push(x, y, z);

    const t = Math.random();
    color.setRGB(
      0.75 + t * 0.25,
      0.78 + t * 0.22,
      0.9 + t * 0.1
    );
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3)
  );

  const material = new THREE.PointsMaterial({
    size: 0.72,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    sizeAttenuation: true
  });

  return new THREE.Points(geometry, material);
}

const stars = createStars();
scene.add(stars);

const dustShell = new THREE.Mesh(
  new THREE.SphereGeometry(120, 48, 48),
  new THREE.MeshBasicMaterial({
    color: 0x07101f,
    transparent: true,
    opacity: 0.06,
    side: THREE.BackSide
  })
);
scene.add(dustShell);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(w, h);
  bloomPass.setSize(w, h);
}

window.addEventListener('resize', resize);

function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();

  controls.update();

  mainDiskMaterial.uniforms.uTime.value = t;
  diskGlowMaterial.uniforms.uTime.value = t * 0.8;
  lensShellMaterial.uniforms.uTime.value = t;

  photonRing.material.opacity = 0.9 + Math.sin(t * 1.8) * 0.04;
  topBand.material.opacity = 0.74 + Math.sin(t * 1.4) * 0.04;
  bottomBand.material.opacity = 0.34 + Math.sin(t * 1.1 + 0.6) * 0.03;

  stars.rotation.y += 0.00012;

  composer.render();
}

resize();
animate();

console.log('Black hole cinematic scene loaded.');

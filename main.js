import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 1);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 4, 12);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 0.9;
controls.enablePan = false;
controls.minDistance = 4;
controls.maxDistance = 40;
controls.minPolarAngle = 0.08;
controls.maxPolarAngle = Math.PI - 0.08;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.12);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffaa55, 3.2, 50, 2);
pointLight.position.set(0, 0, 0);
scene.add(pointLight);

const blackHoleGroup = new THREE.Group();
scene.add(blackHoleGroup);

const blackHoleGeometry = new THREE.SphereGeometry(1.7, 128, 128);
const blackHoleMaterial = new THREE.MeshBasicMaterial({
  color: 0x020202
});
const blackHole = new THREE.Mesh(blackHoleGeometry, blackHoleMaterial);
blackHoleGroup.add(blackHole);

const photonRingGeometry = new THREE.RingGeometry(1.95, 2.35, 256);
const photonRingMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  uniforms: {
    uTime: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;

    void main() {
      vec2 uv = vUv - 0.5;
      float r = length(uv) * 2.0;

      float glow = smoothstep(0.95, 0.55, abs(r - 0.72));
      float pulse = 0.9 + sin(uTime * 1.2) * 0.08;

      vec3 color = vec3(1.0, 0.72, 0.28) * glow * pulse;
      float alpha = glow * 0.9;

      gl_FragColor = vec4(color, alpha);
    }
  `
});
const photonRing = new THREE.Mesh(photonRingGeometry, photonRingMaterial);
photonRing.rotation.x = Math.PI * 0.5;
blackHoleGroup.add(photonRing);

function createAccretionDiskTexture(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  const outer = size * 0.48;
  const inner = size * 0.18;

  const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  gradient.addColorStop(0.0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.12, 'rgba(255,170,60,0.0)');
  gradient.addColorStop(0.24, 'rgba(255,140,30,0.85)');
  gradient.addColorStop(0.42, 'rgba(255,190,90,0.95)');
  gradient.addColorStop(0.62, 'rgba(255,240,210,0.8)');
  gradient.addColorStop(0.82, 'rgba(255,150,40,0.28)');
  gradient.addColorStop(1.0, 'rgba(0,0,0,0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';

  for (let i = 0; i < 1400; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = inner + Math.random() * (outer - inner);
    const swirl = angle + radius * 0.018;
    const x = cx + Math.cos(swirl) * radius;
    const y = cy + Math.sin(swirl) * radius;

    const alpha = 0.03 + Math.random() * 0.10;
    const sizeDot = 0.6 + Math.random() * 2.4;

    const hue = 28 + Math.random() * 20;
    const light = 50 + Math.random() * 35;

    ctx.fillStyle = `hsla(${hue}, 100%, ${light}%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, sizeDot, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const diskTexture = createAccretionDiskTexture();

const diskGeometry = new THREE.RingGeometry(2.2, 6.3, 256, 32);
const diskMaterial = new THREE.MeshBasicMaterial({
  map: diskTexture,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const disk = new THREE.Mesh(diskGeometry, diskMaterial);
disk.rotation.x = Math.PI * 0.5;
blackHoleGroup.add(disk);

const diskGlowGeometry = new THREE.RingGeometry(2.0, 7.4, 256, 32);
const diskGlowMaterial = new THREE.MeshBasicMaterial({
  color: 0xffa347,
  transparent: true,
  opacity: 0.12,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const diskGlow = new THREE.Mesh(diskGlowGeometry, diskGlowMaterial);
diskGlow.rotation.x = Math.PI * 0.5;
blackHoleGroup.add(diskGlow);

const lensingGeometry = new THREE.SphereGeometry(2.6, 128, 128);
const lensingMaterial = new THREE.ShaderMaterial({
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
      float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 2.6);

      float pulse = 0.9 + 0.1 * sin(uTime * 1.5);
      vec3 color = vec3(0.12, 0.18, 0.35) * fresnel * pulse;

      gl_FragColor = vec4(color, fresnel * 0.22);
    }
  `
});
const lensingShell = new THREE.Mesh(lensingGeometry, lensingMaterial);
blackHoleGroup.add(lensingShell);

function createStarField(count = 5000, radius = 300) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const sizes = [];

  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const r = radius * (0.7 + Math.random() * 0.3);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);

    positions.push(x, y, z);

    const t = Math.random();
    color.setRGB(
      0.7 + t * 0.3,
      0.75 + t * 0.25,
      0.9 + t * 0.1
    );
    colors.push(color.r, color.g, color.b);

    sizes.push(1 + Math.random() * 2);
  }

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3)
  );
  geometry.setAttribute(
    'size',
    new THREE.Float32BufferAttribute(sizes, 1)
  );

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    uniforms: {},
    vertexShader: `
      attribute float size;
      varying vec3 vColor;

      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vColor;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float alpha = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor, alpha);
      }
    `
  });

  return new THREE.Points(geometry, material);
}

const stars = createStarField();
scene.add(stars);

const clock = new THREE.Clock();

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();

  controls.update();

  disk.rotation.z += 0.0035;
  diskGlow.rotation.z -= 0.0018;
  photonRingMaterial.uniforms.uTime.value = elapsed;
  lensingMaterial.uniforms.uTime.value = elapsed;

  blackHoleGroup.rotation.y += 0.0015;
  stars.rotation.y += 0.00015;

  renderer.render(scene, camera);
}

resize();
animate();

console.log('Cena carregada com sucesso.');

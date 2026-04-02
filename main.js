import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 14);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 0.9;
controls.minDistance = 5;
controls.maxDistance = 40;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = Math.PI - 0.15;

const ambient = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambient);

const keyLight = new THREE.PointLight(0xffb366, 12, 80);
keyLight.position.set(0, 0, 0);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x66aaff, 2.5, 100);
rimLight.position.set(-10, 8, -12);
scene.add(rimLight);

const blackHoleGroup = new THREE.Group();
scene.add(blackHoleGroup);

const diskGroup = new THREE.Group();
scene.add(diskGroup);

const blackHole = new THREE.Mesh(
  new THREE.SphereGeometry(2.1, 96, 96),
  new THREE.MeshBasicMaterial({ color: 0x000000 })
);
blackHoleGroup.add(blackHole);

const photonRing = new THREE.Mesh(
  new THREE.TorusGeometry(2.45, 0.16, 24, 180),
  new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0.95
  })
);
photonRing.rotation.x = Math.PI * 0.5;
blackHoleGroup.add(photonRing);

const lensMaterial = new THREE.ShaderMaterial({
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

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 3.0);
      vec3 color = vec3(0.2, 0.4, 0.9) * fresnel;
      gl_FragColor = vec4(color, fresnel * 0.22);
    }
  `
});

const lensShell = new THREE.Mesh(
  new THREE.SphereGeometry(2.9, 128, 128),
  lensMaterial
);
blackHoleGroup.add(lensShell);

const disk = new THREE.Mesh(
  new THREE.TorusGeometry(4.2, 1.15, 48, 220),
  new THREE.MeshStandardMaterial({
    color: 0xff9a3d,
    emissive: 0xff7b1a,
    emissiveIntensity: 3.2,
    roughness: 0.35,
    metalness: 0.05
  })
);
disk.rotation.x = Math.PI * 0.5;
disk.scale.y = 0.08;
diskGroup.add(disk);

const diskOuterGlow = new THREE.Mesh(
  new THREE.TorusGeometry(4.35, 1.45, 32, 220),
  new THREE.MeshBasicMaterial({
    color: 0xffb347,
    transparent: true,
    opacity: 0.18
  })
);
diskOuterGlow.rotation.x = Math.PI * 0.5;
diskOuterGlow.scale.y = 0.10;
diskGroup.add(diskOuterGlow);

// Disco duplicado fake para sugerir a curvatura visual do Gargantua
const upperLensedDisk = new THREE.Mesh(
  new THREE.TorusGeometry(2.95, 0.28, 24, 180),
  new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0.82
  })
);
upperLensedDisk.rotation.x = Math.PI * 0.5;
upperLensedDisk.position.y = 0.55;
upperLensedDisk.scale.set(1.05, 0.16, 0.72);
diskGroup.add(upperLensedDisk);

const lowerLensedDisk = new THREE.Mesh(
  new THREE.TorusGeometry(2.95, 0.28, 24, 180),
  new THREE.MeshBasicMaterial({
    color: 0xffc45e,
    transparent: true,
    opacity: 0.55
  })
);
lowerLensedDisk.rotation.x = Math.PI * 0.5;
lowerLensedDisk.position.y = -0.55;
lowerLensedDisk.scale.set(1.05, 0.12, 0.72);
diskGroup.add(lowerLensedDisk);

function createStars(count = 3500, radius = 220) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const r = radius * (0.65 + Math.random() * 0.35);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

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
    size: 0.85,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    sizeAttenuation: true
  });

  return new THREE.Points(geometry, material);
}

const stars = createStars();
scene.add(stars);

const dust = new THREE.Mesh(
  new THREE.SphereGeometry(120, 48, 48),
  new THREE.MeshBasicMaterial({
    color: 0x0a1020,
    transparent: true,
    opacity: 0.08,
    side: THREE.BackSide
  })
);
scene.add(dust);

const clock = new THREE.Clock();

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener('resize', resize);

function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();

  controls.update();

  diskGroup.rotation.y += 0.02;
  disk.rotation.z += 0.0025;
  diskOuterGlow.rotation.z -= 0.0015;

  upperLensedDisk.material.opacity = 0.76 + Math.sin(t * 1.6) * 0.05;
  lowerLensedDisk.material.opacity = 0.50 + Math.sin(t * 1.3 + 1.2) * 0.04;
  photonRing.material.opacity = 0.82 + Math.sin(t * 2.0) * 0.08;
  lensMaterial.uniforms.uTime.value = t;

  stars.rotation.y += 0.00015;

  renderer.render(scene, camera);
}

resize();
animate();

console.log('Cena renderizada com sucesso.');

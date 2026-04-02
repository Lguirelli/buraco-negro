import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
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
renderer.toneMappingExposure = 0.92;
renderer.setClearColor(0x000000, 1);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 1.8, 9.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 0.9;
controls.minDistance = 5.2;
controls.maxDistance = 18;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = Math.PI - 0.12;

const ambient = new THREE.AmbientLight(0xffffff, 0.04);
scene.add(ambient);

const warmLight = new THREE.PointLight(0xff8d3a, 4.8, 36, 2);
warmLight.position.set(0, 0, 0);
scene.add(warmLight);

const coolLight = new THREE.PointLight(0x507dff, 0.65, 80, 2);
coolLight.position.set(-10, 7, -8);
scene.add(coolLight);

const root = new THREE.Group();
scene.add(root);

const blackHoleGroup = new THREE.Group();
root.add(blackHoleGroup);

const diskGroup = new THREE.Group();
root.add(diskGroup);

const clock = new THREE.Clock();

function createStars(count = 7000, radius = 220) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const sizes = [];
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const r = radius * (0.72 + Math.random() * 0.28);
    const theta = Math.random() * Math.PI * 2.0;
    const phi = Math.acos(2.0 * Math.random() - 1.0);

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);

    positions.push(x, y, z);

    const t = Math.random();
    color.setRGB(
      0.78 + t * 0.22,
      0.79 + t * 0.2,
      0.88 + t * 0.12
    );
    colors.push(color.r, color.g, color.b);

    const rare = Math.random();
    let size = 0.55 + Math.random() * 0.9;
    if (rare > 0.992) size = 1.5 + Math.random() * 1.2;
    sizes.push(size);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    vertexShader: `
      attribute float aSize;
      varying vec3 vColor;

      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float scale = 220.0 / max(1.0, -mvPosition.z);
        gl_PointSize = aSize * scale;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vColor;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor, alpha);
      }
    `
  });

  return new THREE.Points(geometry, material);
}

const stars = createStars();
scene.add(stars);

const dustShell = new THREE.Mesh(
  new THREE.SphereGeometry(150, 24, 24),
  new THREE.MeshBasicMaterial({
    color: 0x06080d,
    transparent: true,
    opacity: 0.02,
    side: THREE.BackSide
  })
);
scene.add(dustShell);

function createAccretionTexture(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const inner = size * 0.23;
  const outer = size * 0.47;

  const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  grad.addColorStop(0.00, 'rgba(255,245,210,0.0)');
  grad.addColorStop(0.10, 'rgba(255,245,210,0.92)');
  grad.addColorStop(0.24, 'rgba(255,190,90,0.95)');
  grad.addColorStop(0.56, 'rgba(255,120,30,0.58)');
  grad.addColorStop(0.84, 'rgba(120,40,10,0.18)');
  grad.addColorStop(1.00, 'rgba(0,0,0,0.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  for (let i = 0; i < 1900; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = inner + Math.random() * (outer - inner);
    const x = cx + Math.cos(angle + radius * 0.017) * radius;
    const y = cy + Math.sin(angle + radius * 0.017) * radius;

    const alpha = 0.012 + Math.random() * 0.07;
    const dotSize = 0.5 + Math.random() * 2.2;
    const hue = 26 + Math.random() * 18;
    const light = 42 + Math.random() * 32;

    ctx.fillStyle = `hsla(${hue}, 100%, ${light}%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, dotSize, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const accretionTexture = createAccretionTexture();

function createDiskMesh(innerRadius, outerRadius, opacity, renderOrder) {
  const material = new THREE.MeshBasicMaterial({
    map: accretionTexture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    opacity
  });

  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(innerRadius, outerRadius, 320, 24),
    material
  );

  mesh.rotation.x = -Math.PI * 0.5;
  mesh.scale.y = 0.085;
  mesh.renderOrder = renderOrder;

  return mesh;
}

const backDisk = createDiskMesh(2.0, 6.0, 0.48, 1);
diskGroup.add(backDisk);

const frontDisk = createDiskMesh(2.0, 6.0, 0.72, 11);
diskGroup.add(frontDisk);

const diskGlow = new THREE.Mesh(
  new THREE.RingGeometry(1.8, 7.0, 320, 8),
  new THREE.MeshBasicMaterial({
    color: 0xffa347,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending
  })
);
diskGlow.rotation.x = -Math.PI * 0.5;
diskGlow.scale.y = 0.11;
diskGlow.renderOrder = 2;
diskGroup.add(diskGlow);

const diskCoreGlow = new THREE.Mesh(
  new THREE.RingGeometry(1.95, 3.2, 240, 8),
  new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending
  })
);
diskCoreGlow.rotation.x = -Math.PI * 0.5;
diskCoreGlow.scale.y = 0.16;
diskCoreGlow.renderOrder = 3;
diskGroup.add(diskCoreGlow);

const blackHole = new THREE.Mesh(
  new THREE.SphereGeometry(1.62, 128, 128),
  new THREE.MeshBasicMaterial({ color: 0x000000 })
);
blackHole.material.depthWrite = true;
blackHole.material.depthTest = true;
blackHole.renderOrder = 10;
blackHoleGroup.add(blackHole);

const photonRing = new THREE.Mesh(
  new THREE.RingGeometry(1.66, 1.92, 256),
  new THREE.MeshBasicMaterial({
    color: 0xffd07b,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
);
photonRing.rotation.x = -Math.PI * 0.5;
photonRing.renderOrder = 12;
blackHoleGroup.add(photonRing);

const shadowHalo = new THREE.Mesh(
  new THREE.RingGeometry(1.72, 2.35, 256),
  new THREE.MeshBasicMaterial({
    color: 0x120702,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false
  })
);
shadowHalo.rotation.x = -Math.PI * 0.5;
shadowHalo.renderOrder = 6;
blackHoleGroup.add(shadowHalo);

const lensShellMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
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
      float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 3.5);
      float pulse = 0.95 + sin(uTime * 0.9) * 0.02;
      vec3 color = vec3(0.07, 0.13, 0.28) * fresnel * pulse;
      float alpha = fresnel * 0.085;
      if (alpha < 0.002) discard;
      gl_FragColor = vec4(color, alpha);
    }
  `
});

const lensShell = new THREE.Mesh(
  new THREE.SphereGeometry(2.25, 128, 128),
  lensShellMaterial
);
lensShell.renderOrder = 9;
blackHoleGroup.add(lensShell);

function createLensedArc(color, opacity, y, renderOrder) {
  const arc = new THREE.Mesh(
    new THREE.PlaneGeometry(5.0, 1.45),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity }
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
        uniform vec3 uColor;
        uniform float uOpacity;

        void main() {
          vec2 p = vUv - 0.5;
          p.y *= 0.32;

          float curve = exp(-pow(abs(p.x) * 5.0, 2.0));
          p.y += curve * 0.08;

          float r = length(p) * 2.0;
          float outer = 1.0 - smoothstep(0.79, 0.87, r);
          float inner = smoothstep(0.63, 0.71, r);
          float ring = outer * inner;

          float sideFade = smoothstep(1.0, 0.78, abs(p.x) * 2.0);
          float alpha = ring * sideFade * uOpacity;

          if (alpha < 0.002) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `
    })
  );

  arc.position.y = y;
  arc.renderOrder = renderOrder;
  return arc;
}

const topArc = createLensedArc(0xffddb0, 0.42, 0.78, 9);
blackHoleGroup.add(topArc);

const bottomArc = createLensedArc(0xffb65a, 0.22, -0.78, 5);
blackHoleGroup.add(bottomArc);

const outerGlow = new THREE.Mesh(
  new THREE.RingGeometry(2.1, 3.5, 220),
  new THREE.MeshBasicMaterial({
    color: 0xff9a36,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending
  })
);
outerGlow.rotation.x = -Math.PI * 0.5;
outerGlow.scale.set(1.0, 0.18, 1.0);
outerGlow.renderOrder = 4;
blackHoleGroup.add(outerGlow);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const distortionPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uAspect: { value: window.innerWidth / window.innerHeight },
    uStrength: { value: 0.02 },
    uRadius: { value: 0.115 },
    uInnerRadius: { value: 0.03 }
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uCenter;
    uniform float uAspect;
    uniform float uStrength;
    uniform float uRadius;
    uniform float uInnerRadius;

    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec2 delta = uv - uCenter;
      delta.x *= uAspect;

      float dist = length(delta);
      vec2 warpedUv = uv;

      if (dist < uRadius) {
        float influence = 1.0 - smoothstep(uInnerRadius, uRadius, dist);
        float pull = influence * influence * uStrength;
        vec2 dir = normalize(delta + vec2(0.00001));
        vec2 offset = dir * pull;
        offset.x /= uAspect;
        warpedUv -= offset;
      }

      gl_FragColor = texture2D(tDiffuse, warpedUv);
    }
  `
});
composer.addPass(distortionPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.46,
  0.48,
  0.56
);
composer.addPass(bloomPass);

const screenCenter = new THREE.Vector3();
const projectedCenter = new THREE.Vector3();

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(w, h);
  bloomPass.setSize(w, h);

  distortionPass.uniforms.uAspect.value = w / h;
}

window.addEventListener('resize', resize);

function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();

  controls.update();

  lensShellMaterial.uniforms.uTime.value = t;

  photonRing.material.opacity = 0.76 + Math.sin(t * 1.4) * 0.015;
  outerGlow.material.opacity = 0.075 + Math.sin(t * 0.8) * 0.008;

  stars.rotation.y += 0.00004;
  backDisk.rotation.z += 0.0012;
  frontDisk.rotation.z += 0.0012;
  diskGlow.rotation.z -= 0.0006;
  diskCoreGlow.rotation.z += 0.0008;

  topArc.lookAt(camera.position);
  bottomArc.lookAt(camera.position);

  screenCenter.set(0, 0, 0);
  projectedCenter.copy(screenCenter).project(camera);

  distortionPass.uniforms.uCenter.value.set(
    projectedCenter.x * 0.5 + 0.5,
    projectedCenter.y * 0.5 + 0.5
  );

  composer.render();
}

resize();
animate();

console.log('Black hole cinematic scene loaded.');

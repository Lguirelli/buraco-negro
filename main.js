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
renderer.toneMappingExposure = 1.1;
renderer.setClearColor(0x000000, 1);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 2.8, 11);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 0.9;
controls.minDistance = 5;
controls.maxDistance = 24;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = Math.PI - 0.12;

const ambient = new THREE.AmbientLight(0xffffff, 0.08);
scene.add(ambient);

const warmLight = new THREE.PointLight(0xff9b4a, 14, 90, 2);
warmLight.position.set(0, 0, 0);
scene.add(warmLight);

const coolLight = new THREE.PointLight(0x4f7dff, 2.2, 150, 2);
coolLight.position.set(-14, 10, -10);
scene.add(coolLight);

const blackHoleGroup = new THREE.Group();
scene.add(blackHoleGroup);

const diskGroup = new THREE.Group();
scene.add(diskGroup);

const clock = new THREE.Clock();

function createStarTexture(size = 2048) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  const nebulaGradient = ctx.createRadialGradient(
    size * 0.52,
    size * 0.48,
    0,
    size * 0.52,
    size * 0.48,
    size * 0.75
  );
  nebulaGradient.addColorStop(0, 'rgba(30, 16, 6, 0.18)');
  nebulaGradient.addColorStop(0.45, 'rgba(18, 10, 5, 0.08)');
  nebulaGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = nebulaGradient;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, ${110 + i * 20}, ${50 + i * 10}, ${0.015 - i * 0.002})`;
    ctx.lineWidth = 120 - i * 18;
    ctx.ellipse(
      size * 0.5,
      size * (0.46 + i * 0.015),
      size * (0.42 + i * 0.03),
      size * (0.03 + i * 0.008),
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }

  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;

    const r = Math.random();
    let starSize = 0.3 + Math.random() * 1.4;
    let alpha = 0.25 + Math.random() * 0.75;

    if (r > 0.985) {
      starSize = 1.8 + Math.random() * 2.8;
      alpha = 0.9;
    }

    const blueBias = Math.random();
    const red = Math.floor(220 + Math.random() * 35);
    const green = Math.floor(220 + Math.random() * 35);
    const blue = Math.floor(230 + blueBias * 25);

    ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, starSize, 0, Math.PI * 2);
    ctx.fill();

    if (starSize > 2.2) {
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.2})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x - starSize * 2.0, y);
      ctx.lineTo(x + starSize * 2.0, y);
      ctx.moveTo(x, y - starSize * 2.0);
      ctx.lineTo(x, y + starSize * 2.0);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

const starTexture = createStarTexture();

const starSphere = new THREE.Mesh(
  new THREE.SphereGeometry(280, 64, 64),
  new THREE.MeshBasicMaterial({
    map: starTexture,
    side: THREE.BackSide
  })
);
scene.add(starSphere);

const dustShell = new THREE.Mesh(
  new THREE.SphereGeometry(150, 48, 48),
  new THREE.MeshBasicMaterial({
    color: 0x090d16,
    transparent: true,
    opacity: 0.08,
    side: THREE.BackSide
  })
);
scene.add(dustShell);

const diskVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const diskFragmentShader = `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform float uInnerRadius;
  uniform float uOuterRadius;
  uniform float uOpacity;
  uniform float uBrightness;
  uniform vec3 uHotColor;
  uniform vec3 uWarmColor;
  uniform vec3 uCoolColor;

  float ringMask(float r, float innerR, float outerR, float blur) {
    float inner = smoothstep(innerR, innerR + blur, r);
    float outer = 1.0 - smoothstep(outerR - blur, outerR, r);
    return inner * outer;
  }

  void main() {
    vec2 p = vUv - 0.5;
    p.y *= 0.22;

    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);

    float mask = ringMask(r, uInnerRadius, uOuterRadius, 0.05);

    float streaks =
      sin(a * 28.0 + r * 20.0 - uTime * 3.0) * 0.35 +
      sin(a * 54.0 - r * 16.0 - uTime * 1.8) * 0.2 +
      cos(a * 14.0 + r * 9.0 + uTime * 1.2) * 0.15;

    float noiseBand =
      sin((p.x + p.y) * 30.0 + uTime * 0.8) * 0.08 +
      cos((p.x - p.y) * 18.0 - uTime * 1.1) * 0.08;

    float hot = 1.0 - smoothstep(uInnerRadius, uInnerRadius + 0.16, r);
    float warm = 1.0 - smoothstep(uInnerRadius + 0.08, uOuterRadius - 0.04, r);
    float outer = smoothstep(uInnerRadius + 0.04, uOuterRadius, r);

    float pattern = clamp(0.8 + streaks + noiseBand, 0.0, 1.6);

    vec3 color = mix(uCoolColor, uWarmColor, clamp(warm, 0.0, 1.0));
    color = mix(color, uHotColor, clamp(hot, 0.0, 1.0));
    color *= mix(0.75, 1.35, pattern);
    color *= mix(0.85, 1.2, outer);
    color *= uBrightness;

    float alpha = mask * pattern * uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

const lensVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const lensFragmentShader = `
  precision highp float;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  uniform float uTime;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 3.2);
    float pulse = 0.92 + sin(uTime * 1.25) * 0.04;
    vec3 color = vec3(0.10, 0.18, 0.45) * fresnel * pulse;
    gl_FragColor = vec4(color, fresnel * 0.16);
  }
`;

const ringBandVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ringBandFragmentShader = `
  precision highp float;

  varying vec2 vUv;

  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uThickness;
  uniform float uSoftness;

  void main() {
    vec2 p = vUv - 0.5;
    p.y *= 0.26;

    float r = length(p) * 2.0;
    float ring = smoothstep(0.72 + uThickness + uSoftness, 0.72 + uThickness, r) *
                 (1.0 - smoothstep(0.72 - uThickness, 0.72 - uThickness - uSoftness, r));

    float fadeX = 1.0 - smoothstep(0.78, 1.0, abs(p.x) * 2.0);
    float alpha = ring * fadeX * uOpacity;

    gl_FragColor = vec4(uColor, alpha);
  }
`;

function createDiskMaterial({
  innerRadius,
  outerRadius,
  opacity,
  brightness,
  hotColor,
  warmColor,
  coolColor
}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: diskVertexShader,
    fragmentShader: diskFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uInnerRadius: { value: innerRadius },
      uOuterRadius: { value: outerRadius },
      uOpacity: { value: opacity },
      uBrightness: { value: brightness },
      uHotColor: { value: new THREE.Color(hotColor) },
      uWarmColor: { value: new THREE.Color(warmColor) },
      uCoolColor: { value: new THREE.Color(coolColor) }
    }
  });
}

function createBandMaterial(color, opacity, thickness, softness) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: ringBandVertexShader,
    fragmentShader: ringBandFragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uThickness: { value: thickness },
      uSoftness: { value: softness }
    }
  });
}

const diskPlane = new THREE.PlaneGeometry(20, 20);

const mainDiskMaterial = createDiskMaterial({
  innerRadius: 0.24,
  outerRadius: 0.86,
  opacity: 0.95,
  brightness: 1.55,
  hotColor: 0xfff4c9,
  warmColor: 0xff9f34,
  coolColor: 0x2e1206
});

const glowDiskMaterial = createDiskMaterial({
  innerRadius: 0.18,
  outerRadius: 1.02,
  opacity: 0.28,
  brightness: 1.9,
  hotColor: 0xfff2d8,
  warmColor: 0xffb45e,
  coolColor: 0x351404
});

const mainDisk = new THREE.Mesh(diskPlane, mainDiskMaterial);
mainDisk.rotation.x = -Math.PI * 0.5;
mainDisk.renderOrder = 2;
diskGroup.add(mainDisk);

const glowDisk = new THREE.Mesh(diskPlane, glowDiskMaterial);
glowDisk.rotation.x = -Math.PI * 0.5;
glowDisk.position.y = -0.03;
glowDisk.scale.set(1.15, 1.15, 1.15);
glowDisk.renderOrder = 1;
diskGroup.add(glowDisk);

const blackHole = new THREE.Mesh(
  new THREE.SphereGeometry(2.1, 128, 128),
  new THREE.MeshBasicMaterial({ color: 0x000000 })
);
blackHole.renderOrder = 10;
blackHoleGroup.add(blackHole);

const shadowHalo = new THREE.Mesh(
  new THREE.RingGeometry(2.16, 3.15, 256),
  new THREE.MeshBasicMaterial({
    color: 0x180a02,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    depthWrite: false
  })
);
shadowHalo.rotation.x = -Math.PI * 0.5;
shadowHalo.renderOrder = 5;
blackHoleGroup.add(shadowHalo);

const photonRing = new THREE.Mesh(
  new THREE.RingGeometry(2.18, 2.5, 256),
  new THREE.MeshBasicMaterial({
    color: 0xffd37e,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false
  })
);
photonRing.rotation.x = -Math.PI * 0.5;
photonRing.renderOrder = 11;
blackHoleGroup.add(photonRing);

const lensShellMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  vertexShader: lensVertexShader,
  fragmentShader: lensFragmentShader,
  uniforms: {
    uTime: { value: 0 }
  }
});

const lensShell = new THREE.Mesh(
  new THREE.SphereGeometry(3.15, 128, 128),
  lensShellMaterial
);
lensShell.renderOrder = 9;
blackHoleGroup.add(lensShell);

const topBandMaterial = createBandMaterial(0xffe2a1, 0.78, 0.04, 0.08);
const bottomBandMaterial = createBandMaterial(0xffb95a, 0.42, 0.04, 0.08);

const topBand = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), topBandMaterial);
topBand.position.y = 1.08;
topBand.renderOrder = 8;
blackHoleGroup.add(topBand);

const bottomBand = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), bottomBandMaterial);
bottomBand.position.y = -1.08;
bottomBand.renderOrder = 4;
blackHoleGroup.add(bottomBand);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const distortionPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uAspect: { value: window.innerWidth / window.innerHeight },
    uStrength: { value: 0.12 },
    uRadius: { value: 0.22 },
    uInnerRadius: { value: 0.045 }
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
        vec2 offset = dir * pull * 0.18;

        warpedUv -= offset;

        float swirl = influence * 0.012;
        float s = sin(swirl);
        float c = cos(swirl);
        vec2 local = uv - uCenter;
        local.x *= uAspect;
        local = mat2(c, -s, s, c) * local;
        local.x /= uAspect;
        warpedUv = mix(warpedUv, uCenter + local, influence * 0.25);
      }

      vec4 color = texture2D(tDiffuse, warpedUv);
      gl_FragColor = color;
    }
  `
});
composer.addPass(distortionPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.25,
  0.85,
  0.2
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

  mainDiskMaterial.uniforms.uTime.value = t;
  glowDiskMaterial.uniforms.uTime.value = t * 0.8;
  lensShellMaterial.uniforms.uTime.value = t;

  photonRing.material.opacity = 0.9 + Math.sin(t * 1.8) * 0.03;
  topBandMaterial.uniforms.uOpacity.value = 0.76 + Math.sin(t * 1.3) * 0.03;
  bottomBandMaterial.uniforms.uOpacity.value = 0.40 + Math.sin(t * 1.1 + 0.4) * 0.03;

  topBand.lookAt(camera.position);
  bottomBand.lookAt(camera.position);

  starSphere.rotation.y += 0.00008;

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

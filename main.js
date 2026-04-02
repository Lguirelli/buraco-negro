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
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 2.2, 10.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 0.9;
controls.minDistance = 5.5;
controls.maxDistance = 22;
controls.minPolarAngle = 0.16;
controls.maxPolarAngle = Math.PI - 0.16;

const ambient = new THREE.AmbientLight(0xffffff, 0.06);
scene.add(ambient);

const warmLight = new THREE.PointLight(0xff8d36, 8, 60, 2);
warmLight.position.set(0, 0, 0);
scene.add(warmLight);

const coolLight = new THREE.PointLight(0x4a78ff, 1.2, 120, 2);
coolLight.position.set(-12, 8, -10);
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

  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;

    const rare = Math.random();
    let starSize = 0.22 + Math.random() * 0.95;
    let alpha = 0.22 + Math.random() * 0.6;

    if (rare > 0.992) {
      starSize = 1.4 + Math.random() * 1.8;
      alpha = 0.85;
    }

    const temp = Math.random();
    const red = Math.floor(220 + temp * 35);
    const green = Math.floor(220 + temp * 30);
    const blue = Math.floor(228 + temp * 22);

    ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, starSize, 0, Math.PI * 2);
    ctx.fill();
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
  new THREE.SphereGeometry(160, 32, 32),
  new THREE.MeshBasicMaterial({
    color: 0x080b12,
    transparent: true,
    opacity: 0.04,
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
  uniform float uVerticalScale;
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
    p.y *= uVerticalScale;

    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);

    float mask = ringMask(r, uInnerRadius, uOuterRadius, 0.04);

    float streaks =
      sin(a * 22.0 + r * 18.0 - uTime * 2.4) * 0.20 +
      sin(a * 46.0 - r * 13.0 - uTime * 1.5) * 0.12 +
      cos(a * 10.0 + r * 7.5 + uTime * 0.9) * 0.08;

    float turbulence =
      sin((p.x + p.y) * 20.0 + uTime * 0.7) * 0.05 +
      cos((p.x - p.y) * 14.0 - uTime * 0.9) * 0.05;

    float pattern = clamp(0.82 + streaks + turbulence, 0.0, 1.35);

    float hot = 1.0 - smoothstep(uInnerRadius, uInnerRadius + 0.10, r);
    float warm = 1.0 - smoothstep(uInnerRadius + 0.06, uOuterRadius - 0.03, r);
    float outer = smoothstep(uInnerRadius + 0.04, uOuterRadius, r);

    vec3 color = mix(uCoolColor, uWarmColor, clamp(warm, 0.0, 1.0));
    color = mix(color, uHotColor, clamp(hot, 0.0, 1.0));
    color *= mix(0.82, 1.18, pattern);
    color *= mix(0.88, 1.08, outer);
    color *= uBrightness;

    float alpha = mask * pattern * uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

const bandVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const bandFragmentShader = `
  precision highp float;

  varying vec2 vUv;

  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uRadius;
  uniform float uThickness;
  uniform float uVerticalScale;
  uniform float uSoftness;

  void main() {
    vec2 p = vUv - 0.5;
    p.y *= uVerticalScale;

    float r = length(p) * 2.0;

    float outer = 1.0 - smoothstep(uRadius + uThickness, uRadius + uThickness + uSoftness, r);
    float inner = smoothstep(uRadius - uThickness - uSoftness, uRadius - uThickness, r);
    float ring = outer * inner;

    float sideFade = 1.0 - smoothstep(0.88, 1.0, abs(p.x) * 2.0);
    float alpha = ring * sideFade * uOpacity;

    gl_FragColor = vec4(uColor, alpha);
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
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 3.4);
    float pulse = 0.94 + sin(uTime * 1.1) * 0.03;
    vec3 color = vec3(0.08, 0.15, 0.34) * fresnel * pulse;
    gl_FragColor = vec4(color, fresnel * 0.12);
  }
`;

function createDiskMaterial({
  innerRadius,
  outerRadius,
  opacity,
  brightness,
  verticalScale,
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
      uVerticalScale: { value: verticalScale },
      uHotColor: { value: new THREE.Color(hotColor) },
      uWarmColor: { value: new THREE.Color(warmColor) },
      uCoolColor: { value: new THREE.Color(coolColor) }
    }
  });
}

function createBandMaterial({
  color,
  opacity,
  radius,
  thickness,
  verticalScale,
  softness
}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: bandVertexShader,
    fragmentShader: bandFragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uRadius: { value: radius },
      uThickness: { value: thickness },
      uVerticalScale: { value: verticalScale },
      uSoftness: { value: softness }
    }
  });
}

const diskPlane = new THREE.PlaneGeometry(34, 34);

const mainDiskMaterial = createDiskMaterial({
  innerRadius: 0.19,
  outerRadius: 0.62,
  opacity: 0.78,
  brightness: 0.95,
  verticalScale: 0.085,
  hotColor: 0xffefbf,
  warmColor: 0xff982f,
  coolColor: 0x250d04
});

const glowDiskMaterial = createDiskMaterial({
  innerRadius: 0.15,
  outerRadius: 0.74,
  opacity: 0.16,
  brightness: 1.0,
  verticalScale: 0.085,
  hotColor: 0xffe8c6,
  warmColor: 0xffb65a,
  coolColor: 0x301106
});

const mainDisk = new THREE.Mesh(diskPlane, mainDiskMaterial);
mainDisk.rotation.x = -Math.PI * 0.5;
mainDisk.renderOrder = 2;
diskGroup.add(mainDisk);

const glowDisk = new THREE.Mesh(diskPlane, glowDiskMaterial);
glowDisk.rotation.x = -Math.PI * 0.5;
glowDisk.position.y = -0.02;
glowDisk.scale.set(1.05, 1.05, 1.05);
glowDisk.renderOrder = 1;
diskGroup.add(glowDisk);

const blackHole = new THREE.Mesh(
  new THREE.SphereGeometry(1.68, 128, 128),
  new THREE.MeshBasicMaterial({ color: 0x000000 })
);
blackHole.renderOrder = 10;
blackHoleGroup.add(blackHole);

const photonRing = new THREE.Mesh(
  new THREE.RingGeometry(1.72, 1.96, 256),
  new THREE.MeshBasicMaterial({
    color: 0xffd27e,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false
  })
);
photonRing.rotation.x = -Math.PI * 0.5;
photonRing.renderOrder = 11;
blackHoleGroup.add(photonRing);

const shadowHalo = new THREE.Mesh(
  new THREE.RingGeometry(1.75, 2.55, 256),
  new THREE.MeshBasicMaterial({
    color: 0x120702,
    transparent: true,
    opacity: 0.22,
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
  vertexShader: lensVertexShader,
  fragmentShader: lensFragmentShader,
  uniforms: {
    uTime: { value: 0 }
  }
});

const lensShell = new THREE.Mesh(
  new THREE.SphereGeometry(2.38, 128, 128),
  lensShellMaterial
);
lensShell.renderOrder = 9;
blackHoleGroup.add(lensShell);

const bandGeometry = new THREE.PlaneGeometry(8.4, 2.2);

const topBandMaterial = createBandMaterial({
  color: 0xffddb0,
  opacity: 0.52,
  radius: 0.64,
  thickness: 0.030,
  verticalScale: 0.34,
  softness: 0.07
});

const bottomBandMaterial = createBandMaterial({
  color: 0xffb75a,
  opacity: 0.28,
  radius: 0.64,
  thickness: 0.026,
  verticalScale: 0.34,
  softness: 0.07
});

const topBand = new THREE.Mesh(bandGeometry, topBandMaterial);
topBand.position.y = 0.86;
topBand.scale.set(1.0, 0.82, 1.0);
topBand.renderOrder = 8;
blackHoleGroup.add(topBand);

const bottomBand = new THREE.Mesh(bandGeometry, bottomBandMaterial);
bottomBand.position.y = -0.86;
bottomBand.scale.set(1.0, 0.74, 1.0);
bottomBand.renderOrder = 4;
blackHoleGroup.add(bottomBand);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const distortionPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uAspect: { value: window.innerWidth / window.innerHeight },
    uStrength: { value: 0.045 },
    uRadius: { value: 0.16 },
    uInnerRadius: { value: 0.035 }
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
  0.62,
  0.55,
  0.42
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
  glowDiskMaterial.uniforms.uTime.value = t * 0.82;
  lensShellMaterial.uniforms.uTime.value = t;

  photonRing.material.opacity = 0.74 + Math.sin(t * 1.6) * 0.02;
  topBandMaterial.uniforms.uOpacity.value = 0.50 + Math.sin(t * 1.2) * 0.02;
  bottomBandMaterial.uniforms.uOpacity.value = 0.26 + Math.sin(t * 1.0 + 0.3) * 0.02;

  topBand.lookAt(camera.position);
  bottomBand.lookAt(camera.position);

  starSphere.rotation.y += 0.00005;

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

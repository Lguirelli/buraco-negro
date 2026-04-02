import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import vertexShader from './shaders/blackHole.vert.glsl?raw';
import fragmentShader from './shaders/blackHole.frag.glsl?raw';
import './styles.css';

const app = document.querySelector('#app');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const hud = document.createElement('div');
hud.className = 'hud';
hud.innerHTML = `
  <h1 class="hud__title">Gargantua</h1>
  <p class="hud__text">Drag to orbit. Scroll to zoom. The black hole remains locked at the scene center.</p>
`;
document.body.appendChild(hud);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 2.8, 12);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.85;
controls.zoomSpeed = 0.95;
controls.panSpeed = 0.0;
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

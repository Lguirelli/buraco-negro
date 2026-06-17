import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let scene;
let camera;
let renderer;
let model;

init();
animate();

function init() {
  const canvas = document.querySelector('#scene');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4a4a4a);

  camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.01,
    5000
  );

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;

  const ambient = new THREE.AmbientLight(0xffffff, 1.8);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 2.5);
  directional.position.set(5, 8, 6);
  scene.add(directional);

  const fill = new THREE.DirectionalLight(0xffffff, 1.2);
  fill.position.set(-5, 3, 5);
  scene.add(fill);

  const loader = new GLTFLoader();

  loader.load(
    '/assets/model.glb',
    (gltf) => {
      model = gltf.scene;
      scene.add(model);
      fitCameraToObject(model);
      console.log('GLB carregado com sucesso:', gltf);
    },
    (progress) => {
      const total = progress.total || 1;
      console.log(`Carregando GLB: ${((progress.loaded / total) * 100).toFixed(1)}%`);
    },
    (error) => {
      console.error('Erro ao carregar o GLB:', error);
    }
  );

  window.addEventListener('resize', onResize);
}

function fitCameraToObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  box.getSize(size);
  box.getCenter(center);

  object.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

  cameraZ *= 1.8;

  camera.position.set(0, maxDim * 0.25, cameraZ);
  camera.lookAt(0, 0, 0);

  camera.near = Math.max(maxDim / 100, 0.01);
  camera.far = Math.max(maxDim * 100, 1000);
  camera.updateProjectionMatrix();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function animate() {
  requestAnimationFrame(animate);

  if (model) {
    model.rotation.y += 0.002;
  }

  renderer.render(scene, camera);
}

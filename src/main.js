import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer, model;

init();
animate();

function init() {
  const canvas = document.querySelector('#scene');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0d0d);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.2, 3);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1.2);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1);
  dir.position.set(3, 5, 2);
  scene.add(dir);

  const loader = new GLTFLoader();
  loader.load('/assets/model.glb', (gltf) => {
    model = gltf.scene;
    model.scale.set(1, 1, 1);
    scene.add(model);
  });

  window.addEventListener('resize', onResize);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  if (model) model.rotation.y += 0.003;

  renderer.render(scene, camera);
}

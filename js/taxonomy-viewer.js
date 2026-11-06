import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE_COLOR = [180, 180, 180];
let scene, camera, controls, renderer, canvas;
let currentMesh = null;
let currentLabels = null;
let manifest = null;
let isInitialized = false;

/**
 * Force le rendu d'une image unique (On-demand rendering)
 */
function requestRender() {
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/**
 * Initialise la scène Three.js
 */
function initViewer() {
  canvas = document.getElementById('canvas-taxonomy');
  if (!canvas) return false;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  // Limite le ratio de pixels pour éviter de ramer sur les écrans 4K/Retina
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef0f2);

  camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.001, 1000);
  
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  
  // On ne rend la scène que quand la caméra bouge
  controls.addEventListener('change', requestRender);

  // Lumières
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.8);
  d1.position.set(1, 1, 1);
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.3);
  d2.position.set(-1, -0.5, -1);
  scene.add(d2);

  function resize() {
    const parent = canvas.parentElement;
    renderer.setSize(parent.clientWidth, parent.clientHeight);
    camera.aspect = parent.clientWidth / parent.clientHeight;
    camera.updateProjectionMatrix();
    requestRender();
  }

  function animate() {
    requestAnimationFrame(animate);
    // update() renvoie true si l'inertie (damping) fait encore bouger la caméra
    if (controls.update()) {
       renderer.render(scene, camera);
    }
  }

  window.addEventListener('resize', resize);
  resize();
  animate();
  return true;
}

/**
 * Libère proprement la mémoire du GPU
 */
function disposeCurrentMesh() {
  if (currentMesh) {
    currentMesh.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (child.material.isMaterial) {
          child.material.dispose();
        } else if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        }
      }
    });
    scene.remove(currentMesh);
  }
}

/**
 * Met à jour les couleurs des sommets selon la taxonomie sélectionnée
 */
function updateVertexColors() {
  if (!currentMesh || !currentLabels) return;

  const buttons = Array.from(document.querySelectorAll('.taxonomy-toggle'));
  const buttonOrder = buttons.map((b) => b.dataset.category);
  const activeCategories = new Set();
  buttons.forEach((btn) => {
    if (btn.classList.contains('is-active')) activeCategories.add(btn.dataset.category);
  });

  currentMesh.traverse((child) => {
    if (!child.isMesh) return;

    // Création de l'attribut couleur s'il n'existe pas dans le GLB
    if (!child.geometry.attributes.color) {
      const count = child.geometry.attributes.position.count;
      child.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    }

    const colorAttr = child.geometry.attributes.color;
    const labels = currentLabels.vertex_labels;
    const catColors = currentLabels.category_colors;
    const br = BASE_COLOR[0] / 255, bg = BASE_COLOR[1] / 255, bb = BASE_COLOR[2] / 255;

    for (let i = 0; i < colorAttr.count; i++) {
      const label = labels[i];
      
      if (!label || label === 'none') {
        colorAttr.setXYZ(i, br, bg, bb);
        continue;
      }

      const cats = label.split('+');
      const activeCats = cats.filter((c) => activeCategories.has(c));

      if (activeCats.length === 0) {
        colorAttr.setXYZ(i, br, bg, bb);
      } else {
        // Logique de priorité : le bouton le plus à droite gagne
        let winner = activeCats[0];
        let bestPrio = -1;
        for (const cat of activeCats) {
          const prio = buttonOrder.indexOf(cat);
          if (prio > bestPrio) { bestPrio = prio; winner = cat; }
        }
        const c = catColors[winner];
        colorAttr.setXYZ(i, c[0] / 255, c[1] / 255, c[2] / 255);
      }
    }
    colorAttr.needsUpdate = true;
  });
  requestRender();
}

/**
 * Charge un nouvel objet GLB et ses labels JSON
 */
async function loadObject(objId) {
  if (!manifest || !manifest[objId]) return;
  const entry = manifest[objId];

  disposeCurrentMesh();

  try {
    const labelsResp = await fetch(`assets/meshes/${entry.labels}`).then((r) => r.json());
    currentLabels = labelsResp;

    const loader = new GLTFLoader();
    loader.load(`assets/meshes/${entry.glb}`, (gltf) => {
      currentMesh = gltf.scene;
      currentMesh.traverse((child) => {
        if (child.isMesh) {
          child.geometry.computeVertexNormals();
          child.material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            shininess: 30
          });
        }
      });
      scene.add(currentMesh);
      frameCamera(currentMesh, objId);
      updateVertexColors();
    });
    updateButtons(entry.categories);
  } catch (err) {
    console.error('[taxonomy] Error loading object:', err);
  }
}

/**
 * Centre la caméra sur l'objet chargé
 */
const CAMERA_OVERRIDES = {
  '13': { axis: 'y', sign: 1, rotateX: Math.PI, rotateY: Math.PI },
};

function frameCamera(obj3d, objId) {
  const override = CAMERA_OVERRIDES[objId];
  if (override && override.rotateX) obj3d.rotation.x = override.rotateX;
  if (override && override.rotateY) obj3d.rotation.y = override.rotateY;

  const box = new THREE.Box3().setFromObject(obj3d);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const dist = Math.max(size.x, size.y, size.z) * 2.2;

  controls.target.copy(center);
  camera.position.copy(center);
  camera.up.set(0, 1, 0);

  if (override) {
    camera.position[override.axis] += dist * override.sign;
  } else {
    camera.position.z += dist;
  }

  camera.updateProjectionMatrix();
  controls.update();
  requestRender();
}

/**
 * Initialisation via Intersection Observer (Lazy Loading)
 */
document.addEventListener('DOMContentLoaded', () => {
  const section = document.getElementById('taxonomy');
  if (!section) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (entry.isIntersecting && !isInitialized) {
        isInitialized = true;
        await startExperience();
      }
    });
  }, { threshold: 0.1 });

  observer.observe(section);
});

/**
 * Démarre réellement l'expérience une fois la section visible
 */
async function startExperience() {
  if (!initViewer()) return;

  try {
    const resp = await fetch('data/taxonomy_manifest.json?v=' + Date.now());
    manifest = await resp.json();
  } catch (e) { return; }

  const tabs = document.getElementById('taxonomy-object-tabs');
  const orderedKeys = ['15', '22', '04', '13', '14'].filter((k) => k in manifest);
  
  tabs.innerHTML = '';
  orderedKeys.forEach((objId, idx) => {
    const entry = manifest[objId];
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = entry.name;
    if (idx === 0) a.classList.add('active');
    
    a.addEventListener('click', (e) => {
      e.preventDefault();
      tabs.querySelectorAll('a').forEach((t) => t.classList.remove('active'));
      a.classList.add('active');
      loadObject(objId);
    });
    li.appendChild(a);
    tabs.appendChild(li);
  });

  loadObject(orderedKeys[0]);
}

/**
 * Recrée les boutons de catégories selon l'objet sélectionné
 */
function updateButtons(categories) {
  const container = document.getElementById('taxonomy-buttons');
  if (!container) return;
  container.innerHTML = '';

  const allCategoryMeta = {
    lambertian: { color: '#8BC34A', label: 'Lambertian' },
    specular: { color: '#FF9800', label: 'Specular' },
    transparent: { color: '#03A9F4', label: 'Transparent' },
    not_textured: { color: '#9C27B0', label: 'Textureless' },
    fine_structure: { color: '#F44336', label: 'Fine Structure' },
  };

  categories.forEach(cat => {
    const meta = allCategoryMeta[cat];
    if (!meta) return;
    const btn = document.createElement('button');
    btn.className = 'button is-small taxonomy-toggle is-active';
    btn.style.setProperty('--cat-color', meta.color);
    btn.textContent = meta.label;
    btn.dataset.category = cat;
    
    btn.addEventListener('click', () => {
      btn.classList.toggle('is-active');
      updateVertexColors();
    });
    container.appendChild(btn);
  });
}
// Import necessary modules
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Initialize the scene
const scene = new THREE.Scene();

// Create a camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Create the renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add OrbitControls for user interaction
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth out the rotation
controls.dampingFactor = 0.05;

// Load the 3D model
const loader = new GLTFLoader();
let snitchModel; // To store the loaded model

loader.load(
    './golden_snitch__harry_potter/scene.gltf', 
    (gltf) => {
        snitchModel = gltf.scene;
        scene.add(snitchModel);

        // Optional: Adjust model scale and position
        snitchModel.scale.set(1, 1, 1); // Adjust scale if needed
        snitchModel.position.set(0, 0, 0);
    },
    undefined, // Progress callback
    (error) => {
        console.error('An error occurred while loading the model:', error);
    }
);

// Animation loop with flying and rotating effect
let time = 0; // To control the position of the Golden Snitch

function animate() {
    requestAnimationFrame(animate);

    // Move the snitch model across the screen
    if (snitchModel) {
        time += 0.01; // Control the speed of the flying effect
        snitchModel.position.x = Math.sin(time) * 5; // Move in a circular path
        snitchModel.position.y = Math.cos(time) * 2; // Adjust height

        // Rotate the snitch model
        snitchModel.rotation.x += 0.05; // Rotate around X-axis
        snitchModel.rotation.y += 0.05; // Rotate around Y-axis
    }

    // Update OrbitControls (for rotation and user interaction)
    controls.update();

    renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Add a basic light to illuminate the model
const ambientLight = new THREE.AmbientLight(0xFFFFFF, 1.5); // Increased intensity for more brightness
scene.add(ambientLight);

// Add a stronger directional light (like sunlight)
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5); // Increased intensity for more brightness
directionalLight.position.set(5, 5, 5).normalize();
scene.add(directionalLight);

// Add a second directional light for better illumination
const directionalLight2 = new THREE.DirectionalLight(0xFFFFFF, 1); 
directionalLight2.position.set(-5, -5, -5).normalize();
scene.add(directionalLight2);

// Optional: Add a HemisphereLight for softer illumination from above
const hemisphereLight = new THREE.HemisphereLight(0xFFFFFF, 0xFFFFFF, 0.6); // Soft ambient light from above
scene.add(hemisphereLight);

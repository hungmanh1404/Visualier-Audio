import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Configuration
const CONFIG = {
    fftSize: 2048,
    smoothingTimeConstant: 0.85,
    particleCount: 15000,
    bloomStrength: 1.5,
    bloomRadius: 0.4,
    bloomThreshold: 0.1
};

// State
let audioContext, analyser, dataArray;
let scene, camera, renderer, composer;
let uniforms, particles;
let isAudioActive = false;

// DOM Elements
const overlay = document.getElementById('overlay');
const btnSystem = document.getElementById('btn-system');
const btnMic = document.getElementById('btn-mic');

// Shaders for Cosmic Particles
const vertexShader = `
    uniform float uTime;
    uniform float uAudioLow;
    uniform float uAudioMid;
    uniform float uAudioHigh;
    attribute float aScale;
    attribute vec3 aRandomness;
    varying vec3 vColor;
    varying vec2 vUv;

    void main() {
        vUv = uv;
        vec3 pos = position;
        
        // Cosmic swirl movement
        float angle = uTime * 0.1 + length(pos.xy) * 0.5;
        float radius = length(pos.xy);
        
        // Rotate based on radius (vortex effect)
        float c = cos(angle);
        float s = sin(angle);
        vec3 rotatedPos = vec3(
            pos.x * c - pos.y * s,
            pos.x * s + pos.y * c,
            pos.z
        );
        
        // Audio reactivity: Pulse outwards
        rotatedPos += normalize(rotatedPos) * uAudioLow * 2.0 * aRandomness.x;
        
        // Turbulence from Mids
        rotatedPos.x += sin(uTime * 2.0 + pos.y) * uAudioMid * aRandomness.y;
        rotatedPos.y += cos(uTime * 2.0 + pos.x) * uAudioMid * aRandomness.y;
        
        // Highs affect Z-depth (twinkle movement)
        rotatedPos.z += uAudioHigh * 5.0 * aRandomness.z;

        vec4 mvPosition = modelViewMatrix * vec4(rotatedPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        // Size attenuation
        gl_PointSize = aScale * (300.0 / -mvPosition.z);
        
        // Color variation based on position and audio
        vec3 color1 = vec3(0.1, 0.0, 0.3); // Deep Void Purple
        vec3 color2 = vec3(0.0, 0.5, 1.0); // Electric Blue
        vec3 color3 = vec3(1.0, 0.2, 0.5); // Nebula Pink
        vec3 color4 = vec3(1.0, 0.9, 0.4); // Star Gold
        
        float mix1 = smoothstep(-5.0, 5.0, pos.x);
        vec3 baseColor = mix(color1, color2, mix1);
        
        // Highs make it brighter/whiter
        vColor = mix(baseColor, color3, uAudioMid);
        vColor = mix(vColor, color4, uAudioHigh * aRandomness.z);
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    
    void main() {
        // Circular particle
        float strength = distance(gl_PointCoord, vec2(0.5));
        strength = 1.0 - strength;
        strength = pow(strength, 3.0);
        
        vec3 finalColor = vColor * strength;
        
        // Add glow
        gl_FragColor = vec4(finalColor, strength);
    }
`;

function init() {
    // Scene Setup
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.02);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 15;
    camera.position.y = 5;
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('canvas'),
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ReinhardToneMapping;

    // Post-Processing (Bloom)
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        CONFIG.bloomStrength,
        CONFIG.bloomRadius,
        CONFIG.bloomThreshold
    );

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Particles Geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(CONFIG.particleCount * 3);
    const scales = new Float32Array(CONFIG.particleCount);
    const randomness = new Float32Array(CONFIG.particleCount * 3);

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const i3 = i * 3;

        // Galaxy/Nebula distribution
        const radius = Math.random() * 10 + 2;
        const spinAngle = radius * 0.5;
        const branchAngle = (i % 3) * ((2 * Math.PI) / 3);

        const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 2;
        const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 2;
        const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 2;

        positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
        positions[i3 + 1] = randomY * 2; // Vertical spread
        positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

        scales[i] = Math.random();

        randomness[i3] = Math.random();
        randomness[i3 + 1] = Math.random();
        randomness[i3 + 2] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aRandomness', new THREE.BufferAttribute(randomness, 3));

    // Material
    uniforms = {
        uTime: { value: 0 },
        uAudioLow: { value: 0 },
        uAudioMid: { value: 0 },
        uAudioHigh: { value: 0 }
    };

    const material = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Resize Handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now() * 0.001;
    uniforms.uTime.value = time;

    // Rotate entire system slowly
    particles.rotation.y = time * 0.05;

    if (isAudioActive && analyser) {
        analyser.getByteFrequencyData(dataArray);

        const bufferLength = analyser.frequencyBinCount;
        const lowBound = Math.floor(bufferLength * 0.1);
        const midBound = Math.floor(bufferLength * 0.5);

        let lowSum = 0, midSum = 0, highSum = 0;

        for (let i = 0; i < bufferLength; i++) {
            const val = dataArray[i] / 255.0;
            if (i < lowBound) lowSum += val;
            else if (i < midBound) midSum += val;
            else highSum += val;
        }

        // Smooth transitions
        uniforms.uAudioLow.value = THREE.MathUtils.lerp(uniforms.uAudioLow.value, lowSum / lowBound, 0.15);
        uniforms.uAudioMid.value = THREE.MathUtils.lerp(uniforms.uAudioMid.value, midSum / (midBound - lowBound), 0.15);
        uniforms.uAudioHigh.value = THREE.MathUtils.lerp(uniforms.uAudioHigh.value, highSum / (bufferLength - midBound), 0.15);
    } else {
        // Demo Mode: Cosmic Breathing
        const lowSim = (Math.sin(time * 1.0) * 0.5 + 0.5) * 0.5;
        const midSim = (Math.sin(time * 2.3) * 0.5 + 0.5) * 0.3;
        const highSim = (Math.sin(time * 4.5) * 0.5 + 0.5) * 0.2;

        uniforms.uAudioLow.value = THREE.MathUtils.lerp(uniforms.uAudioLow.value, lowSim, 0.05);
        uniforms.uAudioMid.value = THREE.MathUtils.lerp(uniforms.uAudioMid.value, midSim, 0.05);
        uniforms.uAudioHigh.value = THREE.MathUtils.lerp(uniforms.uAudioHigh.value, highSim, 0.05);
    }

    composer.render();
}

async function startAudio(sourceType) {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = CONFIG.fftSize;

        let stream;

        if (sourceType === 'system') {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
        } else {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
        }

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        dataArray = new Uint8Array(analyser.frequencyBinCount);
        isAudioActive = true;

        overlay.classList.add('hidden');

    } catch (err) {
        console.error("Error accessing audio:", err);
        if (confirm("Could not access audio (Permission denied?). \n\nDo you want to continue in Demo Mode (simulated visuals)?")) {
            overlay.classList.add('hidden');
        }
    }
}

// Event Listeners
btnSystem.addEventListener('click', () => startAudio('system'));
btnMic.addEventListener('click', () => startAudio('mic'));
document.getElementById('btn-demo').addEventListener('click', () => {
    overlay.classList.add('hidden');
});

init();

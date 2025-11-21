import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- Configuration ---
const CONFIG = {
    fftSize: 2048,
    smoothingTimeConstant: 0.85,
    bloomStrength: 1.5,
    bloomRadius: 0.4,
    bloomThreshold: 0.1
};

// --- Global State ---
let audioContext, analyser, dataArray;
let manager;
let isAudioActive = false;

// --- Audio Logic ---
async function startAudio(sourceType) {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (analyser) {
            analyser.disconnect();
        }

        analyser = audioContext.createAnalyser();
        analyser.fftSize = CONFIG.fftSize;
        analyser.smoothingTimeConstant = CONFIG.smoothingTimeConstant;

        let stream;
        if (sourceType === 'system') {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } else {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        dataArray = new Uint8Array(analyser.frequencyBinCount);
        isAudioActive = true;

        document.getElementById('overlay').classList.add('hidden');
        document.getElementById('controls').classList.remove('hidden');

    } catch (err) {
        console.error("Error accessing audio:", err);
        alert("Error accessing audio: " + err.message + "\n\nPlease ensure you are using a supported browser (Chrome/Edge/Safari) and have granted permissions.");
        if (confirm("Do you want to continue in Demo Mode?")) {
            document.getElementById('overlay').classList.add('hidden');
            document.getElementById('controls').classList.remove('hidden');
        }
    }
}

// --- Visual Effects ---

class CosmicEffect {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.init();
    }

    init() {
        const particleCount = 15000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const scales = new Float32Array(particleCount);
        const randomness = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const radius = Math.random() * 10 + 2;
            const spinAngle = radius * 0.5;
            const branchAngle = (i % 3) * ((2 * Math.PI) / 3);

            const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 2;
            const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 2;
            const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 2;

            positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
            positions[i3 + 1] = randomY * 2;
            positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

            scales[i] = Math.random();
            randomness[i3] = Math.random();
            randomness[i3 + 1] = Math.random();
            randomness[i3 + 2] = Math.random();
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
        geometry.setAttribute('aRandomness', new THREE.BufferAttribute(randomness, 3));

        this.uniforms = {
            uTime: { value: 0 },
            uAudioLow: { value: 0 },
            uAudioMid: { value: 0 },
            uAudioHigh: { value: 0 }
        };

        const material = new THREE.ShaderMaterial({
            vertexShader: `
                uniform float uTime;
                uniform float uAudioLow;
                uniform float uAudioMid;
                uniform float uAudioHigh;
                attribute float aScale;
                attribute vec3 aRandomness;
                varying vec3 vColor;
                void main() {
                    vec3 pos = position;
                    float angle = uTime * 0.1 + length(pos.xy) * 0.5;
                    float c = cos(angle); float s = sin(angle);
                    vec3 rotatedPos = vec3(pos.x * c - pos.y * s, pos.x * s + pos.y * c, pos.z);
                    rotatedPos += normalize(rotatedPos) * uAudioLow * 2.0 * aRandomness.x;
                    rotatedPos.x += sin(uTime * 2.0 + pos.y) * uAudioMid * aRandomness.y;
                    rotatedPos.y += cos(uTime * 2.0 + pos.x) * uAudioMid * aRandomness.y;
                    rotatedPos.z += uAudioHigh * 5.0 * aRandomness.z;
                    vec4 mvPosition = modelViewMatrix * vec4(rotatedPos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    gl_PointSize = aScale * (300.0 / -mvPosition.z);
                    vec3 color1 = vec3(0.1, 0.0, 0.3);
                    vec3 color2 = vec3(0.0, 0.5, 1.0);
                    vec3 color3 = vec3(1.0, 0.2, 0.5);
                    vec3 color4 = vec3(1.0, 0.9, 0.4);
                    float mix1 = smoothstep(-5.0, 5.0, pos.x);
                    vec3 baseColor = mix(color1, color2, mix1);
                    vColor = mix(baseColor, color3, uAudioMid);
                    vColor = mix(vColor, color4, uAudioHigh * aRandomness.z);
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                void main() {
                    float strength = distance(gl_PointCoord, vec2(0.5));
                    strength = 1.0 - strength;
                    strength = pow(strength, 3.0);
                    gl_FragColor = vec4(vColor * strength, strength);
                }
            `,
            uniforms: this.uniforms,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.mesh = new THREE.Points(geometry, material);
        this.group.add(this.mesh);
    }

    update(time, audioData) {
        this.uniforms.uTime.value = time;
        this.uniforms.uAudioLow.value = audioData.low;
        this.uniforms.uAudioMid.value = audioData.mid;
        this.uniforms.uAudioHigh.value = audioData.high;
        this.mesh.rotation.y = time * 0.05;
    }

    dispose() {
        this.scene.remove(this.group);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

class WaveEffect {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.init();
    }

    init() {
        // --- Retro-Futuristic Terrain ---
        // High segment count for smooth waves
        const geometry = new THREE.PlaneGeometry(150, 150, 64, 64);
        geometry.rotateX(-Math.PI / 2);

        // Initialize colors attribute
        const count = geometry.attributes.position.count;
        const colors = new Float32Array(count * 3);
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.MeshBasicMaterial({
            vertexColors: true,
            wireframe: true,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        this.terrain = new THREE.Mesh(geometry, material);
        this.group.add(this.terrain);

        // --- Synthwave Sun ---
        const sunGeo = new THREE.CircleGeometry(25, 64);
        // Create a gradient texture for the sun
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 128);
        grad.addColorStop(0, '#ffcc00');
        grad.addColorStop(0.5, '#ff0055');
        grad.addColorStop(1, '#aa00cc');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);

        // Add "scanlines" to sun
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for (let i = 0; i < 128; i += 4) {
            ctx.fillRect(0, i, 128, 1);
        }

        const sunTex = new THREE.CanvasTexture(canvas);

        const sunMat = new THREE.MeshBasicMaterial({
            map: sunTex,
            transparent: true,
            color: 0xffffff
        });

        this.sun = new THREE.Mesh(sunGeo, sunMat);
        this.sun.position.set(0, 20, -60);
        this.group.add(this.sun);

        // --- Floating Particles ---
        const pGeo = new THREE.BufferGeometry();
        const pCount = 500;
        const pPos = new Float32Array(pCount * 3);
        for (let i = 0; i < pCount * 3; i++) {
            pPos[i] = (Math.random() - 0.5) * 150;
        }
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        this.particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
            color: 0x00ffff,
            size: 0.3,
            transparent: true,
            opacity: 0.6
        }));
        this.group.add(this.particles);
    }

    update(time, audioData) {
        // 1. Animate Terrain Waves
        const positions = this.terrain.geometry.attributes.position;
        const colors = this.terrain.geometry.attributes.color;
        const count = positions.count;

        // We'll use a scrolling offset to simulate forward movement
        const scrollSpeed = time * 2.0;

        for (let i = 0; i < count; i++) {
            const x = positions.getX(i);
            // We use the original Z (depth) to calculate waves
            // Since we can't easily store original Z in a simple loop without extra memory,
            // we can derive it if we assume the grid is regular.
            // But for simplicity, let's just use the current X and Z (which doesn't change in X/Z plane, only Y changes).
            // Wait, getZ(i) returns the Z coordinate.
            const z = positions.getZ(i);

            // Calculate Wave Height (Y)
            let y = 0;

            // Base rolling terrain (perlin-like using sines)
            y += Math.sin(x * 0.15 + z * 0.1 + time) * 2.0;
            y += Math.cos(x * 0.1 - z * 0.1 + time * 0.5) * 2.0;

            // Audio Reaction:
            // Bass creates a large central pulse
            const dist = Math.sqrt(x * x + z * z);
            const ripple = Math.sin(dist * 0.5 - time * 5.0);
            y += ripple * audioData.low * 5.0;

            // Mids create jagged noise
            if (audioData.mid > 0.1) {
                y += Math.sin(x * 2.0 + time * 10.0) * Math.cos(z * 2.0) * audioData.mid * 2.0;
            }

            // Highs create fine detail
            y += Math.sin(x * 5.0) * Math.sin(z * 5.0) * audioData.high * 1.0;

            positions.setY(i, y);

            // continuous Color Logic
            // Map height and time to color
            // We want a continuous flow of colors

            // Base Hue rotates with time
            const baseHue = (time * 0.1) % 1.0;

            // Local hue variation based on height
            const localHue = (baseHue + y * 0.02) % 1.0;

            // Intensity based on audio
            const lightness = 0.3 + audioData.mid * 0.4 + (y > 2 ? 0.3 : 0);

            const color = new THREE.Color().setHSL(localHue, 1.0, lightness);
            colors.setXYZ(i, color.r, color.g, color.b);
        }

        positions.needsUpdate = true;
        colors.needsUpdate = true;

        // 2. Animate Sun
        // Pulse with bass
        const scale = 1.0 + audioData.low * 0.3;
        this.sun.scale.set(scale, scale, 1);

        // Rotate sun color slightly
        this.sun.material.color.setHSL((time * 0.02) % 1.0, 1.0, 0.8);

        // 3. Animate Particles
        this.particles.rotation.y = time * 0.1;
        this.particles.position.y = Math.sin(time) * 2.0;
    }

    dispose() {
        this.scene.remove(this.group);
        this.terrain.geometry.dispose();
        this.terrain.material.dispose();
        this.sun.geometry.dispose();
        this.sun.material.dispose();
        this.particles.geometry.dispose();
        this.particles.material.dispose();
    }
}

class LightShowEffect {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.init();
    }

    init() {
        // Abstract flowing shapes
        const geometry = new THREE.IcosahedronGeometry(1, 6);
        this.uniforms = {
            uTime: { value: 0 },
            uAudio: { value: 0 }
        };

        const material = new THREE.ShaderMaterial({
            vertexShader: `
                uniform float uTime;
                uniform float uAudio;
                varying vec3 vNormal;
                varying vec3 vPos;
                
                // Simplex noise (omitted for brevity, using sine approximation)
                float noise(vec3 p) {
                    return sin(p.x*5.0+uTime) * sin(p.y*3.0+uTime) * sin(p.z*4.0);
                }

                void main() {
                    vNormal = normal;
                    vec3 pos = position;
                    float d = noise(pos + uTime * 0.5);
                    pos += normal * d * (0.5 + uAudio);
                    vPos = pos;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying vec3 vNormal;
                varying vec3 vPos;
                
                void main() {
                    vec3 color = 0.5 + 0.5 * cos(uTime + vPos.xyx + vec3(0,2,4));
                    float glow = dot(vNormal, vec3(0,0,1));
                    gl_FragColor = vec4(color * glow * 2.0, 1.0);
                }
            `,
            uniforms: this.uniforms,
            wireframe: true
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.group.add(this.mesh);

        // Background particles
        const pGeo = new THREE.BufferGeometry();
        const pCount = 1000;
        const pPos = new Float32Array(pCount * 3);
        for (let i = 0; i < pCount * 3; i++) pPos[i] = (Math.random() - 0.5) * 50;
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        this.particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 }));
        this.group.add(this.particles);
    }

    update(time, audioData) {
        this.uniforms.uTime.value = time;
        this.uniforms.uAudio.value = audioData.mid;

        this.mesh.rotation.x = time * 0.2;
        this.mesh.rotation.y = time * 0.3;

        // Scale with bass
        const s = 2 + audioData.low * 3;
        this.mesh.scale.set(s, s, s);

        this.particles.rotation.y = time * 0.05;
    }

    dispose() {
        this.scene.remove(this.group);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.particles.geometry.dispose();
        this.particles.material.dispose();
    }
}

class FireworksEffect {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.particles = [];
        this.rockets = [];
        this.lastLaunchTime = 0;

        this.init();
    }

    init() {
        // River Surface (Reflective Floor)
        const planeGeo = new THREE.PlaneGeometry(200, 200);
        const planeMat = new THREE.MeshStandardMaterial({
            color: 0x000510, // Dark blue water
            roughness: 0.1,
            metalness: 0.9,
            emissive: 0x000205,
            emissiveIntensity: 0.5
        });
        this.floor = new THREE.Mesh(planeGeo, planeMat);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -5; // Water level
        this.group.add(this.floor);

        // Background Stars (Static)
        const starGeo = new THREE.BufferGeometry();
        const starCount = 2000;
        const starPos = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount * 3; i++) {
            starPos[i] = (Math.random() - 0.5) * 300;
            if (i % 3 === 1) starPos[i] = Math.abs(starPos[i]) + 10; // Only above horizon
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.8 });
        this.stars = new THREE.Points(starGeo, starMat);
        this.group.add(this.stars);

        // Particle Geometry (Reused for all fireworks)
        this.particleGeometry = new THREE.BufferGeometry();
        this.particleMaterial = new THREE.PointsMaterial({
            size: 0.8,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            map: this.createParticleTexture()
        });
    }

    createParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    launchRocket(isHigh, intensity) {
        const x = (Math.random() - 0.5) * 40;
        const z = (Math.random() - 0.5) * 20 - 10;
        const targetY = isHigh ? 20 + Math.random() * 10 : 10 + Math.random() * 5;
        const color = new THREE.Color().setHSL(Math.random(), 1.0, 0.6);

        this.rockets.push({
            pos: new THREE.Vector3(x, -5, z),
            vel: new THREE.Vector3(0, isHigh ? 0.8 : 0.5, 0),
            targetY: targetY,
            color: color,
            trail: [],
            isHigh: isHigh
        });
    }

    explode(pos, color, isHigh) {
        const count = isHigh ? 300 : 100;
        const spread = isHigh ? 1.0 : 0.5;

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const vel = Math.random() * spread;

            this.particles.push({
                pos: pos.clone(),
                vel: new THREE.Vector3(
                    Math.sin(phi) * Math.cos(angle) * vel,
                    Math.sin(phi) * Math.sin(angle) * vel,
                    Math.cos(phi) * vel
                ),
                color: color.clone(),
                alpha: 1.0,
                decay: Math.random() * 0.02 + 0.01,
                gravity: 0.01
            });
        }

        // Flash light
        const light = new THREE.PointLight(color, 5, 50);
        light.position.copy(pos);
        this.group.add(light);

        // Remove light after a short time
        setTimeout(() => {
            this.group.remove(light);
        }, 200);
    }

    update(time, audioData) {
        // Beat Detection & Launch Logic
        const now = performance.now();

        // Passive launch (ensure activity)
        if (now - this.lastLaunchTime > 800) {
            this.launchRocket(Math.random() > 0.5, 0.5);
            this.lastLaunchTime = now;
        }

        if (now - this.lastLaunchTime > 150) { // Limit launch rate
            if (audioData.low > 0.4) { // Bass Kick -> High Firework (Lowered threshold)
                this.launchRocket(true, audioData.low);
                this.lastLaunchTime = now;
            } else if (audioData.mid > 0.4 && Math.random() < 0.4) { // Mids -> Medium Firework
                this.launchRocket(false, audioData.mid);
                this.lastLaunchTime = now;
            } else if (audioData.high > 0.5 && Math.random() < 0.3) { // Highs -> Low Firework
                this.launchRocket(false, audioData.high);
                this.lastLaunchTime = now;
            }
        }

        // Update Rockets
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const r = this.rockets[i];
            r.pos.add(r.vel);

            // Trail effect
            if (Math.random() < 0.5) {
                this.particles.push({
                    pos: r.pos.clone(),
                    vel: new THREE.Vector3((Math.random() - 0.5) * 0.1, -0.1, (Math.random() - 0.5) * 0.1),
                    color: new THREE.Color(0xffaa00),
                    alpha: 1.0,
                    decay: 0.05,
                    gravity: 0.0
                });
            }

            if (r.pos.y >= r.targetY) {
                this.explode(r.pos, r.color, r.isHigh);
                this.rockets.splice(i, 1);
            }
        }

        // Update Particles
        const positions = [];
        const colors = [];

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.pos.add(p.vel);
            p.vel.y -= p.gravity; // Gravity
            p.vel.multiplyScalar(0.95); // Drag
            p.alpha -= p.decay;

            if (p.alpha <= 0 || p.pos.y < -5) {
                this.particles.splice(i, 1);
            } else {
                positions.push(p.pos.x, p.pos.y, p.pos.z);
                colors.push(p.color.r, p.color.g, p.color.b);
            }
        }

        // Update Geometry
        this.particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // Render active particles
        if (!this.activeMesh) {
            this.activeMesh = new THREE.Points(this.particleGeometry, this.particleMaterial);
            this.group.add(this.activeMesh);
        }

        // Gentle camera movement
        this.scene.rotation.y = Math.sin(time * 0.1) * 0.1;
    }

    dispose() {
        this.scene.remove(this.group);
        this.particleGeometry.dispose();
        this.particleMaterial.dispose();
        this.floor.geometry.dispose();
        this.floor.material.dispose();
        this.stars.geometry.dispose();
        this.stars.material.dispose();
    }
}

// --- Manager ---

class VisualizerManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.z = 15;
        this.camera.position.y = 5;
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('canvas'),
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ReinhardToneMapping;

        // Post Processing
        const renderScene = new RenderPass(this.scene, this.camera);
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            CONFIG.bloomStrength, CONFIG.bloomRadius, CONFIG.bloomThreshold
        );
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(this.bloomPass);

        this.currentEffect = null;
        this.switchMode('cosmic');

        window.addEventListener('resize', () => this.onResize());
        this.animate();
    }

    switchMode(mode) {
        if (this.currentEffect) {
            this.currentEffect.dispose();
        }

        // Reset camera
        this.camera.position.set(0, 5, 15);
        this.camera.lookAt(0, 0, 0);
        this.scene.fog = null;

        switch (mode) {
            case 'cosmic':
                this.scene.fog = new THREE.FogExp2(0x000000, 0.02);
                this.currentEffect = new CosmicEffect(this.scene);
                break;
            case 'wave':
                this.camera.position.set(0, 5, 30); // Lower and further back for Synthwave look
                this.camera.lookAt(0, 5, -50); // Look towards the sun
                this.currentEffect = new WaveEffect(this.scene);
                break;
            case 'light':
                this.currentEffect = new LightShowEffect(this.scene);
                break;
            case 'fireworks':
                this.camera.position.set(0, 5, 40); // Further back for fireworks
                this.camera.lookAt(0, 10, 0);
                this.currentEffect = new FireworksEffect(this.scene);
                break;
        }
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    getAudioData(time) {
        let low = 0, mid = 0, high = 0;

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
            low = lowSum / lowBound;
            mid = midSum / (midBound - lowBound);
            high = highSum / (bufferLength - midBound);
        } else {
            // Demo Mode
            low = (Math.sin(time * 2.0) * 0.5 + 0.5) * 0.8;
            mid = (Math.sin(time * 1.5 + 1.0) * 0.5 + 0.5) * 0.6;
            high = (Math.sin(time * 3.0 + 2.0) * 0.5 + 0.5) * 0.5;
        }

        return { low, mid, high };
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const time = performance.now() * 0.001;
        const audioData = this.getAudioData(time);

        if (this.currentEffect) {
            this.currentEffect.update(time, audioData);
        }

        this.composer.render();
    }
}

// --- Initialization ---
try {
    manager = new VisualizerManager();
    console.log("Visualizer initialized successfully");
} catch (err) {
    console.error("Initialization error:", err);
    alert("Error initializing visualizer: " + err.message);
}

// Event Listeners
const btnSystem = document.getElementById('btn-system');
if (btnSystem) {
    btnSystem.addEventListener('click', () => {
        console.log("System Audio button clicked");
        startAudio('system');
    });
} else {
    console.error("System Audio button not found!");
}

document.getElementById('btn-mic').addEventListener('click', () => startAudio('mic'));
document.getElementById('btn-demo').addEventListener('click', () => {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('controls').classList.remove('hidden');
});

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        manager.switchMode(e.target.dataset.mode);
    });
});

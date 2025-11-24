import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- Configuration ---
const CONFIG = {
    fftSize: 2048,
    smoothingTimeConstant: 0.85,
    bloomStrength: 2.5, // Increased for more glow
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
        // Shared Uniforms
        this.uniforms = {
            uTime: { value: 0 },
            uAudioLow: { value: 0 },
            uAudioMid: { value: 0 },
            uAudioHigh: { value: 0 }
        };

        // 1. Central Rainbow Galaxy
        this.initGalaxy();

        // 2. The Black Hole (Event Horizon + Accretion Disk)
        this.initGalaxyCore();

        // 3. Aurora Halo (Seamless)
        this.initAuroraHalo();

        // 4. Distant Starfield (Parallax)
        this.initStarfield();

        // 5. Shooting Stars
        this.initShootingStars();
    }

    initGalaxy() {
        const particleCount = 40000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const scales = new Float32Array(particleCount);
        const randomness = new Float32Array(particleCount * 3);

        const radius = 30.0;
        const height = 120.0;

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const r = Math.random() * radius + 5;
            const theta = Math.random() * Math.PI * 2;
            const y = (Math.random() - 0.5) * height;

            positions[i3] = Math.cos(theta) * r;
            positions[i3 + 1] = y;
            positions[i3 + 2] = Math.sin(theta) * r;

            scales[i] = Math.random();
            randomness[i3] = Math.random();
            randomness[i3 + 1] = Math.random();
            randomness[i3 + 2] = Math.random();
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
        geometry.setAttribute('aRandomness', new THREE.BufferAttribute(randomness, 3));

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: `
                uniform float uTime;
                uniform float uAudioLow;
                uniform float uAudioMid;
                uniform float uAudioHigh;
                attribute float aScale;
                attribute vec3 aRandomness;
                varying vec3 vColor;
                varying float vAlpha;

                vec3 hsv2rgb(vec3 c) {
                    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
                }

                void main() {
                    vec3 pos = position;
                    
                    float angle = uTime * 0.1 + aRandomness.x; 
                    float c = cos(angle); float s = sin(angle);
                    vec3 rotatedPos = vec3(pos.x * c - pos.z * s, pos.y, pos.x * s + pos.z * c);
                    
                    float beat = 1.0 + uAudioLow * 0.3;
                    rotatedPos.x *= beat;
                    rotatedPos.z *= beat;

                    vec4 mvPosition = modelViewMatrix * vec4(rotatedPos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    gl_PointSize = aScale * (250.0 / -mvPosition.z);
                    
                    float hue = (atan(pos.z, pos.x) / 6.28) + (pos.y * 0.002) - (uTime * 0.1);
                    float sat = 0.7 + uAudioMid * 0.3;
                    float val = 0.8 + uAudioHigh * 0.5;
                    
                    vColor = hsv2rgb(vec3(hue, sat, val));
                    vAlpha = 0.8 * (1.0 - smoothstep(50.0, 60.0, abs(pos.y)));
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vAlpha;
                void main() {
                    vec2 uv = gl_PointCoord - 0.5;
                    float dist = length(uv);
                    float glow = exp(-dist * 4.0);
                    if (glow < 0.01) discard;
                    gl_FragColor = vec4(vColor, vAlpha * glow);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.galaxyMesh = new THREE.Points(geometry, material);
        this.group.add(this.galaxyMesh);
    }

    initGalaxyCore() {
        // 1. The Event Horizon (Pure Black Void)
        const horizonGeo = new THREE.SphereGeometry(4, 64, 64);
        const horizonMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        this.eventHorizon = new THREE.Mesh(horizonGeo, horizonMat);
        this.group.add(this.eventHorizon);

        // 2. The Accretion Disk (Colorful Swirl)
        const particleCount = 10000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const randomness = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            const r = 5 + Math.random() * 15;
            const theta = Math.random() * Math.PI * 2;
            const y = (Math.random() - 0.5) * (r * 0.1);

            positions[i * 3] = r * Math.cos(theta);
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = r * Math.sin(theta);

            randomness[i] = Math.random();
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aRandomness', new THREE.BufferAttribute(randomness, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: `
                uniform float uTime;
                uniform float uAudioLow;
                uniform float uAudioMid;
                uniform float uAudioHigh;
                attribute float aRandomness;
                varying vec3 vColor;
                varying float vAlpha;

                vec3 hsv2rgb(vec3 c) {
                    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
                }

                void main() {
                    vec3 pos = position;
                    float r = length(pos.xz);
                    
                    float speed = (20.0 / r) * (1.0 + uAudioLow * 0.5);
                    float angle = uTime * 0.5 * speed + aRandomness;
                    
                    float c = cos(angle); float s = sin(angle);
                    pos = vec3(pos.x * c - pos.z * s, pos.y, pos.x * s + pos.z * c);

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    gl_PointSize = (3.0 + aRandomness * 3.0) * (100.0 / -mvPosition.z);
                    
                    // Rainbow Color Logic - DARKER / DEEPER (No Glare)
                    float hue = (atan(pos.z, pos.x) / 6.28) - (uTime * 0.2) + (10.0/r);
                    float sat = 0.9 + uAudioMid * 0.1;
                    float val = 0.6 + uAudioHigh * 0.4; // Reduced brightness
                    
                    vColor = hsv2rgb(vec3(hue, sat, val));
                    
                    float alpha = smoothstep(4.0, 5.0, r) * (1.0 - smoothstep(15.0, 20.0, r));
                    vAlpha = alpha * 0.6; 
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vAlpha;
                void main() {
                    vec2 uv = gl_PointCoord - 0.5;
                    float dist = length(uv);
                    float glow = exp(-dist * 4.0);
                    if (glow < 0.01) discard;
                    gl_FragColor = vec4(vColor, vAlpha * glow);
                }
            `
        });

        this.diskMesh = new THREE.Points(geometry, material);
        this.group.add(this.diskMesh);
    }

    initAuroraHalo() {
        const geometry = new THREE.CylinderGeometry(60, 60, 40, 128, 1, true);
        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPos;
                void main() {
                    vUv = uv;
                    vPos = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uAudioLow;
                uniform float uAudioHigh;
                varying vec2 vUv;
                varying vec3 vPos;

                // Simplex 3D Noise 
                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
                vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

                float snoise(vec3 v) { 
                    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
                    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
                    vec3 i  = floor(v + dot(v, C.yyy) );
                    vec3 x0 = v - i + dot(i, C.xxx) ;
                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min( g.xyz, l.zxy );
                    vec3 i2 = max( g.xyz, l.zxy );
                    vec3 x1 = x0 - i1 + C.xxx;
                    vec3 x2 = x0 - i2 + C.yyy;
                    vec3 x3 = x0 - D.yyy;
                    i = mod289(i); 
                    vec4 p = permute( permute( permute( 
                                i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
                    float n_ = 0.142857142857;
                    vec3  ns = n_ * D.wyz - D.xzx;
                    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                    vec4 x_ = floor(j * ns.z);
                    vec4 y_ = floor(j - 7.0 * x_ );
                    vec4 x = x_ *ns.x + ns.yyyy;
                    vec4 y = y_ *ns.x + ns.yyyy;
                    vec4 h = 1.0 - abs(x) - abs(y);
                    vec4 b0 = vec4( x.xy, y.xy );
                    vec4 b1 = vec4( x.zw, y.zw );
                    vec4 s0 = floor(b0)*2.0 + 1.0;
                    vec4 s1 = floor(b1)*2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));
                    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
                    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
                    vec3 p0 = vec3(a0.xy,h.x);
                    vec3 p1 = vec3(a0.zw,h.y);
                    vec3 p2 = vec3(a1.xy,h.z);
                    vec3 p3 = vec3(a1.zw,h.w);
                    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
                    p0 *= norm.x;
                    p1 *= norm.y;
                    p2 *= norm.z;
                    p3 *= norm.w;
                    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
                }

                void main() {
                    float theta = vUv.x * 6.2831853;
                    vec3 noisePos = vec3(cos(theta), sin(theta), vUv.y * 2.0 - uTime * 0.3);
                    float noise = snoise(noisePos * 2.0);
                    float alpha = smoothstep(0.0, 1.0, noise * 0.5 + 0.5);
                    float edgeFade = 1.0 - abs(vUv.y - 0.5) * 2.0;
                    alpha *= edgeFade;
                    vec3 colorA = vec3(0.0, 1.0, 0.8); 
                    vec3 colorB = vec3(0.8, 0.0, 1.0); 
                    vec3 color = mix(colorA, colorB, vUv.y + sin(uTime));
                    color += vec3(uAudioHigh * 0.5);
                    gl_FragColor = vec4(color, alpha * 0.4 * (1.0 + uAudioLow));
                }
            `
        });
        this.auroraMesh = new THREE.Mesh(geometry, material);
        this.group.add(this.auroraMesh);
    }

    initStarfield() {
        const count = 3000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const speeds = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const r = 300 + Math.random() * 300;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
            sizes[i] = Math.random();
            speeds[i] = Math.random();
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aScale', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            transparent: true,
            vertexShader: `
                uniform float uTime;
                attribute float aScale;
                attribute float aSpeed;
                void main() {
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    float twinkle = 1.0 + sin(uTime * (1.0 + aSpeed * 3.0) + position.x) * 0.5;
                    gl_PointSize = aScale * (400.0 / -mvPosition.z) * twinkle;
                }
            `,
            fragmentShader: `
                void main() {
                    vec2 uv = gl_PointCoord - 0.5;
                    float dist = length(uv);
                    if(dist > 0.5) discard;
                    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
                    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
                }
            `
        });
        this.starMesh = new THREE.Points(geometry, material);
        this.group.add(this.starMesh);
    }

    initShootingStars() {
        this.shootingStars = [];
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(6);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        this.shootingStarMaterial = new THREE.LineBasicMaterial({
            color: 0xaaddff,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        for (let i = 0; i < 8; i++) {
            const star = new THREE.Line(geometry.clone(), this.shootingStarMaterial);
            star.visible = false;
            this.group.add(star);
            this.shootingStars.push({
                mesh: star,
                active: false,
                progress: 0,
                speed: 0,
                startPos: new THREE.Vector3(),
                endPos: new THREE.Vector3()
            });
        }
    }

    spawnShootingStar() {
        const star = this.shootingStars.find(s => !s.active);
        if (!star) return;

        star.active = true;
        star.mesh.visible = true;
        star.progress = 0;
        star.speed = 0.005 + Math.random() * 0.01;

        const r = 150;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        star.startPos.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );

        star.endPos.copy(star.startPos).add(new THREE.Vector3(
            (Math.random() - 0.5) * 200,
            (Math.random() - 0.5) * 200,
            (Math.random() - 0.5) * 200
        ));
    }

    updateShootingStars() {
        if (Math.random() < 0.02) this.spawnShootingStar();

        this.shootingStars.forEach(star => {
            if (!star.active) return;

            star.progress += star.speed;
            if (star.progress >= 1) {
                star.active = false;
                star.mesh.visible = false;
                return;
            }

            const currentPos = new THREE.Vector3().lerpVectors(star.startPos, star.endPos, star.progress);
            const tailPos = new THREE.Vector3().lerpVectors(star.startPos, star.endPos, Math.max(0, star.progress - 0.1));

            const positions = star.mesh.geometry.attributes.position.array;
            positions[0] = currentPos.x; positions[1] = currentPos.y; positions[2] = currentPos.z;
            positions[3] = tailPos.x; positions[4] = tailPos.y; positions[5] = tailPos.z;
            star.mesh.geometry.attributes.position.needsUpdate = true;

            star.mesh.material.opacity = 1.0 - star.progress;
        });
    }

    update(time, audioData) {
        this.uniforms.uTime.value = time;
        this.uniforms.uAudioLow.value = THREE.MathUtils.lerp(this.uniforms.uAudioLow.value, audioData.low, 0.1);
        this.uniforms.uAudioMid.value = THREE.MathUtils.lerp(this.uniforms.uAudioMid.value, audioData.mid, 0.1);
        this.uniforms.uAudioHigh.value = THREE.MathUtils.lerp(this.uniforms.uAudioHigh.value, audioData.high, 0.1);

        // Dynamic Rotation
        const rotationSpeed = 0.05 + (this.uniforms.uAudioLow.value * 0.2);
        this.group.rotation.y += rotationSpeed * 0.016;

        // Cinematic Camera Motion (Lissajous Curve)
        this.group.position.x = Math.sin(time * 0.2) * 5;
        this.group.position.y = Math.cos(time * 0.15) * 5;
        this.group.rotation.z = Math.sin(time * 0.1) * 0.1;

        // Update Shooting Stars
        this.updateShootingStars();
    }

    dispose() {
        this.scene.remove(this.group);
        if (this.galaxyMesh) { this.galaxyMesh.geometry.dispose(); this.galaxyMesh.material.dispose(); }
        if (this.eventHorizon) { this.eventHorizon.geometry.dispose(); this.eventHorizon.material.dispose(); }
        if (this.diskMesh) { this.diskMesh.geometry.dispose(); this.diskMesh.material.dispose(); }
        if (this.auroraMesh) { this.auroraMesh.geometry.dispose(); this.auroraMesh.material.dispose(); }
        if (this.starMesh) { this.starMesh.geometry.dispose(); this.starMesh.material.dispose(); }
        if (this.shootingStars) {
            this.shootingStars.forEach(s => {
                s.mesh.geometry.dispose();
                s.mesh.material.dispose();
            });
            // Dispose of the shared material only once if it's not unique per star
            if (this.shootingStarMaterial) {
                this.shootingStarMaterial.dispose();
            }
        }
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
        this.shockwaves = [];
        this.lastLaunchTime = 0;

        this.init();
    }

    init() {
        // --- Enchanted River ---
        const planeGeo = new THREE.PlaneGeometry(300, 300);
        const planeMat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.0,
            metalness: 1.0, // Perfect mirror
            emissive: 0x000510,
            emissiveIntensity: 0.2
        });
        this.floor = new THREE.Mesh(planeGeo, planeMat);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -5;
        this.group.add(this.floor);

        // --- Galaxy Background ---
        const starGeo = new THREE.BufferGeometry();
        const starCount = 3000;
        const starPos = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount * 3; i += 3) {
            starPos[i] = (Math.random() - 0.5) * 400;
            starPos[i + 1] = Math.random() * 200; // Dome
            starPos[i + 2] = (Math.random() - 0.5) * 200 - 50;

            const color = new THREE.Color().setHSL(Math.random(), 0.8, 0.8);
            starColors[i] = color.r;
            starColors[i + 1] = color.g;
            starColors[i + 2] = color.b;
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
        const starMat = new THREE.PointsMaterial({
            vertexColors: true,
            size: 0.5,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        this.stars = new THREE.Points(starGeo, starMat);
        this.group.add(this.stars);

        // --- Textures ---
        this.textures = {
            dot: this.createParticleTexture(),
            heart: this.createHeartTexture(),
            star: this.createStarTexture(),
            leaf: this.createLeafTexture()
        };

        // --- Materials ---
        this.materials = {};
        for (const [key, tex] of Object.entries(this.textures)) {
            this.materials[key] = new THREE.PointsMaterial({
                size: 2.0,
                map: tex,
                vertexColors: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                alphaTest: 0.01
            });
        }
    }

    // --- Texture Generators ---
    createParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(canvas);
    }

    createHeartTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.translate(32, 32);
        ctx.scale(2, 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-5, -5, -10, 0, 0, 10);
        ctx.bezierCurveTo(10, 0, 5, -5, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        // Glow
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'white';
        ctx.fill();
        return new THREE.CanvasTexture(canvas);
    }

    createStarTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.translate(32, 32);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            ctx.lineTo(Math.cos((18 + i * 72) * 0.01745) * 15, -Math.sin((18 + i * 72) * 0.01745) * 15);
            ctx.lineTo(Math.cos((54 + i * 72) * 0.01745) * 6, -Math.sin((54 + i * 72) * 0.01745) * 6);
        }
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'white';
        ctx.fill();
        return new THREE.CanvasTexture(canvas);
    }

    createLeafTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.translate(32, 32);
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 15, Math.PI / 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        return new THREE.CanvasTexture(canvas);
    }

    launchRocket(type, intensity) {
        const x = (Math.random() - 0.5) * 60;
        const z = (Math.random() - 0.5) * 30 - 20;
        const targetY = 25 + Math.random() * 15;

        // Magical Colors
        const hue = Math.random();
        const color = new THREE.Color().setHSL(hue, 1.0, 0.7);

        this.rockets.push({
            pos: new THREE.Vector3(x, -5, z),
            vel: new THREE.Vector3(0, 0.8 + Math.random() * 0.2, 0),
            targetY: targetY,
            color: color,
            type: type, // 'heart', 'star', 'leaf'
            intensity: intensity
        });
    }

    explode(pos, color, type, intensity) {
        const particleCount = 150 + Math.floor(intensity * 200);
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const velocities = []; // Store velocities separately for physics

        // Shape-based velocity distribution
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positions[i3] = pos.x;
            positions[i3 + 1] = pos.y;
            positions[i3 + 2] = pos.z;

            // Base Color with variation
            const pColor = color.clone().offsetHSL(Math.random() * 0.1 - 0.05, 0, 0);
            colors[i3] = pColor.r;
            colors[i3 + 1] = pColor.g;
            colors[i3 + 2] = pColor.b;

            // Velocity Logic
            const speed = (0.3 + Math.random() * 0.5) * (1 + intensity);
            let vx, vy, vz;

            if (type === 'heart') {
                // Heart shape formula
                const t = Math.random() * Math.PI * 2;
                // x = 16sin^3(t)
                // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
                // Scale down
                vx = (16 * Math.pow(Math.sin(t), 3)) * 0.05;
                vy = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 0.05;
                vz = (Math.random() - 0.5) * 0.5; // Thickness
            } else if (type === 'star') {
                // Star burst
                const angle = (i / 5) * Math.PI * 2;
                const r = Math.random() < 0.5 ? 1 : 0.4; // Points vs inner
                vx = Math.cos(angle) * r * speed;
                vy = Math.sin(angle) * r * speed;
                vz = (Math.random() - 0.5) * speed;
            } else {
                // Sphere burst (Leaf/Default)
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(Math.random() * 2 - 1);
                vx = Math.sin(phi) * Math.cos(theta) * speed;
                vy = Math.sin(phi) * Math.sin(theta) * speed;
                vz = Math.cos(phi) * speed;
            }

            velocities.push({ x: vx, y: vy, z: vz, decay: Math.random() * 0.01 + 0.005 });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = this.materials[type] || this.materials.dot;
        const points = new THREE.Points(geometry, material);

        this.group.add(points);
        this.particles.push({
            mesh: points,
            velocities: velocities,
            age: 0,
            lifespan: 2.0 + intensity // Longer life for intense beats
        });

        // Shockwave
        this.createShockwave(pos, color);
    }

    createShockwave(pos, color) {
        const geo = new THREE.RingGeometry(0.1, 0.5, 32);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        this.group.add(mesh);
        this.shockwaves.push({ mesh: mesh, age: 0 });
    }

    update(time, audioData) {
        const now = performance.now();

        // --- Music Reactive Launch ---
        if (now - this.lastLaunchTime > 100) { // Fast check
            // Bass -> Heart (Big, Center)
            if (audioData.low > 0.45) {
                this.launchRocket('heart', audioData.low);
                this.lastLaunchTime = now;
            }
            // Mids -> Star (Medium, Spread)
            else if (audioData.mid > 0.4 && Math.random() < 0.5) {
                this.launchRocket('star', audioData.mid);
                this.lastLaunchTime = now;
            }
            // Highs -> Leaf (Small, Frequent)
            else if (audioData.high > 0.5 && Math.random() < 0.4) {
                this.launchRocket('leaf', audioData.high);
                this.lastLaunchTime = now;
            }
            // Idle firework
            else if (now - this.lastLaunchTime > 1500) {
                this.launchRocket('dot', 0.3);
                this.lastLaunchTime = now;
            }
        }

        // --- Update Rockets ---
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const r = this.rockets[i];
            r.pos.add(r.vel);

            // Wiggle effect for "magical" flight
            r.pos.x += Math.sin(time * 10 + i) * 0.05;

            // Trail particles
            if (Math.random() < 0.3) {
                // Simple trail logic could go here, but keeping it clean for performance
            }

            if (r.pos.y >= r.targetY) {
                this.explode(r.pos, r.color, r.type, r.intensity);
                this.rockets.splice(i, 1);
            }
        }

        // --- Update Particles ---
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.age += 0.016;

            const positions = p.mesh.geometry.attributes.position.array;
            let alive = false;

            for (let j = 0; j < p.velocities.length; j++) {
                const v = p.velocities[j];

                // Physics
                positions[j * 3] += v.x;
                positions[j * 3 + 1] += v.y;
                positions[j * 3 + 2] += v.z;

                // Gravity & Drag
                v.y -= 0.01; // Gravity
                v.x *= 0.98; v.y *= 0.98; v.z *= 0.98; // Drag

                // Audio Turbulence (Magical floating)
                if (audioData.high > 0.3) {
                    v.x += (Math.random() - 0.5) * 0.02;
                    v.y += (Math.random() - 0.5) * 0.02;
                    v.z += (Math.random() - 0.5) * 0.02;
                }
            }
            p.mesh.geometry.attributes.position.needsUpdate = true;

            // Fade out
            p.mesh.material.opacity = 1.0 - (p.age / p.lifespan);

            if (p.age >= p.lifespan) {
                this.group.remove(p.mesh);
                p.mesh.geometry.dispose();
                // Material is shared, don't dispose
                this.particles.splice(i, 1);
            }
        }

        // --- Update Shockwaves ---
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const s = this.shockwaves[i];
            s.age += 0.02;
            const scale = 1 + s.age * 20;
            s.mesh.scale.set(scale, scale, 1);
            s.mesh.material.opacity = 0.8 - s.age;

            if (s.age > 0.8) {
                this.group.remove(s.mesh);
                s.mesh.geometry.dispose();
                s.mesh.material.dispose();
                this.shockwaves.splice(i, 1);
            }
        }

        // Camera Sway
        this.scene.rotation.y = Math.sin(time * 0.2) * 0.05;
    }

    dispose() {
        this.scene.remove(this.group);
        // Dispose all resources
        this.floor.geometry.dispose();
        this.floor.material.dispose();
        this.stars.geometry.dispose();
        this.stars.material.dispose();

        Object.values(this.textures).forEach(t => t.dispose());
        Object.values(this.materials).forEach(m => m.dispose());
    }
}

// --- Manager ---

class LightningStormEffect {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.bolts = [];
        this.lastStrikeTime = 0;
        this.lightningLight = new THREE.PointLight(0x88ccff, 0, 100);
        this.group.add(this.lightningLight);

        this.init();
    }

    init() {
        // --- Deep Space Atmosphere ---
        this.scene.fog = new THREE.FogExp2(0x020008, 0.015);

        // --- Aurora Borealis (Cực Quang) ---
        this.initAurora();

        // --- Volumetric Nebula Clouds ---
        this.initClouds();

        // --- Reactive Particles ---
        this.initParticles();
    }

    initAurora() {
        // A large curved curtain
        const geometry = new THREE.PlaneGeometry(200, 100, 64, 64);

        this.auroraUniforms = {
            uTime: { value: 0 },
            uBass: { value: 0 },
            uMid: { value: 0 },
            uHigh: { value: 0 }
        };

        const material = new THREE.ShaderMaterial({
            uniforms: this.auroraUniforms,
            vertexShader: `
                uniform float uTime;
                varying vec2 vUv;
                varying float vElev;
                
                // Simplex Noise (Simplified)
                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
                float snoise(vec2 v) {
                    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                    vec2 i  = floor(v + dot(v, C.yy) );
                    vec2 x0 = v - i + dot(i, C.xx);
                    vec2 i1;
                    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                    vec4 x12 = x0.xyxy + C.xxzz;
                    x12.xy -= i1;
                    i = mod289(i);
                    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
                    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                    m = m*m ;
                    m = m*m ;
                    vec3 x = 2.0 * fract(p * C.www) - 1.0;
                    vec3 h = abs(x) - 0.5;
                    vec3 ox = floor(x + 0.5);
                    vec3 a0 = x - ox;
                    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
                    vec3 g;
                    g.x  = a0.x  * x0.x  + h.x  * x0.y;
                    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                    return 130.0 * dot(m, g);
                }

                void main() {
                    vUv = uv;
                    vec3 pos = position;
                    
                    // Waving motion
                    float noiseVal = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uv.y * 0.5 + uTime * 0.05));
                    pos.z += noiseVal * 20.0;
                    pos.y += sin(uv.x * 5.0 + uTime * 0.2) * 5.0;
                    
                    // Curve the plane
                    float curve = pos.x * 0.05;
                    pos.z -= curve * curve * 2.0;
                    
                    vElev = pos.y;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uBass;
                uniform float uMid;
                uniform float uHigh;
                varying vec2 vUv;
                varying float vElev;

                void main() {
                    // Color Palette
                    vec3 colorBass = vec3(1.0, 0.3, 0.0); // Gold/Orange
                    vec3 colorMid = vec3(0.0, 1.0, 0.6);  // Cyan/Green
                    vec3 colorHigh = vec3(0.8, 0.0, 1.0); // Violet/Pink
                    
                    // Mix based on audio
                    vec3 baseColor = mix(vec3(0.0, 0.1, 0.3), colorBass, uBass * 0.5);
                    baseColor = mix(baseColor, colorMid, uMid * 0.5);
                    baseColor = mix(baseColor, colorHigh, uHigh * 0.5);
                    
                    // Vertical Gradient (Fade out at top/bottom)
                    float alpha = smoothstep(0.0, 0.2, vUv.y) * (1.0 - smoothstep(0.8, 1.0, vUv.y));
                    
                    // Moving bands
                    float band = sin(vUv.y * 20.0 + uTime + vUv.x * 5.0);
                    baseColor += vec3(band * 0.2);

                    gl_FragColor = vec4(baseColor, alpha * 0.6);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });

        this.aurora = new THREE.Mesh(geometry, material);
        this.aurora.position.set(0, 20, -40);
        this.group.add(this.aurora);
    }

    initClouds() {
        // We use a custom shader to simulate light scattering from the lightning
        const cloudGeo = new THREE.BufferGeometry();
        const cloudCount = 400; // More particles for density
        const cloudPos = new Float32Array(cloudCount * 3);
        const cloudSizes = new Float32Array(cloudCount);
        const cloudRotation = new Float32Array(cloudCount);

        for (let i = 0; i < cloudCount; i++) {
            const i3 = i * 3;
            // Cylinder distribution for a "tunnel" or "sky" feel
            const r = 30 + Math.random() * 50;
            const theta = Math.random() * Math.PI * 2;
            const y = (Math.random() - 0.5) * 60;

            cloudPos[i3] = Math.cos(theta) * r;
            cloudPos[i3 + 1] = y + 20; // Bias upwards
            cloudPos[i3 + 2] = Math.sin(theta) * r;

            cloudSizes[i] = 20 + Math.random() * 30;
            cloudRotation[i] = Math.random() * Math.PI;
        }

        cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3));
        cloudGeo.setAttribute('size', new THREE.BufferAttribute(cloudSizes, 1));
        cloudGeo.setAttribute('rotation', new THREE.BufferAttribute(cloudRotation, 1));

        // Texture
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        // Soft cloud puff
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        grad.addColorStop(0.4, 'rgba(100, 100, 255, 0.2)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        const cloudTex = new THREE.CanvasTexture(canvas);

        this.cloudUniforms = {
            uTime: { value: 0 },
            uTex: { value: cloudTex },
            uLightningPos: { value: new THREE.Vector3(0, 0, 0) },
            uLightningColor: { value: new THREE.Color(0x88ccff) },
            uLightningIntensity: { value: 0.0 },
            uBaseColor: { value: new THREE.Color(0x110033) } // Deep purple base
        };

        const cloudMat = new THREE.ShaderMaterial({
            uniforms: this.cloudUniforms,
            vertexShader: `
                uniform float uTime;
                attribute float size;
                attribute float rotation;
                varying vec3 vWorldPos;
                
                void main() {
                    vec3 pos = position;
                    // Slow rotation
                    float angle = uTime * 0.05 + rotation;
                    pos.x += cos(angle) * 2.0;
                    pos.z += sin(angle) * 2.0;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
                    
                    gl_PointSize = size * (500.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D uTex;
                uniform vec3 uLightningPos;
                uniform vec3 uLightningColor;
                uniform float uLightningIntensity;
                uniform vec3 uBaseColor;
                varying vec3 vWorldPos;
                
                void main() {
                    vec4 tex = texture2D(uTex, gl_PointCoord);
                    if (tex.a < 0.01) discard;
                    
                    // Volumetric Lighting Calculation
                    float dist = distance(vWorldPos, uLightningPos);
                    float light = uLightningIntensity * (100.0 / (dist * dist + 0.1));
                    
                    vec3 finalColor = uBaseColor + uLightningColor * light;
                    gl_FragColor = vec4(finalColor, tex.a * (0.3 + light * 0.5));
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.cloudSystem = new THREE.Points(cloudGeo, cloudMat);
        this.group.add(this.cloudSystem);
    }

    initParticles() {
        // --- Heavy Pollen (Bass) ---
        const pollenGeo = new THREE.BufferGeometry();
        const pollenCount = 500;
        const pollenPos = new Float32Array(pollenCount * 3);
        for (let i = 0; i < pollenCount * 3; i++) pollenPos[i] = (Math.random() - 0.5) * 150;
        pollenGeo.setAttribute('position', new THREE.BufferAttribute(pollenPos, 3));

        this.pollen = new THREE.Points(pollenGeo, new THREE.PointsMaterial({
            color: 0xffaa00, // Gold
            size: 0.5,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        }));
        this.group.add(this.pollen);

        // --- Sparkles (Highs) ---
        const sparkleGeo = new THREE.BufferGeometry();
        const sparkleCount = 800;
        const sparklePos = new Float32Array(sparkleCount * 3);
        for (let i = 0; i < sparkleCount * 3; i++) sparklePos[i] = (Math.random() - 0.5) * 150;
        sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePos, 3));

        this.sparkles = new THREE.Points(sparkleGeo, new THREE.PointsMaterial({
            color: 0x00ffff, // Cyan
            size: 0.3,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        }));
        this.group.add(this.sparkles);
    }

    // Recursive Branching Lightning
    createBolt(start, end, thickness, recursionLevel = 0) {
        const points = [];
        const segments = 10;
        const jaggedness = 2.0 / (recursionLevel + 1); // Less jagged as we branch

        points.push(start);
        let current = start.clone();
        const step = new THREE.Vector3().subVectors(end, start).divideScalar(segments);

        for (let i = 1; i < segments; i++) {
            current.add(step);
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * jaggedness,
                (Math.random() - 0.5) * jaggedness,
                (Math.random() - 0.5) * jaggedness
            );
            const point = current.clone().add(offset);
            points.push(point);

            // Chance to branch
            if (recursionLevel < 2 && Math.random() < 0.3) {
                const branchEnd = point.clone().add(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 10,
                        (Math.random() - 0.5) * 10,
                        (Math.random() - 0.5) * 10
                    )
                );
                this.createBolt(point, branchEnd, thickness * 0.5, recursionLevel + 1);
            }
        }
        points.push(end);

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0xaaddff,
            linewidth: 2,
            blending: THREE.AdditiveBlending
        });
        const line = new THREE.Line(geometry, material);
        this.group.add(line);

        this.bolts.push({
            mesh: line,
            life: 1.0,
            decay: 0.1 + Math.random() * 0.1
        });

        // Return mid-point for light positioning
        return points[Math.floor(points.length / 2)];
    }

    update(time, audioData) {
        const now = performance.now();

        // --- Audio Analysis for Aurora ---
        // We need more specific bands than just low/mid/high
        let bass = 0, mid = 0, high = 0;
        if (isAudioActive && dataArray) {
            const bufferLength = dataArray.length;
            // Bass: 0 - 10%
            for (let i = 0; i < bufferLength * 0.1; i++) bass += dataArray[i];
            bass /= (bufferLength * 0.1 * 255);

            // Mid: 10% - 50%
            for (let i = Math.floor(bufferLength * 0.1); i < bufferLength * 0.5; i++) mid += dataArray[i];
            mid /= (bufferLength * 0.4 * 255);

            // High: 50% - 100%
            for (let i = Math.floor(bufferLength * 0.5); i < bufferLength; i++) high += dataArray[i];
            high /= (bufferLength * 0.5 * 255);
        }

        // Update Aurora
        this.auroraUniforms.uTime.value = time;
        this.auroraUniforms.uBass.value = THREE.MathUtils.lerp(this.auroraUniforms.uBass.value, bass, 0.1);
        this.auroraUniforms.uMid.value = THREE.MathUtils.lerp(this.auroraUniforms.uMid.value, mid, 0.1);
        this.auroraUniforms.uHigh.value = THREE.MathUtils.lerp(this.auroraUniforms.uHigh.value, high, 0.1);

        // Update Particles
        this.pollen.rotation.y = time * 0.05;
        this.pollen.position.y += Math.sin(time) * 0.02;
        this.sparkles.rotation.y = time * 0.1;
        // Sparkles jitter on highs
        if (high > 0.3) {
            this.sparkles.scale.setScalar(1.0 + high * 0.5);
        } else {
            this.sparkles.scale.setScalar(1.0);
        }

        // Update Clouds
        this.cloudUniforms.uTime.value = time;
        this.cloudUniforms.uLightningIntensity.value *= 0.9;
        this.lightningLight.intensity *= 0.9;

        // --- Spectrum Lightning (Detailed Music Visualization) ---
        if (isAudioActive && dataArray) {
            const bands = 16;
            const step = Math.floor(dataArray.length / bands);

            for (let i = 0; i < bands; i++) {
                const val = dataArray[i * step] / 255.0;

                // Threshold for mini-bolts
                if (val > 0.6 && Math.random() < 0.2) {
                    const angle = (i / bands) * Math.PI * 2;
                    const r = 40;

                    // Circular arrangement
                    const start = new THREE.Vector3(Math.cos(angle) * r, 10 + val * 10, Math.sin(angle) * r);
                    const end = new THREE.Vector3(Math.cos(angle) * r, -10, Math.sin(angle) * r);

                    // Create mini bolt
                    this.createBolt(start, end, 0.5, 1); // Thinner, less jagged
                }
            }
        }

        // --- Main Thunder Logic ---
        if (now - this.lastStrikeTime > 150) { // Minimum interval
            // Trigger on strong beats
            const trigger = audioData.high * 0.6 + audioData.low * 0.4;

            if (trigger > 0.5 && Math.random() < trigger * 0.4) {
                // Pick random cloud area
                const angle = Math.random() * Math.PI * 2;
                const r = 30 + Math.random() * 20;
                const start = new THREE.Vector3(Math.cos(angle) * r, 40, Math.sin(angle) * r);
                const end = new THREE.Vector3(Math.cos(angle) * r * 0.5, 0, Math.sin(angle) * r * 0.5);

                const midPoint = this.createBolt(start, end, 1.0);

                // Update Lighting
                this.cloudUniforms.uLightningPos.value.copy(midPoint);
                this.cloudUniforms.uLightningIntensity.value = 20.0 * trigger;
                this.cloudUniforms.uLightningColor.value.setHSL(0.6 + Math.random() * 0.1, 1.0, 0.8); // Electric Blue/Purple

                this.lightningLight.position.copy(midPoint);
                this.lightningLight.intensity = 500 * trigger;
                this.lightningLight.color.setHSL(0.6 + Math.random() * 0.1, 1.0, 0.5);

                this.lastStrikeTime = now;
            }
        }

        // Update Bolts
        for (let i = this.bolts.length - 1; i >= 0; i--) {
            const b = this.bolts[i];
            b.life -= b.decay;
            b.mesh.material.opacity = b.life;

            if (b.life <= 0) {
                this.group.remove(b.mesh);
                b.mesh.geometry.dispose();
                b.mesh.material.dispose();
                this.bolts.splice(i, 1);
            }
        }

        // Cinematic Camera Sway
        this.scene.rotation.z = Math.sin(time * 0.1) * 0.05;
        this.scene.rotation.y = Math.sin(time * 0.05) * 0.1;
    }

    dispose() {
        this.scene.remove(this.group);
        this.scene.fog = null;
        this.cloudSystem.geometry.dispose();
        this.cloudSystem.material.dispose();
        this.aurora.geometry.dispose();
        this.aurora.material.dispose();
        this.pollen.geometry.dispose();
        this.pollen.material.dispose();
        this.sparkles.geometry.dispose();
        this.sparkles.material.dispose();
    }
}

class AudioReactorEffect {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.init();
    }

    init() {
        this.uniforms = {
            uTime: { value: 0 },
            uAudioLow: { value: 0 },
            uAudioMid: { value: 0 },
            uAudioHigh: { value: 0 }
        };

        // 1. Reactor Core (Deforming Icosahedron)
        const geometry = new THREE.IcosahedronGeometry(10, 4);
        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            wireframe: true,
            transparent: true,
            vertexShader: `
                uniform float uTime;
                uniform float uAudioLow;
                varying vec3 vPos;
                
                // Simplex Noise
                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
                vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
                float snoise(vec3 v) { 
                    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
                    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
                    vec3 i  = floor(v + dot(v, C.yyy) );
                    vec3 x0 = v - i + dot(i, C.xxx) ;
                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min( g.xyz, l.zxy );
                    vec3 i2 = max( g.xyz, l.zxy );
                    vec3 x1 = x0 - i1 + C.xxx;
                    vec3 x2 = x0 - i2 + C.yyy;
                    vec3 x3 = x0 - D.yyy;
                    i = mod289(i); 
                    vec4 p = permute( permute( permute( 
                                i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
                    float n_ = 0.142857142857;
                    vec3  ns = n_ * D.wyz - D.xzx;
                    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                    vec4 x_ = floor(j * ns.z);
                    vec4 y_ = floor(j - 7.0 * x_ );
                    vec4 x = x_ *ns.x + ns.yyyy;
                    vec4 y = y_ *ns.x + ns.yyyy;
                    vec4 h = 1.0 - abs(x) - abs(y);
                    vec4 b0 = vec4( x.xy, y.xy );
                    vec4 b1 = vec4( x.zw, y.zw );
                    vec4 s0 = floor(b0)*2.0 + 1.0;
                    vec4 s1 = floor(b1)*2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));
                    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
                    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
                    vec3 p0 = vec3(a0.xy,h.x);
                    vec3 p1 = vec3(a0.zw,h.y);
                    vec3 p2 = vec3(a1.xy,h.z);
                    vec3 p3 = vec3(a1.zw,h.w);
                    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
                    p0 *= norm.x;
                    p1 *= norm.y;
                    p2 *= norm.z;
                    p3 *= norm.w;
                    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
                }

                void main() {
                    vPos = position;
                    vec3 pos = position;
                    
                    // Bass Deformation
                    float noise = snoise(pos * 0.2 + uTime);
                    float spike = 1.0 + uAudioLow * 0.8 * noise; // Increased spike
                    pos *= spike;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uAudioLow;
                uniform float uAudioMid;
                varying vec3 vPos;
                
                vec3 hsv2rgb(vec3 c) {
                    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
                }

                void main() {
                    // Dynamic Color based on Mid frequencies
                    float hue = 0.6 + uAudioMid * 0.4 + sin(uTime * 0.5) * 0.1; 
                    vec3 color = hsv2rgb(vec3(hue, 1.0, 0.8));
                    
                    float glow = 0.5 + uAudioLow * 0.5;
                    gl_FragColor = vec4(color, glow);
                }
            `
        });
        this.core = new THREE.Mesh(geometry, material);
        this.group.add(this.core);

        // 2. Orbital Rings
        this.rings = [];
        const ringGeo = new THREE.TorusGeometry(15, 0.2, 16, 100);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 });

        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(ringGeo, ringMat.clone());
            ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            this.rings.push({ mesh: ring, axis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize() });
            this.group.add(ring);
        }

        // 3. Warp Grid (Enhanced)
        const gridGeo = new THREE.PlaneGeometry(200, 200, 60, 60); // More segments for smoother waves
        const gridMat = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            wireframe: true,
            transparent: true,
            vertexShader: `
                uniform float uTime;
                uniform float uAudioHigh;
                uniform float uAudioMid;
                varying float vHeight;
                varying vec2 vUv;
                
                void main() {
                    vUv = uv;
                    vec3 pos = position;
                    
                    // Liquid Wave Effect
                    float d = length(pos.xy);
                    float wave1 = sin(d * 0.1 - uTime * 2.0);
                    float wave2 = cos(pos.x * 0.1 + uTime);
                    float wave3 = sin(pos.y * 0.1 + uTime * 1.5);
                    
                    float z = (wave1 + wave2 + wave3) * (2.0 + uAudioMid * 5.0 + uAudioHigh * 5.0);
                    pos.z = z;
                    vHeight = z;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uAudioMid;
                uniform float uAudioHigh;
                varying float vHeight;
                varying vec2 vUv;

                vec3 hsv2rgb(vec3 c) {
                    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
                }

                void main() {
                    float alpha = 1.0 - smoothstep(0.0, 90.0, length(gl_FragCoord.xy - vec2(0.5))); 
                    
                    // Melody-based Color Shift
                    float hue = 0.8 + uAudioMid * 0.5 + vUv.x * 0.2 + sin(uTime) * 0.1;
                    vec3 color = hsv2rgb(vec3(hue, 0.8, 1.0));
                    
                    // Highlight peaks
                    color += vec3(vHeight * 0.05);

                    gl_FragColor = vec4(color, 0.4 + uAudioHigh * 0.2);
                }
            `
        });

        this.floorGrid = new THREE.Mesh(gridGeo, gridMat);
        this.floorGrid.rotation.x = -Math.PI / 2;
        this.floorGrid.position.y = -20;
        this.group.add(this.floorGrid);

        this.ceilGrid = new THREE.Mesh(gridGeo, gridMat);
        this.ceilGrid.rotation.x = Math.PI / 2;
        this.ceilGrid.position.y = 20;
        this.group.add(this.ceilGrid);
    }

    update(time, audioData) {
        this.uniforms.uTime.value = time;
        // Smoother Lerp
        this.uniforms.uAudioLow.value = THREE.MathUtils.lerp(this.uniforms.uAudioLow.value, audioData.low, 0.15);
        this.uniforms.uAudioMid.value = THREE.MathUtils.lerp(this.uniforms.uAudioMid.value, audioData.mid, 0.15);
        this.uniforms.uAudioHigh.value = THREE.MathUtils.lerp(this.uniforms.uAudioHigh.value, audioData.high, 0.15);

        // Core Rotation
        this.core.rotation.y += 0.01 + audioData.low * 0.05;
        this.core.rotation.z += 0.01 + audioData.low * 0.05;

        // Rings
        this.rings.forEach((r, i) => {
            r.mesh.rotateOnAxis(r.axis, 0.02 + audioData.mid * 0.1);
            const scale = 1.0 + audioData.mid * 0.5;
            r.mesh.scale.setScalar(scale);
            r.mesh.material.color.setHSL((time * 0.2 + i * 0.3) % 1.0, 1.0, 0.5);
        });

        // Slight Grid Rotation for "Virtual" feel
        this.floorGrid.rotation.z = Math.sin(time * 0.1) * 0.1;
        this.ceilGrid.rotation.z = Math.cos(time * 0.1) * 0.1;
    }

    dispose() {
        this.scene.remove(this.group);
        this.core.geometry.dispose();
        this.core.material.dispose();
        this.rings.forEach(r => {
            r.mesh.geometry.dispose();
            r.mesh.material.dispose();
        });
        this.floorGrid.geometry.dispose();
        this.floorGrid.material.dispose();
        this.ceilGrid.geometry.dispose();
        this.ceilGrid.material.dispose();
    }
}
class MultiverseEffect {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.init();
    }

    init() {
        this.uniforms = {
            uTime: { value: 0 },
            uAudioLow: { value: 0 },
            uAudioMid: { value: 0 },
            uAudioHigh: { value: 0 }
        };

        // 1. Reactor Core (Icosahedron)
        this.initCore();

        // 2. Black Hole Ring (Accretion Disk)
        this.initBlackHoleRing();

        // 3. Aurora Halo
        this.initAuroraHalo();

        // 4. Warp Grid
        this.initWarpGrid();

        // 5. Starfield + Shooting Stars
        this.initStarfield();
        this.initShootingStars();

        // 6. Fireworks System
        this.fireworks = [];
    }

    initCore() {
        const geometry = new THREE.IcosahedronGeometry(8, 4);
        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            wireframe: true,
            transparent: true,
            vertexShader: `
                uniform float uTime;
                uniform float uAudioLow;
                varying vec3 vPos;
                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
                vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
                float snoise(vec3 v) { 
                    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
                    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
                    vec3 i  = floor(v + dot(v, C.yyy) );
                    vec3 x0 = v - i + dot(i, C.xxx) ;
                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min( g.xyz, l.zxy );
                    vec3 i2 = max( g.xyz, l.zxy );
                    vec3 x1 = x0 - i1 + C.xxx;
                    vec3 x2 = x0 - i2 + C.yyy;
                    vec3 x3 = x0 - D.yyy;
                    i = mod289(i); 
                    vec4 p = permute( permute( permute( 
                                i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
                    float n_ = 0.142857142857;
                    vec3  ns = n_ * D.wyz - D.xzx;
                    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                    vec4 x_ = floor(j * ns.z);
                    vec4 y_ = floor(j - 7.0 * x_ );
                    vec4 x = x_ *ns.x + ns.yyyy;
                    vec4 y = y_ *ns.x + ns.yyyy;
                    vec4 h = 1.0 - abs(x) - abs(y);
                    vec4 b0 = vec4( x.xy, y.xy );
                    vec4 b1 = vec4( x.zw, y.zw );
                    vec4 s0 = floor(b0)*2.0 + 1.0;
                    vec4 s1 = floor(b1)*2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));
                    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
                    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
                    vec3 p0 = vec3(a0.xy,h.x);
                    vec3 p1 = vec3(a0.zw,h.y);
                    vec3 p2 = vec3(a1.xy,h.z);
                    vec3 p3 = vec3(a1.zw,h.w);
                    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
                    p0 *= norm.x;
                    p1 *= norm.y;
                    p2 *= norm.z;
                    p3 *= norm.w;
                    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
                }
                void main() {
                    vPos = position;
                    vec3 pos = position;
                    float noise = snoise(pos * 0.2 + uTime);
                    float spike = 1.0 + uAudioLow * 0.5 * noise;
                    pos *= spike;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uAudioLow;
                varying vec3 vPos;
                void main() {
                    vec3 color = vec3(0.1, 0.5, 1.0); 
                    color += vec3(uAudioLow * 0.8, 0.0, uAudioLow * 0.2); 
                    float glow = 0.5 + uAudioLow * 0.5;
                    gl_FragColor = vec4(color, glow);
                }
            `
        });
        this.core = new THREE.Mesh(geometry, material);
        this.group.add(this.core);
    }

    initBlackHoleRing() {
        const particleCount = 8000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const randomness = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            const r = 12 + Math.random() * 15; // Larger radius to surround core
            const theta = Math.random() * Math.PI * 2;
            const y = (Math.random() - 0.5) * (r * 0.1);
            positions[i * 3] = r * Math.cos(theta);
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = r * Math.sin(theta);
            randomness[i] = Math.random();
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aRandomness', new THREE.BufferAttribute(randomness, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: `
                uniform float uTime;
                uniform float uAudioLow;
                uniform float uAudioMid;
                uniform float uAudioHigh;
                attribute float aRandomness;
                varying vec3 vColor;
                varying float vAlpha;
                vec3 hsv2rgb(vec3 c) {
                    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
                }
                void main() {
                    vec3 pos = position;
                    float r = length(pos.xz);
                    float speed = (20.0 / r) * (1.0 + uAudioLow * 0.5);
                    float angle = uTime * 0.5 * speed + aRandomness;
                    float c = cos(angle); float s = sin(angle);
                    pos = vec3(pos.x * c - pos.z * s, pos.y, pos.x * s + pos.z * c);
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    gl_PointSize = (3.0 + aRandomness * 3.0) * (100.0 / -mvPosition.z);
                    float hue = (atan(pos.z, pos.x) / 6.28) - (uTime * 0.2) + (10.0/r);
                    float sat = 0.9 + uAudioMid * 0.1;
                    float val = 0.6 + uAudioHigh * 0.4; 
                    vColor = hsv2rgb(vec3(hue, sat, val));
                    float alpha = smoothstep(10.0, 12.0, r) * (1.0 - smoothstep(25.0, 30.0, r));
                    vAlpha = alpha * 0.6; 
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vAlpha;
                void main() {
                    vec2 uv = gl_PointCoord - 0.5;
                    float dist = length(uv);
                    float glow = exp(-dist * 4.0);
                    if (glow < 0.01) discard;
                    gl_FragColor = vec4(vColor, vAlpha * glow);
                }
            `
        });

        this.diskMesh = new THREE.Points(geometry, material);
        this.group.add(this.diskMesh);
    }

    initAuroraHalo() {
        const geometry = new THREE.CylinderGeometry(70, 70, 50, 64, 1, true);
        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uAudioLow;
                varying vec2 vUv;
                // Simplified noise
                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
                vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
                float snoise(vec3 v) { 
                    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
                    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
                    vec3 i  = floor(v + dot(v, C.yyy) );
                    vec3 x0 = v - i + dot(i, C.xxx) ;
                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min( g.xyz, l.zxy );
                    vec3 i2 = max( g.xyz, l.zxy );
                    vec3 x1 = x0 - i1 + C.xxx;
                    vec3 x2 = x0 - i2 + C.yyy;
                    vec3 x3 = x0 - D.yyy;
                    i = mod289(i); 
                    vec4 p = permute( permute( permute( 
                                i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
                    float n_ = 0.142857142857;
                    vec3  ns = n_ * D.wyz - D.xzx;
                    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                    vec4 x_ = floor(j * ns.z);
                    vec4 y_ = floor(j - 7.0 * x_ );
                    vec4 x = x_ *ns.x + ns.yyyy;
                    vec4 y = y_ *ns.x + ns.yyyy;
                    vec4 h = 1.0 - abs(x) - abs(y);
                    vec4 b0 = vec4( x.xy, y.xy );
                    vec4 b1 = vec4( x.zw, y.zw );
                    vec4 s0 = floor(b0)*2.0 + 1.0;
                    vec4 s1 = floor(b1)*2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));
                    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
                    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
                    vec3 p0 = vec3(a0.xy,h.x);
                    vec3 p1 = vec3(a0.zw,h.y);
                    vec3 p2 = vec3(a1.xy,h.z);
                    vec3 p3 = vec3(a1.zw,h.w);
                    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
                    p0 *= norm.x;
                    p1 *= norm.y;
                    p2 *= norm.z;
                    p3 *= norm.w;
                    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
                }
                void main() {
                    float theta = vUv.x * 6.2831853;
                    vec3 noisePos = vec3(cos(theta), sin(theta), vUv.y * 2.0 - uTime * 0.3);
                    float noise = snoise(noisePos * 2.0);
                    float alpha = smoothstep(0.0, 1.0, noise * 0.5 + 0.5);
                    float edgeFade = 1.0 - abs(vUv.y - 0.5) * 2.0;
                    alpha *= edgeFade;
                    vec3 colorA = vec3(0.0, 1.0, 0.8); 
                    vec3 colorB = vec3(0.8, 0.0, 1.0); 
                    vec3 color = mix(colorA, colorB, vUv.y + sin(uTime));
                    gl_FragColor = vec4(color, alpha * 0.4 * (1.0 + uAudioLow));
                }
            `
        });
        this.auroraMesh = new THREE.Mesh(geometry, material);
        this.group.add(this.auroraMesh);
    }

    initWarpGrid() {
        const gridGeo = new THREE.PlaneGeometry(300, 300, 60, 60); // More segments
        const gridMat = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            wireframe: true,
            transparent: true,
            vertexShader: `
                uniform float uTime;
                uniform float uAudioHigh;
                uniform float uAudioMid;
                varying float vHeight;
                varying vec2 vUv;
                
                void main() {
                    vUv = uv;
                    vec3 pos = position;
                    
                    // Liquid Wave Effect
                    float d = length(pos.xy);
                    float wave1 = sin(d * 0.1 - uTime * 2.0);
                    float wave2 = cos(pos.x * 0.1 + uTime);
                    float wave3 = sin(pos.y * 0.1 + uTime * 1.5);
                    
                    float z = (wave1 + wave2 + wave3) * (2.0 + uAudioMid * 5.0 + uAudioHigh * 5.0);
                    pos.z = z;
                    vHeight = z;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uAudioMid;
                uniform float uAudioHigh;
                varying float vHeight;
                varying vec2 vUv;

                vec3 hsv2rgb(vec3 c) {
                    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
                }

                void main() {
                    float alpha = 1.0 - smoothstep(0.0, 120.0, length(gl_FragCoord.xy - vec2(0.5))); 
                    
                    // Melody-based Color Shift
                    float hue = 0.8 + uAudioMid * 0.5 + vUv.x * 0.2 + sin(uTime) * 0.1;
                    vec3 color = hsv2rgb(vec3(hue, 0.8, 1.0));
                    
                    // Highlight peaks
                    color += vec3(vHeight * 0.05);

                    gl_FragColor = vec4(color, 0.3 + uAudioHigh * 0.2);
                }
            `
        });

        this.floorGrid = new THREE.Mesh(gridGeo, gridMat);
        this.floorGrid.rotation.x = -Math.PI / 2;
        this.floorGrid.position.y = -30;
        this.group.add(this.floorGrid);

        this.ceilGrid = new THREE.Mesh(gridGeo, gridMat);
        this.ceilGrid.rotation.x = Math.PI / 2;
        this.ceilGrid.position.y = 30;
        this.group.add(this.ceilGrid);
    }

    initStarfield() {
        const count = 4000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const speeds = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const r = 300 + Math.random() * 300;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
            sizes[i] = Math.random();
            speeds[i] = Math.random();
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aScale', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            transparent: true,
            vertexShader: `
                uniform float uTime;
                attribute float aScale;
                attribute float aSpeed;
                void main() {
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    float twinkle = 1.0 + sin(uTime * (1.0 + aSpeed * 3.0) + position.x) * 0.5;
                    gl_PointSize = aScale * (400.0 / -mvPosition.z) * twinkle;
                }
            `,
            fragmentShader: `
                void main() {
                    vec2 uv = gl_PointCoord - 0.5;
                    float dist = length(uv);
                    if(dist > 0.5) discard;
                    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
                    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
                }
            `
        });
        this.starMesh = new THREE.Points(geometry, material);
        this.group.add(this.starMesh);
    }

    initShootingStars() {
        this.shootingStars = [];
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(6);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        this.shootingStarMaterial = new THREE.LineBasicMaterial({
            color: 0xaaddff,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        for (let i = 0; i < 10; i++) {
            const star = new THREE.Line(geometry.clone(), this.shootingStarMaterial);
            star.visible = false;
            this.group.add(star);
            this.shootingStars.push({
                mesh: star,
                active: false,
                progress: 0,
                speed: 0,
                startPos: new THREE.Vector3(),
                endPos: new THREE.Vector3()
            });
        }
    }

    spawnShootingStar() {
        const star = this.shootingStars.find(s => !s.active);
        if (!star) return;

        star.active = true;
        star.mesh.visible = true;
        star.progress = 0;
        star.speed = 0.005 + Math.random() * 0.01;

        const r = 200;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        star.startPos.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );

        star.endPos.copy(star.startPos).add(new THREE.Vector3(
            (Math.random() - 0.5) * 200,
            (Math.random() - 0.5) * 200,
            (Math.random() - 0.5) * 200
        ));
    }

    updateShootingStars() {
        if (Math.random() < 0.03) this.spawnShootingStar();

        this.shootingStars.forEach(star => {
            if (!star.active) return;
            star.progress += star.speed;
            if (star.progress >= 1) {
                star.active = false;
                star.mesh.visible = false;
                return;
            }
            const currentPos = new THREE.Vector3().lerpVectors(star.startPos, star.endPos, star.progress);
            const tailPos = new THREE.Vector3().lerpVectors(star.startPos, star.endPos, Math.max(0, star.progress - 0.1));
            const positions = star.mesh.geometry.attributes.position.array;
            positions[0] = currentPos.x; positions[1] = currentPos.y; positions[2] = currentPos.z;
            positions[3] = tailPos.x; positions[4] = tailPos.y; positions[5] = tailPos.z;
            star.mesh.geometry.attributes.position.needsUpdate = true;
            star.mesh.material.opacity = 1.0 - star.progress;
        });
    }

    spawnFirework() {
        const particleCount = 50;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        const startPos = new THREE.Vector3(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 50,
            (Math.random() - 0.5) * 100
        );

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = startPos.x;
            positions[i * 3 + 1] = startPos.y;
            positions[i * 3 + 2] = startPos.z;
            velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ));
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            color: new THREE.Color().setHSL(Math.random(), 1.0, 0.5),
            size: 0.5,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        const points = new THREE.Points(geometry, material);
        this.group.add(points);

        this.fireworks.push({ mesh: points, velocities: velocities, life: 1.0 });
    }

    updateFireworks() {
        for (let i = this.fireworks.length - 1; i >= 0; i--) {
            const fw = this.fireworks[i];
            fw.life -= 0.02;
            if (fw.life <= 0) {
                this.group.remove(fw.mesh);
                fw.mesh.geometry.dispose();
                fw.mesh.material.dispose();
                this.fireworks.splice(i, 1);
                continue;
            }

            const positions = fw.mesh.geometry.attributes.position.array;
            for (let j = 0; j < fw.velocities.length; j++) {
                positions[j * 3] += fw.velocities[j].x;
                positions[j * 3 + 1] += fw.velocities[j].y;
                positions[j * 3 + 2] += fw.velocities[j].z;
            }
            fw.mesh.geometry.attributes.position.needsUpdate = true;
            fw.mesh.material.opacity = fw.life;
        }
    }

    update(time, audioData) {
        this.uniforms.uTime.value = time;
        // Smoother Lerp
        this.uniforms.uAudioLow.value = THREE.MathUtils.lerp(this.uniforms.uAudioLow.value, audioData.low, 0.15);
        this.uniforms.uAudioMid.value = THREE.MathUtils.lerp(this.uniforms.uAudioMid.value, audioData.mid, 0.15);
        this.uniforms.uAudioHigh.value = THREE.MathUtils.lerp(this.uniforms.uAudioHigh.value, audioData.high, 0.15);

        // Core Rotation
        this.core.rotation.y += 0.01 + audioData.low * 0.05;
        this.core.rotation.z += 0.01 + audioData.low * 0.05;

        // Update Shooting Stars
        this.updateShootingStars();

        // Fireworks on Bass
        if (audioData.low > 0.7 && Math.random() < 0.1) {
            this.spawnFirework();
        }
        this.updateFireworks();

        // Camera Motion
        this.group.rotation.y = Math.sin(time * 0.05) * 0.2;

        // Slight Grid Rotation
        this.floorGrid.rotation.z = Math.sin(time * 0.1) * 0.1;
        this.ceilGrid.rotation.z = Math.cos(time * 0.1) * 0.1;
    }

    dispose() {
        this.scene.remove(this.group);
        this.core.geometry.dispose();
        this.core.material.dispose();
        this.diskMesh.geometry.dispose();
        this.diskMesh.material.dispose();
        this.auroraMesh.geometry.dispose();
        this.auroraMesh.material.dispose();
        this.floorGrid.geometry.dispose();
        this.floorGrid.material.dispose();
        this.ceilGrid.geometry.dispose();
        this.ceilGrid.material.dispose();
        this.starMesh.geometry.dispose();
        this.starMesh.material.dispose();
        this.shootingStars.forEach(s => {
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
        });
        if (this.shootingStarMaterial) this.shootingStarMaterial.dispose();
        this.fireworks.forEach(fw => {
            fw.mesh.geometry.dispose();
            fw.mesh.material.dispose();
        });
    }
}

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
            try {
                this.currentEffect.dispose();
            } catch (err) {
                console.error("Error disposing effect:", err);
            }
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
            case 'lightning':
                this.camera.position.set(0, 5, 30);
                this.camera.lookAt(0, 10, 0);
                this.currentEffect = new LightningStormEffect(this.scene);
                break;
            case 'reactor':
                this.camera.position.set(0, 0, 40);
                this.camera.lookAt(0, 0, 0);
                this.currentEffect = new AudioReactorEffect(this.scene);
                break;
            case 'multiverse':
                this.camera.position.set(0, 0, 50);
                this.camera.lookAt(0, 0, 0);
                this.currentEffect = new MultiverseEffect(this.scene);
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

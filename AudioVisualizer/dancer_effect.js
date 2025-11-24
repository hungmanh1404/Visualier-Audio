// DancerEffect - A dancing humanoid character that reacts to music
class DancerEffect {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.init();
    }

    init() {
        // Create character parts
        this.character = new THREE.Group();

        // Materials
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xff6b9d,
            emissive: 0xff1493,
            emissiveIntensity: 0.3,
            metalness: 0.3,
            roughness: 0.7
        });

        const limbMat = new THREE.MeshStandardMaterial({
            color: 0x4ecdc4,
            emissive: 0x00ced1,
            emissiveIntensity: 0.2,
            metalness: 0.3,
            roughness: 0.7
        });

        // Head
        const headGeo = new THREE.SphereGeometry(1, 32, 32);
        this.head = new THREE.Mesh(headGeo, bodyMat);
        this.head.position.y = 7;
        this.character.add(this.head);

        // Torso
        const torsoGeo = new THREE.BoxGeometry(2, 3, 1);
        this.torso = new THREE.Mesh(torsoGeo, bodyMat);
        this.torso.position.y = 4.5;
        this.character.add(this.torso);

        // Arms (with joints for animation)
        this.leftArm = new THREE.Group();
        this.leftArm.position.set(-1.5, 5.5, 0);
        const leftUpperArmGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 16);
        this.leftUpperArm = new THREE.Mesh(leftUpperArmGeo, limbMat);
        this.leftUpperArm.position.y = -1;
        this.leftArm.add(this.leftUpperArm);

        this.leftForearm = new THREE.Group();
        this.leftForearm.position.y = -2;
        const leftForearmGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.5, 16);
        this.leftForearmMesh = new THREE.Mesh(leftForearmGeo, limbMat);
        this.leftForearmMesh.position.y = -0.75;
        this.leftForearm.add(this.leftForearmMesh);
        this.leftArm.add(this.leftForearm);
        this.character.add(this.leftArm);

        this.rightArm = new THREE.Group();
        this.rightArm.position.set(1.5, 5.5, 0);
        const rightUpperArmGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 16);
        this.rightUpperArm = new THREE.Mesh(rightUpperArmGeo, limbMat);
        this.rightUpperArm.position.y = -1;
        this.rightArm.add(this.rightUpperArm);

        this.rightForearm = new THREE.Group();
        this.rightForearm.position.y = -2;
        const rightForearmGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.5, 16);
        this.rightForearmMesh = new THREE.Mesh(rightForearmGeo, limbMat);
        this.rightForearmMesh.position.y = -0.75;
        this.rightForearm.add(this.rightForearmMesh);
        this.rightArm.add(this.rightForearm);
        this.character.add(this.rightArm);

        // Legs
        this.leftLeg = new THREE.Group();
        this.leftLeg.position.set(-0.6, 3, 0);
        const leftThighGeo = new THREE.CylinderGeometry(0.4, 0.35, 2, 16);
        this.leftThigh = new THREE.Mesh(leftThighGeo, limbMat);
        this.leftThigh.position.y = -1;
        this.leftLeg.add(this.leftThigh);

        this.leftShin = new THREE.Group();
        this.leftShin.position.y = -2;
        const leftShinGeo = new THREE.CylinderGeometry(0.35, 0.3, 2, 16);
        this.leftShinMesh = new THREE.Mesh(leftShinGeo, limbMat);
        this.leftShinMesh.position.y = -1;
        this.leftShin.add(this.leftShinMesh);
        this.leftLeg.add(this.leftShin);
        this.character.add(this.leftLeg);

        this.rightLeg = new THREE.Group();
        this.rightLeg.position.set(0.6, 3, 0);
        const rightThighGeo = new THREE.CylinderGeometry(0.4, 0.35, 2, 16);
        this.rightThigh = new THREE.Mesh(rightThighGeo, limbMat);
        this.rightThigh.position.y = -1;
        this.rightLeg.add(this.rightThigh);

        this.rightShin = new THREE.Group();
        this.rightShin.position.y = -2;
        const rightShinGeo = new THREE.CylinderGeometry(0.35, 0.3, 2, 16);
        this.rightShinMesh = new THREE.Mesh(rightShinGeo, limbMat);
        this.rightShinMesh.position.y = -1;
        this.rightShin.add(this.rightShinMesh);
        this.rightLeg.add(this.rightShin);
        this.character.add(this.rightLeg);

        this.group.add(this.character);

        // Stage/Floor
        const floorGeo = new THREE.CircleGeometry(15, 64);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            metalness: 0.8,
            roughness: 0.2
        });
        this.floor = new THREE.Mesh(floorGeo, floorMat);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -1;
        this.group.add(this.floor);

        // Lighting
        const spotLight1 = new THREE.SpotLight(0xff00ff, 2);
        spotLight1.position.set(-10, 15, 5);
        spotLight1.angle = Math.PI / 6;
        spotLight1.penumbra = 0.5;
        spotLight1.target = this.character;
        this.group.add(spotLight1);

        const spotLight2 = new THREE.SpotLight(0x00ffff, 2);
        spotLight2.position.set(10, 15, 5);
        spotLight2.angle = Math.PI / 6;
        spotLight2.penumbra = 0.5;
        spotLight2.target = this.character;
        this.group.add(spotLight2);

        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.group.add(ambientLight);

        // Particle effects around dancer
        this.initParticles();
    }

    initParticles() {
        const particleCount = 200;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const r = 8 + Math.random() * 5;
            positions[i * 3] = r * Math.cos(theta);
            positions[i * 3 + 1] = Math.random() * 15;
            positions[i * 3 + 2] = r * Math.sin(theta);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.3,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });

        this.particles = new THREE.Points(geometry, material);
        this.group.add(this.particles);
    }

    update(time, audioData, mouse, isDragging) {
        // Bass - Body bounce and leg movement
        const bounce = Math.sin(time * 5 + audioData.low * 10) * audioData.low * 0.5;
        this.character.position.y = bounce;

        // Leg dance
        const legSwing = Math.sin(time * 8) * (0.3 + audioData.low * 0.5);
        this.leftLeg.rotation.x = legSwing;
        this.rightLeg.rotation.x = -legSwing;

        const kneeAngle = Math.abs(Math.sin(time * 8)) * (0.2 + audioData.low * 0.3);
        this.leftShin.rotation.x = -kneeAngle;
        this.rightShin.rotation.x = -kneeAngle;

        // Mids - Arm movements
        const armSwing = Math.sin(time * 6) * (0.5 + audioData.mid * 1.5);
        this.leftArm.rotation.z = Math.PI / 4 + armSwing;
        this.rightArm.rotation.z = -Math.PI / 4 - armSwing;

        const elbowBend = Math.abs(Math.sin(time * 6)) * (0.3 + audioData.mid * 0.8);
        this.leftForearm.rotation.x = -elbowBend;
        this.rightForearm.rotation.x = -elbowBend;

        // Highs - Head bob and torso twist
        this.head.rotation.y = Math.sin(time * 10) * (0.2 + audioData.high * 0.5);
        this.head.position.y = 7 + Math.sin(time * 12) * audioData.high * 0.3;

        this.torso.rotation.y = Math.sin(time * 4) * (0.1 + audioData.mid * 0.3);

        // Overall character rotation
        this.character.rotation.y = time * 0.3;

        // Mouse interaction - character looks at mouse
        if (isDragging) {
            this.character.rotation.y += mouse.x * 0.05;
        }

        // Particle animation
        this.particles.rotation.y = time * 0.5;
        const positions = this.particles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += Math.sin(time * 2 + i) * 0.02;
            if (positions[i + 1] > 15) positions[i + 1] = 0;
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
    }

    dispose() {
        this.scene.remove(this.group);
        // Dispose geometries and materials
        this.character.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        this.floor.geometry.dispose();
        this.floor.material.dispose();
        this.particles.geometry.dispose();
        this.particles.material.dispose();
    }
}

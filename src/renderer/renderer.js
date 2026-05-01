import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { starVertexShader, starFragmentShader, bhVertexShader, bhFragmentShader } from './shaders.js';

const MAX_PARTICLES = 30000;
const MAX_BH = 50;

class Renderer {
    constructor(container) {
        this.container = container;
        this.showTrails = false;
        this._trails = [];
        this._trailUpdateCounter = 0;
        this._blackHoles = [];
        this._initScene();
        this._initCamera();
        this._initRenderer();
        this._initPostProcessing();
        this._initControls();
        this._initStarSystem();
        this._initBlackHoleSystem();
        this._onResize();
        window.addEventListener('resize', () => this._onResize());
    }

    _initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x010105);
        this._addBackgroundStars();
    }

    _addBackgroundStars() {
        const count = 300;
        const geometry = new THREE.BufferGeometry();
        const position = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = 600 + Math.random() * 400;
            position[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            position[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            position[i * 3 + 2] = radius * Math.cos(phi);
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
        const points = new THREE.Points(geometry, new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.2,
            transparent: true,
            opacity: 0.06,
            sizeAttenuation: false,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }));
        this.scene.add(points);
    }

    _initCamera() {
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 5000);
        this.camera.position.set(0, 150, 280);
        this.camera.lookAt(0, 0, 0);
    }

    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.container.appendChild(this.renderer.domElement);
    }

    _initPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            2.2, 0.4, 0.6
        );
        this.composer.addPass(this.bloomPass);
    }

    _initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.rotateSpeed = 0.4;
        this.controls.zoomSpeed = 1.5;
        this.controls.minDistance = 30;
        this.controls.maxDistance = 2000;
        this.controls.target.set(0, 0, 0);
        this.controls.autoRotate = false;
        this.controls.autoRotateSpeed = 0.15;
    }

    _initStarSystem() {
        const positions = new Float32Array(MAX_PARTICLES * 3);
        const sizes = new Float32Array(MAX_PARTICLES);
        const colors = new Float32Array(MAX_PARTICLES * 3);
        const alphas = new Float32Array(MAX_PARTICLES);
        const accretion = new Float32Array(MAX_PARTICLES);
        this._starGeo = new THREE.BufferGeometry();
        this._starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this._starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        this._starGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        this._starGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
        this._starGeo.setAttribute('aAccretion', new THREE.BufferAttribute(accretion, 1));
        this._starMat = new THREE.ShaderMaterial({
            vertexShader: starVertexShader,
            fragmentShader: starFragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        this.scene.add(new THREE.Points(this._starGeo, this._starMat));
    }

    _initBlackHoleSystem() {
        const positions = new Float32Array(MAX_BH * 3);
        const sizes = new Float32Array(MAX_BH);
        const colors = new Float32Array(MAX_BH * 3);
        const alphas = new Float32Array(MAX_BH);
        const flash = new Float32Array(MAX_BH);
        this._bhGeo = new THREE.BufferGeometry();
        this._bhGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this._bhGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        this._bhGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        this._bhGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
        this._bhGeo.setAttribute('aFlash', new THREE.BufferAttribute(flash, 1));
        this._bhMat = new THREE.ShaderMaterial({
            vertexShader: bhVertexShader,
            fragmentShader: bhFragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: { uTime: { value: 0 } },
        });
        this.scene.add(new THREE.Points(this._bhGeo, this._bhMat));
    }

    _getStarColor(distance, type) {
        if (type === 'elliptical' || type === 'lenticular') {
            const t = Math.min(distance / 80, 1);
            return [1.0 - t * 0.08, 0.92 - t * 0.1, 0.78 - t * 0.08];
        }
        if (type === 'irregular') {
            const t = Math.min(distance / 80, 1);
            return [0.85 + t * 0.08, 0.80 - t * 0.05, 0.92 + t * 0.06];
        }
        const t = Math.min(distance / 120, 1);
        if (t < 0.12) {
            const s = t / 0.12;
            return [1.0, 0.98 - s * 0.03, 0.95 - s * 0.08];
        }
        if (t < 0.4) {
            const s = (t - 0.12) / 0.28;
            return [1.0 - s * 0.1, 0.95 - s * 0.1, 0.87 + s * 0.06];
        }
        if (t < 0.7) {
            const s = (t - 0.4) / 0.3;
            return [0.9 - s * 0.2, 0.85 - s * 0.08, 0.93 + s * 0.05];
        }
        const s = (t - 0.7) / 0.3;
        return [0.7 - s * 0.1, 0.77 - s * 0.05, 0.98 + s * 0.02];
    }

    updateParticles(particles, galaxies, cameraPosition) {
        const positions = this._starGeo.attributes.position.array;
        const sizes = this._starGeo.attributes.aSize.array;
        const colors = this._starGeo.attributes.aColor.array;
        const alphas = this._starGeo.attributes.aAlpha.array;
        const accretion = this._starGeo.attributes.aAccretion.array;
        let index = 0;

        for (const particle of particles) {
            const dx = particle.x - cameraPosition.x;
            const dy = particle.y - cameraPosition.y;
            const dz = particle.z - cameraPosition.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (distance > 1500) continue;
            let lodFactor = 1.0;
            if (distance > 1000) lodFactor = 0.4;
            else if (distance > 500) lodFactor = 0.7;
            positions[index * 3] = particle.x;
            positions[index * 3 + 1] = particle.y;
            positions[index * 3 + 2] = particle.z;
            const [r, g, b] = this._getStarColor(particle.distFromCenter || 10, particle.galaxyType);
            const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy + particle.vz * particle.vz);
            sizes[index] = (2.0 + Math.min(speed * 0.2, 4.0)) * lodFactor;
            colors[index * 3] = r;
            colors[index * 3 + 1] = g;
            colors[index * 3 + 2] = b;
            alphas[index] = (0.5 + Math.min(0.5, (particle.distFromCenter || 10) * 0.004)) * lodFactor;
            accretion[index] = particle.accretionGlow || 0;
            index++;
        }

        this._starGeo.attributes.position.needsUpdate = true;
        this._starGeo.attributes.aSize.needsUpdate = true;
        this._starGeo.attributes.aColor.needsUpdate = true;
        this._starGeo.attributes.aAlpha.needsUpdate = true;
        this._starGeo.attributes.aAccretion.needsUpdate = true;
        this._starGeo.setDrawRange(0, index);
        this._updateBlackHoles(galaxies);
        this._trailUpdateCounter++;
        if (this._trailUpdateCounter % 4 === 0) {
            this._updateTrails(galaxies);
        }
    }

    _updateBlackHoles(galaxies) {
        const positions = this._bhGeo.attributes.position.array;
        const sizes = this._bhGeo.attributes.aSize.array;
        const colors = this._bhGeo.attributes.aColor.array;
        const alphas = this._bhGeo.attributes.aAlpha.array;
        const flash = this._bhGeo.attributes.aFlash.array;
        let index = 0;
        this._blackHoles = [];

        for (const galaxy of galaxies) {
            if (!galaxy.alive || !galaxy.blackHole || !galaxy.blackHole.alive) continue;
            const bh = galaxy.blackHole;
            this._blackHoles.push(bh);
            positions[index * 3] = bh.x;
            positions[index * 3 + 1] = bh.y;
            positions[index * 3 + 2] = bh.z;
            sizes[index] = 15 + Math.sqrt(bh.mass) * 0.3;
            colors[index * 3] = 1.0;
            colors[index * 3 + 1] = 0.5;
            colors[index * 3 + 2] = 0.15;
            alphas[index] = 0.95;
            flash[index] = bh.mergedFlash || 0;
            bh.trail.push([bh.x, bh.y, bh.z]);
            if (bh.trail.length > bh.trailMax) bh.trail.shift();
            index++;
        }

        this._bhGeo.attributes.position.needsUpdate = true;
        this._bhGeo.attributes.aSize.needsUpdate = true;
        this._bhGeo.attributes.aColor.needsUpdate = true;
        this._bhGeo.attributes.aAlpha.needsUpdate = true;
        this._bhGeo.attributes.aFlash.needsUpdate = true;
        this._bhGeo.setDrawRange(0, index);
    }

    _updateTrails(galaxies) {
        for (const trail of this._trails) {
            this.scene.remove(trail);
            trail.geometry.dispose();
            trail.material.dispose();
        }
        this._trails = [];
        if (!this.showTrails) return;

        for (const bh of this._blackHoles) {
            if (bh.trail.length < 2) continue;
            const n = bh.trail.length;
            const positions = new Float32Array((n - 1) * 2 * 3);
            const colors = new Float32Array((n - 1) * 2 * 3);
            for (let i = 0; i < n - 1; i++) {
                const p0 = bh.trail[i];
                const p1 = bh.trail[i + 1];
                const j = i * 6;
                positions[j] = p0[0];
                positions[j + 1] = p0[1];
                positions[j + 2] = p0[2];
                positions[j + 3] = p1[0];
                positions[j + 4] = p1[1];
                positions[j + 5] = p1[2];
                const alpha = i / n;
                colors[j] = 1.0;
                colors[j + 1] = 0.6 * alpha;
                colors[j + 2] = 0.2 * alpha;
                colors[j + 3] = 1.0;
                colors[j + 4] = 0.6 * alpha;
                colors[j + 5] = 0.2 * alpha;
            }
            const lineGeometry = new THREE.BufferGeometry();
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            lineGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            const line = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            }));
            this.scene.add(line);
            this._trails.push(line);
        }
    }

    setBloomIntensity(value) {
        this.bloomPass.strength = value;
    }

    render() {
        this._bhMat.uniforms.uTime.value = performance.now() * 0.001;
        this.controls.update();
        this.composer.render();
    }

    _onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
    }

    getScreenToWorld(sx, sy) {
        const mouse = new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), target);
        return target;
    }
}

export { Renderer };

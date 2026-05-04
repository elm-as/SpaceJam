import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const MAX_PARTICLES = 50000;
const MAX_BH = 50;

const starVertexShader = `
    attribute float aSize;
    attribute vec3 aColor;
    attribute float aAlpha;
    attribute float aAccretion;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vAccretion;
    void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vAccretion = aAccretion;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (600.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 1.0, 48.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const starFragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;
    varying float vAccretion;
    void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float glow = exp(-d * 5.0);
        float core = smoothstep(0.08, 0.0, d);
        vec3 accretionCol = vec3(1.0, 0.5, 0.1) * vAccretion * 3.0;
        vec3 col = vColor * glow * 1.5 + vec3(1.0) * core * 0.8 + accretionCol * glow;
        float a = glow * vAlpha * 0.9 + vAccretion * 0.5 + core * 0.4;
        gl_FragColor = vec4(col, a);
    }
`;

const bhVertexShader = `
    attribute float aSize;
    attribute float aMass;
    attribute float aFlash;
    varying float vMass;
    varying float vFlash;
    void main() {
        vMass = aMass;
        vFlash = aFlash;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (800.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 20.0, 200.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const bhFragmentShader = `
    varying float vMass;
    varying float vFlash;
    uniform float uTime;

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float angle = atan(uv.y, uv.x);

        float ehRadius = 0.12;
        float eventHorizon = 1.0 - smoothstep(ehRadius - 0.008, ehRadius + 0.004, d);

        float pr1Center = 0.145;
        float pr1 = exp(-pow((d - pr1Center) / 0.008, 2.0));
        float pr2Center = 0.155;
        float pr2 = exp(-pow((d - pr2Center) / 0.012, 2.0)) * 0.6;
        float prTurb = noise(vec2(angle * 4.0 + uTime * 0.8, d * 30.0));
        float photonRing = (pr1 + pr2) * (0.75 + 0.25 * prTurb);

        float diskMask = smoothstep(0.42, 0.16, d) * (1.0 - eventHorizon);
        float spiral1 = sin(angle * 3.0 - d * 18.0 + uTime * 1.2);
        float spiral2 = sin(angle * 5.0 + d * 25.0 - uTime * 0.7) * 0.4;
        float diskNoise = noise(vec2(angle * 2.0 + uTime * 0.3, d * 10.0));
        float accDisk = diskMask * (0.4 + 0.3 * spiral1 + spiral2 * 0.2 + diskNoise * 0.2);
        float doppler = 0.6 + 0.4 * sin(angle + 1.2);
        accDisk *= doppler;

        float halo = exp(-d * 4.5) * 0.15 * (1.0 - eventHorizon);
        float outerGlow = exp(-pow((d - 0.35) / 0.12, 2.0)) * 0.06;

        float flashRing = vFlash * exp(-pow((d - 0.2) / 0.06, 2.0));
        float flashCore = vFlash * exp(-d * 12.0) * 0.5;
        float flashTotal = flashRing + flashCore;

        vec3 col = vec3(0.0);
        col += vec3(0.95, 0.75, 0.3) * photonRing * 2.0;
        vec3 diskHot = vec3(1.0, 0.55, 0.12);
        vec3 diskCool = vec3(0.8, 0.2, 0.05);
        vec3 diskColor = mix(diskHot, diskCool, smoothstep(0.16, 0.40, d));
        col += diskColor * accDisk * doppler * 1.2;
        col += vec3(0.4, 0.25, 0.6) * halo;
        col += vec3(0.3, 0.15, 0.5) * outerGlow;
        col += vec3(1.0, 0.85, 0.5) * flashTotal * 3.0;

        col *= (1.0 - eventHorizon);

        float a = 0.0;
        a += photonRing * 1.8;
        a += accDisk * 0.8;
        a += halo;
        a += outerGlow;
        a += flashTotal * 2.0;
        a += eventHorizon * 0.95;
        a = clamp(a, 0.0, 1.0);

        gl_FragColor = vec4(col, a);
    }
`;

class Renderer {
    constructor(container) {
        this.container = container;
        this.showTrails = false;
        this._trails = [];
        this._trailUpdateCounter = 0;
        this._blackHoles = [];
        this._lowPerf = false;
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            const params = new URLSearchParams(window.location.search);
            if (params.get('perf') === 'low') this._lowPerf = true;
        }
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
        const count = this._lowPerf ? 100 : 300;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const th = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 600 + Math.random() * 400;
            pos[i*3] = r * Math.sin(phi) * Math.cos(th);
            pos[i*3+1] = r * Math.sin(phi) * Math.sin(th);
            pos[i*3+2] = r * Math.cos(phi);
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
            color: 0xffffff, size: 1.2, transparent: true, opacity: 0.06,
            sizeAttenuation: false, blending: THREE.AdditiveBlending, depthWrite: false,
        })));
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
        const bloomStrength = this._lowPerf ? 1.0 : 2.2;
        const bloomRadius = this._lowPerf ? 0.2 : 0.4;
        const bloomThreshold = this._lowPerf ? 0.4 : 0.6;
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            bloomStrength, bloomRadius, bloomThreshold
        );
        this.composer.addPass(this.bloomPass);
    }

    setLowPerf(isLow) {
        this._lowPerf = isLow;
        if (this.bloomPass) {
            this.bloomPass.strength = isLow ? 1.0 : 2.2;
            this.bloomPass.radius = isLow ? 0.2 : 0.4;
            this.bloomPass.threshold = isLow ? 0.4 : 0.6;
        }
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
        const pos = new Float32Array(MAX_PARTICLES * 3);
        const sizes = new Float32Array(MAX_PARTICLES);
        const colors = new Float32Array(MAX_PARTICLES * 3);
        const alphas = new Float32Array(MAX_PARTICLES);
        const accretion = new Float32Array(MAX_PARTICLES);
        this._starGeo = new THREE.BufferGeometry();
        this._starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this._starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        this._starGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        this._starGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
        this._starGeo.setAttribute('aAccretion', new THREE.BufferAttribute(accretion, 1));
        this._starMat = new THREE.ShaderMaterial({
            vertexShader: starVertexShader, fragmentShader: starFragmentShader,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        this.scene.add(new THREE.Points(this._starGeo, this._starMat));
    }

    _initBlackHoleSystem() {
        const pos = new Float32Array(MAX_BH * 3);
        const sizes = new Float32Array(MAX_BH);
        const mass = new Float32Array(MAX_BH);
        const flash = new Float32Array(MAX_BH);
        this._bhGeo = new THREE.BufferGeometry();
        this._bhGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this._bhGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        this._bhGeo.setAttribute('aMass', new THREE.BufferAttribute(mass, 1));
        this._bhGeo.setAttribute('aFlash', new THREE.BufferAttribute(flash, 1));
        this._bhMat = new THREE.ShaderMaterial({
            vertexShader: bhVertexShader, fragmentShader: bhFragmentShader,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: { uTime: { value: 0 } },
        });
        this.scene.add(new THREE.Points(this._bhGeo, this._bhMat));
    }

    updateParticles(particles, blackHoles, cameraPos) {
        const pos = this._starGeo.attributes.position.array;
        const sizes = this._starGeo.attributes.aSize.array;
        const colors = this._starGeo.attributes.aColor.array;
        const alphas = this._starGeo.attributes.aAlpha.array;
        const accretion = this._starGeo.attributes.aAccretion.array;
        let idx = 0;
        const maxDraw = this._lowPerf ? Math.min(MAX_PARTICLES, 15000) : MAX_PARTICLES;
        for (const s of particles) {
            if (idx >= maxDraw) break;
            const dx = s.x - cameraPos.x;
            const dy = s.y - cameraPos.y;
            const dz = s.z - cameraPos.z;
            const distCam = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (distCam > 1500 || (this._lowPerf && distCam > 800)) continue;
            let lodFactor = 1.0;
            if (distCam > 1000) lodFactor = 0.4;
            else if (distCam > 500) lodFactor = 0.7;

            pos[idx*3] = s.x; pos[idx*3+1] = s.y; pos[idx*3+2] = s.z;
            const r = s.colorR ?? 1.0, g = s.colorG ?? 1.0, b = s.colorB ?? 1.0;
            colors[idx*3] = r; colors[idx*3+1] = g; colors[idx*3+2] = b;
            const intrinsic = s.starSize ?? 1.0;
            const speed = Math.sqrt(s.vx**2 + s.vy**2 + s.vz**2);
            const rawSize = intrinsic * (1.5 + Math.min(speed * 0.1, 2.0)) * lodFactor;
            sizes[idx] = Math.min(rawSize, 5.0);

            const dist = s.distFromCenter || 10;
            alphas[idx] = (0.5 + Math.min(0.5, dist * 0.004)) * lodFactor;
            accretion[idx] = s.accretionGlow || 0;
            idx++;
        }
        this._starGeo.attributes.position.needsUpdate = true;
        this._starGeo.attributes.aSize.needsUpdate = true;
        this._starGeo.attributes.aColor.needsUpdate = true;
        this._starGeo.attributes.aAlpha.needsUpdate = true;
        this._starGeo.attributes.aAccretion.needsUpdate = true;
        this._starGeo.setDrawRange(0, idx);
        this._updateBlackHoles(blackHoles);
        this._trailUpdateCounter++;
        if (this._trailUpdateCounter % 4 === 0) this._updateTrails();
    }

    _updateBlackHoles(blackHoles) {
        const pos = this._bhGeo.attributes.position.array;
        const sizes = this._bhGeo.attributes.aSize.array;
        const mass = this._bhGeo.attributes.aMass.array;
        const flash = this._bhGeo.attributes.aFlash.array;
        let idx = 0;
        this._blackHoles = [];
        for (const bh of blackHoles) {
            if (!bh.alive) continue;
            this._blackHoles.push(bh);
            pos[idx*3] = bh.x; pos[idx*3+1] = bh.y; pos[idx*3+2] = bh.z;
            const m = bh.mass;
            sizes[idx] = 12 + Math.log2(1 + m) * 4.0 + (bh.mergedFlash || 0) * 8.0;
            mass[idx] = m;
            flash[idx] = bh.mergedFlash || 0;
            bh.trail.push([bh.x, bh.y, bh.z]);
            if (bh.trail.length > bh.trailMax) bh.trail.shift();
            idx++;
        }
        this._bhGeo.attributes.position.needsUpdate = true;
        this._bhGeo.attributes.aSize.needsUpdate = true;
        this._bhGeo.attributes.aMass.needsUpdate = true;
        this._bhGeo.attributes.aFlash.needsUpdate = true;
        this._bhGeo.setDrawRange(0, idx);
    }

    _updateTrails() {
        for (const t of this._trails) { this.scene.remove(t); t.geometry.dispose(); t.material.dispose(); }
        this._trails = [];
        if (!this.showTrails) return;
        for (const bh of this._blackHoles) {
            if (bh.trail.length < 2) continue;
            const n = bh.trail.length;
            const positions = new Float32Array((n - 1) * 2 * 3);
            const trailColors = new Float32Array((n - 1) * 2 * 3);
            for (let i = 0; i < n - 1; i++) {
                const p0 = bh.trail[i], p1 = bh.trail[i + 1];
                const j = i * 6;
                positions[j] = p0[0]; positions[j+1] = p0[1]; positions[j+2] = p0[2];
                positions[j+3] = p1[0]; positions[j+4] = p1[1]; positions[j+5] = p1[2];
                const a = i / n;
                trailColors[j] = 1.0; trailColors[j+1] = 0.6 * a; trailColors[j+2] = 0.2 * a;
                trailColors[j+3] = 1.0; trailColors[j+4] = 0.6 * a; trailColors[j+5] = 0.2 * a;
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
            const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
                vertexColors: true, transparent: true, opacity: 0.7,
                blending: THREE.AdditiveBlending, depthWrite: false,
            }));
            this.scene.add(line);
            this._trails.push(line);
        }
    }

    setBloomIntensity(val) { this.bloomPass.strength = val; }

    render() {
        this._bhMat.uniforms.uTime.value = performance.now() * 0.001;
        this.controls.update();
        this.composer.render();
    }

    _onResize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer.setSize(w, h);
    }

    getScreenToWorld(sx, sy) {
        const mouse = new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
        const rc = new THREE.Raycaster();
        rc.setFromCamera(mouse, this.camera);
        const target = new THREE.Vector3();
        rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), target);
        return target;
    }
}

export { Renderer };

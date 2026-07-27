import { PhysicsEngine } from './engine/physics-engine.js';
import { seedInitialGalaxies } from './app-controller.js';
import { SIZE_PRESETS } from './engine/constants.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { AudioManager } from './audio-manager.js';

import * as THREE from 'three';

const phys = new PhysicsEngine();
const renderer = new Renderer(document.body);
const ui = new UI();

// Background music setup using Web Audio API (more performant)
const _audioMgr = new AudioManager('/sampcrmr.mp3');
_audioMgr.init();


let running = true;
let timeDirection = 1;
let stepOnce = false;
let startTime = performance.now();
let frameCount = 0;
let lastFpsTime = performance.now();
let currentFps = 0;
let isLerping = false;

const ZOOM_SPEED   = 1.3;
const ROTATE_SPEED = 0.12;
const PAN_SPEED    = 8;

function loop() {
    requestAnimationFrame(loop);

    if (running) {
        phys.step(timeDirection * 0.016);
        renderer.updateFromPhysics(phys, renderer.camera.position);
    } else if (stepOnce) {
        phys.step(timeDirection * 0.016);
        renderer.updateFromPhysics(phys, renderer.camera.position);
        stepOnce = false;
    }

    renderer.render();

    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 500) {
        currentFps = Math.round(frameCount / ((now - lastFpsTime) / 1000));
        frameCount = 0;
        lastFpsTime = now;

        const stats = phys.stats();
        ui.updateStats(currentFps, stats.galaxies, stats.stars, stats.bhs, stats.stars * 0.5, phys.getElapsedTime());
    }
}

ui.on('gChange',          (val) => { phys.GMultiplier  = val; });
ui.on('timeScaleChange',  (val) => { phys.tscale        = val; });
ui.on('animSpeedChange',  (val) => { phys.animSpeed     = val; });
ui.on('bloomChange',      (val) => { renderer.setBloomIntensity(val); });
ui.on('pause',            (paused) => { running = !paused; });
ui.on('toggleTrails',     () => { renderer.showTrails = !renderer.showTrails; });
ui.on('invertTime',       (inverted) => { timeDirection = inverted ? -1 : 1; });
ui.on('toggleTides',      (val) => { phys.enableTides = val; });
ui.on('toggleBarnesHut', (val) => { phys.enableBarnesHut = val; });
ui.on('toggleNFW',       (val) => { phys.enableNFWHalo = val; });
ui.on('step',             () => { stepOnce = true; });
ui.on('multiScene', () => {
    phys.reset();
    startTime = performance.now();
    phys.addMultiGalaxyScene(10);
});
ui.on('focus', () => focusOnLargestGalaxy());
ui.on('reset', () => {
    phys.reset();
    startTime = performance.now();
    renderer.showTrails = false;
    timeDirection = 1;
    ui._timeInverted = false;
    ui._elements.btnInvert.textContent = 'Inverser le Temps';
    ui._elements.btnInvert.classList.remove('danger');
});

ui.on('placementMode', (type) => {
    renderer.renderer.domElement.style.cursor = type ? 'crosshair' : 'default';
    renderer.controls.enabled = !type;
});

ui.on('preset', () => {
    phys.reset();
    startTime = performance.now();
    phys.addGalaxy(-100, 0, 0, 0, 0, 1.0, 'spiral', SIZE_PRESETS[2]);
    phys.addGalaxy(100, 0, 0, 0, 0, -1.0, 'barred', SIZE_PRESETS[1]);
});

ui.on('addRandom', () => {
    const center = getSceneCenter();
    phys.addRandom(center.x, center.y, center.z, 250);
});

let placementStart = null;

renderer.renderer.domElement.addEventListener('mousedown', (e) => {
    if (e.button === 0 && ui.placementMode) {
        placementStart = { x: e.clientX, y: e.clientY };
    }
});

renderer.renderer.domElement.addEventListener('mouseup', (e) => {
    if (e.button === 0 && ui.placementMode && placementStart) {
        const dx = e.clientX - placementStart.x;
        const dy = e.clientY - placementStart.y;
        const pos = renderer.getScreenToWorld(e.clientX, e.clientY);
        if (pos) {
            const vx = dx * 0.005;
            const vy = dy * -0.005;
            phys.addGalaxy(pos.x, pos.y, pos.z, vx, vy, 0, ui.placementMode, SIZE_PRESETS[1]);
            ui.exitPlacementMode();
        }
        placementStart = null;
    }
});

renderer.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

let focusedGalaxyIndex = 0;

function focusOnGalaxy(index) {
    const galaxies = phys.galaxies.filter(g => g.alive);
    if (galaxies.length === 0) return;

    const idx = ((index % galaxies.length) + galaxies.length) % galaxies.length;
    focusedGalaxyIndex = idx;
    const target = galaxies[idx];

    const tx = target.x, ty = target.y, tz = target.z;
    if (!isFinite(tx) || !isFinite(ty) || !isFinite(tz)) return;

    const dist   = target.mass > 2000 ? 180 : 120;
    const height = dist * 0.5;

    isLerping = true;
    renderer.controls.enabled = false;
    renderer.controls.autoRotate = false;

    const startPos    = renderer.camera.position.clone();
    const startTarget = renderer.controls.target.clone();
    const endPos      = new THREE.Vector3(tx + dist * 0.6, ty + height, tz + dist * 0.6);
    const endTarget   = new THREE.Vector3(tx, ty, tz);
    const duration    = 1200;
    const startAnim   = performance.now();

    ui.updateGalaxyInfo(target);

    function lerpCamera(time) {
        const elapsed = time - startAnim;
        const t    = Math.min(elapsed / duration, 1);
        const ease = t * t * (3 - 2 * t);
        renderer.camera.position.lerpVectors(startPos, endPos, ease);
        renderer.controls.target.lerpVectors(startTarget, endTarget, ease);
        renderer.controls.update();
        if (t < 1) {
            requestAnimationFrame(lerpCamera);
        } else {
            isLerping = false;
            renderer.controls.enabled = true;
        }
    }
    requestAnimationFrame(lerpCamera);
}

document.addEventListener('keydown', (e) => {
    if (isLerping || ui.placementMode) return;
    const key = e.key.toLowerCase();
    switch (key) {
        case 'z': case 'arrowup':    renderer.controls.dollyIn(ZOOM_SPEED);        break;
        case 's': case 'arrowdown':  renderer.controls.dollyOut(ZOOM_SPEED);       break;
        case 'q': case 'arrowleft':  renderer.controls.rotateLeft(ROTATE_SPEED);   break;
        case 'd': case 'arrowright': renderer.controls.rotateRight(ROTATE_SPEED);  break;
        case 'e': renderer.camera.position.y += PAN_SPEED; renderer.controls.target.y += PAN_SPEED; break;
        case 'a': renderer.camera.position.y -= PAN_SPEED; renderer.controls.target.y -= PAN_SPEED; break;
        case 'f': focusOnLargestGalaxy(); break;
        case 'n':
            if (typeof phys.fuseClosest === 'function') phys.fuseClosest(2.0, 0.5, 0.5);
            break;
        case 'tab':
            e.preventDefault();
            { const galaxies = phys.galaxies.filter(g => g.alive);
              if (galaxies.length > 0) { focusedGalaxyIndex = (focusedGalaxyIndex + 1) % galaxies.length; focusOnGalaxy(focusedGalaxyIndex); } }
            break;
        case ' ':
            e.preventDefault();
            running = !running;
            ui._paused = !running;
            ui._elements.btnPause.textContent = running ? 'Pause' : 'Reprendre';
            break;
    }
});

function getSceneCenter() {
    const alive = phys.galaxies.filter(g => g.alive);
    if (alive.length === 0) return { x: 0, y: 0, z: 0 };
    let cx = 0, cy = 0, cz = 0;
    for (const g of alive) { cx += g.x; cy += g.y; cz += g.z; }
    return { x: cx / alive.length, y: cy / alive.length, z: cz / alive.length };
}

function focusOnLargestGalaxy() {
    const galaxies = phys.galaxies.filter(g => g.alive);
    if (galaxies.length === 0) return;
    const target = galaxies.reduce((max, g) => g.Mtot > max.Mtot ? g : max, galaxies[0]);
    focusedGalaxyIndex = galaxies.indexOf(target);
    focusOnGalaxy(focusedGalaxyIndex);
}

try {
    if (typeof seedInitialGalaxies === 'function') {
        seedInitialGalaxies(phys);
    } else {
        phys.addGalaxy(-100, 0, 0, 0, 0, 1.0, 'spiral', SIZE_PRESETS[2]);
        phys.addGalaxy(100, 0, 0, 0, 0, -1.0, 'barred', SIZE_PRESETS[1]);
    }
} catch (e) {
    console.error('[SpaceJam] erreur seedInitialGalaxies:', e);
    phys.addGalaxy(-100, 0, 0, 0, 0, 1.0, 'spiral', SIZE_PRESETS[2]);
    phys.addGalaxy(100, 0, 0, 0, 0, -1.0, 'barred', SIZE_PRESETS[1]);
}

loop();

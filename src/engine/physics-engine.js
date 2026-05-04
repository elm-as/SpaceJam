import { Galaxy, Star, BlackHole } from './galaxy-objects.js';
import { G, SOFT_TIDAL, MERGE_DIST, MERGE_SPEED, GALAXY_TYPES, SIZE_PRESETS } from './constants.js';

const SOFT_GAL        = 10;
const MAX_GALAXY_VEL  = 10;
const CM_CORRECT_FREQ = 20;
const STAR_COLL_FREQ  = 6;

class PhysicsEngine {
    constructor() {
        this.galaxies = [];
        this.freeStars = [];
        this.freeBlackHoles = [];
        this.t        = 0;
        this.Gmult    = 1;
        this.tscale   = 1;
        this.animSpeed = 1;
        this.enableTides = true;
        this._starFormationAccum = {};
        this._merges  = [];
        this._fusionParams = { mu: null, align: null, duration: null };
        this._stepCount = 0;
    }

    setFusionParams(mu, align, duration) { this._fusionParams = { mu, align, duration }; }

    add(x, y, z, vx, vy, vz, type, preset) {
        const g = new Galaxy(x, y, z, vx, vy, vz, type, preset);
        this.galaxies.push(g); return g;
    }
    addGalaxy(x, y, z, vx, vy, vz, type, preset) { return this.add(x, y, z, vx, vy, vz, type, preset); }

    addFreeBlackHole(x, y, z, mass) {
        const bh = new BlackHole(x, y, z, mass);
        bh.vx = 0; bh.vy = 0; bh.vz = 0;
        bh.ax = 0; bh.ay = 0; bh.az = 0;
        this.freeBlackHoles.push(bh);
        return bh;
    }

    addFreeStar(x, y, z, vx, vy, vz) {
        const s = new Star(x, y, z, vx, vy, vz);
        this.freeStars.push(s);
        return s;
    }

    addRandom(cx, cy, cz, spread) {
        const types = Object.keys(GALAXY_TYPES);
        const a = Math.random() * Math.PI * 2, d = spread * (0.3 + Math.random() * 0.7);
        return this.add(cx + Math.cos(a) * d, cy + (Math.random() - 0.5) * spread * 0.2, cz + Math.sin(a) * d,
            0, 0, 0, types[Math.floor(Math.random() * types.length)],
            SIZE_PRESETS[Math.floor(Math.random() * SIZE_PRESETS.length)]);
    }

    addMultiGalaxyScene(count) {
        const types = ['spiral', 'barred', 'elliptical', 'lenticular', 'irregular'];
        const R = 200;
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2, sp = 0.4 + Math.random() * 0.4;
            this.add(Math.cos(a) * R, (Math.random() - 0.5) * 30, Math.sin(a) * R,
                -Math.sin(a) * sp, 0, Math.cos(a) * sp,
                types[i % types.length], SIZE_PRESETS[Math.floor(Math.random() * 3)]);
        }
    }

    step(dt) {
        const effectiveDt = dt * this.animSpeed;
        const sub = effectiveDt * this.tscale / 2;
        const Gval = G * this.Gmult;

        for (let pass = 0; pass < 2; pass++) {
            const alive = this.galaxies.filter(g => g.alive);
            if (!alive.length) break;

            for (const g of alive) { g.ax0 = g.ax; g.ay0 = g.ay; g.az0 = g.az; g.ax = 0; g.ay = 0; g.az = 0; }

            for (let i = 0; i < alive.length; i++) {
                for (let j = i + 1; j < alive.length; j++) {
                    const a = alive[i], b = alive[j];
                    if (a._merging || b._merging) continue;
                    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (dist < 0.1) continue;
                    const r2 = dx * dx + dy * dy + dz * dz + SOFT_GAL * SOFT_GAL;
                    const inv = 1 / (r2 * Math.sqrt(r2));
                    a.ax += Gval * b.Mtot * dx * inv; a.ay += Gval * b.Mtot * dy * inv; a.az += Gval * b.Mtot * dz * inv;
                    b.ax -= Gval * a.Mtot * dx * inv; b.ay -= Gval * a.Mtot * dy * inv; b.az -= Gval * a.Mtot * dz * inv;
                }
            }

            for (const g of alive) {
                g.x += g.vx * sub + 0.5 * g.ax0 * sub * sub;
                g.y += g.vy * sub + 0.5 * g.ay0 * sub * sub;
                g.z += g.vz * sub + 0.5 * g.az0 * sub * sub;
                g.vx += 0.5 * (g.ax0 + g.ax) * sub;
                g.vy += 0.5 * (g.ay0 + g.ay) * sub;
                g.vz += 0.5 * (g.az0 + g.az) * sub;
                const sv2 = g.vx * g.vx + g.vy * g.vy + g.vz * g.vz;
                if (sv2 > MAX_GALAXY_VEL * MAX_GALAXY_VEL) { const f = MAX_GALAXY_VEL / Math.sqrt(sv2); g.vx *= f; g.vy *= f; g.vz *= f; }
                if (g.bh) { g.bh.x = g.x; g.bh.y = g.y; g.bh.z = g.z; }
            }

            const allBHs = this.getBHs();
            for (const g of alive) {
                g.computeAccelerations(allBHs, alive, this.enableTides);
                g.integrate(sub);
                this._addStarsToGalaxy(g, sub);
                if (this._stepCount % STAR_COLL_FREQ === 0) {
                    g.checkStarCollisions();
                }
            }

            // Physics for free entities
            for (const bh of this.freeBlackHoles) {
                if (!bh.alive) continue;
                bh.ax = 0; bh.ay = 0; bh.az = 0;
                for (const g of alive) {
                    const dx = g.x - bh.x, dy = g.y - bh.y, dz = g.z - bh.z;
                    const r2 = dx * dx + dy * dy + dz * dz + SOFT_GAL * SOFT_GAL;
                    const inv = 1 / (r2 * Math.sqrt(r2));
                    bh.ax += Gval * g.Mtot * dx * inv;
                    bh.ay += Gval * g.Mtot * dy * inv;
                    bh.az += Gval * g.Mtot * dz * inv;
                    
                    // Reverse pull from free BH to galaxy
                    g.ax -= Gval * bh.mass * dx * inv;
                    g.ay -= Gval * bh.mass * dy * inv;
                    g.az -= Gval * bh.mass * dz * inv;
                }
                
                // Pull between free BHs
                for (const obh of this.freeBlackHoles) {
                    if (obh === bh || !obh.alive) continue;
                    const dx = obh.x - bh.x, dy = obh.y - bh.y, dz = obh.z - bh.z;
                    const r2 = dx * dx + dy * dy + dz * dz + 2.0;
                    const inv = 1 / (r2 * Math.sqrt(r2));
                    bh.ax += Gval * obh.mass * dx * inv;
                    bh.ay += Gval * obh.mass * dy * inv;
                    bh.az += Gval * obh.mass * dz * inv;
                }

                bh.vx += bh.ax * sub; bh.vy += bh.ay * sub; bh.vz += bh.az * sub;
                bh.x += bh.vx * sub; bh.y += bh.vy * sub; bh.z += bh.vz * sub;
            }

            for (const s of this.freeStars) {
                if (!s.alive) continue;
                let ax = 0, ay = 0, az = 0;
                for (const bh of allBHs) {
                    const dx = bh.x - s.lx, dy = bh.y - s.ly, dz = bh.z - s.lz;
                    const r2 = dx * dx + dy * dy + dz * dz + 2.0;
                    const inv = 1 / (r2 * Math.sqrt(r2));
                    ax += Gval * bh.mass * dx * inv;
                    ay += Gval * bh.mass * dy * inv;
                    az += Gval * bh.mass * dz * inv;
                }
                for (const g of alive) {
                    const dx = g.x - s.lx, dy = g.y - s.ly, dz = g.z - s.lz;
                    const r2 = dx * dx + dy * dy + dz * dz + SOFT_GAL * SOFT_GAL;
                    const inv = 1 / (r2 * Math.sqrt(r2));
                    ax += Gval * g.Mtot * dx * inv;
                    ay += Gval * g.Mtot * dy * inv;
                    az += Gval * g.Mtot * dz * inv;
                }
                s.lvx += ax * sub; s.lvy += ay * sub; s.lvz += az * sub;
                s.lx += s.lvx * sub; s.ly += s.lvy * sub; s.lz += s.lvz * sub;
                
                // Accretion
                for (const bh of allBHs) {
                    const dx = bh.x - s.lx, dy = bh.y - s.ly, dz = bh.z - s.lz;
                    if (dx*dx + dy*dy + dz*dz < bh.rTidal * bh.rTidal) {
                        s.alive = false;
                        bh.mass += s.size * 0.001;
                        bh.mergedFlash = Math.min(1.0, bh.mergedFlash + 0.08);
                    }
                }
            }

            this._mergeCheck(Gval);
            this._progressMerges(sub);
            this._checkBHMergers();

            for (const g of this.galaxies) {
                if (!g.alive) continue;
                if (g.bh?.mergedFlash > 0) g.bh.mergedFlash = Math.max(0, g.bh.mergedFlash - sub * 0.5);
                const mt = g.morphologyTransition;
                if (mt?.active) {
                    mt.t += sub;
                    const s = Math.min(mt.t / mt.duration, 1), ease = s * s * (3 - 2 * s);
                    g.Mbulge = mt.startBulge + (mt.targetBulge - mt.startBulge) * ease;
                    g.Mdisk  = mt.startDisk  + (mt.targetDisk  - mt.startDisk)  * ease;
                    if (s >= 1) mt.active = false;
                }
                if (g.starFormationCooldown > 0) g.starFormationCooldown -= sub;
            }
        }

        this.t += effectiveDt * this.tscale;
        this._stepCount++;
        if (this._stepCount % CM_CORRECT_FREQ === 0) this._correctCenterOfMass();
    }

    _correctCenterOfMass() {
        const alive = this.galaxies.filter(g => g.alive);
        if (!alive.length) return;
        let M = 0, pvx = 0, pvy = 0, pvz = 0;
        for (const g of alive) { M += g.Mtot; pvx += g.vx * g.Mtot; pvy += g.vy * g.Mtot; pvz += g.vz * g.Mtot; }
        if (M < 1e-12) return;
        pvx /= M; pvy /= M; pvz /= M;
        for (const g of alive) { g.vx -= pvx; g.vy -= pvy; g.vz -= pvz; }
    }

    _mergeCheck(Gval) {
        const alive = this.galaxies.filter(g => g.alive);
        for (let i = 0; i < alive.length; i++) {
            for (let j = i + 1; j < alive.length; j++) {
                const a = alive[i], b = alive[j];
                if (!a.alive || !b.alive || a._merging || b._merging) continue;
                const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const dvx = b.vx - a.vx, dvy = b.vy - a.vy, dvz = b.vz - a.vz;
                const relSpeed2 = dvx * dvx + dvy * dvy + dvz * dvz;
                const mu = a.Mtot + b.Mtot;
                const Eorb = 0.5 * relSpeed2 - Gval * mu / (dist + 1e-6);
                const close = dist < MERGE_DIST;
                const bound = Eorb < 0 && dist < MERGE_DIST * 2.5;
                if (close || bound) {
                    const cx = (a.x * a.Mtot + b.x * b.Mtot) / mu;
                    const cy = (a.y * a.Mtot + b.y * b.Mtot) / mu;
                    const cz = (a.z * a.Mtot + b.z * b.Mtot) / mu;
                    this._merges.push({ a, b, cx, cy, cz, t: 0, duration: 1.5 });
                    a._merging = true; b._merging = true;
                }
            }
        }
    }

    _progressMerges(dt) {
        if (!this._merges.length) return;
        const remaining = [];
        for (const m of this._merges) {
            m.t += dt;
            const ratio = Math.min(m.t / m.duration, 1);
            const mu = m.a.Mtot + m.b.Mtot;
            const cmVx = (m.a.vx * m.a.Mtot + m.b.vx * m.b.Mtot) / mu;
            const cmVy = (m.a.vy * m.a.Mtot + m.b.vy * m.b.Mtot) / mu;
            const cmVz = (m.a.vz * m.a.Mtot + m.b.vz * m.b.Mtot) / mu;
            const drag = Math.exp(-dt * 4.0);
            m.a.vx = cmVx + (m.a.vx - cmVx) * drag; m.a.vy = cmVy + (m.a.vy - cmVy) * drag; m.a.vz = cmVz + (m.a.vz - cmVz) * drag;
            m.b.vx = cmVx + (m.b.vx - cmVx) * drag; m.b.vy = cmVy + (m.b.vy - cmVy) * drag; m.b.vz = cmVz + (m.b.vz - cmVz) * drag;
            const pull = Math.min(dt * (1 + ratio * 3), 0.8);
            m.a.x += (m.cx - m.a.x) * pull; m.a.y += (m.cy - m.a.y) * pull; m.a.z += (m.cz - m.a.z) * pull;
            m.b.x += (m.cx - m.b.x) * pull; m.b.y += (m.cy - m.b.y) * pull; m.b.z += (m.cz - m.b.z) * pull;
            if (m.a.bh) { m.a.bh.x = m.a.x; m.a.bh.y = m.a.y; m.a.bh.z = m.a.z; }
            if (m.b.bh) { m.b.bh.x = m.b.x; m.b.bh.y = m.b.y; m.b.bh.z = m.b.z; }
            if (ratio >= 1) { this._merge(m.a, m.b); m.a._merging = false; m.b._merging = false; }
            else remaining.push(m);
        }
        this._merges = remaining;
    }

    _checkBHMergers() {
        const allBHs = this.getBHs();
        for (let i = 0; i < allBHs.length; i++) {
            for (let j = i + 1; j < allBHs.length; j++) {
                const a = allBHs[i], b = allBHs[j];
                if (!a.alive || !b.alive) continue;
                const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
                const mergeDist = Math.max(a.rh, b.rh) * 4.0; // un peu plus grand pour faciliter la fusion visuelle
                if (dx*dx + dy*dy + dz*dz < mergeDist * mergeDist) {
                    if (a.mass > b.mass) {
                        a.mass += b.mass;
                        a.mergedFlash = 1.0;
                        b.alive = false;
                        // Conserve la quantité de mouvement
                        if (a.vx !== undefined && b.vx !== undefined) {
                            a.vx = (a.vx * a.mass + b.vx * b.mass) / (a.mass + b.mass);
                            a.vy = (a.vy * a.mass + b.vy * b.mass) / (a.mass + b.mass);
                            a.vz = (a.vz * a.mass + b.vz * b.mass) / (a.mass + b.mass);
                        }
                    } else {
                        b.mass += a.mass;
                        b.mergedFlash = 1.0;
                        a.alive = false;
                        if (a.vx !== undefined && b.vx !== undefined) {
                            b.vx = (a.vx * a.mass + b.vx * b.mass) / (a.mass + b.mass);
                            b.vy = (a.vy * a.mass + b.vy * b.mass) / (a.mass + b.mass);
                            b.vz = (a.vz * a.mass + b.vz * b.mass) / (a.mass + b.mass);
                        }
                    }
                }
            }
        }
    }

    _merge(a, b) {
        const mu = a.Mtot + b.Mtot;
        const mx = (a.x * a.Mtot + b.x * b.Mtot) / mu, my = (a.y * a.Mtot + b.y * b.Mtot) / mu, mz = (a.z * a.Mtot + b.z * b.Mtot) / mu;
        const vx = (a.vx * a.Mtot + b.vx * b.Mtot) / mu, vy = (a.vy * a.Mtot + b.vy * b.Mtot) / mu, vz = (a.vz * a.Mtot + b.vz * b.Mtot) / mu;

        const mR = Math.min(a.Mtot, b.Mtot) / Math.max(a.Mtot, b.Mtot);
        const muU = this._fusionParams.mu ?? mR, alU = this._fusionParams.align ?? 0.5, durM = this._fusionParams.duration ?? 8.0;

        let tt;
        if (muU > 0.7) tt = 'elliptical';
        else if (muU > 0.3) tt = alU < 0.4 ? 'elliptical' : (Math.random() > 0.4 ? 'lenticular' : 'elliptical');
        else tt = a.Mtot > b.Mtot ? a.type : b.type;

        const wA = a.Mtot / mu, wB = b.Mtot / mu;
        const mergedColor = [
            a.dominantColor[0] * wA + b.dominantColor[0] * wB,
            a.dominantColor[1] * wA + b.dominantColor[1] * wB,
            a.dominantColor[2] * wA + b.dominantColor[2] * wB,
        ];
        const mergedAge = Math.min(1, (a.stellarAge * wA + b.stellarAge * wB) + 0.1);

        const preset = a.Mtot > b.Mtot ? a.preset : b.preset;
        const merged = new Galaxy(mx, my, mz, vx, vy, vz, tt, preset, {
            dominantColor: mergedColor,
            stellarAge: mergedAge,
        });

        for (const o of this.galaxies) {
            if (!o.alive || o === a || o === b) continue;
            const dx = merged.x - o.x, dy = merged.y - o.y, dz = merged.z - o.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d > 0 && d < 200) { const f = (1 - d / 200) * 0.02; o.vx += (dx / d) * f; o.vy += (dy / d) * f; o.vz += (dz / d) * f; }
        }

        if (a.bh && b.bh) { merged.bh.mass = a.bh.mass + b.bh.mass; merged.bh.mergedFlash = 1.0; }

        const ms = [];
        const mig = (p) => {
            for (const s of p.stars) {
                if (!s.alive) continue;
                const [wx, wy, wz] = p._localToWorld(s.lx, s.ly, s.lz);
                const [nlx, nly, nlz] = merged._worldToLocal(wx, wy, wz);
                const [vwx, vwy, vwz] = p._localToWorldVel(s.lvx, s.lvy, s.lvz);
                const [nlvx, nlvy, nlvz] = merged._worldToLocalVel(vwx + p.vx - merged.vx, vwy + p.vy - merged.vy, vwz + p.vz - merged.vz);
                const ns = new (s.constructor)(nlx, nly, nlz, nlvx, nlvy, nlvz);
                ns.size = s.size;
                ns.spectral = Math.min(1, s.spectral + 0.05 * Math.random());
                ms.push(ns);
            }
        };
        mig(a); mig(b);
        merged.stars = ms;

        a.alive = false; b.alive = false;
        if (a.bh) a.bh.alive = false;
        if (b.bh) b.bh.alive = false;

        merged.starFormationCooldown = 3.0;
        merged.gasFraction = Math.min(0.5, (a.gasFraction * a.Mtot + b.gasFraction * b.Mtot) / mu + 0.05);
        if (tt !== a.type || tt !== b.type) merged.morphologyTransition = { active: true, t: 0, duration: durM, startBulge: a.Mbulge + b.Mbulge, targetBulge: merged.Mbulge, startDisk: a.Mdisk + b.Mdisk, targetDisk: merged.Mdisk };

        this.galaxies.push(merged);
    }

    _addStarsToGalaxy(galaxy, dt) {
        if (!galaxy.alive || galaxy.gasFraction < 0.15 || galaxy.starFormationCooldown > 0) return;
        const gid = galaxy.id;
        if (!this._starFormationAccum[gid]) this._starFormationAccum[gid] = 0;
        this._starFormationAccum[gid] += (5 + (galaxy.gasFraction - 0.15) * 40) * dt;
        const count = Math.floor(this._starFormationAccum[gid]);
        if (count <= 0) return;
        this._starFormationAccum[gid] -= count;
        for (let i = 0; i < count; i++) {
            const R = galaxy.Rd * (0.1 + Math.random() * 0.4), theta = Math.random() * Math.PI * 2, vc = galaxy._vc(R);
            const ns = new Star(
                R * Math.cos(theta), R * Math.sin(theta), (Math.random() - 0.5) * galaxy.Zh * 0.3,
                -vc * Math.sin(theta) * 0.96, vc * Math.cos(theta) * 0.96, (Math.random() - 0.5) * vc * 0.01
            );
            ns.size = 0.5 + Math.random() * 1.5;
            ns.spectral = Math.random() * 0.4;
            galaxy.stars.push(ns);
        }
        galaxy.gasFraction = Math.max(0, galaxy.gasFraction - count * 0.001);
    }

    fuseClosest(duration = 2.0, mu = 0.5, align = 0.5) {
        const alive = this.galaxies.filter(g => g.alive);
        if (alive.length < 2) return;
        let bA = null, bB = null, bD = Infinity;
        for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
            const a = alive[i], b = alive[j]; if (a._merging || b._merging) continue;
            const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d < bD) { bD = d; bA = a; bB = b; }
        }
        if (!bA) return;
        this._fusionParams = { mu, align, duration };
        bA._merging = true; bB._merging = true;
        const mu2 = bA.Mtot + bB.Mtot;
        this._merges.push({ a: bA, b: bB, cx: (bA.x * bA.Mtot + bB.x * bB.Mtot) / mu2, cy: (bA.y * bA.Mtot + bB.y * bB.Mtot) / mu2, cz: (bA.z * bA.Mtot + bB.z * bB.Mtot) / mu2, t: 0, duration });
        this._fusionParams = { mu: null, align: null, duration: null };
    }

    getBHs() { 
        return this.galaxies.filter(g => g.alive && g.bh?.alive).map(g => g.bh)
                   .concat(this.freeBlackHoles.filter(bh => bh.alive)); 
    }

    reset() {
        this.galaxies = []; this.freeStars = []; this.freeBlackHoles = [];
        Galaxy._id = 0; BlackHole._id = 0;
        this.t = 0; this._starFormationAccum = {}; this._merges = []; this._stepCount = 0;
    }

    stats() {
        let stars = this.freeStars.filter(s => s.alive).length;
        let bhs = this.freeBlackHoles.filter(bh => bh.alive).length;
        for (const g of this.galaxies) { if (!g.alive) continue; stars += g.stars.filter(s => s.alive).length; if (g.bh?.alive) bhs++; }
        return { galaxies: this.galaxies.filter(g => g.alive).length, stars, bhs, t: this.t };
    }

    getParticles() { 
        const gStars = this.galaxies.filter(g => g.alive).flatMap(g => g.getWorldStars()); 
        const fStars = this.freeStars.filter(s => s.alive).map(s => ({
            x: s.lx, y: s.ly, z: s.lz,
            glow: 0,
            distFromCenter: 100,
            galaxyType: 'free',
            vx: s.lvx, vy: s.lvy, vz: s.lvz,
            accretionGlow: 0,
            starSize: s.size,
            colorR: 1.0, colorG: 0.9, colorB: 0.8
        }));
        return gStars.concat(fStars);
    }
    getElapsedTime() { return this.t; }
    get GMultiplier()      { return this.Gmult; }
    set GMultiplier(value) { this.Gmult = value; }
}

export { PhysicsEngine };
import { Galaxy, Star, BlackHole } from './galaxy-objects.js';
import { G, SOFT_TIDAL, MERGE_DIST, MERGE_SPEED, GALAXY_TYPES, SIZE_PRESETS } from './constants.js';

class PhysicsEngine {
    constructor() {
        this.galaxies = [];
        this.t = 0;
        this.Gmult = 1;
        this.tscale = 1;
        this.enableTides = true;
        this._starFormationAccum = {};
        this._merges = [];
        this._fusionParams = { mu: null, align: null, duration: null };
    }

    setFusionParams(mu, align, duration) {
        this._fusionParams = { mu, align, duration };
    }

    add(x, y, z, vx, vy, vz, type, preset) {
        const galaxy = new Galaxy(x, y, z, vx, vy, vz, type, preset);
        this.galaxies.push(galaxy);
        return galaxy;
    }

    addGalaxy(x, y, z, vx, vy, vz, type, preset) {
        return this.add(x, y, z, vx, vy, vz, type, preset);
    }

    addRandom(cx, cy, cz, spread) {
        const types = Object.keys(GALAXY_TYPES);
        const a = Math.random() * Math.PI * 2;
        const d = spread * (0.3 + Math.random() * 0.7);
        return this.add(
            cx + Math.cos(a) * d,
            cy + (Math.random() - 0.5) * spread * 0.2,
            cz + Math.sin(a) * d,
            0,
            0,
            0,
            types[Math.floor(Math.random() * types.length)],
            SIZE_PRESETS[Math.floor(Math.random() * SIZE_PRESETS.length)]
        );
    }

    addMultiGalaxyScene(count) {
        const types = ['spiral', 'barred', 'elliptical', 'lenticular', 'irregular'];
        const radius = 200;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = (Math.random() - 0.5) * 30;
            const speed = 0.5 + Math.random() * 0.5;
            const vx = -Math.sin(angle) * speed;
            const vz = Math.cos(angle) * speed;
            const type = types[i % types.length];
            const preset = SIZE_PRESETS[Math.floor(Math.random() * 3)];
            this.add(x, y, z, vx, 0, vz, type, preset);
        }
    }

    step(dt) {
        const sub = dt * this.tscale;
        const steps = 2;
        const Gval = G * this.Gmult;

        for (let pass = 0; pass < steps; pass++) {
            const alive = this.galaxies.filter(g => g.alive);
            for (const galaxy of alive) {
                galaxy.ax0 = galaxy.ax;
                galaxy.ay0 = galaxy.ay;
                galaxy.az0 = galaxy.az;
                galaxy.x += galaxy.vx * sub + 0.5 * galaxy.ax * sub * sub;
                galaxy.y += galaxy.vy * sub + 0.5 * galaxy.ay * sub * sub;
                galaxy.z += galaxy.vz * sub + 0.5 * galaxy.az * sub * sub;
                if (galaxy.bh) {
                    galaxy.bh.x = galaxy.x;
                    galaxy.bh.y = galaxy.y;
                    galaxy.bh.z = galaxy.z;
                }
            }

            const aliveGalaxies = this.galaxies.filter(g => g.alive);
            for (const galaxy of aliveGalaxies) {
                galaxy.ax = 0;
                galaxy.ay = 0;
                galaxy.az = 0;
            }

            for (let i = 0; i < aliveGalaxies.length; i++) {
                for (let j = i + 1; j < aliveGalaxies.length; j++) {
                    const a = aliveGalaxies[i];
                    const b = aliveGalaxies[j];
                    // Do not apply mutual gravity while either galaxy is merging (stabilize during merge)
                    if (a._merging || b._merging) continue;
                // Skip mutual gravity during imminent merges to avoid explosive accelerations
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dz = b.z - a.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist < MERGE_DIST) continue;
                const r2 = dx * dx + dy * dy + dz * dz + SOFT_TIDAL * SOFT_TIDAL;
                const invR3 = 1 / (r2 * Math.sqrt(r2));
                a.ax += Gval * b.Mtot * dx * invR3;
                a.ay += Gval * b.Mtot * dy * invR3;
                a.az += Gval * b.Mtot * dz * invR3;
                b.ax -= Gval * a.Mtot * dx * invR3;
                b.ay -= Gval * a.Mtot * dy * invR3;
                b.az -= Gval * a.Mtot * dz * invR3;
            }
        }

            for (const galaxy of aliveGalaxies) {
                galaxy.vx += 0.5 * (galaxy.ax0 + galaxy.ax) * sub;
                galaxy.vy += 0.5 * (galaxy.ay0 + galaxy.ay) * sub;
                galaxy.vz += 0.5 * (galaxy.az0 + galaxy.az) * sub;
            }

            const allBHs = this.getBHs();
            const alive3 = this.galaxies.filter(g => g.alive);
            for (const galaxy of alive3) {
                galaxy.computeAccelerations(allBHs, alive3, this.enableTides);
                galaxy.integrate(sub);
                this._addStarsToGalaxy(galaxy, sub);
            }

            this._mergeCheck();
            // Progress any ongoing merges (requires proper update per sub-step)
            this._progressMerges(sub);
            for (const galaxy of this.galaxies) {
                if (!galaxy.alive) continue;
                if (galaxy.bh && galaxy.bh.mergedFlash > 0) {
                    galaxy.bh.mergedFlash -= sub * 0.5;
                    if (galaxy.bh.mergedFlash < 0) galaxy.bh.mergedFlash = 0;
                }
                const mt = galaxy.morphologyTransition;
                if (mt && mt.active) {
                    mt.t += sub;
                    const progress = Math.min(mt.t / mt.duration, 1.0);
                    const ease = progress * progress * (3 - 2 * progress);
                    galaxy.Mbulge = mt.startBulge + (mt.targetBulge - mt.startBulge) * ease;
                    galaxy.Mdisk = mt.startDisk + (mt.targetDisk - mt.startDisk) * ease;
                    if (progress >= 1.0) mt.active = false;
                }
                if (galaxy.starFormationCooldown > 0) {
                    galaxy.starFormationCooldown -= sub;
                }
            }
        }

        this.t += sub;
    }

    _mergeCheck() {
        const alive = this.galaxies.filter(g => g.alive);
        // Start timeline merge towards center for stable visuals
        for (let i = 0; i < alive.length; i++) {
            for (let j = i + 1; j < alive.length; j++) {
                const a = alive[i];
                const b = alive[j];
                if (!a.alive || !b.alive) continue;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dz = b.z - a.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist < MERGE_DIST) {
                    const relSpeed = Math.sqrt((b.vx - a.vx) ** 2 + (b.vy - a.vy) ** 2 + (b.vz - a.vz) ** 2);
                    if (relSpeed < MERGE_SPEED) {
                        // Avoid duplicates
                        if (!a._merging && !b._merging) {
                            const cx = (a.x + b.x) * 0.5;
                            const cy = (a.y + b.y) * 0.5;
                            const cz = (a.z + b.z) * 0.5;
                            this._merges.push({ a, b, cx, cy, cz, t: 0, duration: 1.8 });
                            a._merging = true;
                            b._merging = true;
                        }
                    }
                }
            }
        }
    }

    _progressMerges(dt) {
        if (!this._merges.length) return;
        const sub = dt;
        const remaining = [];
        for (const m of this._merges) {
            m.t += sub;
            const t = m.t / m.duration;
            const ratio = Math.min(t, 1);
            // Interpolate positions toward center
            m.a.x += (m.cx - m.a.x) * (sub / m.duration);
            m.a.y += (m.cy - m.a.y) * (sub / m.duration);
            m.a.z += (m.cz - m.a.z) * (sub / m.duration);
            m.b.x += (m.cx - m.b.x) * (sub / m.duration);
            m.b.y += (m.cy - m.b.y) * (sub / m.duration);
            m.b.z += (m.cz - m.b.z) * (sub / m.duration);
            if (ratio >= 1) {
                this._merge(m.a, m.b);
                m.a._merging = false;
                m.b._merging = false;
            } else {
                remaining.push(m);
            }
        }
        this._merges = remaining;
    }

    getBHs() {
        return this.galaxies
            .filter(g => g.alive && g.bh && g.bh.alive)
            .map(g => g.bh);
    }

    _addStarsToGalaxy(galaxy, dt) {
        if (!galaxy.alive || galaxy.gasFraction < 0.15) return;
        if (galaxy.starFormationCooldown > 0) return;
        const gid = galaxy.id;
        if (!this._starFormationAccum[gid]) {
            this._starFormationAccum[gid] = 0;
        }
        const rate = 5 + (galaxy.gasFraction - 0.15) * 40;
        this._starFormationAccum[gid] += rate * dt;
        const count = Math.floor(this._starFormationAccum[gid]);
        if (count > 0) {
            this._starFormationAccum[gid] -= count;
            for (let i = 0; i < count; i++) {
                const R = galaxy.Rd * (0.1 + Math.random() * 0.4);
                const theta = Math.random() * Math.PI * 2;
                const z = (Math.random() - 0.5) * galaxy.Zh * 0.3;
                const lx = R * Math.cos(theta);
                const ly = R * Math.sin(theta);
                const vc = galaxy._vc(R);
                const vx = -vc * Math.sin(theta) * 0.95;
                const vy = vc * Math.cos(theta) * 0.95;
                const vz = (Math.random() - 0.5) * vc * 0.01;
                galaxy.stars.push(new Star(lx, ly, z, vx, vy, vz));
            }
            galaxy.gasFraction = Math.max(0, galaxy.gasFraction - count * 0.001);
        }
    }

    _merge(a, b) {
        const totalMass = a.Mtot + b.Mtot;
        const mx = (a.x * a.Mtot + b.x * b.Mtot) / totalMass;
        const my = (a.y * a.Mtot + b.y * b.Mtot) / totalMass;
        const mz = (a.z * a.Mtot + b.z * b.Mtot) / totalMass;
        const vx = (a.vx * a.Mtot + b.vx * b.Mtot) / totalMass;
        const vy = (a.vy * a.Mtot + b.vy * b.Mtot) / totalMass;
        const vz = (a.vz * a.Mtot + b.vz * b.Mtot) / totalMass;
        const mu = Math.min(a.Mtot, b.Mtot) / Math.max(a.Mtot, b.Mtot);
        // Use fusion params if provided by UI
        const muUsed = (this._fusionParams && this._fusionParams.mu != null) ? this._fusionParams.mu : mu;
        // Default alignment to a neutral value if not provided by UI
        const alignUsed = (this._fusionParams && this._fusionParams.align != null) ? this._fusionParams.align : 0.5;
        const durationMerge = (this._fusionParams && this._fusionParams.duration != null) ? this._fusionParams.duration : 8.0;
        let targetType;
        if (muUsed > 0.7) {
            targetType = 'elliptical';
        } else if (muUsed > 0.3) {
            targetType = alignUsed < 0.4 ? 'elliptical' : (Math.random() > 0.4 ? 'lenticular' : 'elliptical');
        } else {
            targetType = a.Mtot > b.Mtot ? a.type : b.type;
        }
        const preset = a.Mtot > b.Mtot ? a.preset : b.preset;
        const merged = new Galaxy(mx, my, mz, vx, vy, vz, targetType, preset);
        // Gentle gravitational impulse to nearby galaxies to simulate a coalescence wave
        // This helps nearby objects get pulled toward the new center visually and physically.
        const impulseRadius = 200;
        const impulseStrength = 0.02;
        for (const other of this.galaxies) {
            if (!other.alive || other === a || other === b) continue;
            const dx = merged.x - other.x;
            const dy = merged.y - other.y;
            const dz = merged.z - other.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (dist > 0 && dist < impulseRadius) {
                const f = (1 - dist / impulseRadius) * impulseStrength;
                other.vx += (dx / dist) * f;
                other.vy += (dy / dist) * f;
                other.vz += (dz / dist) * f;
            }
        }
        if (a.bh && b.bh) {
            merged.bh.mass = a.bh.mass + b.bh.mass;
            merged.bh.mergedFlash = 1.0;
        }
        // Rebuild merged stars from both parents to avoid aliasing, transforming velocities properly
        const mergedStars = [];
        // Stars from A
        for (const s of a.stars) {
            if (!s.alive) continue;
            // position transform
            const [wx, wy, wz] = a._localToWorld(s.lx, s.ly, s.lz);
            const [nlx, nly, nlz] = merged._worldToLocal(wx, wy, wz);
            // velocity: local -> world, then to abs world, then to merged local
            const [vwx, vwy, vwz] = a._localToWorldVel(s.lvx, s.lvy, s.lvz);
            const absV = [vwx + a.vx, vwy + a.vy, vwz + a.vz];
            const [nlvx, nlvy, nlvz] = merged._worldToLocalVel(absV[0], absV[1], absV[2]);
            mergedStars.push(new Star(nlx, nly, nlz, nlvx, nlvy, nlvz));
        }
        // Stars from B
        for (const s of b.stars) {
            if (!s.alive) continue;
            const [wx, wy, wz] = b._localToWorld(s.lx, s.ly, s.lz);
            const [nlx, nly, nlz] = merged._worldToLocal(wx, wy, wz);
            const [vwx, vwy, vwz] = b._localToWorldVel(s.lvx, s.lvy, s.lvz);
            const absV = [vwx + b.vx, vwy + b.vy, vwz + b.vz];
            const [nlvx, nlvy, nlvz] = merged._worldToLocalVel(absV[0], absV[1], absV[2]);
            mergedStars.push(new Star(nlx, nly, nlz, nlvx, nlvy, nlvz));
        }
        merged.stars = mergedStars;
        a.alive = false;
        b.alive = false;
        if (a.bh) a.bh.alive = false;
        if (b.bh) b.bh.alive = false;
        merged.starFormationCooldown = 3.0;
        merged.gasFraction = Math.min(0.5, (a.gasFraction * a.Mtot + b.gasFraction * b.Mtot) / totalMass + 0.05);
        if (targetType !== a.type || targetType !== b.type) {
            merged.morphologyTransition = {
                active: true,
                t: 0,
                duration: durationMerge,
                startBulge: a.Mbulge + b.Mbulge,
                targetBulge: merged.Mbulge,
                startDisk: a.Mdisk + b.Mdisk,
                targetDisk: merged.Mdisk,
            };
        }
        this.galaxies.push(merged);
    }

    reset() {
        this.galaxies = [];
        Galaxy._id = 0;
        BlackHole._id = 0;
        this.t = 0;
        this._starFormationAccum = {};
    }

    stats() {
        let stars = 0;
        let bhs = 0;
        for (const galaxy of this.galaxies) {
            if (!galaxy.alive) continue;
            stars += galaxy.stars.filter(s => s.alive).length;
            if (galaxy.bh && galaxy.bh.alive) bhs++;
        }
        return {
            galaxies: this.galaxies.filter(g => g.alive).length,
            stars,
            bhs,
            t: this.t,
        };
    }

    getParticles() {
        return this.galaxies.filter(g => g.alive).flatMap(g => g.getWorldStars());
    }

    getElapsedTime() {
        return this.t;
    }

    get GMultiplier() {
        return this.Gmult;
    }

    set GMultiplier(value) {
        this.Gmult = value;
    }

    // Manual fusion of closest pair (two nuclei) – user-invoked fuse action
    fuseClosest(duration = 2.0, mu = 0.5, align = 0.5) {
        const alive = this.galaxies.filter(g => g.alive);
        if (alive.length < 2) return;
        let bestA = null, bestB = null, bestDist = Infinity;
        for (let i = 0; i < alive.length; i++) {
            for (let j = i + 1; j < alive.length; j++) {
                const a = alive[i], b = alive[j];
                if (a._merging || b._merging) continue;
                const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
                const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
                if (d < bestDist) { bestDist = d; bestA = a; bestB = b; }
            }
        }
        if (!bestA || !bestB) return;
        // Override fusion params for this operation
        this._fusionParams = { mu: mu, align: align, duration: duration };
        this._merge(bestA, bestB);
        // Clear fusion params afterwards
        this._fusionParams = { mu: null, align: null, duration: null };
    }
}

export { PhysicsEngine };

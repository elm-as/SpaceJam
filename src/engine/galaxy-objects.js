import { G, SOFT_BH, SOFT_TIDAL, GALAXY_TYPES } from './constants.js';
import { rand, gauss } from './utils.js';

class Star {
    constructor(lx, ly, lz, lvx, lvy, lvz) {
        this.lx = lx;
        this.ly = ly;
        this.lz = lz;
        this.lvx = lvx;
        this.lvy = lvy;
        this.lvz = lvz;
        this.alive = true;
        this.glow = 0;
        this.lax = 0;
        this.lay = 0;
        this.laz = 0;
    }
}

class BlackHole {
    static _id = 0;
    constructor(x, y, z, mass) {
        this.id = BlackHole._id++;
        this.x = x;
        this.y = y;
        this.z = z;
        this.mass = mass;
        this.alive = true;
        this.trail = [];
        this.trailMax = 150;
        this.mergedFlash = 0;
    }

    get rh() {
        return Math.pow(G * this.mass * 0.01, 1 / 3);
    }

    get ra() {
        return this.rh * 25;
    }
}

class Galaxy {
    static _id = 0;
    constructor(x, y, z, vx, vy, vz, type, preset) {
        this.id = Galaxy._id++;
        this.x = x;
        this.y = y;
        this.z = z;
        this.vx = vx;
        this.vy = vy;
        this.vz = vz;
        this.ax = 0;
        this.ay = 0;
        this.az = 0;
        this.ax0 = 0;
        this.ay0 = 0;
        this.az0 = 0;
        this.type = type;
        this.preset = preset;
        this.alive = true;
        this.stars = [];
        this.bh = null;
        this._setupOrientation();
        this._initMasses(preset);
        this._initShape(type);
        this.bh = new BlackHole(x, y, z, this.Mbh);
        this._generate();
        this.gasFraction = this._initGasFraction(type);
        this.morphologyTransition = { active: false, t: 0, duration: 5.0 };
        this.starFormationCooldown = 0;
        this.targetNArms = this.nArms ?? 0;
        this.targetPitch = this.pitch ?? 0;
        this.targetArmW = this.armW ?? 0;
    }

    get blackHole() {
        return this.bh;
    }

    get mass() {
        return this.Mtot;
    }

    set GMultiplier(value) {
        this.Gmult = value;
    }

    _initGasFraction(type) {
        switch (type) {
            case 'spiral': return 0.30;
            case 'barred': return 0.25;
            case 'irregular': return 0.40;
            case 'lenticular': return 0.10;
            case 'elliptical': return 0.05;
            default: return 0.20;
        }
    }

    _setupOrientation() {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        this.ox = Math.sin(phi) * Math.cos(theta);
        this.oy = Math.sin(phi) * Math.sin(theta);
        this.oz = Math.cos(phi);
        const len = Math.sqrt(1 - this.oz * this.oz) || 1;
        this.ux = -this.oy / len;
        this.uy = this.ox / len;
        this.uz = 0;
        this._wx = this.oy * this.uz - this.oz * this.uy;
        this._wy = this.oz * this.ux - this.ox * this.uz;
        this._wz = this.ox * this.uy - this.oy * this.ux;
    }

    _localToWorld(lx, ly, lz) {
        return [
            lx * this.ux + ly * this._wx + lz * this.ox + this.x,
            lx * this.uy + ly * this._wy + lz * this.oy + this.y,
            lx * this.uz + ly * this._wz + lz * this.oz + this.z,
        ];
    }

    _worldToLocal(wx, wy, wz) {
        const dx = wx - this.x;
        const dy = wy - this.y;
        const dz = wz - this.z;
        return [
            dx * this.ux + dy * this.uy + dz * this.uz,
            dx * this._wx + dy * this._wy + dz * this._wz,
            dx * this.ox + dy * this.oy + dz * this.oz,
        ];
    }

    _initMasses(preset) {
        this.Mtot = preset.M * rand(0.9, 1.1);
        this.Rd = preset.Rd;
        this.Zh = preset.Zh;
        this.Rb = preset.Rb;
        this.Rh = preset.Rh;
        this.Mbh = this.Mtot * preset.bhR;
        this.Mbulge = this.Mtot * 0.10;
        this.Mdisk = this.Mtot * 0.15;
        this.Mhalo = this.Mtot * 0.05;
        if (this.type === 'elliptical') {
            this.Mbulge = this.Mtot * 0.25;
            this.Mdisk = this.Mtot * 0.02;
        }
        if (this.type === 'lenticular') {
            this.Mbulge = this.Mtot * 0.18;
            this.Mdisk = this.Mtot * 0.12;
        }
    }

    _initShape(type) {
        const info = GALAXY_TYPES[type];
        if (info.armRange) {
            this.nArms = Math.floor(rand(...info.armRange));
            this.pitch = rand(...info.pitchRange);
            this.armW = rand(0.25, 0.45);
        }
        if (type === 'barred') {
            this.nArms = 2;
            this.pitch = rand(0.2, 0.35);
            this.armW = 0.3;
            this.barLen = this.Rd * rand(0.5, 0.8);
            this.barAngle = Math.random() * Math.PI;
        }
        if (type === 'irregular') {
            this.nArms = Math.floor(rand(...info.armRange));
            this.pitch = rand(...info.pitchRange);
            this.armW = 0.6;
        }
    }

    _vc(R) {
        const fBH = G * this.Mbh / (R + SOFT_BH);
        const fB = G * this.Mbulge * R * R / Math.pow(R * R + this.Rb * this.Rb, 1.5);
        const fH = 0.36 * R * R / (R * R + this.Rh * this.Rh);
        return Math.sqrt(Math.max(fBH + fB + fH, 0.001));
    }

    _generate() {
        const N = Math.floor(this.preset.N * rand(0.8, 1.2));
        for (let i = 0; i < N; i++) {
            let R;
            let theta;
            let z;
            let lx;
            let ly;
            let lz;
            let vx;
            let vy;
            let vz;
            if (this.type === 'elliptical') {
                const Re = this.Rb * 3;
                R = Re * -Math.log(1 - Math.random());
                if (R > Re * 5) R = Re * 5;
                const th = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const f = 0.6 + Math.random() * 0.2;
                lx = R * Math.sin(phi) * Math.cos(th);
                ly = R * Math.sin(phi) * Math.sin(th);
                lz = R * Math.cos(phi) * f;
                const sigma = Math.sqrt(G * this.Mbh / (R + SOFT_BH)) * 0.3;
                vx = gauss(0, sigma);
                vy = gauss(0, sigma);
                vz = gauss(0, sigma) * 0.5;
                this.stars.push(new Star(lx, ly, lz, vx, vy, vz));
                continue;
            }
            R = this.Rd * -Math.log(1 - Math.random());
            theta = Math.random() * Math.PI * 2;
            if (this.type === 'barred' && Math.random() > 0.4 && R < this.barLen) {
                R = Math.random() * this.barLen;
                theta = this.barAngle + (Math.random() - 0.5) * 0.6;
            } else if (this.nArms) {
                const arm = Math.floor(Math.random() * this.nArms);
                theta = arm * (2 * Math.PI / this.nArms)
                    + Math.log(Math.max(R, 1)) / Math.tan(this.pitch)
                    + (Math.random() - 0.5) * this.armW * 2;
            }
            lx = R * Math.cos(theta);
            ly = R * Math.sin(theta);
            z = (Math.random() - 0.5) * this.Zh * (1 + R * 0.01);
            const vc = this._vc(R);
            const e = 0.94 + Math.random() * 0.12;
            vx = -vc * Math.sin(theta) * e;
            vy = vc * Math.cos(theta) * e;
            vz = (Math.random() - 0.5) * vc * 0.01;
            this.stars.push(new Star(lx, ly, z, vx, vy, vz));
        }
    }

    computeAccelerations(otherBHs, otherGalaxies, enableTides) {
        const bh = this.bh;
        for (const star of this.stars) {
            if (!star.alive) continue;
            const lx = star.lx;
            const ly = star.ly;
            const lz = star.lz;
            const R2 = lx * lx + ly * ly + lz * lz + SOFT_BH * SOFT_BH;
            const R = Math.sqrt(R2);
            const invR3 = 1 / (R2 * R);
            const fBH = G * bh.mass * invR3;
            const fB = G * this.Mbulge / Math.pow(R2 + this.Rb * this.Rb, 1.5);
            const fH = 0.36 / Math.sqrt(R2 + this.Rh * this.Rh);
            let ax = -fBH * lx - fB * lx - fH * lx;
            let ay = -fBH * ly - fB * ly - fH * ly;
            let az = -fBH * lz - fB * lz - fH * lz;
            const [sx, sy, sz] = this._localToWorld(lx, ly, lz);
            if (enableTides) {
                for (const other of otherGalaxies) {
                    if (other === this || !other.alive) continue;
                    const dx = other.x - sx;
                    const dy = other.y - sy;
                    const dz = other.z - sz;
                    const d2 = dx * dx + dy * dy + dz * dz + SOFT_TIDAL * SOFT_TIDAL;
                    const d = Math.sqrt(d2);
                    const invD3 = 1 / (d2 * d);
                    const ftDirect = G * other.Mtot * invD3;
                    const [fax, fay, faz] = this._worldToLocal(dx, dy, dz);
                    ax += ftDirect * fax;
                    ay += ftDirect * fay;
                    az += ftDirect * faz;
                    const tideStrength = 2 * G * other.Mtot / (d * d * d);
                    const distFromCenter = R;
                    const tideFactor = tideStrength * distFromCenter * 0.01;
                    const radialFactor = Math.min(distFromCenter / this.Rd, 2.0);
                    ax += fax * tideFactor * radialFactor;
                    ay += fay * tideFactor * radialFactor;
                    az += faz * tideFactor * radialFactor;
                }
            }
            star.lax = ax;
            star.lay = ay;
            star.laz = az;
            star.glow = R < bh.ra ? 1 - R / bh.ra : 0;
        }
    }

    integrate(dt) {
        const subSteps = 3;
        const subDt = dt / subSteps;
        for (const star of this.stars) {
            if (!star.alive) continue;
            star.lvx += star.lax * subDt * 0.5;
            star.lvy += star.lay * subDt * 0.5;
            star.lvz += star.laz * subDt * 0.5;
            star.lx += star.lvx * subDt;
            star.ly += star.lvy * subDt;
            star.lz += star.lvz * subDt;
            star.lvx += star.lax * subDt * 0.5;
            star.lvy += star.lay * subDt * 0.5;
            star.lvz += star.laz * subDt * 0.5;
            const sp2 = star.lvx * star.lvx + star.lvy * star.lvy + star.lvz * star.lvz;
            if (sp2 > 500) {
                const limit = 22 / Math.sqrt(sp2);
                star.lvx *= limit;
                star.lvy *= limit;
                star.lvz *= limit;
            }
        }
    }

    getWorldStars() {
        const out = [];
        for (const star of this.stars) {
            if (!star.alive) continue;
            const [wx, wy, wz] = this._localToWorld(star.lx, star.ly, star.lz);
            const dist = Math.sqrt(star.lx * star.lx + star.ly * star.ly + star.lz * star.lz);
            out.push({
                x: wx,
                y: wy,
                z: wz,
                glow: star.glow,
                distFromCenter: dist,
                galaxyType: this.type,
                vx: star.lvx,
                vy: star.lvy,
                vz: star.lvz,
                accretionGlow: star.glow,
            });
        }
        return out;
    }

    // Velocity transformation helpers: local -> world
    // and world -> local (used for merging stars between galaxies)
    _localToWorldVel(lvX, lvY, lvZ) {
        // v_world = rotation_matrix * v_local
        const wx = lvX * this.ux + lvY * this._wx + lvZ * this.ox;
        const wy = lvX * this.uy + lvY * this._wy + lvZ * this.oy;
        const wz = lvX * this.uz + lvY * this._wz + lvZ * this.oz;
        return [wx, wy, wz];
    }

    _worldToLocalVel(wx, wy, wz) {
        // v_local = rotation_matrix_transpose * v_world
        const lvx = wx * this.ux + wy * this.uy + wz * this.uz;
        const lvy = wx * this._wx + wy * this._wy + wz * this._wz;
        const lvz = wx * this.ox + wy * this.oy + wz * this.oz;
        return [lvx, lvy, lvz];
    }
}

export { Star, BlackHole, Galaxy };

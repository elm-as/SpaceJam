import { G, SOFT_BH, SOFT_TIDAL, GALAXY_TYPES } from './constants.js';
import { rand, gauss } from './utils.js';

const SOFT_STAR  = 1.5;
const V_MAX      = 22;
const V_MAX2     = V_MAX * V_MAX;
const ORBIT_DAMP = 0.9998;

// ─── Star ─────────────────────────────────────────────────────────────────────
class Star {
    constructor(lx, ly, lz, lvx, lvy, lvz) {
        this.lx = lx; this.ly = ly; this.lz = lz;
        this.lvx = lvx; this.lvy = lvy; this.lvz = lvz;
        this.lax = 0; this.lay = 0; this.laz = 0;
        this.lax0 = 0; this.lay0 = 0; this.laz0 = 0;
        this.alive = true; this.glow = 0;
        // Taille intrinsèque de l'étoile : distribution réaliste (IMF simplifiée)
        // La plupart sont petites, quelques-unes très grandes
        const r = Math.random();
        if (r < 0.60)       this.size = 0.4 + Math.random() * 0.4;   // naines (60%)
        else if (r < 0.85)  this.size = 0.9 + Math.random() * 0.6;   // solaires (25%)
        else if (r < 0.96)  this.size = 1.6 + Math.random() * 1.2;   // géantes (11%)
        else                this.size = 3.0 + Math.random() * 2.5;    // supergéantes (4%)
        // Température / couleur spectrale intrinsèque (O,B,A,F,G,K,M)
        this.spectral = Math.random(); // 0=bleu chaud, 1=rouge froid
    }
}

// ─── BlackHole ────────────────────────────────────────────────────────────────
class BlackHole {
    static _id = 0;
    constructor(x, y, z, mass) {
        this.id = BlackHole._id++;
        this.x = x; this.y = y; this.z = z;
        this.mass = mass; this.alive = true;
        this.trail = []; this.trailMax = 150; this.mergedFlash = 0;
    }
    get rh() { return Math.pow(G * this.mass * 0.01, 1 / 3); }
    get ra() { return this.rh * 25; }
    // Rayon de destruction très petit : seulement les étoiles vraiment au cœur du TN
    get rTidal() { return Math.max(1.5, this.rh * 2); }
}

// ─── Galaxy ───────────────────────────────────────────────────────────────────
class Galaxy {
    static _id = 0;

    constructor(x, y, z, vx, vy, vz, type, preset, mergeData) {
        this.id = Galaxy._id++;
        this.x = x; this.y = y; this.z = z;
        this.vx = vx; this.vy = vy; this.vz = vz;
        this.ax = 0; this.ay = 0; this.az = 0;
        this.ax0 = 0; this.ay0 = 0; this.az0 = 0;
        this.type = type; this.preset = preset;
        this.alive = true; this.stars = []; this.bh = null; this._merging = false;
        // Couleur dominante héritée ou définie par type
        this.dominantColor = mergeData?.dominantColor || this._defaultColor(type);
        // Âge stellaire moyen (0=jeune/bleu, 1=vieux/rouge)
        this.stellarAge = mergeData?.stellarAge ?? this._defaultAge(type);
        this._setupOrientation();
        this._initMasses(preset);
        this._initShape(type);
        this.bh = new BlackHole(x, y, z, this.Mbh);
        this._generate();
        this.gasFraction = this._initGasFraction(type);
        this.morphologyTransition = { active: false, t: 0, duration: 5.0 };
        this.starFormationCooldown = 0;
        // Compteur destruction pour stats
        this.destroyedCount = 0;
    }

    _defaultColor(type) {
        // [r,g,b] couleur dominante des étoiles selon le type
        return {
            spiral:     [0.45, 0.65, 1.0],
            barred:     [1.0,  0.78, 0.25],
            elliptical: [1.0,  0.55, 0.30],
            lenticular: [0.95, 0.80, 0.55],
            irregular:  [0.70, 0.90, 1.0],
        }[type] || [1.0, 1.0, 1.0];
    }

    _defaultAge(type) {
        // 0=jeune, 1=vieux
        return { spiral: 0.3, barred: 0.45, elliptical: 0.85, lenticular: 0.65, irregular: 0.15 }[type] ?? 0.5;
    }

    _initGasFraction(type) {
        return { spiral: 0.30, barred: 0.25, irregular: 0.40, lenticular: 0.10, elliptical: 0.05 }[type] ?? 0.20;
    }

    _setupOrientation() {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        this.ox = Math.sin(phi) * Math.cos(theta);
        this.oy = Math.sin(phi) * Math.sin(theta);
        this.oz = Math.cos(phi);
        const len = Math.sqrt(1 - this.oz * this.oz) || 1;
        this.ux = -this.oy / len; this.uy = this.ox / len; this.uz = 0;
        this._wx = this.oy * this.uz - this.oz * this.uy;
        this._wy = this.oz * this.ux - this.ox * this.uz;
        this._wz = this.ox * this.uy - this.oy * this.ux;
    }

    _localToWorld(lx, ly, lz) {
        return [lx * this.ux + ly * this._wx + lz * this.ox + this.x,
                lx * this.uy + ly * this._wy + lz * this.oy + this.y,
                lx * this.uz + ly * this._wz + lz * this.oz + this.z];
    }
    _worldToLocal(wx, wy, wz) {
        const dx = wx - this.x, dy = wy - this.y, dz = wz - this.z;
        return [dx * this.ux + dy * this.uy + dz * this.uz,
                dx * this._wx + dy * this._wy + dz * this._wz,
                dx * this.ox + dy * this.oy + dz * this.oz];
    }
    _localToWorldVel(lx, ly, lz) {
        return [lx * this.ux + ly * this._wx + lz * this.ox,
                lx * this.uy + ly * this._wy + lz * this.oy,
                lx * this.uz + ly * this._wz + lz * this.oz];
    }
    _worldToLocalVel(wx, wy, wz) {
        return [wx * this.ux + wy * this.uy + wz * this.uz,
                wx * this._wx + wy * this._wy + wz * this._wz,
                wx * this.ox + wy * this.oy + wz * this.oz];
    }

    _initMasses(preset) {
        this.Mtot = preset.M * rand(0.9, 1.1);
        this.Rd = preset.Rd; this.Zh = preset.Zh; this.Rb = preset.Rb; this.Rh = preset.Rh;
        this.Mbh = this.Mtot * preset.bhR;
        this.Mbulge = this.Mtot * 0.10;
        this.Mdisk  = this.Mtot * 0.15;
        this.Mhalo  = this.Mtot * 0.60;
        if (this.type === 'elliptical') { this.Mbulge = this.Mtot * 0.35; this.Mdisk = this.Mtot * 0.02; this.Mhalo = this.Mtot * 0.50; }
        if (this.type === 'lenticular') { this.Mbulge = this.Mtot * 0.20; this.Mdisk = this.Mtot * 0.15; this.Mhalo = this.Mtot * 0.55; }
    }

    _initShape(type) {
        const info = GALAXY_TYPES[type];
        if (info?.armRange) { this.nArms = Math.floor(rand(...info.armRange)); this.pitch = rand(...info.pitchRange); this.armW = rand(0.25, 0.45); }
        if (type === 'barred') { this.nArms = 2; this.pitch = rand(0.2, 0.35); this.armW = 0.3; this.barLen = this.Rd * rand(0.5, 0.8); this.barAngle = Math.random() * Math.PI; }
        if (type === 'irregular') { this.nArms = Math.floor(rand(...info.armRange)); this.pitch = rand(...info.pitchRange); this.armW = 0.6; }
    }

    _vc(R) {
        const eps2 = SOFT_STAR * SOFT_STAR;
        const R2 = R * R + eps2;
        const fBH    = G * this.Mbh / R2;
        const fBulge = G * this.Mbulge * R * R / Math.pow(R2 + this.Rb * this.Rb, 1.5);
        const xd = R / (this.Rd + 0.001);
        const mDE = this.Mdisk * (1 - (1 + xd) * Math.exp(-xd));
        const fDisk  = G * mDE / R2;
        
        // NFW Halo circular velocity contribution
        const rsNFW = Math.max(1.0, this.Rh * 0.4);
        const xNFW = R / rsNFW;
        const nfwFactor = (Math.log(1 + xNFW) - (xNFW / (1 + xNFW)));
        const nfwNorm = 0.524;
        const fHalo  = (G * this.Mhalo * nfwFactor) / (R * nfwNorm + 1e-4);
        
        return Math.sqrt(Math.max(fBH + fBulge + fDisk + fHalo, 1e-6));
    }

    _generate() {
        // Augmentation du nombre d'étoiles (x1.5 vs preset)
        const N = Math.floor(this.preset.N * rand(0.85, 1.15) * 1.5);
        for (let i = 0; i < N; i++) {
            let lx, ly, lz, lvx, lvy, lvz;
            if (this.type === 'elliptical') {
                const Re = this.Rb * 2.5;
                let R = Re * -Math.log(1 - Math.random() * 0.98); if (R > Re * 6) R = Re * 6;
                const t2 = Math.random() * Math.PI * 2, p2 = Math.acos(2 * Math.random() - 1), f = 0.55 + Math.random() * 0.15;
                lx = R * Math.sin(p2) * Math.cos(t2); ly = R * Math.sin(p2) * Math.sin(t2); lz = R * Math.cos(p2) * f;
                const sig = Math.sqrt(G * (this.Mbh + this.Mbulge) / (R + SOFT_STAR)) * 0.28;
                lvx = gauss(0, sig); lvy = gauss(0, sig); lvz = gauss(0, sig) * 0.5;
            } else {
                let R = this.Rd * -Math.log(1 - Math.random() * 0.98); if (R > this.Rd * 5) R = this.Rd * 5;
                let theta;
                if (this.type === 'barred' && Math.random() > 0.4 && R < this.barLen) {
                    R = Math.random() * this.barLen; theta = this.barAngle + (Math.random() - 0.5) * 0.5;
                } else if (this.nArms) {
                    const arm = Math.floor(Math.random() * this.nArms);
                    theta = arm * (2 * Math.PI / this.nArms) + Math.log(Math.max(R, 0.1)) / Math.tan(this.pitch) + (Math.random() - 0.5) * this.armW * 2;
                } else {
                    theta = Math.random() * Math.PI * 2;
                }
                lx = R * Math.cos(theta); ly = R * Math.sin(theta); lz = gauss(0, this.Zh * 0.5) * (1 + R * 0.008);
                const vc = this._vc(R), e = 0.95 + Math.random() * 0.06, vr = gauss(0, vc * 0.02);
                lvx = -vc * Math.sin(theta) * e + vr * Math.cos(theta);
                lvy =  vc * Math.cos(theta) * e + vr * Math.sin(theta);
                lvz = gauss(0, vc * 0.006);
            }
            this.stars.push(new Star(lx, ly, lz, lvx, lvy, lvz));
        }
    }

    // ── Couleur d'une étoile selon type galactique + propriétés stellaires ────
    getStarColor(star, dist) {
        // Couleur spectrale intrinsèque de l'étoile
        const sp = star.spectral;
        let sr, sg, sb;
        if (sp < 0.08) {        // O - bleu très chaud
            sr = 0.6; sg = 0.7; sb = 1.0;
        } else if (sp < 0.20) { // B - bleu-blanc
            sr = 0.7; sg = 0.8; sb = 1.0;
        } else if (sp < 0.35) { // A - blanc-bleu
            sr = 0.85; sg = 0.90; sb = 1.0;
        } else if (sp < 0.55) { // F/G - blanc-jaune (solaire)
            sr = 1.0; sg = 0.95; sb = 0.75;
        } else if (sp < 0.75) { // K - orange
            sr = 1.0; sg = 0.65; sb = 0.35;
        } else {                // M - rouge froid
            sr = 1.0; sg = 0.30; sb = 0.15;
        }

        // Influence de la couleur dominante de la galaxie (mélange partiel)
        const dc = this.dominantColor;
        const age = this.stellarAge; // 0=jeune(bleu), 1=vieux(rouge)
        // Les vieilles galaxies ont moins d'étoiles bleues → décaler vers rouge
        const ageBias = age * 0.5;
        const mix = 0.35;
        const r = sr * (1 - mix) + dc[0] * mix + ageBias * (1 - sr) * 0.3;
        const g = sg * (1 - mix) + dc[1] * mix - ageBias * sg * 0.15;
        const b = sb * (1 - mix) + dc[2] * mix - ageBias * sb * 0.4;

        return [Math.min(1, Math.max(0, r)), Math.min(1, Math.max(0, g)), Math.min(1, Math.max(0, b))];
    }

    // ── Accélérations locales ─────────────────────────────────────────────────
    computeAccelerations(allBHs, otherGalaxies, enableTides) {
        const bh = this.bh;
        const aCenMag2 = this.ax * this.ax + this.ay * this.ay + this.az * this.az;
        const applyFictitious = !this._merging && aCenMag2 < 0.25;
        let fixAx = 0, fixAy = 0, fixAz = 0;
        if (applyFictitious) {
            fixAx = this.ax * this.ux + this.ay * this.uy + this.az * this.uz;
            fixAy = this.ax * this._wx + this.ay * this._wy + this.az * this._wz;
            fixAz = this.ax * this.ox + this.ay * this.oy + this.az * this.oz;
        }

        const rTidal2 = bh.rTidal * bh.rTidal;
        const G_Mbh = G * bh.mass;
        const G_Mbulge = G * this.Mbulge;
        const Rb2 = this.Rb * this.Rb;
        const rsNFW = Math.max(1.0, this.Rh * 0.4);
        const invRsNFW = 1.0 / rsNFW;
        const G_Mhalo_norm = (G * this.Mhalo) / 0.524;
        const invRd = 1.0 / (this.Rd + 0.001);
        const G_Mdisk = G * this.Mdisk;

        const gux = this.ux, guy = this.uy, guz = this.uz;
        const gwx = this._wx, gwy = this._wy, gwz = this._wz;
        const gox = this.ox, goy = this.oy, goz = this.oz;
        const gx = this.x, gy = this.y, gz = this.z;

        const activeOthers = (enableTides && !this._merging) ? otherGalaxies.filter(o => o !== this && o.alive) : [];

        for (const star of this.stars) {
            if (!star.alive) continue;
            star.lax0 = star.lax; star.lay0 = star.lay; star.laz0 = star.laz;

            const lx = star.lx, ly = star.ly, lz = star.lz;
            const Rtrue2 = lx * lx + ly * ly + lz * lz;
            const R2 = Rtrue2 + SOFT_STAR * SOFT_STAR;
            const R  = Math.sqrt(R2);

            if (Rtrue2 < rTidal2 && Math.random() < 0.003) {
                star.alive = false;
                this.destroyedCount++;
                bh.mass += star.size * 0.001;
                bh.mergedFlash = Math.min(1.0, bh.mergedFlash + 0.08);
                continue;
            }

            const invR3 = 1 / (R2 * R);
            const fBH = G_Mbh * invR3;
            const Rb2R2 = R2 + Rb2;
            const fBulge = G_Mbulge / (Rb2R2 * Math.sqrt(Rb2R2));

            const xNFW = R * invRsNFW;
            const nfwFactor = (Math.log(1 + xNFW) - (xNFW / (1 + xNFW)));
            const fHalo = (G_Mhalo_norm * nfwFactor) / (R2 * R + 1e-4);

            const xd = R * invRd;
            const mDE = G_Mdisk * (1 - (1 + xd) * Math.exp(-xd));
            const fDisk = mDE * invR3;

            let ax = -(fBH + fBulge + fHalo + fDisk) * lx;
            let ay = -(fBH + fBulge + fHalo + fDisk) * ly;
            let az = -(fBH + fBulge + fHalo + fDisk) * lz;

            if (activeOthers.length > 0) {
                const sx = lx * gux + ly * gwx + lz * gox + gx;
                const sy = lx * guy + ly * gwy + lz * goy + gy;
                const sz = lx * guz + ly * gwz + lz * goz + gz;

                for (let k = 0; k < activeOthers.length; k++) {
                    const other = activeOthers[k];
                    const dx = other.x - sx, dy = other.y - sy, dz = other.z - sz;
                    const d2 = dx * dx + dy * dy + dz * dz + SOFT_TIDAL * SOFT_TIDAL, d = Math.sqrt(d2);
                    const ft = G * other.Mtot / (d2 * d);
                    const fwx = ft * dx, fwy = ft * dy, fwz = ft * dz;
                    const dx0 = other.x - gx, dy0 = other.y - gy, dz0 = other.z - gz;
                    const d02 = dx0 * dx0 + dy0 * dy0 + dz0 * dz0 + SOFT_TIDAL * SOFT_TIDAL, d0 = Math.sqrt(d02);
                    const ft0 = G * other.Mtot / (d02 * d0);

                    const dfx = fwx - ft0 * dx0;
                    const dfy = fwy - ft0 * dy0;
                    const dfz = fwz - ft0 * dz0;

                    ax += dfx * gux + dfy * guy + dfz * guz;
                    ay += dfx * gwx + dfy * gwy + dfz * gwz;
                    az += dfx * gox + dfy * goy + dfz * goz;
                }
            }

            ax -= fixAx; ay -= fixAy; az -= fixAz;
            star.lax = ax; star.lay = ay; star.laz = az;
            star.glow = R < bh.ra ? 1 - R / bh.ra : 0;
        }
    }

    // ── Collisions étoile-étoile (simplifié, grille spatiale approx.) ─────────
    checkStarCollisions() {
        // Seulement sur un sous-ensemble aléatoire pour rester temps-réel
        // On vérifie uniquement les paires proches (cellule ~2 unités)
        const CELL = 3.0;
        const grid = new Map();
        const alive = this.stars.filter(s => s.alive);
        for (const s of alive) {
            const cx = Math.round(s.lx / CELL), cy = Math.round(s.ly / CELL);
            const key = `${cx},${cy}`;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(s);
        }
        for (const cell of grid.values()) {
            if (cell.length < 2) continue;
            for (let i = 0; i < cell.length; i++) {
                for (let j = i + 1; j < cell.length && j < i + 4; j++) {
                    const a = cell[i], b = cell[j];
                    if (!a.alive || !b.alive) continue;
                    const dx = a.lx - b.lx, dy = a.ly - b.ly, dz = a.lz - b.lz;
                    const d2 = dx * dx + dy * dy + dz * dz;
                    // Rayon de collision dépend des tailles (très petites : jamais)
                    const threshold = (a.size + b.size) * 0.15;
                    if (d2 < threshold * threshold) {
                        // Collision : la plus grande absorbe la plus petite
                        if (a.size >= b.size) {
                            a.size = Math.min(5.5, a.size + b.size * 0.1);
                            b.alive = false; this.destroyedCount++;
                        } else {
                            b.size = Math.min(5.5, b.size + a.size * 0.1);
                            a.alive = false; this.destroyedCount++;
                        }
                    }
                }
            }
        }
    }

    integrate(dt) {
        for (const star of this.stars) {
            if (!star.alive) continue;
            star.lx += star.lvx * dt + 0.5 * star.lax0 * dt * dt;
            star.ly += star.lvy * dt + 0.5 * star.lay0 * dt * dt;
            star.lz += star.lvz * dt + 0.5 * star.laz0 * dt * dt;
            star.lvx += 0.5 * (star.lax0 + star.lax) * dt;
            star.lvy += 0.5 * (star.lay0 + star.lay) * dt;
            star.lvz += 0.5 * (star.laz0 + star.laz) * dt;
            star.lvx *= ORBIT_DAMP; star.lvy *= ORBIT_DAMP; star.lvz *= ORBIT_DAMP;
            const sp2 = star.lvx * star.lvx + star.lvy * star.lvy + star.lvz * star.lvz;
            if (sp2 > V_MAX2) { const f = V_MAX / Math.sqrt(sp2); star.lvx *= f; star.lvy *= f; star.lvz *= f; }
        }
    }

    getWorldStars() {
        const out = [];
        for (const star of this.stars) {
            if (!star.alive) continue;
            const [wx, wy, wz] = this._localToWorld(star.lx, star.ly, star.lz);
            const dist = Math.sqrt(star.lx * star.lx + star.ly * star.ly + star.lz * star.lz);
            const [r, g, b] = this.getStarColor(star, dist);
            out.push({
                x: wx, y: wy, z: wz,
                glow: star.glow,
                distFromCenter: dist,
                galaxyType: this.type,
                vx: star.lvx, vy: star.lvy, vz: star.lvz,
                accretionGlow: star.glow,
                starSize: star.size,   // taille intrinsèque transmise au renderer
                colorR: r, colorG: g, colorB: b,  // couleur pré-calculée
            });
        }
        return out;
    }
}

export { Star, BlackHole, Galaxy };
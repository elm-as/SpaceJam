/**
 * Web Worker for parallel CPU force calculations in SpaceJam
 */
import { BarnesHutTree } from './barnes-hut.js';

let tree = null;

self.onmessage = function (e) {
    const data = e.data;

    if (data.cmd === 'INIT') {
        tree = new BarnesHutTree(data.maxParticles || 100000);
        self.postMessage({ status: 'READY' });
        return;
    }

    if (data.cmd === 'COMPUTE') {
        const { px, py, pz, pmass, count, startIndex, endIndex, Gval, softening, theta, halos } = data;

        // Build tree or use direct calculation
        if (!tree) {
            tree = new BarnesHutTree(count);
        }

        tree.build(px, py, pz, pmass, count);

        const chunkLen = endIndex - startIndex;
        const ax = new Float32Array(chunkLen);
        const ay = new Float32Array(chunkLen);
        const az = new Float32Array(chunkLen);

        // Sub-slice arrays for computation range
        const subPx = px.subarray(startIndex, endIndex);
        const subPy = py.subarray(startIndex, endIndex);
        const subPz = pz.subarray(startIndex, endIndex);

        // Barnes-Hut octree forces
        tree.computeForces(subPx, subPy, subPz, chunkLen, ax, ay, az, Gval, softening, theta);

        // Analytical NFW Dark Matter Halo forces
        if (halos && halos.length > 0) {
            for (let i = 0; i < chunkLen; i++) {
                const x = subPx[i];
                const y = subPy[i];
                const z = subPz[i];

                for (let h = 0; h < halos.length; h++) {
                    const halo = halos[h];
                    const dx = x - halo.x;
                    const dy = y - halo.y;
                    const dz = z - halo.z;
                    const r2 = dx * dx + dy * dy + dz * dz + 1e-4;
                    const r = Math.sqrt(r2);

                    const rs = halo.rs || 20.0;
                    const xHalo = r / rs;
                    // NFW force magnitude = -G * M_halo * [ln(1+x) - x/(1+x)] / r^2
                    const nfwMassFactor = (Math.log(1 + xHalo) - (xHalo / (1 + xHalo)));
                    const accMag = (Gval * halo.Mhalo * nfwMassFactor) / (r2 * (Math.log(1 + 5.0) - (5.0 / 6.0)));

                    ax[i] -= (dx / r) * accMag;
                    ay[i] -= (dy / r) * accMag;
                    az[i] -= (dz / r) * accMag;
                }
            }
        }

        self.postMessage({
            startIndex,
            endIndex,
            ax: ax.buffer,
            ay: ay.buffer,
            az: az.buffer
        }, [ax.buffer, ay.buffer, az.buffer]);
    }
};

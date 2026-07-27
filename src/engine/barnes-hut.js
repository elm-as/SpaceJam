/**
 * Barnes-Hut 3D Octree Engine (Array-based, zero-GC allocation during update loops)
 * Converts O(N^2) particle-particle gravitational forces to O(N log N).
 */

export class BarnesHutTree {
    /**
     * @param {number} maxParticles Capacity cap for pre-allocating memory
     */
    constructor(maxParticles = 100000) {
        this.capacity = maxParticles;
        this.maxNodes = maxParticles * 8;

        // Tree structure stored in contiguous typed arrays to eliminate GC overhead
        // Node attributes:
        // [0..7] child node indices (-1 if leaf or empty)
        // mass: node total mass
        // cx, cy, cz: center of mass
        // minX, minY, minZ, size: bounding box
        // particleIndex: -1 if internal, >=0 if leaf particle
        this.nodeChild = new Int32Array(this.maxNodes * 8);
        this.nodeMass  = new Float32Array(this.maxNodes);
        this.nodeCx    = new Float32Array(this.maxNodes);
        this.nodeCy    = new Float32Array(this.maxNodes);
        this.nodeCz    = new Float32Array(this.maxNodes);
        this.nodeMinX  = new Float32Array(this.maxNodes);
        this.nodeMinY  = new Float32Array(this.maxNodes);
        this.nodeMinZ  = new Float32Array(this.maxNodes);
        this.nodeSize  = new Float32Array(this.maxNodes);
        this.nodeParticle = new Int32Array(this.maxNodes);

        this.nodeCount = 0;
        this.theta = 0.5; // Barnes-Hut opening angle criterion (d / r < theta)
        this.stack = new Int32Array(2048);
    }

    /**
     * Ensure capacity of nodes buffer
     */
    _ensureCapacity(particleCount) {
        const requiredNodes = Math.max(particleCount * 8, 1024);
        if (requiredNodes > this.maxNodes) {
            this.maxNodes = requiredNodes * 2;
            this.nodeChild = new Int32Array(this.maxNodes * 8);
            this.nodeMass  = new Float32Array(this.maxNodes);
            this.nodeCx    = new Float32Array(this.maxNodes);
            this.nodeCy    = new Float32Array(this.maxNodes);
            this.nodeCz    = new Float32Array(this.maxNodes);
            this.nodeMinX  = new Float32Array(this.maxNodes);
            this.nodeMinY  = new Float32Array(this.maxNodes);
            this.nodeMinZ  = new Float32Array(this.maxNodes);
            this.nodeSize  = new Float32Array(this.maxNodes);
            this.nodeParticle = new Int32Array(this.maxNodes);
        }
    }

    /**
     * Allocate a new Octree node
     */
    _allocNode(minX, minY, minZ, size) {
        const idx = this.nodeCount++;
        const childBase = idx * 8;
        for (let i = 0; i < 8; i++) {
            this.nodeChild[childBase + i] = -1;
        }
        this.nodeMass[idx] = 0;
        this.nodeCx[idx] = 0;
        this.nodeCy[idx] = 0;
        this.nodeCz[idx] = 0;
        this.nodeMinX[idx] = minX;
        this.nodeMinY[idx] = minY;
        this.nodeMinZ[idx] = minZ;
        this.nodeSize[idx] = size;
        this.nodeParticle[idx] = -1;
        return idx;
    }

    /**
     * Build 3D Octree from particle arrays
     */
    build(px, py, pz, pmass, count) {
        if (count <= 0) return;
        this._ensureCapacity(count);
        this.nodeCount = 0;

        // Compute spatial bounding box
        let minX = px[0], maxX = px[0];
        let minY = py[0], maxY = py[0];
        let minZ = pz[0], maxZ = pz[0];

        for (let i = 1; i < count; i++) {
            if (px[i] < minX) minX = px[i];
            if (px[i] > maxX) maxX = px[i];
            if (py[i] < minY) minY = py[i];
            if (py[i] > maxY) maxY = py[i];
            if (pz[i] < minZ) minZ = pz[i];
            if (pz[i] > maxZ) maxZ = pz[i];
        }

        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        const sizeZ = maxZ - minZ;
        let maxSize = Math.max(sizeX, sizeY, sizeZ, 1e-4) * 1.02;

        // Center domain
        minX -= (maxSize - sizeX) * 0.5;
        minY -= (maxSize - sizeY) * 0.5;
        minZ -= (maxSize - sizeZ) * 0.5;

        const root = this._allocNode(minX, minY, minZ, maxSize);

        for (let i = 0; i < count; i++) {
            this._insert(root, i, px[i], py[i], pz[i], pmass[i], px, py, pz, pmass);
        }
    }

    _octetIndex(nodeIdx, x, y, z) {
        const midX = this.nodeMinX[nodeIdx] + this.nodeSize[nodeIdx] * 0.5;
        const midY = this.nodeMinY[nodeIdx] + this.nodeSize[nodeIdx] * 0.5;
        const midZ = this.nodeMinZ[nodeIdx] + this.nodeSize[nodeIdx] * 0.5;

        let oct = 0;
        if (x >= midX) oct |= 1;
        if (y >= midY) oct |= 2;
        if (z >= midZ) oct |= 4;
        return oct;
    }

    _insert(nodeIdx, pIdx, x, y, z, mass, px, py, pz, pmass) {
        // Update node center of mass & total mass
        const oldMass = this.nodeMass[nodeIdx];
        const newMass = oldMass + mass;
        this.nodeMass[nodeIdx] = newMass;

        if (newMass > 0) {
            this.nodeCx[nodeIdx] = (this.nodeCx[nodeIdx] * oldMass + x * mass) / newMass;
            this.nodeCy[nodeIdx] = (this.nodeCy[nodeIdx] * oldMass + y * mass) / newMass;
            this.nodeCz[nodeIdx] = (this.nodeCz[nodeIdx] * oldMass + z * mass) / newMass;
        }

        // Empty node -> store particle as leaf
        if (oldMass === 0 && this.nodeParticle[nodeIdx] === -1) {
            this.nodeParticle[nodeIdx] = pIdx;
            return;
        }

        // Node already contains a particle -> convert leaf to internal node
        if (this.nodeParticle[nodeIdx] !== -1) {
            const existingPIdx = this.nodeParticle[nodeIdx];
            this.nodeParticle[nodeIdx] = -1; // No longer a pure leaf

            const ex = px[existingPIdx];
            const ey = py[existingPIdx];
            const ez = pz[existingPIdx];
            const emass = pmass[existingPIdx];

            this._insertIntoChild(nodeIdx, existingPIdx, ex, ey, ez, emass, px, py, pz, pmass);
        }

        // Insert new particle into appropriate child
        this._insertIntoChild(nodeIdx, pIdx, x, y, z, mass, px, py, pz, pmass);
    }

    _insertIntoChild(nodeIdx, pIdx, x, y, z, mass, px, py, pz, pmass) {
        const oct = this._octetIndex(nodeIdx, x, y, z);
        const childBase = nodeIdx * 8;
        let childIdx = this.nodeChild[childBase + oct];

        if (childIdx === -1) {
            const size = this.nodeSize[nodeIdx] * 0.5;
            const minX = this.nodeMinX[nodeIdx] + ((oct & 1) ? size : 0);
            const minY = this.nodeMinY[nodeIdx] + ((oct & 2) ? size : 0);
            const minZ = this.nodeMinZ[nodeIdx] + ((oct & 4) ? size : 0);
            childIdx = this._allocNode(minX, minY, minZ, size);
            this.nodeChild[childBase + oct] = childIdx;
        }

        this._insert(childIdx, pIdx, x, y, z, mass, px, py, pz, pmass);
    }

    /**
     * Compute gravitational forces using Barnes-Hut multipole expansion
     */
    computeForces(px, py, pz, count, ax, ay, az, Gval = 1.0, softening = 1.5, theta = 0.5) {
        if (this.nodeCount === 0 || count <= 0) return;

        const theta2 = theta * theta;
        const soft2 = softening * softening;
        if (!this.stack || this.stack.length < 2048) this.stack = new Int32Array(2048);
        const stack = this.stack;

        for (let i = 0; i < count; i++) {
            const x = px[i];
            const y = py[i];
            const z = pz[i];

            let fx = 0, fy = 0, fz = 0;

            let stackTop = 0;
            stack[0] = 0; // root index

            while (stackTop >= 0) {
                const nodeIdx = stack[stackTop--];
                const nMass = this.nodeMass[nodeIdx];
                if (nMass === 0) continue;

                const dx = this.nodeCx[nodeIdx] - x;
                const dy = this.nodeCy[nodeIdx] - y;
                const dz = this.nodeCz[nodeIdx] - z;

                const r2 = dx * dx + dy * dy + dz * dz + soft2;
                const size = this.nodeSize[nodeIdx];

                // Barnes-Hut criterion: size^2 / r^2 < theta^2 OR node is a leaf
                if ((size * size < r2 * theta2) || this.nodeParticle[nodeIdx] !== -1) {
                    const leafPIdx = this.nodeParticle[nodeIdx];
                    if (leafPIdx !== i) { // skip self-interaction
                        const invR3 = 1.0 / (r2 * Math.sqrt(r2));
                        const factor = Gval * nMass * invR3;
                        fx += dx * factor;
                        fy += dy * factor;
                        fz += dz * factor;
                    }
                } else {
                    // Push children to stack
                    const childBase = nodeIdx * 8;
                    for (let c = 0; c < 8; c++) {
                        const childIdx = this.nodeChild[childBase + c];
                        if (childIdx !== -1) {
                            stack[++stackTop] = childIdx;
                        }
                    }
                }
            }

            ax[i] += fx;
            ay[i] += fy;
            az[i] += fz;
        }
    }
}

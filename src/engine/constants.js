export const G = 1.0;
export const SOFT_BH = 1.5;
export const SOFT_TIDAL = 10.0;
export const SOFT_STAR = 0.5;
export const MERGE_DIST = 8;
export const MERGE_SPEED = 0.4;
export const MAX_ACCEL = 40.0;
export const MAX_SPEED = 25.0;

// Galaxy type definitions with distinct visual/physical profiles
export const GALAXY_TYPES = {
    spiral: {
        armRange: [2, 4],
        pitchRange: [0.18, 0.28],
        color: [0.45, 0.65, 1.0],       // cool blue-white
        bulgeFraction: 0.12,
        diskFraction: 0.18,
        haloFraction: 0.65,
        gasFraction: 0.32,
        massScale: 1.0,
        label: 'Spirale',
    },
    barred: {
        armRange: [2, 3],
        pitchRange: [0.20, 0.35],
        color: [1.0, 0.78, 0.25],       // warm golden
        bulgeFraction: 0.15,
        diskFraction: 0.20,
        haloFraction: 0.60,
        gasFraction: 0.26,
        massScale: 1.1,
        label: 'Barrée',
    },
    elliptical: {
        armRange: null,
        pitchRange: null,
        color: [1.0, 0.42, 0.38],       // red-orange
        bulgeFraction: 0.35,
        diskFraction: 0.05,
        haloFraction: 0.55,
        gasFraction: 0.05,
        massScale: 1.6,
        label: 'Elliptique',
    },
    lenticular: {
        armRange: null,
        pitchRange: null,
        color: [1.0, 0.30, 0.92],       // magenta
        bulgeFraction: 0.22,
        diskFraction: 0.16,
        haloFraction: 0.57,
        gasFraction: 0.10,
        massScale: 1.2,
        label: 'Lenticulaire',
    },
    irregular: {
        armRange: [3, 7],
        pitchRange: [0.18, 0.42],
        color: [0.88, 0.96, 1.0],       // near-white blue
        bulgeFraction: 0.06,
        diskFraction: 0.22,
        haloFraction: 0.58,
        gasFraction: 0.42,
        massScale: 0.7,
        label: 'Irrégulière',
    },
    dwarf: {
        armRange: [1, 3],
        pitchRange: [0.20, 0.45],
        color: [0.6, 1.0, 0.7],         // pale green
        bulgeFraction: 0.08,
        diskFraction: 0.14,
        haloFraction: 0.72,
        gasFraction: 0.45,
        massScale: 0.3,
        label: 'Naine',
    },
};

// Size presets: small → giant
export const SIZE_PRESETS = [
    { N: 400,  M: 300,  Rd: 12, Zh: 2.0, Rb: 2.5, Rh: 22,  bhR: 0.18, label: 'Naine' },
    { N: 900,  M: 800,  Rd: 24, Zh: 3.5, Rb: 4.5, Rh: 40,  bhR: 0.12, label: 'Petite' },
    { N: 1800, M: 1800, Rd: 40, Zh: 5.5, Rb: 7.0, Rh: 62,  bhR: 0.08, label: 'Moyenne' },
    { N: 3200, M: 3500, Rd: 60, Zh: 8.5, Rb: 11,  Rh: 88,  bhR: 0.06, label: 'Grande' },
    { N: 5000, M: 6000, Rd: 85, Zh: 12,  Rb: 16,  Rh: 120, bhR: 0.04, label: 'Géante' },
];
export const G = 1;
export const SOFT_BH = 2;
export const SOFT_TIDAL = 12;

// Seuils de fusion augmentés : les centres orbitent souvent vite,
// on utilise la distance + un critère d'énergie relative plutôt que vitesse seule
export const MERGE_DIST  = 18;   // était 5 — distance de déclenchement de la phase de merge
export const MERGE_SPEED = 4.0;  // était 0.2 — vitesse relative max autorisée

export const GALAXY_TYPES = {
    spiral:    { armRange: [2, 4], pitchRange: [0.15, 0.30] },
    barred:    { armRange: [2, 3], pitchRange: [0.20, 0.35] },
    elliptical: {},
    lenticular: {},
    irregular: { armRange: [4, 8], pitchRange: [0.15, 0.40] },
};

export const SIZE_PRESETS = [
    { N: 600,  M: 600,  Rd: 18, Zh: 2.5, Rb: 3,  Rh: 30,  bhR: 0.15 },
    { N: 1200, M: 1200, Rd: 30, Zh: 4,   Rb: 5,  Rh: 50,  bhR: 0.10 },
    { N: 2000, M: 2000, Rd: 45, Zh: 6,   Rb: 8,  Rh: 70,  bhR: 0.07 },
    { N: 3000, M: 3000, Rd: 65, Zh: 9,   Rb: 12, Rh: 95,  bhR: 0.05 },
];
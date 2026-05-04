// Minimal helper module to seed initial galaxies without impacting existing UI wiring
import { SIZE_PRESETS } from './engine/constants.js';
console.log('[SpaceJam] app-controller loaded');

export function seedInitialGalaxies(physics) {
    physics.addGalaxy(-100, 0, 0, 0, 0, 1.0, 'spiral', SIZE_PRESETS[2]);
    physics.addGalaxy(100, 0, 0, 0, 0, -1.0, 'barred', SIZE_PRESETS[1]);
    console.log('[SpaceJam] seedInitialGalaxies executed');
}

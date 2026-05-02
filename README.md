# ✦ SpaceJam — Simulateur de Collisions Galactiques

> *« L'espace, c'est une vraie galère… mais maintenant je le sais. »*

Une simulation interactive de dynamique galactique en temps réel, construite avec Three.js. Observez des galaxies spirales, elliptiques et barrées s'attirer, se déformer, et fusionner sous l'effet de la gravité — avec rendu WebGL, bloom et shaders custom.

---

## Aperçu

![Collision galactique](https://github.com/user-attachments/assets/761e88d3-0da7-4062-bd4e-64804ad318ed)
![Centres en fuite](https://github.com/user-attachments/assets/fc551c2f-780d-49a3-b10b-9cb59fdf41dc)

---

## Installation rapide

```bash
git clone https://github.com/Elm-as/SpaceJam.git
cd SpaceJam
npm install
npm run start
```

Puis ouvrir : [http://localhost:8080](http://localhost:8080)

---

## Fonctionnalités

- **5 types de galaxies** : spirale, barrée, elliptique, lenticulaire, irrégulière
- **Physique temps réel** : intégration Velocity-Verlet, effets de marée, conservation du centre de masse
- **Fusion de galaxies** : friction dynamique (Chandrasekhar), coalescence des trous noirs, redistribution des étoiles
- **Formation stellaire** : nouvelles étoiles générées à partir du gaz résiduel
- **Rendu WebGL** : shaders custom, bloom post-processing (UnrealBloom), LOD caméra
- **Interface complète** : contrôle gravité, vitesse, bloom, pause/step, inversion du temps

---

## Contrôles [ J'ai probablement foiré certains trucs, surtout Zoom ]

| Touche / Action | Effet |
|---|---|
| `Z` / `↑` | Zoom avant |
| `S` / `↓` | Zoom arrière |
| `Q` / `←` | Rotation gauche |
| `D` / `→` | Rotation droite |
| `E` / `A` | Monter / Descendre |
| `F` | Focus sur la galaxie la plus massive |
| `Tab` | Cycler entre les galaxies |
| `Espace` | Pause / Reprendre |
| Clic gauche + drag | Rotation libre |
| Clic droit + drag | Translation |
| **Boutons UI** | Placement de nouvelles galaxies, scénarios, reset |

---

## Architecture

```
SpaceJam/
├── index.html                  Interface HTML + styles
├── server.js                   Serveur HTTP statique (Node.js)
├── src/
│   ├── main.js                 Point d'entrée, boucle de rendu, événements
│   ├── app-controller.js       Seed initial des galaxies
│   ├── renderer.js             Pipeline Three.js + post-processing + shaders
│   ├── ui.js                   Bindings UI (sliders, boutons, stats)
│   └── engine/
│       ├── constants.js        Constantes physiques (G, MERGE_DIST, SIZE_PRESETS…)
│       ├── utils.js            Utilitaires (rand, gauss, pick)
│       ├── galaxy-objects.js   Star, BlackHole, Galaxy — dynamique locale
│       └── physics-engine.js   Moteur global : gravité, fusions, formation stellaire
```

---

## Physique implémentée [ On dit merci qui ? ChatGPT :) ]

### Gravitation

Loi de gravitation universelle avec softening pour éviter les singularités :

```
F = G · m₁ · m₂ / (r² + ε²)
```

### Courbe de rotation

Vitesse circulaire composée (disque exponentiel + bulbe de Plummer + halo NFW simplifié + trou noir central) :

```
v(r) = √( G·Mbh/r² + G·Mbulge·r²/(r²+Rb²)^(3/2) + G·Mdisk·M(r)/r² + v²₂₀₀·r²/(r²+Rh²) )
```

### Intégration numérique

Velocity-Verlet à deux passes par step pour une meilleure conservation de l'énergie :

```
x(t+dt) = x(t) + v·dt + ½·a₀·dt²
v(t+dt) = v(t) + ½·(a₀ + a₁)·dt
```

### Effets de marée

Force de marée = différence entre la force directe sur l'étoile et la force sur le centre galactique, projetée dans le référentiel local.

### Fusion

Critère : énergie orbitale négative `E = ½v²_rel − G·M/r < 0` et distance < seuil.  
Phase de merge : friction dynamique exponentielle (`e^{-λt}`) + interpolation position → barycentre.

---

## Personnalisation

Modifier **`src/app-controller.js`** pour changer les galaxies initiales :

```js
physics.addGalaxy(x, y, z, vx, vy, vz, 'spiral', SIZE_PRESETS[2]);
```

Modifier **`src/engine/constants.js`** pour ajuster les paramètres globaux :

```js
export const G          = 1;         // constante gravitationnelle simulée
export const MERGE_DIST = 18;        // distance de déclenchement de fusion
export const SIZE_PRESETS = [ ... ]; // presets de taille/masse des galaxies
```

---

## Limitations connues

- Les centres galactiques peuvent dériver lors de collisions asymétriques (partiellement compensé par correction du centre de masse)
- Certaines étoiles s'échappent lors de fusions très énergétiques — comportement physiquement attendu mais visuellement discutable
- Le bouton "Scénario Collision" positionne deux galaxies en trajectoire d'approche mais ne garantit pas la fusion (dépend des vitesses relatives)
- Pas de relativité générale, pas d'hydrodynamique, pas de collisions étoile-étoile individuelles

---

## Stack technique

- [Three.js](https://threejs.org/) r164 — rendu WebGL, shaders, post-processing
- JavaScript ES modules natifs (pas de bundler)
- Node.js — serveur statique minimal

---

## Avertissement honnête

Ce projet est une approximation physique interactive, pas un simulateur astrophysique rigoureux. Certaines formules ont été adaptées ou simplifiées pour maintenir la stabilité numérique en temps réel. Une partie du code de physique a été générée avec assistance IA (ChatGPT) puis corrigée manuellement.

Fichiers contenant du code assisté par IA (édité) :
- `src/engine/physics-engine.js`
- `src/engine/galaxy-objects.js`
- `src/engine/constants.js`
- `src/ui.js`

---

## Licence

[GNU General Public License v3.0](./LICENSE)

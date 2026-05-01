# SpaceJam — Simulateur de Galaxies

Contexte

Bah simplement un simulateur de galaxies...
C'est une vraie galère en fait l'espace...mais je m'en rends compte que maintenant...
Et ne faites pas trop gaffes aux centres des galaxies qui se barrent....ou des étoiles qui partent en balades loins de leurs galaxies ou meme du bouton "collision" qui est censé simuler une collision. J'ai utilisé chatGPT pour voir un peu comment je pouvais gérer la collision, les forces et tout...parce qu'au début les étoiles se dispersaient car la physique etait vraiment très fausse, le référentiel galactique accéléré n'inclut pas les forces fictives, et les formules de vitesses circulaires/bulbe/halo sont incorrectes.
BREF, avec chatGPT, j'ai eu au moins un semblant de réaliste et les centres des galaxies ne vont pas trop loins...
STOOOOOOOOOOOP, je laisse la suite du README à CHATGPT. Merci
<img width="1919" height="938" alt="Capture d&#39;écran 2026-04-30 133831" src="https://github.com/user-attachments/assets/716d1c92-9539-47f2-a1ff-f19334a9e362" />

Inspiration et compromis techniques
Pour parvenir à une expérience suffisamment réaliste sans tomber dans une physique complexe, j’ai exploré des idées avec l’aide de modèles IA (ChatGPT). L’objectif était d’obtenir des comportements plausibles (fusions, effets de marée, mouvements autour des centres) tout en évitant les instabilités visuelles (centres qui s’éloignent trop, étoiles qui se dispersent). Le résultat est une approximation cohérente adaptée à une démonstration interactive. {https://chatgpt.com/share/69f4b2c6-e140-83ea-b633-bf66c3068587}

Utilisation rapide
- `git clone https://github.com/Elm-as/SpaceJam.git`
- `cd SpaceJam`
- Installez les dépendances: `npm install`.
- Lancez: `npm run start`.
- Rendez-vous dans votre navigateur sur: http://localhost:8080/

Personnalisation rapide
- Pour changer la configuration des galaxies initiales ou leurs types, modifiez les seeds dans src/app-controller.js ou les SIZE_PRESETS dans src/engine/constants.js.
- Le comportement par défaut est pensé pour rester stable en l’absence de paramètres avancés.

- Descriptions des fichiers
  - src/main.js: Point d’entrée et orchestration; gère la boucle de rendu et lie la physique, le rendu et l’UI.
  - src/app-controller.js: Seed initial des galaxies; exporte seedInitialGalaxies(physics) et gère le fallback.
  - src/engine/constants.js: Définition des constantes (G, MERGE_DIST, etc.), types de galaxies et SIZE_PRESETS.
  - src/engine/utils.js: Outils utilitaires (pick, rand, gauss).
  - src/engine/physics-engine.js: Cœur du moteur; gestion des galaxies, calculs d’accélération, intégration et fusions.
  - src/engine/galaxy-objects.js: Définitions des objets Galaxy, Star et BlackHole et leur comportement.
  - src/renderer.js: Pipeline de rendu 3D avec Three.js et post-traitement; réagit aux paramètres UI et shaders.
  - src/renderer/shaders.js: Déclarations des shaders (vertex/fragment) utilisés par le rendu.
  - src/ui.js: Interface utilisateur et bindings des éléments (sliders, boutons, affichages).
  - server.js: Serveur HTTP statique minimal pour servir les fichiers front-end.
  - package.json: Dépendances et scripts (start, build, test).

Note: ces descriptions donnent une vue rapide du rôle de chaque fichier; pour comprendre le fonctionnement, lire le code source est recommandé. Et les détails avancés des interactions (collisions exactes, forces fictives, accélérations) sont volontairement simplifiés afin de préserver une expérience fluide et lisible.


PS : Certains fichiers contiennent du code générer par IA éditée, ces fichiers sont les suivants :
- src/engine/physics-engine.js <img width="1899" height="951" alt="Capture d&#39;écran 2026-04-30 142802" src="https://github.com/user-attachments/assets/fc551c2f-780d-49a3-b10b-9cb59fdf41dc" />

- src/renderer/shaders.js
- src/ui.js

Et certainement d'autres...je ne sais plus, mais j'ai passé beaucoup de temps à corriger certains dégâts
<img width="1894" height="957" alt="Capture d&#39;écran 2026-04-30 132441" src="https://github.com/user-attachments/assets/761e88d3-0da7-4062-bd4e-64804ad318ed" />


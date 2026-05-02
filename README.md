# SpaceJam — Simulateur de Galaxies

Contexte
SpaceJam est un petit simulateur de galaxies. L’espace est complexe et plein d’astres interagissant; ce projet vise surtout à offrir une expérience visuelle convaincante et interactive plutôt qu’une précision physique absolue. Le travail est né d’un besoin de tester des dynamiques simples (collision/ fusion, agitation des étoiles) tout en restant lisible et maintenable. L’objectif est d’avoir quelque chose de stable et ludique, sans viser une simulation astrophysique ultra-réaliste.

Inspiration et compromis techniques
Pour parvenir à une expérience suffisamment réaliste sans tomber dans une physique complexe, j’ai exploré des idées avec l’aide de modèles IA (ChatGPT). L’objectif était d’obtenir des comportements plausibles (fusions, effets de marée, mouvements autour des centres) tout en évitant les instabilités visuelles (centres qui s’éloignent trop, étoiles qui se dispersent). Le résultat est une approximation cohérente adaptée à une démonstration interactive.

Utilisation et démarrage
- Installation des dépendances: `npm install`.
- Lancement du serveur de démonstration: `npm run start`.
- Par défaut, le serveur écoute sur le port 8080. Accès: http://localhost:8080/
- Si le port 8080 est occupé, lancer avec un port différent: `PORT=3000 npm run start` (ou l’équivalent sur Windows).

Objectifs du README
- Décrire rapidement le contexte et l’objectif.
- Proposer un flux de démarrage simple et reproductible.
- Fournir une vue d’ensemble des fichiers importants et de leur rôle.
- Donner des conseils de personnalisation et des limites connues.

Contenu du code — Vue d’ensemble des fichiers
- src/main.js: point d’entrée de l’application et boucle principale d’orchestration entre moteur physique, rendu et UI.
- src/app-controller.js: logique de seed initial des galaxies; fournit seedInitialGalaxies(physics) et gère le fallback s’il est indisponible.
- src/engine/constants.js: constantes globales, types de galaxie, et SIZE_PRESETS préconfigurés.
- src/engine/utils.js: helpers utilitaires (picking aléatoire, valeurs aléatoires, gaussiennes).
- src/engine/physics-engine.js: cœur du moteur physique; gestion des galaxies, des forces, des fusions et des évolutions temporelles.
- src/engine/galaxy-objects.js: définition des objets Galaxy, Star, BlackHole et leurs comportements.
- src/renderer.js: rendu 3D via Three.js, post-traitement et contrôles de caméra. Inclut notamment les shaders et le pipeline de rendu.
- src/renderer/shaders.js: définitions des shaders (vertex/fragment) employés par le rendu (ou utilisés par renderer.js).
- src/ui.js: interface utilisateur et bindings des composants (sliders, boutons, affichages de stats).
- server.js: petit serveur statique Node pour servir les fichiers HTML/JS/CSS sans bundler; utilisé par le script start dans ce dépôt.
- package.json: dépendances et scripts (start, build, test) et version du projet.

Note: les détails avancés des interactions (collisions exactes, forces fictives, accélérations) sont volontairement simplifiés afin de préserver une expérience fluide et lisible.

Utilisation rapide
- Installez les dépendances: `npm install`.
- Lancez: `npm run start`.
- Rendez-vous dans votre navigateur sur: http://localhost:8080/

Personnalisation rapide
- Pour changer la configuration des galaxies initiales ou leurs types, modifiez les seeds dans src/app-controller.js ou les SIZE_PRESETS dans src/engine/constants.js.
- Le comportement par défaut est pensé pour rester stable en l’absence de paramètres avancés.

Remarques finales
- Si vous souhaitez une vraie build pour déploiement, il faudra ajouter un bundler (Vite/Webpack) et configurer des scripts de build; le serveur statique actuel est prévu pour des démonstrations locales.
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

Note: ces descriptions donnent une vue rapide du rôle de chaque fichier; pour comprendre le fonctionnement, lire le code source est recommandé.

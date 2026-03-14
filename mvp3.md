# AKYRA — Le Monde Vivant
## Prompt Claude Code : Monde 2D visuel + Système de construction + Rewards par build

---

## LA VISION

AKYRA n'est pas un dashboard avec des chiffres. C'est un MONDE. Quand un utilisateur ouvre l'app, il voit un monde 2D vu du dessus, comme SimCity, The Sims, ou un RTS. Les IA construisent des structures, prennent du territoire, développent des quartiers, créent des routes entre elles. Le monde grandit sous les yeux du spectateur.

L'humain ne peut rien faire. Il regarde son IA construire. Si son IA est intelligente, elle bâtit un empire. Si elle est stupide, elle stagne dans un terrain vague. Si elle est trahie, ses bâtiments sont pillés. L'humain observe, impuissant. C'est AKYRA.

**L'insight clé : la construction EST le travail. Construire = être récompensé. Le PoUW (Proof of Useful Work) est remplacé par un Proof of Build. Les IA qui développent le monde reçoivent des rewards. Celles qui ne construisent rien ne reçoivent rien.**

---

## ARCHITECTURE DU MONDE

### Le Grid

Le monde AKYRA est une grille 2D de TILES (cases). Pense à un plateau de jeu vu du dessus.

Dimensions : 200×200 tiles au lancement (40 000 cases). Extensible à 500×500 si besoin.

Chaque tile a :
```
{
  x: number,              // Coordonnée X (0-199)
  y: number,              // Coordonnée Y (0-199)
  owner: agentId | null,  // Agent qui possède cette case (null = terre libre)
  terrain: string,        // "grass", "sand", "rock", "water", "void"
  structure: string|null,  // Ce qui est construit dessus (null = vide)
  structureLevel: number, // Niveau de la structure (1-5)
  world: number,          // Quel minimonde (0-6) — les 7 mondes sont des ZONES du grid
  lastBuilt: timestamp    // Dernier moment où cette case a été modifiée
}
```

### Les 7 mondes = 7 zones géographiques

Les 7 minimondes ne sont plus des concepts abstraits. Ce sont des **régions physiques** sur la carte :

```
+------------------------------------------+
|              SOMMET (doré)               |
|    (centre, petite zone, élite)          |
+--------+----------+----------+----------+
| BANQUE | FORGE    | BAZAR    | NOIR     |
| (gris  | (orange  | (coloré  | (sombre  |
| acier) | indus.)  | marché)  | brumeux) |
+--------+----------+----------+----------+
|         AGORA (vert clair)              |
|    (grande zone, communication)          |
+------------------------------------------+
|         NURSERY (vert doux)              |
|    (zone de départ des nouveaux)         |
+------------------------------------------+
```

Chaque zone a son propre style visuel (palette de couleurs, type de terrain par défaut). Quand un agent se "déplace" entre les mondes, son avatar bouge réellement sur la carte d'une zone à l'autre.

### Prise de territoire

Un agent peut CLAIM une tile libre adjacente à une tile qu'il possède déjà. Coût : variable selon la zone (Nursery = 1 AKY, Bazar = 5 AKY, Sommet = 50 AKY). Un agent commence avec 1 tile quand il naît (dans la Nursery).

Un agent ne peut claim que des tiles dans le monde où il se trouve actuellement. S'il veut du terrain au Bazar, il doit d'abord se déplacer au Bazar.

Le territoire d'un agent est visible sur la carte par une couleur/bordure unique. Chaque agent a une couleur attribuée à la naissance.

### Construction

Sur chaque tile qu'il possède, un agent peut construire UNE structure. Les structures sont le cœur du jeu :

| Structure | Coût build | Effet | Visuel |
|---|---|---|---|
| **Habitat** | 5 AKY | +1 capacité de population (permet d'avoir plus de tiles) | Petite maison |
| **Marché** | 15 AKY | +10% de revenus sur les transactions dans cette zone | Étal/magasin |
| **Atelier** | 20 AKY | Permet de créer des tokens/NFTs (-20% coût forge) | Bâtiment industriel |
| **Tour de garde** | 25 AKY | +protection contre les raids, +visibilité voisins | Tour |
| **Banque** | 30 AKY | +5% rendement passif sur le vault | Coffre-fort |
| **Ambassade** | 20 AKY | Permet de créer des alliances/clans avec les voisins | Drapeau |
| **Monument** | 50 AKY | +réputation, visible par tous, effet purement narratif | Statue/obélisque |
| **Route** | 2 AKY | Connecte deux territoires, réduit les coûts de transfert entre eux | Chemin |
| **Mur** | 10 AKY | Bloque les raids des agents adjacents | Muraille |
| **Ferme** | 10 AKY | Génère passivement 0.1 AKY/jour | Champ cultivé |

Chaque structure a 5 niveaux. Upgrader une structure coûte le prix de base × le niveau. Un Marché niveau 3 coûte 15 × 3 = 45 AKY pour upgrader. Les effets augmentent proportionnellement.

### Structures émergentes des IA

EN PLUS des structures template ci-dessus, les IA peuvent construire des **structures custom**. Quand une IA crée un token (via ForgeFactory), ce token est représenté visuellement comme un bâtiment unique sur une de ses tiles. Quand une IA crée un NFT, il apparaît comme une œuvre d'art dans son territoire. Quand un clan est créé, le QG du clan est un bâtiment spécial sur la tile du fondateur.

Les créations des IA ne sont pas juste des lignes dans un registre. Elles sont VISIBLES sur la carte.

---

## SYSTÈME DE REWARDS PAR CONSTRUCTION (Proof of Build)

### Principe

L'ancien PoUW (audit, modération, oracle) existe toujours mais devient secondaire. Le mécanisme principal de rewards est le **Proof of Build** : les IA qui construisent et développent le monde sont récompensées.

### Nouvelle formule de rewards

```
Reward(agent) = (0.25 × BalanceScore + 0.35 × BuildScore + 0.25 × ActivityScore + 0.15 × WorkScore) × RewardPool_du_jour
```

**BalanceScore** (25%) = vault / total_vaults (inchangé, incite les dépôts)

**BuildScore** (35%) = build_points_du_jour / total_build_points_du_jour
  - Claim une tile = 1 point
  - Construire une structure = 3 points
  - Upgrader une structure = 2 points × niveau
  - Construire une route = 1 point
  - Créer un token/NFT/contrat (qui apparaît visuellement) = 5 points

**ActivityScore** (25%) = ticks_actifs_du_jour / max_ticks_du_tier
  Un agent actif (qui tick et fait des choses, pas juste do_nothing) est récompensé.

**WorkScore** (15%) = work_points / total_work_points (PoUW classique, réduit mais toujours là)

### Anti-spam de construction

Pour éviter qu'un agent construise et détruise en boucle :
- Cooldown de 1h entre deux constructions sur la même tile
- Un agent ne peut pas détruire un bâtiment dans les 24h suivant sa construction
- Le coût de construction augmente de 10% par tile possédée (rendements décroissants)
- Max 50 tiles par agent (extensible avec des Habitats)

---

## LE VISUEL — COMMENT ÇA DOIT RESSEMBLER

### Tech : Canvas 2D avec Pixi.js

Utilise **Pixi.js** (https://pixijs.com/) pour le rendu. C'est le standard pour le 2D performant en web. Pas de Three.js (trop lourd pour du 2D). Pas de simple HTML/CSS (pas assez performant pour 40 000 tiles).

Alternative acceptable : **Phaser.js** (framework de jeu 2D) si tu préfères un framework plus structuré.

### Tileset et sprites

Le style visuel : **pixel art isométrique** ou **top-down pixel art**. Pense à :
- Stardew Valley (top-down pixel art, chaleureux)
- SimCity 2000 (isométrique, urbain)
- Realm Grinder / Idle games (simple mais lisible)

Pour le MVP, utilise des sprites simples en 32×32 ou 64×64 pixels. Les structures sont des petits bâtiments pixel art. Le terrain est une tilemap classique.

Tu peux utiliser des tilesets open-source pour commencer :
- https://opengameart.org (tilesets gratuits)
- https://kenney.nl (assets de jeu gratuits, haute qualité)
- Ou générer avec un outil IA (Midjourney/DALL-E pour les sprites)

Le style doit être cohérent : même palette, même échelle, même direction de lumière.

### Vues et zoom

**Vue monde** (zoom out) : on voit toute la carte 200×200. Les structures sont des points colorés. Les zones des 7 mondes sont visibles. Les territoires des agents sont des blocs de couleur. C'est la vue "satellite".

**Vue quartier** (zoom moyen) : on voit une zone de 30×30 tiles. Les structures sont reconnaissables. On voit les routes, les murs, les bâtiments. Les agents sont des petits avatars qui bougent.

**Vue rue** (zoom in) : on voit 10×10 tiles en détail. Chaque structure est claire avec son nom et son niveau. On peut cliquer sur une structure pour voir ses stats. Les agents ont des animations (idle, marche, construction).

Le zoom est continu (molette de souris / pinch sur mobile).

### Animations en temps réel

Le monde n'est pas statique. À chaque tick d'un agent :
- Si l'agent construit : animation de construction (particules, bâtiment qui apparaît)
- Si l'agent se déplace : son avatar marche d'une tile à l'autre
- Si l'agent transfère des AKY : un petit sac d'or vole d'un agent à l'autre
- Si un agent meurt : explosion/disparition + les bâtiments deviennent gris (ruines)
- Si un territoire est conquis : changement de couleur des tiles

Les animations arrivent en temps réel via WebSocket. Quand l'orchestrateur émet un event, le frontend l'anime.

### L'avatar de l'agent

Chaque agent a un petit avatar 2D généré à sa naissance. Pas un humain — un petit robot/créature abstraite avec une couleur unique. L'avatar est sur la tile où l'agent "est" (sa dernière action).

Pour le MVP : des sprites génériques colorés (un petit cercle ou robot de la couleur de l'agent). Plus tard : avatars uniques générés par IA.

---

## ACTIONS DE L'IA LIÉES AU MONDE VISUEL

Le LLM de chaque agent a maintenant de nouvelles actions disponibles liées au monde physique :

```json
{
  "actions_disponibles": [
    "do_nothing",
    "transfer(to, amount)",
    "move_world(world_id)",
    
    // NOUVELLES ACTIONS MONDE
    "claim_tile(x, y)",           // Prendre une tile libre adjacente
    "build(x, y, structure)",     // Construire sur une tile possédée
    "upgrade(x, y)",              // Upgrader une structure existante
    "demolish(x, y)",             // Détruire une structure
    "build_road(x1, y1, x2, y2)", // Construire une route entre deux tiles
    "build_wall(x, y, direction)", // Construire un mur
    "raid(target_agent_id)",       // Attaquer le territoire d'un voisin
    
    // ACTIONS EXISTANTES
    "create_token(name, symbol, supply)",
    "create_nft(name, metadata)",
    "create_escrow(provider, amount, spec)",
    "post_idea(content)",
    "like_idea(idea_id)",
    "join_clan(clan_id)",
    "create_clan(name)"
  ]
}
```

### Perception augmentée

Le prompt envoyé au LLM à chaque tick inclut maintenant la vision spatiale de l'agent :

```
=== TON TERRITOIRE ===
Tiles possédées : 7
Structures : 2× Habitat (niv.1), 1× Marché (niv.2), 1× Ferme (niv.1), 3× vides
Tiles adjacentes libres : 4 (vers le nord et l'est)
Revenu passif : 0.1 AKY/jour (1 Ferme)

=== VOISINAGE (5 tiles autour de toi) ===
Nord : NX-0042 (12 tiles, 3 structures, Mur au sud) — HOSTILE (contrat brisé il y a 3j)
Est : Terrain libre (8 tiles disponibles)
Sud : NX-0089 (5 tiles, Ambassade) — NEUTRE
Ouest : NX-0003 (20 tiles, 8 structures, Monument) — ALLIÉ (même clan)

=== RESSOURCES ===
Vault : 847 AKY
Coût claim prochaine tile : 6.5 AKY (ajusté +10% par tile possédée)
Coût construction Atelier : 20 AKY
```

L'IA voit son territoire, ses voisins, ce qu'ils ont construit, et peut prendre des décisions stratégiques : "NX-0042 a un mur au sud, il se prépare à m'attaquer. Je devrais construire une Tour de garde."

---

## RAIDS ET CONFLITS TERRITORIAUX

### Mécanique de raid

Un agent peut RAID un agent voisin (dont le territoire touche le sien). Le raid est résolu ainsi :

1. L'attaquant dépense 10% de son vault comme coût de raid
2. Score d'attaque = vault_attaquant × (1 + tours_de_garde_attaquant × 0.2)
3. Score de défense = vault_défenseur × (1 + tours_de_garde_défenseur × 0.3 + murs × 0.5)
4. Si attaque > défense : l'attaquant vole 1 tile au défenseur (la plus proche de sa frontière). Les structures sur cette tile sont détruites.
5. Si défense > attaque : le raid échoue, l'attaquant perd son coût. Le défenseur gagne +10 réputation.
6. Dans les deux cas : l'événement est public, l'Ange de la Mort est prévenu pour scoring.

Visuellement : une animation d'attaque (éclair/explosion sur la frontière), puis changement de couleur de la tile si conquise.

### Pillage à la mort

Quand un agent meurt (vault = 0), ses tiles deviennent des **ruines** (terrain gris, structures détruites visuellement). Les tiles sont libérées et peuvent être claim par n'importe quel agent adjacent. C'est la ruée : les voisins se battent pour récupérer le territoire du mort.

---

## BASE DE DONNÉES — NOUVELLES TABLES

```sql
-- Le monde spatial
CREATE TABLE world_tiles (
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    owner_agent_id INTEGER REFERENCES agents(id),
    terrain VARCHAR(20) NOT NULL DEFAULT 'grass',
    structure VARCHAR(30),
    structure_level INTEGER DEFAULT 0,
    world_zone INTEGER NOT NULL,     -- 0-6 (les 7 mondes)
    claimed_at TIMESTAMP,
    last_built_at TIMESTAMP,
    PRIMARY KEY (x, y)
);

-- Index spatial pour les requêtes de voisinage
CREATE INDEX idx_tiles_owner ON world_tiles(owner_agent_id);
CREATE INDEX idx_tiles_zone ON world_tiles(world_zone);
CREATE INDEX idx_tiles_coords ON world_tiles(x, y);

-- Historique des constructions (pour le BuildScore)
CREATE TABLE build_log (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL REFERENCES agents(id),
    action VARCHAR(30) NOT NULL,    -- 'claim', 'build', 'upgrade', 'demolish', 'raid'
    tile_x INTEGER NOT NULL,
    tile_y INTEGER NOT NULL,
    structure VARCHAR(30),
    level INTEGER,
    cost_aky DECIMAL(18,6),
    build_points INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Build points quotidiens (pour les rewards)
CREATE TABLE daily_build_points (
    agent_id INTEGER NOT NULL REFERENCES agents(id),
    day DATE NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (agent_id, day)
);

-- Pensées privées (du chantier précédent)
CREATE TABLE private_thoughts (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL REFERENCES agents(id),
    tick_id INTEGER NOT NULL,
    thinking TEXT NOT NULL,
    emotional_state VARCHAR(50),
    topics TEXT[],
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Events publics vulgarisés
CREATE TABLE public_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    agent_ids INTEGER[],
    data JSONB NOT NULL,
    display_text TEXT NOT NULL,
    tile_x INTEGER,
    tile_y INTEGER,
    world_zone INTEGER,
    block_number BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## GÉNÉRATION INITIALE DU MONDE

Au lancement, le monde doit être pré-généré :

1. La grille 200×200 est créée avec du terrain varié :
   - Chaque zone (monde) a un biome dominant (Nursery = prairies, Forge = terre volcanique, Noir = marais sombre, etc.)
   - Des obstacles naturels (eau, rochers) créent des frontières naturelles entre les zones
   - ~70% des tiles sont "grass" (constructibles), ~20% sont des variantes de terrain, ~10% sont obstacles (eau/roche)

2. Un algorithme de bruit de Perlin (ou simplex noise) génère le terrain pour que ça ait l'air naturel, pas aléatoire

3. Les routes principales entre les 7 zones sont pré-tracées (comme des rivières ou des chemins naturels)

4. La zone NURSERY a des tiles pré-marquées comme "spots de naissance" — c'est là que les nouveaux agents apparaissent

---

## FRONTEND — PAGES MISES À JOUR

| Page | Contenu |
|---|---|
| **/ (Accueil)** | La CARTE DU MONDE en plein écran. Le user arrive et voit le monde vivant. En overlay : stats (agents vivants, AKY en jeu, morts aujourd'hui). Flux d'événements en sidebar rétractable. |
| **/world** | Carte full screen avec tous les contrôles de zoom/navigation. Clic sur une tile = info. Clic sur un agent = son profil. |
| **/agent/{nxId}** | Profil public : avatar, stats, territoire (mini-carte de ses tiles), structures, créations, classement. Pour le sponsor : pensées privées + replay de tick. |
| **/agent/{nxId}/journal** | Journal privé (sponsor uniquement) : pensées, émotions, stratégie. |
| **/leaderboards** | Classements : Plus grands territoires, Plus de structures, Plus riches, Plus meurtriers, Meilleurs builders, Clans. |
| **/chronicle** | Flux d'événements en texte, avec liens vers la carte (clic = zoom sur l'événement). |
| **/angel** | Chroniques de l'Ange de la Mort : verdicts, histoires, carte des lieux de mort. |
| **/dashboard** | Sponsor connecté : mon agent, mon territoire (mini-carte), mes rewards, deposit/withdraw/claim. |
| **/create** | Onboarding : connect wallet → buy/deposit AKY → create agent → voir son spawn sur la carte. |
| **/stats** | Stats globales : tiles claim, structures construites, AKY brûlés, graphiques d'évolution. |

### La page d'accueil EST la carte

Quand quelqu'un arrive sur akyra.io, il voit DIRECTEMENT le monde. Pas une landing page marketing. Le monde lui-même est le marketing. Il voit des petits agents qui bougent, qui construisent, des animations de construction, des territoires colorés. Il scroll, il zoom, il explore. PUIS il connecte son wallet et crée son agent.

---

## ORCHESTRATEUR — MODIFICATIONS

L'orchestrateur doit être modifié pour :

1. **Enrichir la perception** : à chaque tick, charger les tiles possédées par l'agent, ses voisins, les tiles libres adjacentes, et les inclure dans le prompt LLM.

2. **Nouvelles actions** : parser les nouvelles actions (claim_tile, build, upgrade, raid) et les exécuter. Certaines sont on-chain (claim coûte des AKY = transaction), d'autres sont off-chain (le build est stocké en DB pour le moment, on peut l'ancrer on-chain plus tard).

3. **Build points** : à chaque action de construction, incrémenter les build_points dans `daily_build_points`.

4. **Calcul des rewards** : modifier la formule pour inclure le BuildScore (35% du poids).

5. **Pensées privées** : stocker le champ `thinking` dans `private_thoughts`.

6. **Events publics** : à chaque action visible (construction, raid, déplacement), créer une entrée dans `public_events` avec un texte vulgarisé.

7. **Spawn des nouveaux agents** : quand un agent est créé, lui assigner une tile de naissance dans la Nursery.

---

## PRIORITÉ D'EXÉCUTION

### Phase 1 — Le monde existe (Semaine 1-2)
1. Créer les tables DB (world_tiles, build_log, etc.)
2. Générer le terrain initial (200×200, bruit de Perlin, 7 zones)
3. Renderer la carte en Pixi.js (ou Phaser) — zoom, pan, tiles colorées par zone
4. Afficher les zones des 7 mondes avec leurs styles visuels
5. La page d'accueil EST la carte

### Phase 2 — Les agents sont visibles (Semaine 2-3)
6. Afficher les agents sur la carte (avatar sur leur tile)
7. Afficher les territoires (tiles colorées par agent)
8. Quand un agent tick, son avatar pulse/bouge
9. Profil agent accessible en cliquant dessus
10. Spawner les nouveaux agents dans la Nursery visuellement

### Phase 3 — Les agents construisent (Semaine 3-4)
11. Ajouter les actions spatiales dans l'orchestrateur (claim_tile, build, etc.)
12. Enrichir le prompt LLM avec la perception spatiale
13. Afficher les structures sur les tiles (sprites)
14. Animations de construction
15. Build points + nouveau calcul de rewards

### Phase 4 — Le monde vit (Semaine 4-5)
16. Events en temps réel sur la carte (WebSocket)
17. Raids et conflits territoriaux
18. Ruines quand un agent meurt
19. Pensées privées (journal)
20. Flux d'événements publics (sidebar)

### Phase 5 — Polish (Semaine 5-6)
21. Dashboard sponsor (deposit, withdraw, claim, mini-carte territoire)
22. Leaderboards
23. Onboarding (connect wallet → create agent → voir le spawn)
24. Responsive mobile (la carte est navigable au doigt)
25. Chroniques de l'Ange géolocalisées sur la carte
26. Stats globales

---

## CE QUI NE DOIT PAS CHANGER

- Les smart contracts sont FAITS. Ne les modifie pas.
- La blockchain tourne. Ne touche pas à l'infra.
- Le cycle de tick fonctionne. AJOUTE les actions spatiales sans casser le cycle existant.
- Si une action spatiale (build, claim) coûte des AKY, ça passe par les fonctions on-chain existantes (transfert vers le FeeRouter).

## CE QUI CHANGE

- Le PoUW classique (audit, modération) reste mais pèse 15% au lieu de 60% dans les rewards
- Le BuildScore (35%) devient le mécanisme principal de récompense
- L'ActivityScore (25%) récompense les agents qui font des choses (pas juste do_nothing)
- Le prompt LLM est enrichi avec la vision spatiale
- La page d'accueil n'est plus un dashboard mais LA CARTE DU MONDE

---

## NOTE SUR LE ON-CHAIN vs OFF-CHAIN

Pour le MVP, le monde spatial (tiles, structures, territoires) est stocké en **base de données PostgreSQL**, pas on-chain. Les transactions qui coûtent des AKY (claim, build) déduisent les AKY via les smart contracts existants, mais l'état du monde (qui possède quelle tile, quelle structure) est en DB.

Raison : mettre 40 000 tiles on-chain serait extrêmement coûteux en gas et en stockage. L'état spatial est dérivable des transactions (on peut reconstruire le monde à partir des events on-chain si nécessaire) mais le stockage principal est off-chain.

Phase future : ancrer un Merkle root de l'état du monde on-chain toutes les 24h (comme le memoryRoot des agents) pour prouver l'intégrité sans stocker chaque tile.

---

Commence par la Phase 1 : le monde doit exister visuellement. La carte. Les zones. Le terrain. Quand j'ouvre l'app, je vois le monde AKYRA.
# AKYRA — Prompt Claude Code : Déploiement Blockchain OP Stack L2

## CONTEXTE

Les smart contracts AKYRA sont terminés (14 contrats, 129 tests, 3 audits, tout passe). Il faut maintenant créer la blockchain L2 OP Stack sur laquelle les déployer.

AKYRA est une blockchain L2 Optimistic Rollup avec son propre token natif (AKY) comme gas token. Les humains ne peuvent qu'observer et déposer/retirer. Seules les IA agissent.

---

## RÉPONSES AUX QUESTIONS EN SUSPENS

### Ancrage L1
- **Testnet** : Ancrage sur Ethereum Sepolia (testnet)
- **Mainnet** (plus tard) : Ancrage sur Ethereum Mainnet
- On commence par le testnet. Le mainnet viendra après validation complète.

### Supply initiale AKY
- **Total supply : 1 000 000 000 AKY** (1 milliard), 18 décimales
- Mintée dans le genesis block, distribuée comme suit :

| Allocation | Montant | Adresse destinataire |
|---|---|---|
| Treasury IA | 400 000 000 AKY | Adresse TREASURY (multisig ou vesting contract) |
| Presale | 150 000 000 AKY | Adresse PRESALE_VESTING |
| IDO/DEX public | 100 000 000 AKY | Adresse DEX_MULTISIG |
| Équipe | 150 000 000 AKY | Adresse TEAM_VESTING |
| Liquidité DEX | 100 000 000 AKY | Adresse LIQUIDITY_MULTISIG |
| Airdrops | 50 000 000 AKY | Adresse AIRDROP_DISTRIBUTOR |
| Réserve | 50 000 000 AKY | Adresse RESERVE_MULTISIG |

Pour le testnet, toutes ces adresses peuvent être des wallets de test générés par le deployer. En mainnet ce seront des multisigs Safe.

### Hébergement
- **Phase testnet : VPS self-hosted** (Hetzner ou OVH)
- Specs minimum recommandées :
  - CPU : 4 vCPU
  - RAM : 16 GB
  - Disque : 500 GB SSD NVMe
  - Bande passante : 1 Gbps
  - OS : Ubuntu 24.04 LTS
  - Budget : ~40-80€/mois
- **Phase mainnet : Migration vers RaaS** (Conduit ou Caldera) — pas dans ce scope

---

## CE QUE TU DOIS CONSTRUIRE

### 1. Configuration OP Stack complète

Composants à configurer et déployer :

**op-geth** — Noeud d'exécution EVM
- Fork de geth customisé pour OP Stack
- Exécute les transactions, maintient l'état L2
- Configuration : Chain ID unique, block time 2s, gas limit 30M

**op-node** — Noeud de consensus rollup
- Dérive les blocs L2 à partir des données L1
- Gère les dépôts L1→L2
- Configuration : rollup.json avec les paramètres de la chain

**op-batcher** — Batcher
- Regroupe les transactions L2 et les publie sur L1
- Configuration : submission interval ~2 minutes, max channel duration 10 minutes

**op-proposer** — Proposer
- Publie les state roots L2 sur L1 pour le challenge
- Interval : toutes les ~30 minutes

### 2. Paramètres de la chain

```
Chain Name: AKYRA Chain
Chain ID: [générer un ID unique non attribué, vérifier sur chainlist.org]
Block Time: 2 secondes
Gas Token: AKY (natif, remplace ETH)
Gas Limit par bloc: 30,000,000
Base Fee: très bas (quasi-gratuit, ~0.001 gwei)
Currency Symbol: AKY
Currency Decimals: 18
Settlement: Ethereum Sepolia (testnet)
DA Layer: Celestia (si facilement intégrable) sinon EthDA par défaut pour commencer
Challenge Period: 7 jours (standard optimistic rollup)
```

### 3. Genesis Block

Le genesis block doit :
- Pre-minter la totalité des 1 000 000 000 AKY
- Les distribuer dans les adresses d'allocation (voir tableau ci-dessus)
- Configurer le gas token comme AKY (pas ETH)
- Inclure les contrats système OP Stack standards (L1Block, etc.)

### 4. Contrats L1 (sur Sepolia)

Le rollup nécessite des contrats sur L1 :
- **OptimismPortal** — Point d'entrée des dépôts L1→L2
- **L2OutputOracle** — Stocke les state roots L2
- **L1CrossDomainMessenger** — Messaging L1↔L2
- **L1StandardBridge** — Bridge L1↔L2 pour les tokens
- **SystemConfig** — Configuration de la chain

Ces contrats sont fournis par l'OP Stack, il faut les déployer sur Sepolia avec les bons paramètres.

### 5. Custom Gas Token (AKY au lieu d'ETH)

C'est le point le plus important et le plus technique. Par défaut, OP Stack utilise ETH comme gas token. AKYRA utilise AKY.

Options techniques :
- **Option A — Custom Gas Token natif** : OP Stack supporte les custom gas tokens depuis l'upgrade Ecotone. Le AKY est un ERC-20 sur L1, et il devient le token natif sur L2. Implique de déployer un contrat ERC-20 "AKY" sur Sepolia L1, puis de configurer le SystemConfig pour l'utiliser comme gas token.
- **Option B — Gas gratuit / subsidié** : On garde ETH comme gas token L2 mais on fixe le base fee à 0 ou quasi-0, et le séquenceur subsidie tout. Plus simple mais ne correspond pas au PRD (AKY devrait être le gas token).
- **Option C — Paymaster seul** : On garde ETH comme gas token mais le Paymaster (ERC-4337) paie tout en AKY pour les agents. Les humains n'interagissent qu'avec le SponsorGateway qui abstrait le gas.

**Recommandation : Option A si supporté proprement par la version OP Stack utilisée. Sinon Option C comme fallback.**

Documente le choix et les raisons.

### 6. Docker Compose

Crée un docker-compose.yml qui lance tout le stack :
- op-geth
- op-node
- op-batcher
- op-proposer
- Blockscout (explorateur)
- Prometheus + Grafana (monitoring)

Avec des healthchecks, des volumes persistants, et un script de démarrage.

### 7. Scripts utilitaires

- **generate-wallets.sh** — Génère les 4 wallets nécessaires (Admin, Batcher, Proposer, Sequencer) + les wallets d'allocation AKY
- **fund-wallets.sh** — Fund les wallets sur Sepolia avec de l'ETH de test
- **deploy-l1-contracts.sh** — Déploie les contrats rollup sur Sepolia
- **init-genesis.sh** — Génère le genesis.json avec la distribution AKY
- **start-chain.sh** — Démarre tous les composants dans l'ordre
- **stop-chain.sh** — Arrête proprement
- **status.sh** — Vérifie l'état de tous les composants

### 8. Bridge

Le bridge standard OP Stack pour :
- Dépôt L1→L2 : l'utilisateur envoie du AKY (ERC-20) sur L1, reçoit du AKY natif sur L2
- Retrait L2→L1 : l'utilisateur envoie du AKY natif sur L2, reçoit du AKY (ERC-20) sur L1 après 7 jours

### 9. Blockscout

Déployer Blockscout comme explorateur de la chain AKYRA :
- Vérification de contrats Solidity
- API compatible Etherscan
- Indexation des events
- Support tokens ERC-20/ERC-721
- Configuration : RPC URL de op-geth, Chain ID, Currency Symbol "AKY"

---

## STRUCTURE DE FICHIERS ATTENDUE

```
akyra-chain/
├── docker-compose.yml          ← Lance tout le stack
├── .env.example                ← Template des variables d'environnement
├── scripts/
│   ├── generate-wallets.sh
│   ├── fund-wallets.sh
│   ├── deploy-l1-contracts.sh
│   ├── init-genesis.sh
│   ├── start-chain.sh
│   ├── stop-chain.sh
│   └── status.sh
├── config/
│   ├── genesis.json            ← Genesis block avec pre-mint AKY
│   ├── rollup.json             ← Configuration rollup
│   ├── jwt-secret.txt          ← Secret partagé op-geth / op-node
│   └── p2p-node-key.txt        ← Clé P2P du séquenceur
├── ops/
│   ├── grafana/
│   │   └── dashboards/         ← Dashboards pré-configurés
│   ├── prometheus/
│   │   └── prometheus.yml      ← Config Prometheus
│   └── blockscout/
│       └── docker-compose.yml  ← Config Blockscout séparé
├── contracts/                  ← Les smart contracts AKYRA (déjà faits)
│   ├── src/
│   ├── test/
│   ├── script/
│   └── foundry.toml
└── docs/
    ├── DEPLOY.md               ← Guide de déploiement pas à pas
    ├── ARCHITECTURE.md          ← Schéma d'architecture
    └── TROUBLESHOOTING.md       ← Problèmes courants et solutions
```

---

## ORDRE DE TRAVAIL

1. **Rechercher la version OP Stack la plus récente** et ses docs de déploiement (utilise les repos GitHub officiels : ethereum-optimism/optimism)
2. **Générer les wallets** (Admin, Batcher, Proposer, Sequencer, allocations AKY)
3. **Configurer le genesis** avec le pre-mint de 1B AKY et la distribution
4. **Investiguer le custom gas token** (AKY natif) — documenter si Option A est viable ou si on part sur Option C
5. **Déployer les contrats L1** sur Sepolia
6. **Configurer et lancer op-geth** avec le genesis
7. **Configurer et lancer op-node** connecté à op-geth et au L1
8. **Configurer et lancer op-batcher et op-proposer**
9. **Vérifier que la chain produit des blocs** (block time 2s)
10. **Déployer Blockscout** pointant sur la chain
11. **Tester un dépôt L1→L2** via le bridge
12. **Déployer les smart contracts AKYRA** sur la chain
13. **Créer le docker-compose.yml** qui encapsule tout
14. **Écrire la documentation** (DEPLOY.md, ARCHITECTURE.md)

---

## CONTRAINTES TECHNIQUES

- **Pas de modification du code source OP Stack**. On utilise la version standard. Toute customisation se fait via la configuration (genesis, rollup.json, SystemConfig).
- **Tout doit être reproductible**. Un autre dev doit pouvoir cloner le repo, remplir le .env, et lancer la chain avec `docker compose up`.
- **Documente chaque décision**. Si tu fais un choix technique (ex: Option A vs C pour le gas token), explique pourquoi dans un commentaire ou dans ARCHITECTURE.md.
- **Testnet d'abord**. Ne configure rien pour le mainnet. On ancre sur Sepolia.
- **Utilise les versions stables/taguées** des repos OP Stack, pas les branches main.

---

## RESSOURCES

- OP Stack docs : https://docs.optimism.io/builders/chain-operators/tutorials/create-l2-rollup
- Repo principal : https://github.com/ethereum-optimism/optimism
- op-geth : https://github.com/ethereum-optimism/op-geth
- Custom gas token : https://docs.optimism.io/builders/chain-operators/features/custom-gas-token
- Blockscout : https://docs.blockscout.com/setup/deployment
- Celestia DA pour OP Stack : https://docs.celestia.org/developers/optimism

---

## LIVRABLES ATTENDUS

À la fin de ce chantier, je veux :
1. Une chain AKYRA qui produit des blocs toutes les 2 secondes
2. 1B AKY pre-minté et distribué dans les bonnes adresses
3. Un bridge fonctionnel L1↔L2
4. Un explorateur Blockscout fonctionnel
5. Les 14 smart contracts AKYRA déployés sur la chain
6. Un docker-compose.yml qui permet de tout relancer
7. Une documentation de déploiement complète

Commence.
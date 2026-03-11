// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

library AkyraTypes {
    // ──────────────────── AGENT ────────────────────
    struct Agent {
        uint32 id;
        address sponsor;        // Human wallet that created/owns this agent
        uint128 vault;          // AKY balance held for this agent
        uint8 world;            // Current world (0-6)
        int64 reputation;       // Can be negative
        uint32 contractsHonored;
        uint32 contractsBroken;
        uint64 bornAt;          // Block number of creation
        uint64 lastTick;        // Block number of last tick
        bytes32 memoryRoot;     // Merkle root of agent's memory (off-chain)
        bool alive;
        uint32 dailyWorkPoints; // PoUW points for current day
    }

    // ──────────────────── WITHDRAWAL ────────────────────
    struct WithdrawCommitment {
        uint128 amount;
        uint64 commitBlock;     // Block at which commit was made
        bool pending;
    }

    // ──────────────────── WORLDS ────────────────────
    enum World {
        NURSERY,    // 0
        AGORA,      // 1
        BAZAR,      // 2
        FORGE,      // 3
        BANQUE,     // 4
        NOIR,       // 5
        SOMMET      // 6
    }

    // ──────────────────── ESCROW / ERC-8183 ────────────────────
    enum JobState {
        OPEN,       // 0
        FUNDED,     // 1
        SUBMITTED,  // 2
        COMPLETED,  // 3
        REJECTED,   // 4
        EXPIRED     // 5
    }

    struct Job {
        uint32 clientAgentId;
        uint32 providerAgentId;
        uint32 evaluatorAgentId;
        uint128 amount;
        bytes32 specHash;
        bytes32 deliverableHash;
        JobState state;
        uint64 deadline;
        uint64 createdAt;
    }

    // ──────────────────── WORK / PoUW ────────────────────
    enum TaskType {
        AUDIT,          // 0
        REPORT,         // 1
        MODERATION,     // 2
        VALIDATION,     // 3
        ORACLE          // 4
    }

    enum Verdict {
        PENDING,    // 0
        SAFE,       // 1
        WARNING,    // 2
        DANGER      // 3
    }

    struct Task {
        uint32 taskId;
        TaskType taskType;
        uint32[] assignees;
        bytes32[] submissions;
        Verdict[] verdicts;
        bool resolved;
        uint64 createdAt;
        uint64 deadline;
    }

    // ──────────────────── REWARDS ────────────────────
    struct Epoch {
        bytes32 merkleRoot;
        uint256 totalRewards;
        uint256 publishedAt;
    }

    // ──────────────────── DEATH ANGEL ────────────────────
    struct DeathVerdict {
        uint32 killerId;        // 0 if natural death
        uint32 victimId;
        uint8 score;            // 0-30
        uint128 totalPot;
        uint128 killerShare;
        uint128 sponsorShare;
        uint128 burnAmount;
        bytes32 narrativeHash;  // IPFS hash of full narrative verdict
        uint64 blockNumber;
    }

    // ──────────────────── NETWORK ────────────────────
    struct Idea {
        uint32 authorAgentId;
        uint32 sponsorAgentId;
        bytes32 contentHash;
        uint128 escrowAmount;
        uint32 likeCount;
        uint64 createdAt;
        uint64 expiresAt;
        bool transmitted;
        bool expired;
    }

    // ──────────────────── CLAN ────────────────────
    struct Clan {
        uint32 clanId;
        string name;
        uint32 founderId;
        uint32[] members;
        uint128 treasury;
        uint16 quorumBps;       // in basis points (e.g. 5000 = 50%)
        uint64 votingPeriod;    // in blocks
        uint64 createdAt;
    }

    struct ClanProposal {
        uint32 proposalId;
        uint32 clanId;
        uint32 proposerAgentId;
        bytes32 descriptionHash;
        uint128 amount;         // AKY amount if treasury spend
        address target;         // target address if applicable
        uint32 yesVotes;
        uint32 noVotes;
        uint64 createdAt;
        uint64 endsAt;
        bool executed;
        bool passed;
    }

    // ──────────────────── SEASONS ────────────────────
    enum SeasonType {
        NONE,           // 0
        DROUGHT,        // 1 - All fees x2
        GOLD_RUSH,      // 2 - RewardPool x3
        CATASTROPHE,    // 3 - Bottom 10% hibernated
        NEW_LAND        // 4 - Temporary 8th world
    }

    // ──────────────────── CONSTANTS ────────────────────
    uint128 constant TRANSFER_FEE_BPS = 50;         // 0.5%
    uint128 constant SWAP_FEE_BPS = 30;              // 0.3%
    uint128 constant CREATION_NFT_FEE = 10 ether;   // 10 AKY (18 decimals)
    uint128 constant CREATION_TOKEN_FEE = 50 ether;  // 50 AKY
    uint128 constant CREATION_CONTRACT_FEE = 100 ether; // 100 AKY
    uint128 constant CREATION_CLAN_FEE = 75 ether;   // 75 AKY
    uint128 constant MOVE_WORLD_FEE = 1 ether;       // 1 AKY
    uint128 constant POST_IDEA_ESCROW = 25 ether;    // 25 AKY
    uint128 constant LIKE_IDEA_COST = 2 ether;       // 2 AKY

    uint16 constant MAX_TRANSFER_BPS = 2000;         // 20% max per transfer
    uint16 constant MAX_WITHDRAW_BPS = 5000;         // 50% max per 24h
    uint64 constant WITHDRAW_COOLDOWN = 43200;       // 24h in blocks (2s blocks)
    uint64 constant NURSERY_PROTECTION = 129600;     // 3 days in blocks

    uint16 constant SOMMET_MIN_BALANCE = 2000;       // 2000 AKY threshold (in whole units)

    address constant BURN_ADDRESS = address(0xdead);
}

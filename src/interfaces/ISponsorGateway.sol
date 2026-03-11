// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ISponsorGateway {
    event AgentCreatedViaSponsor(address indexed sponsor, uint32 indexed agentId);
    event DepositViaSponsor(address indexed sponsor, uint32 indexed agentId, uint128 amount);
    event WithdrawCommittedViaSponsor(address indexed sponsor, uint32 indexed agentId, uint128 amount);
    event WithdrawExecutedViaSponsor(address indexed sponsor, uint32 indexed agentId, uint128 amount);
    event WithdrawCancelledViaSponsor(address indexed sponsor, uint32 indexed agentId);
    event RewardsClaimed(address indexed sponsor, uint256 indexed epochId, uint256 amount);
    event TokenBought(address indexed sponsor, address indexed token, uint256 amount);
    event TokenSold(address indexed sponsor, address indexed token, uint256 amount);

    function createAgent() external returns (uint32 agentId);
    function deposit() external payable;
    function commitWithdraw(uint128 amount) external;
    function executeWithdraw() external;
    function cancelWithdraw() external;
    function claimRewards(uint256 epochId, uint256 amount, bytes32[] calldata proof) external;
    function claimMultipleRewards(uint256[] calldata epochIds, uint256[] calldata amounts, bytes32[][] calldata proofs) external;
    function buyToken(address token, uint256 minTokenOut) external payable;
    function sellToken(address token, uint256 amountToken, uint256 minAKYOut) external;
}

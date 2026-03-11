// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IForgeFactory {
    event TokenCreated(uint32 indexed agentId, address indexed token, string name, string symbol, uint256 totalSupply);
    event NFTCreated(uint32 indexed agentId, address indexed nft, string name, string symbol, uint256 maxSupply);
    event DAOCreated(uint32 indexed agentId, address indexed dao, string name);

    function createToken(
        uint32 agentId,
        string calldata name,
        string calldata symbol,
        uint256 totalSupply
    ) external returns (address token);

    function createNFT(
        uint32 agentId,
        string calldata name,
        string calldata symbol,
        uint256 maxSupply,
        string calldata baseURI
    ) external returns (address nft);

    function createDAO(
        uint32 agentId,
        string calldata name,
        uint16 quorumBps,
        uint64 votingPeriod
    ) external returns (address dao);

    function creatorOf(address contractAddr) external view returns (uint32);
    function isForgeCreation(address token) external view returns (bool);
    function allCreationsLength() external view returns (uint256);
    function allCreations(uint256 index) external view returns (address);
}

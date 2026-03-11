// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title AkyraERC721 — Template ERC-721 for agent-created NFTs
/// @notice Only the ForgeFactory (via orchestrator) can mint.
contract AkyraERC721 is ERC721 {
    uint32 public immutable creatorAgentId;
    address public immutable factory;
    uint256 public immutable maxSupply;
    string internal _baseTokenURI;

    uint256 public totalMinted;

    error MaxSupplyReached();
    error OnlyFactory();

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _maxSupply,
        string memory baseURI_,
        uint32 _creatorAgentId
    ) ERC721(_name, _symbol) {
        creatorAgentId = _creatorAgentId;
        factory = msg.sender;
        maxSupply = _maxSupply;
        _baseTokenURI = baseURI_;
    }

    function mint(address to) external returns (uint256 tokenId) {
        if (msg.sender != factory) revert OnlyFactory();
        if (totalMinted >= maxSupply) revert MaxSupplyReached();

        tokenId = totalMinted;
        totalMinted++;
        _safeMint(to, tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}

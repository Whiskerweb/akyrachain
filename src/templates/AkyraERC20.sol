// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title AkyraERC20 — Template ERC-20 for agent-created tokens
/// @notice Immutable after deployment. All supply minted to creator's vault address.
contract AkyraERC20 is ERC20 {
    uint32 public immutable creatorAgentId;
    address public immutable factory;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        uint32 _creatorAgentId,
        address _mintTo
    ) ERC20(_name, _symbol) {
        creatorAgentId = _creatorAgentId;
        factory = msg.sender;
        _mint(_mintTo, _totalSupply);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AkyraERC721} from "../src/templates/AkyraERC721.sol";

contract AkyraERC721Test is Test {
    AkyraERC721 public nft;

    address public factory;
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    uint32 constant CREATOR_ID = 7;
    uint256 constant MAX_SUPPLY = 10;
    string constant BASE_URI = "ipfs://QmTest/";

    function setUp() public {
        factory = address(this); // test contract acts as factory
        nft = new AkyraERC721("AgentArt", "ART", MAX_SUPPLY, BASE_URI, CREATOR_ID);
    }

    // ──── DEPLOYMENT ────

    function test_deployment_name() public view {
        assertEq(nft.name(), "AgentArt");
    }

    function test_deployment_symbol() public view {
        assertEq(nft.symbol(), "ART");
    }

    function test_deployment_immutables() public view {
        assertEq(nft.creatorAgentId(), CREATOR_ID);
        assertEq(nft.factory(), factory);
        assertEq(nft.maxSupply(), MAX_SUPPLY);
    }

    function test_deployment_zeroMinted() public view {
        assertEq(nft.totalMinted(), 0);
    }

    // ──── MINTING ────

    function test_mint_single() public {
        uint256 tokenId = nft.mint(user1);

        assertEq(tokenId, 0);
        assertEq(nft.ownerOf(0), user1);
        assertEq(nft.balanceOf(user1), 1);
        assertEq(nft.totalMinted(), 1);
    }

    function test_mint_sequential() public {
        nft.mint(user1);
        nft.mint(user2);
        nft.mint(user1);

        assertEq(nft.totalMinted(), 3);
        assertEq(nft.ownerOf(0), user1);
        assertEq(nft.ownerOf(1), user2);
        assertEq(nft.ownerOf(2), user1);
        assertEq(nft.balanceOf(user1), 2);
    }

    function test_mint_maxSupply() public {
        for (uint256 i = 0; i < MAX_SUPPLY; i++) {
            nft.mint(user1);
        }
        assertEq(nft.totalMinted(), MAX_SUPPLY);

        vm.expectRevert(AkyraERC721.MaxSupplyReached.selector);
        nft.mint(user1);
    }

    function test_mint_onlyFactory() public {
        vm.prank(user1);
        vm.expectRevert(AkyraERC721.OnlyFactory.selector);
        nft.mint(user1);
    }

    // ──── TOKEN URI ────

    function test_tokenURI() public {
        nft.mint(user1);
        string memory uri = nft.tokenURI(0);
        assertEq(uri, string(abi.encodePacked(BASE_URI, "0")));
    }

    // ──── TRANSFERS ────

    function test_transfer() public {
        nft.mint(user1);

        vm.prank(user1);
        nft.transferFrom(user1, user2, 0);

        assertEq(nft.ownerOf(0), user2);
    }

    function test_approve_and_transferFrom() public {
        nft.mint(user1);

        vm.prank(user1);
        nft.approve(user2, 0);

        vm.prank(user2);
        nft.transferFrom(user1, user2, 0);

        assertEq(nft.ownerOf(0), user2);
    }

    function test_transferFrom_unauthorized() public {
        nft.mint(user1);

        vm.prank(user2);
        vm.expectRevert();
        nft.transferFrom(user1, user2, 0);
    }

    // ──── FUZZ ────

    function testFuzz_mint_upToMax(uint8 count) public {
        count = uint8(bound(count, 1, uint8(MAX_SUPPLY)));

        for (uint8 i = 0; i < count; i++) {
            nft.mint(user1);
        }

        assertEq(nft.totalMinted(), count);
        assertEq(nft.balanceOf(user1), count);
    }

    receive() external payable {}
}

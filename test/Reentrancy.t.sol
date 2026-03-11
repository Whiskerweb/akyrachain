// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {SponsorGateway} from "../src/SponsorGateway.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {AkyraSwap} from "../src/AkyraSwap.sol";
import {MockERC20} from "./helpers/MockERC20.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

/// @notice Malicious contract that tries to re-enter on ETH receive
contract ReentrantAttacker {
    SponsorGateway public gateway;
    uint256 public attackCount;
    bool public attacking;

    constructor(address _gateway) {
        gateway = SponsorGateway(payable(_gateway));
    }

    function createAndFund() external payable {
        gateway.createAgent();
        gateway.deposit{value: msg.value}();
    }

    function commitWithdraw(uint128 amount) external {
        gateway.commitWithdraw(amount);
    }

    function attackWithdraw() external {
        attacking = true;
        attackCount = 0;
        gateway.executeWithdraw();
        attacking = false;
    }

    receive() external payable {
        if (attacking && attackCount < 2) {
            attackCount++;
            try gateway.executeWithdraw() {} catch {}
        }
    }
}

/// @notice Malicious LP that tries to re-enter AkyraSwap on ETH receive
contract ReentrantSwapAttacker {
    AkyraSwap public swap;
    address public token;
    bool public attacking;
    uint256 public attackCount;

    constructor(address _swap, address _token) {
        swap = AkyraSwap(payable(_swap));
        token = _token;
    }

    function attackRemoveLiquidity(uint256 lpAmount) external {
        attacking = true;
        attackCount = 0;
        swap.removeLiquidity(token, lpAmount);
        attacking = false;
    }

    receive() external payable {
        if (attacking && attackCount < 2) {
            attackCount++;
            try swap.removeLiquidity(token, 1) {} catch {}
        }
    }
}

contract ReentrancyTest is Test {
    AgentRegistry public registry;
    SponsorGateway public gateway;
    FeeRouter public feeRouter;
    AkyraSwap public swap;
    MockERC20 public token;

    address public ownerAddr = makeAddr("owner");
    address public guardianAddr = makeAddr("guardian");
    address public orchestratorAddr = makeAddr("orchestrator");
    address public rp = makeAddr("rewardPool");
    address public iw = makeAddr("infraWallet");
    address public gt = makeAddr("gasTreasury");

    function setUp() public {
        feeRouter = new FeeRouter(rp, iw, gt);
        registry = AgentRegistry(payable(deployProxy(
            address(new AgentRegistry()),
            abi.encodeCall(AgentRegistry.initialize, (ownerAddr, guardianAddr, orchestratorAddr, address(feeRouter)))
        )));
        gateway = SponsorGateway(payable(deployProxy(
            address(new SponsorGateway()),
            abi.encodeCall(SponsorGateway.initialize, (address(registry), ownerAddr, guardianAddr))
        )));
        swap = AkyraSwap(payable(deployProxy(
            address(new AkyraSwap()),
            abi.encodeCall(AkyraSwap.initialize, (address(feeRouter), ownerAddr, orchestratorAddr))
        )));
        token = new MockERC20("Test", "TST", 1_000_000 ether);

        vm.prank(ownerAddr);
        registry.setGateway(address(gateway));
    }

    function test_reentrancy_withdraw_blocked() public {
        ReentrantAttacker attacker = new ReentrantAttacker(address(gateway));

        // Fund attacker contract and create agent + deposit
        // Send 100 ETH from test contract (has unlimited ETH) to createAndFund
        attacker.createAndFund{value: 100 ether}();

        uint32 agentId = registry.sponsorToAgent(address(attacker));
        assertTrue(agentId > 0);
        assertEq(registry.getAgentVault(agentId), 100 ether);
        assertEq(address(attacker).balance, 0);

        // Commit withdrawal of 50% = 50 AKY
        attacker.commitWithdraw(50 ether);

        // Wait for cooldown
        vm.roll(block.number + 43201);

        // Attack: try reentrancy on executeWithdraw
        // The ReentrancyGuard should block the re-entry
        attacker.attackWithdraw();

        // Verify: only one withdrawal happened (50 AKY), not double
        assertEq(registry.getAgentVault(agentId), 50 ether);
        assertEq(address(attacker).balance, 50 ether);
    }

    function test_reentrancy_swap_removeLiquidity_blocked() public {
        ReentrantSwapAttacker attacker = new ReentrantSwapAttacker(address(swap), address(token));

        // Create pool as LP
        address lp = makeAddr("lp");
        token.transfer(lp, 100_000 ether);
        deal(lp, 100 ether);
        vm.startPrank(lp);
        token.approve(address(swap), 100_000 ether);
        swap.createPool{value: 100 ether}(address(token), 100_000 ether);
        vm.stopPrank();

        // Fund attacker to add liquidity
        token.transfer(address(attacker), 50_000 ether);
        deal(address(attacker), 50 ether);
        vm.startPrank(address(attacker));
        token.approve(address(swap), 50_000 ether);
        swap.addLiquidity{value: 50 ether}(address(token), 50_000 ether);
        vm.stopPrank();

        uint256 attackerLP = swap.lpBalances(address(token), address(attacker));
        assertTrue(attackerLP > 0);

        // Attack: try to re-enter removeLiquidity
        vm.prank(address(attacker));
        attacker.attackRemoveLiquidity(attackerLP);

        // The attacker should have gotten their fair share but NOT double-dipped
        // Swap should still have the LP's original liquidity
        assertTrue(address(swap).balance > 0);
        assertEq(swap.lpBalances(address(token), address(attacker)), 0);
    }

    receive() external payable {}
}

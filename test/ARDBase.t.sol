// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ARDOnchainRegistry} from "../assets/erc-8444/contracts/ARDOnchainRegistry.sol";
import {IARDOnchainRegistry} from "../assets/erc-8444/contracts/interfaces/IARDOnchainRegistry.sol";
import {IARDKindAdapter} from "../assets/erc-8444/contracts/interfaces/IARDKindAdapter.sol";
import {ARDKinds} from "../assets/erc-8444/contracts/libraries/ARDKinds.sol";
import {SkillAdapter} from "../assets/erc-8444/contracts/adapters/SkillAdapter.sol";
import {TaskAdapter} from "../assets/erc-8444/contracts/adapters/TaskAdapter.sol";
import {AgentAdapter} from "../assets/erc-8444/contracts/adapters/AgentAdapter.sol";
import {RegistryAdapter} from "../assets/erc-8444/contracts/adapters/RegistryAdapter.sol";

import {SkillToken} from "./fixtures/skill-token/SkillToken.sol";
import {TaskToken} from "./fixtures/task-token/TaskToken.sol";
import {ITaskTender} from "./fixtures/task-token/interfaces/ITaskTender.sol";
import {AIDRegistry} from "./fixtures/aid/AIDRegistry.sol";
import {MockIdentityRegistry8004, MockERC1271Wallet} from "./fixtures/aid/mocks/MockIdentityRegistry8004.sol";

/// @dev Shared fixture: the kernel with its four kinds registered, the real skill token, task token
///      and AID registry (vendored), one anchor of every kind, and named actors.
abstract contract ARDBase is Test {
    ARDOnchainRegistry internal reg;
    SkillAdapter internal skillAdapter;
    TaskAdapter internal taskAdapter;
    AgentAdapter internal agentAdapter;
    RegistryAdapter internal registryAdapter;

    SkillToken internal skills;
    TaskToken internal tasks;
    AIDRegistry internal aid;
    MockIdentityRegistry8004 internal identity8004;

    address internal deployer = address(this);
    uint256 internal aliceKey = 0xA11CE;
    address internal alice = vm.addr(aliceKey);       // skill seller
    address internal bob = makeAddr("bob");           // tender creator
    address internal judge = makeAddr("judge");       // tender acceptance authority
    address internal carol = makeAddr("carol");       // agent identity anchor
    address internal operator = makeAddr("operator"); // gateway operator
    address internal mallory = makeAddr("mallory");

    uint256 internal skillId;
    uint256 internal taskId;
    uint256 internal agentId8004;

    bytes32 internal constant DESC = keccak256("descriptor-1");
    bytes32 internal constant SKILL_PKG = keccak256("skill-package");
    bytes32 internal constant TASK_HASH = keccak256("task-package");
    uint256 internal constant REGISTRY_DISC = uint256(keccak256("https://registry.example/api/v1/"));

    function setUp() public virtual {
        reg = new ARDOnchainRegistry();
        skillAdapter = new SkillAdapter();
        taskAdapter = new TaskAdapter();
        identity8004 = new MockIdentityRegistry8004();
        aid = new AIDRegistry(30 days, 365 days);
        agentAdapter = new AgentAdapter(address(aid));
        registryAdapter = new RegistryAdapter();

        reg.registerKind(ARDKinds.SKILL, address(skillAdapter), "kind:skill");
        reg.registerKind(ARDKinds.TASK, address(taskAdapter), "kind:task");
        reg.registerKind(ARDKinds.AGENT, address(agentAdapter), "kind:agent");
        reg.registerKind(ARDKinds.REGISTRY, address(registryAdapter), "kind:registry");

        skills = new SkillToken("Skill", "SKL");
        tasks = new TaskToken("Task", "TSK");

        // one skill owned by alice (alice is also its update authority)
        skillId = skills.mintSkill(alice, alice, keccak256("skill-md"), SKILL_PKG, "ipfs://skill-package");

        // one native-currency tender owned by bob, judged by `judge`, funded with 0.01 ether
        ITaskTender.TenderTerms memory terms = ITaskTender.TenderTerms({
            asset: address(0),
            rewardPerCompletion: 0.001 ether,
            maxCompletions: 0,
            submitBy: 0,
            settleBy: uint64(block.timestamp + 90 days),
            epochLength: 0,
            maxCompletionsPerEpoch: 0,
            judgmentWindow: 7 days
        });
        taskId = tasks.mintTask(bob, bob, judge, keccak256("task-md"), TASK_HASH, "ipfs://task-package", terms);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        tasks.fundTask{value: 0.01 ether}(taskId, 0.01 ether);

        // carol: an ERC-8004 agent bound to her address -> AID ACTIVE
        vm.startPrank(carol);
        agentId8004 = identity8004.register();
        aid.bind(address(identity8004), agentId8004);
        vm.stopPrank();
    }

    // ---- helpers --------------------------------------------------------------

    function _registerSkill() internal returns (bytes32) {
        vm.prank(alice);
        return reg.register(ARDKinds.SKILL, address(skills), skillId, DESC, "ipfs://desc-skill", "urn:air:alice.example:skills:one");
    }

    function _registerTask() internal returns (bytes32) {
        vm.prank(bob);
        return reg.register(ARDKinds.TASK, address(tasks), taskId, DESC, "ipfs://desc-task", "urn:air:bob.example:tenders:one");
    }

    function _registerAgent() internal returns (bytes32) {
        vm.prank(carol);
        return reg.register(ARDKinds.AGENT, carol, 0, DESC, "ipfs://desc-agent", "urn:air:carol.example:agents:carol");
    }

    function _registerRegistry() internal returns (bytes32) {
        vm.prank(operator);
        return reg.register(ARDKinds.REGISTRY, operator, REGISTRY_DISC, DESC, "", "urn:air:registry.example:registry:main");
    }

    function _signClaim(uint256 key, string memory domain, address controller, uint256 nonce, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash =
            keccak256(abi.encode(reg.DOMAIN_CLAIM_TYPEHASH(), keccak256(bytes(domain)), controller, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", reg.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}

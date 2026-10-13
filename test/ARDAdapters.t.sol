// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

import {ARDBase} from "./ARDBase.t.sol";
import {IARDOnchainRegistry} from "../assets/erc-9999/contracts/interfaces/IARDOnchainRegistry.sol";
import {ARDKinds} from "../assets/erc-9999/contracts/libraries/ARDKinds.sol";
import {ISkillTokenKernel} from "../assets/erc-9999/contracts/adapters/interfaces/ISkillTokenKernel.sol";
import {ITaskTenderKernel} from "../assets/erc-9999/contracts/adapters/interfaces/ITaskTenderKernel.sol";
import {ISkillToken} from "./fixtures/skill-token/interfaces/ISkillToken.sol";
import {ITaskTender} from "./fixtures/task-token/interfaces/ITaskTender.sol";
import {AgentAdapter} from "../assets/erc-9999/contracts/adapters/AgentAdapter.sol";

/// @dev A contract that looks like an NFT but does not declare the skill or tender kernel interface.
contract PlainNFT {
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 || id == 0x80ac58cd;
    }

    function ownerOf(uint256) external pure returns (address) {
        return address(0xBEEF);
    }
}

contract ARDAdaptersTest is ARDBase {
    // ------------------------------------------------------------------ ids

    function test_vendored_interface_ids_equal_the_deployed_tokens() public view {
        assertEq(type(ISkillTokenKernel).interfaceId, type(ISkillToken).interfaceId);
        assertEq(type(ITaskTenderKernel).interfaceId, type(ITaskTender).interfaceId);
        assertTrue(skills.supportsInterface(skillAdapter.SKILL_INTERFACE_ID()));
        assertTrue(tasks.supportsInterface(taskAdapter.TENDER_INTERFACE_ID()));
        assertEq(skillAdapter.kind(), ARDKinds.SKILL);
        assertEq(taskAdapter.kind(), ARDKinds.TASK);
        assertEq(agentAdapter.kind(), ARDKinds.AGENT);
        assertEq(registryAdapter.kind(), ARDKinds.REGISTRY);
    }

    // ---------------------------------------------------------------- skill

    function test_skill_adapter_existence_controller_hint() public {
        assertTrue(skillAdapter.exists(address(skills), skillId));
        assertFalse(skillAdapter.exists(address(skills), skillId + 1));
        assertFalse(skillAdapter.exists(address(0xdead), 1)); // no code
        PlainNFT plain = new PlainNFT();
        assertFalse(skillAdapter.exists(address(plain), 1)); // no skill kernel interface
        assertEq(skillAdapter.controllerOf(address(plain), 1), address(0));
        assertEq(skillAdapter.controllerOf(address(skills), skillId), alice);
        assertEq(skillAdapter.anchorHint(address(skills), skillId), SKILL_PKG);
        assertTrue(skillAdapter.backed(address(skills), skillId));
        assertFalse(skillAdapter.backed(address(skills), skillId + 1));
    }

    function test_skill_hint_follows_package_updates() public {
        bytes32 id = _registerSkill();
        bytes32 newPkg = keccak256("skill-package-v2");
        vm.prank(alice); // alice is the update authority
        skills.updateSkill(skillId, keccak256("skill-md-v2"), newPkg);
        assertEq(reg.anchorHintOf(id), newPkg);
        // a descriptor whose provenance still names the old package is a resolver-side mismatch:
        // the chain keeps the record, the hint tells the resolver to demote it
        assertTrue(reg.backed(id));
    }

    // ----------------------------------------------------------------- task

    function test_task_adapter_backed_requires_live_tender() public {
        bytes32 id = _registerTask();
        assertTrue(reg.backed(id));
        assertEq(reg.anchorHintOf(id), TASK_HASH);
        assertEq(reg.controllerOf(id), bob);

        // settleBy passes -> no longer backed, still registered and controllable
        vm.warp(block.timestamp + 91 days);
        assertFalse(reg.backed(id));
        assertEq(reg.controllerOf(id), bob);
    }

    function test_task_adapter_backed_false_when_cancelled() public {
        bytes32 id = _registerTask();
        vm.prank(bob); // bob is the update authority
        tasks.cancelTask(taskId);
        assertFalse(reg.backed(id));
        assertTrue(taskAdapter.exists(address(tasks), taskId));
    }

    function test_task_adapter_backed_false_without_escrow() public {
        ITaskTender.TenderTerms memory terms = ITaskTender.TenderTerms({
            asset: address(0),
            rewardPerCompletion: 1,
            maxCompletions: 0,
            submitBy: 0,
            settleBy: 0,
            epochLength: 0,
            maxCompletionsPerEpoch: 0,
            judgmentWindow: 1 days
        });
        uint256 empty = tasks.mintTask(bob, bob, judge, keccak256("md"), keccak256("pkg"), "ipfs://x", terms);
        assertTrue(taskAdapter.exists(address(tasks), empty));
        assertFalse(taskAdapter.backed(address(tasks), empty));
        vm.prank(bob);
        tasks.fundTask{value: 5}(empty, 5);
        assertTrue(taskAdapter.backed(address(tasks), empty));
    }

    function test_task_controller_is_the_token_owner_not_the_judge() public {
        assertEq(taskAdapter.controllerOf(address(tasks), taskId), bob);
        vm.prank(judge);
        vm.expectRevert(IARDOnchainRegistry.NotController.selector);
        reg.register(ARDKinds.TASK, address(tasks), taskId, DESC, "", "");
    }

    // ---------------------------------------------------------------- agent

    function test_agent_adapter_states() public {
        assertTrue(agentAdapter.exists(carol, 0));
        assertFalse(agentAdapter.exists(carol, 1));
        assertFalse(agentAdapter.exists(address(0), 0));
        assertEq(agentAdapter.controllerOf(carol, 0), carol);
        assertEq(agentAdapter.controllerOf(carol, 1), address(0));

        bytes32 id = _registerAgent();
        assertTrue(reg.backed(id)); // ACTIVE: bound and within the liveness window

        // liveness lapses -> STALE -> not backed
        vm.warp(block.timestamp + 31 days);
        assertFalse(reg.backed(id));
        vm.prank(carol);
        aid.heartbeat();
        assertTrue(reg.backed(id));

        // the 8004 agent moves away from carol -> STALE again
        vm.prank(carol);
        identity8004.transfer(agentId8004, mallory);
        assertFalse(reg.backed(id));

        // document digest is the hint
        vm.prank(carol);
        aid.setDocumentURI("https://carol.example/aid.json", keccak256("aid-doc"));
        assertEq(reg.anchorHintOf(id), keccak256("aid-doc"));

        // retired identity: never backed again, record still exists and is controllable
        vm.prank(carol);
        aid.retire(address(0));
        assertFalse(reg.backed(id));
        assertEq(reg.controllerOf(id), carol);
    }

    function test_agent_adapter_without_identity_registry_is_never_backed() public {
        AgentAdapter bare = new AgentAdapter(address(0));
        assertTrue(bare.exists(carol, 0));
        assertFalse(bare.backed(carol, 0));
        assertEq(bare.anchorHint(carol, 0), bytes32(0));
    }

    // ------------------------------------------------------------- registry

    function test_registry_adapter_needs_nonzero_discriminator_and_is_never_backed() public {
        assertFalse(registryAdapter.exists(operator, 0));
        assertTrue(registryAdapter.exists(operator, REGISTRY_DISC));
        assertEq(registryAdapter.controllerOf(operator, REGISTRY_DISC), operator);
        assertEq(registryAdapter.controllerOf(operator, 0), address(0));
        bytes32 id = _registerRegistry();
        assertFalse(reg.backed(id));
        assertEq(reg.anchorHintOf(id), bytes32(0));
        // a second endpoint of the same operator is a second record
        vm.prank(operator);
        bytes32 second = reg.register(ARDKinds.REGISTRY, operator, uint256(keccak256("https://other.example/")), DESC, "", "");
        assertTrue(second != id);
    }
}

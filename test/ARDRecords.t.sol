// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

import {ARDBase} from "./ARDBase.t.sol";
import {IARDOnchainRegistry} from "../assets/erc-8444/contracts/interfaces/IARDOnchainRegistry.sol";
import {ARDKinds} from "../assets/erc-8444/contracts/libraries/ARDKinds.sol";
import {SkillToken} from "./fixtures/skill-token/SkillToken.sol";

contract ARDRecordsTest is ARDBase {
    // ---------------------------------------------------------------- register

    function test_register_each_kind_and_record_id_is_chain_target_id() public {
        bytes32 s = _registerSkill();
        bytes32 t = _registerTask();
        bytes32 a = _registerAgent();
        bytes32 r = _registerRegistry();

        assertEq(s, keccak256(abi.encode(block.chainid, address(skills), skillId)));
        assertEq(t, keccak256(abi.encode(block.chainid, address(tasks), taskId)));
        assertEq(a, keccak256(abi.encode(block.chainid, carol, uint256(0))));
        assertEq(r, keccak256(abi.encode(block.chainid, operator, REGISTRY_DISC)));
        assertEq(reg.recordIdOf(address(skills), skillId), s);

        IARDOnchainRegistry.Record memory rec = reg.recordOf(s);
        assertEq(rec.kind, ARDKinds.SKILL);
        assertEq(rec.target, address(skills));
        assertEq(rec.id, skillId);
        assertEq(rec.descriptorHash, DESC);
        assertEq(rec.descriptorURI, "ipfs://desc-skill");
        assertEq(rec.urn, "urn:air:alice.example:skills:one");
        assertEq(uint8(rec.status), uint8(IARDOnchainRegistry.Status.Active));
        assertEq(rec.registrant, alice);
        assertEq(rec.updatedAt, uint64(block.timestamp));
    }

    function test_register_emits_Registered() public {
        vm.expectEmit(true, true, true, true);
        emit IARDOnchainRegistry.Registered(
            reg.recordIdOf(address(skills), skillId),
            ARDKinds.SKILL,
            address(skills),
            skillId,
            alice,
            DESC,
            "ipfs://desc-skill",
            "urn:air:alice.example:skills:one"
        );
        _registerSkill();
    }

    function test_register_rejects_unknown_kind() public {
        bytes32 unknown = ARDKinds.kindId("market");
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.UnknownKind.selector, unknown));
        reg.register(unknown, address(skills), skillId, DESC, "", "");
    }

    function test_register_rejects_empty_descriptor() public {
        vm.prank(alice);
        vm.expectRevert(IARDOnchainRegistry.EmptyDescriptor.selector);
        reg.register(ARDKinds.SKILL, address(skills), skillId, bytes32(0), "", "");
    }

    function test_register_rejects_missing_anchor() public {
        vm.prank(alice);
        vm.expectRevert(IARDOnchainRegistry.AnchorMissing.selector);
        reg.register(ARDKinds.SKILL, address(skills), 999, DESC, "", "");
    }

    function test_register_rejects_non_controller() public {
        vm.prank(mallory);
        vm.expectRevert(IARDOnchainRegistry.NotController.selector);
        reg.register(ARDKinds.SKILL, address(skills), skillId, DESC, "", "");
    }

    function test_register_rejects_wrong_kind_for_anchor() public {
        // a skill token offered as a task: the task adapter does not recognise the skill contract
        vm.prank(alice);
        vm.expectRevert(IARDOnchainRegistry.AnchorMissing.selector);
        reg.register(ARDKinds.TASK, address(skills), skillId, DESC, "", "");
    }

    function test_register_is_one_record_per_anchor_even_under_another_kind() public {
        bytes32 a = _registerAgent();
        // carol's address is also a valid registry operator anchor only with a nonzero id; with id 0
        // the registry adapter says the anchor does not exist, and the agent record is already taken.
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.AlreadyRegistered.selector, a));
        reg.register(ARDKinds.AGENT, carol, 0, DESC, "", "");
        vm.prank(carol);
        vm.expectRevert(IARDOnchainRegistry.AnchorMissing.selector);
        reg.register(ARDKinds.REGISTRY, carol, 0, DESC, "", "");
    }

    function test_agent_and_registry_anchors_of_one_address_do_not_collide() public {
        vm.prank(operator);
        bytes32 a = reg.register(ARDKinds.AGENT, operator, 0, DESC, "", "");
        bytes32 r = _registerRegistry();
        assertTrue(a != r);
        assertEq(reg.recordOf(a).kind, ARDKinds.AGENT);
        assertEq(reg.recordOf(r).kind, ARDKinds.REGISTRY);
    }

    function test_only_an_address_registers_itself_as_agent() public {
        vm.prank(mallory);
        vm.expectRevert(IARDOnchainRegistry.NotController.selector);
        reg.register(ARDKinds.AGENT, carol, 0, DESC, "", "");
    }

    function test_agent_record_needs_no_identity_registration() public {
        // any address is a dormant identity: mallory may register herself, she is just not backed
        vm.prank(mallory);
        bytes32 id = reg.register(ARDKinds.AGENT, mallory, 0, DESC, "", "");
        assertFalse(reg.backed(id));
        bytes32 carolId = _registerAgent();
        assertTrue(reg.backed(carolId));
    }

    // ---------------------------------------------------------- update + status

    function test_update_descriptor_by_controller_only() public {
        bytes32 id = _registerSkill();
        vm.prank(mallory);
        vm.expectRevert(IARDOnchainRegistry.NotController.selector);
        reg.updateDescriptor(id, keccak256("v2"), "", "");

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit IARDOnchainRegistry.DescriptorUpdated(id, keccak256("v2"), "ipfs://v2", "urn:air:alice.example:skills:two");
        reg.updateDescriptor(id, keccak256("v2"), "ipfs://v2", "urn:air:alice.example:skills:two");
        IARDOnchainRegistry.Record memory rec = reg.recordOf(id);
        assertEq(rec.descriptorHash, keccak256("v2"));
        assertEq(rec.urn, "urn:air:alice.example:skills:two");
    }

    function test_update_descriptor_rejects_zero_hash_and_unknown_record() public {
        bytes32 id = _registerSkill();
        vm.prank(alice);
        vm.expectRevert(IARDOnchainRegistry.EmptyDescriptor.selector);
        reg.updateDescriptor(id, bytes32(0), "", "");
        bytes32 ghost = keccak256("ghost");
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.UnknownRecord.selector, ghost));
        reg.updateDescriptor(ghost, DESC, "", "");
    }

    function test_status_transitions() public {
        bytes32 id = _registerSkill();
        IARDOnchainRegistry.Status A = IARDOnchainRegistry.Status.Active;
        IARDOnchainRegistry.Status S = IARDOnchainRegistry.Status.Suspended;
        IARDOnchainRegistry.Status R = IARDOnchainRegistry.Status.Retired;
        IARDOnchainRegistry.Status N = IARDOnchainRegistry.Status.None;

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.InvalidTransition.selector, A, A));
        reg.setStatus(id, A);
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.InvalidTransition.selector, A, N));
        reg.setStatus(id, N);
        reg.setStatus(id, S);
        assertEq(uint8(reg.recordOf(id).status), uint8(S));
        reg.setStatus(id, A);
        reg.setStatus(id, S);
        reg.setStatus(id, R);
        assertEq(uint8(reg.recordOf(id).status), uint8(R));
        // terminal
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.RecordRetired.selector, id));
        reg.setStatus(id, A);
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.RecordRetired.selector, id));
        reg.updateDescriptor(id, keccak256("v2"), "", "");
        vm.stopPrank();
        // and the anchor cannot be registered again
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.AlreadyRegistered.selector, id));
        reg.register(ARDKinds.SKILL, address(skills), skillId, DESC, "", "");
    }

    // ------------------------------------------------------ transferability

    function test_controller_follows_the_token_and_is_never_cached() public {
        bytes32 id = _registerSkill();
        assertEq(reg.controllerOf(id), alice);

        vm.prank(alice);
        skills.transferFrom(alice, mallory, skillId);
        assertEq(reg.controllerOf(id), mallory);

        // the former owner has lost authority; the new owner has it, with the registrant unchanged
        vm.prank(alice);
        vm.expectRevert(IARDOnchainRegistry.NotController.selector);
        reg.updateDescriptor(id, keccak256("v2"), "", "");
        vm.prank(mallory);
        reg.updateDescriptor(id, keccak256("v2"), "", "urn:air:mallory.example:skills:bought");
        assertEq(reg.recordOf(id).registrant, alice);
    }

    function test_burned_anchor_reports_zero_controller_and_blocks_mutation() public {
        bytes32 id = _registerSkill();
        // the reference skill token has no burn; simulate a burned token by making ownerOf revert
        vm.mockCallRevert(
            address(skills), abi.encodeWithSelector(skills.ownerOf.selector, skillId), "SkillToken: nonexistent token"
        );
        assertEq(reg.controllerOf(id), address(0));
        assertFalse(reg.backed(id));
        assertEq(reg.anchorHintOf(id), bytes32(0));
        vm.prank(alice);
        vm.expectRevert(IARDOnchainRegistry.NotController.selector);
        reg.setStatus(id, IARDOnchainRegistry.Status.Retired);
    }

    // ------------------------------------------------------------------ kinds

    function test_kind_registration_is_owner_only_write_once_and_checked() public {
        bytes32 k = ARDKinds.kindId("policy");
        vm.prank(mallory);
        vm.expectRevert(IARDOnchainRegistry.NotOwner.selector);
        reg.registerKind(k, address(registryAdapter), "");
        vm.expectRevert(IARDOnchainRegistry.ZeroAddress.selector);
        reg.registerKind(k, address(0), "");
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.AdapterKindMismatch.selector, k, ARDKinds.REGISTRY));
        reg.registerKind(k, address(registryAdapter), "");
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.KindExists.selector, ARDKinds.SKILL));
        reg.registerKind(ARDKinds.SKILL, address(skillAdapter), "");
        assertEq(reg.kindAdapter(ARDKinds.SKILL), address(skillAdapter));
        assertEq(reg.kindAdapter(k), address(0));
    }

    function test_ownership_transfer_and_renounce_freezes_kind_table() public {
        reg.transferOwnership(mallory);
        assertEq(reg.owner(), mallory);
        vm.expectRevert(IARDOnchainRegistry.NotOwner.selector);
        reg.transferOwnership(address(this));
        vm.prank(mallory);
        reg.transferOwnership(address(0));
        assertEq(reg.owner(), address(0));
        vm.prank(mallory);
        vm.expectRevert(IARDOnchainRegistry.NotOwner.selector);
        reg.registerKind(ARDKinds.kindId("policy"), address(registryAdapter), "");
    }

    // ----------------------------------------------------------------- views

    function test_views_revert_on_unknown_record() public {
        bytes32 ghost = keccak256("ghost");
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.UnknownRecord.selector, ghost));
        reg.controllerOf(ghost);
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.UnknownRecord.selector, ghost));
        reg.backed(ghost);
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.UnknownRecord.selector, ghost));
        reg.anchorHintOf(ghost);
        assertEq(uint8(reg.recordOf(ghost).status), uint8(IARDOnchainRegistry.Status.None));
    }

    function test_supports_interface() public view {
        assertTrue(reg.supportsInterface(0x01ffc9a7));
        assertTrue(reg.supportsInterface(type(IARDOnchainRegistry).interfaceId));
        assertFalse(reg.supportsInterface(0xffffffff));
    }
}

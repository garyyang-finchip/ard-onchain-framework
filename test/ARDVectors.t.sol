// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {ARDOnchainRegistry} from "../assets/erc-8444/contracts/ARDOnchainRegistry.sol";
import {IARDOnchainRegistry} from "../assets/erc-8444/contracts/interfaces/IARDOnchainRegistry.sol";
import {IARDKindAdapter} from "../assets/erc-8444/contracts/interfaces/IARDKindAdapter.sol";
import {ISkillTokenKernel} from "../assets/erc-8444/contracts/adapters/interfaces/ISkillTokenKernel.sol";
import {ITaskTenderKernel} from "../assets/erc-8444/contracts/adapters/interfaces/ITaskTenderKernel.sol";
import {ARDKinds} from "../assets/erc-8444/contracts/libraries/ARDKinds.sol";

/// @dev Cross-language vectors: every value produced by tools/vectors.js (ethers v6 + RFC 8785) is
///      re-derived here with solc. A drift on either side fails these tests.
contract ARDVectorsTest is Test {
    using stdJson for string;

    string internal constant DIR = "assets/erc-8444/vectors/";

    function _load(string memory file) internal view returns (string memory) {
        return vm.readFile(string.concat(vm.projectRoot(), "/", DIR, file));
    }

    function test_kind_id_vectors() public view {
        string memory j = _load("kind-ids.json");
        assertEq(j.readBytes32(".kinds.skill"), ARDKinds.SKILL);
        assertEq(j.readBytes32(".kinds.task"), ARDKinds.TASK);
        assertEq(j.readBytes32(".kinds.agent"), ARDKinds.AGENT);
        assertEq(j.readBytes32(".kinds.registry"), ARDKinds.REGISTRY);
        assertEq(j.readBytes32(".reserved.assertion"), ARDKinds.kindId("assertion"));
        assertEq(j.readBytes32(".reserved.policy"), ARDKinds.kindId("policy"));
        assertEq(j.readBytes32(".reserved.market"), ARDKinds.kindId("market"));
    }

    function test_record_id_vectors() public {
        string memory j = _load("record-id.json");
        ARDOnchainRegistry reg = new ARDOnchainRegistry();
        for (uint256 i = 0; i < 5; i++) {
            string memory p = string.concat(".cases[", vm.toString(i), "]");
            uint256 chainId = j.readUint(string.concat(p, ".chainId"));
            address target = j.readAddress(string.concat(p, ".target"));
            uint256 id = vm.parseUint(j.readString(string.concat(p, ".id")));
            bytes32 expected = j.readBytes32(string.concat(p, ".recordId"));
            assertEq(keccak256(abi.encode(chainId, target, id)), expected, "manual");
            vm.chainId(chainId);
            assertEq(reg.recordIdOf(target, id), expected, "registry view");
        }
    }

    function test_domain_claim_vector_signature_is_accepted_by_the_registry() public {
        string memory j = _load("domain-claim.json");
        uint256 chainId = j.readUint(".chainId");
        address at = j.readAddress(".verifyingContract");
        string memory domain = j.readString(".claim.domain");
        address controller = j.readAddress(".claim.controller");
        uint256 nonce = j.readUint(".claim.nonce");
        uint256 deadline = j.readUint(".claim.deadline");
        bytes memory signature = j.readBytes(".signature");

        vm.chainId(chainId);
        vm.warp(deadline - 1);
        deployCodeTo("ARDOnchainRegistry.sol:ARDOnchainRegistry", at);
        ARDOnchainRegistry reg = ARDOnchainRegistry(at);

        assertEq(reg.DOMAIN_SEPARATOR(), j.readBytes32(".domainSeparator"), "domain separator");
        assertEq(reg.DOMAIN_CLAIM_TYPEHASH(), j.readBytes32(".typeHash"), "type hash");
        bytes32 structHash =
            keccak256(abi.encode(reg.DOMAIN_CLAIM_TYPEHASH(), keccak256(bytes(domain)), controller, nonce, deadline));
        assertEq(structHash, j.readBytes32(".structHash"), "struct hash");
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", reg.DOMAIN_SEPARATOR(), structHash));
        assertEq(digest, j.readBytes32(".digest"), "digest");
        assertEq(keccak256(bytes(domain)), j.readBytes32(".domainHash"), "domain hash");
        assertEq(vm.addr(j.readUint(".privateKey")), controller, "controller derives from the vector key");

        reg.claimDomainBySig(domain, controller, nonce, deadline, signature);
        assertTrue(reg.hasClaim(keccak256(bytes(domain)), controller));
        assertEq(reg.nonces(controller), 1);
    }

    function test_descriptor_hash_vectors_are_sha256_of_the_canonical_bytes() public view {
        string memory j = _load("descriptor-hash.json");
        for (uint256 i = 0; i < 5; i++) {
            string memory p = string.concat(".cases[", vm.toString(i), "]");
            string memory canonical = j.readString(string.concat(p, ".canonical"));
            bytes32 expected = j.readBytes32(string.concat(p, ".sha256"));
            assertEq(sha256(bytes(canonical)), expected, p);
        }
        // the gateway alias entry (case 4) hashes to the authored skill entry (case 0)
        assertEq(j.readBytes32(".cases[4].sha256"), j.readBytes32(".cases[0].sha256"), "alias == authored");
    }

    function test_interface_id_vectors() public view {
        string memory j = _load("interface-ids.json");
        assertEq(bytes4(j.readBytes(".ids.IARDOnchainRegistry")), type(IARDOnchainRegistry).interfaceId);
        assertEq(bytes4(j.readBytes(".ids.IARDKindAdapter")), type(IARDKindAdapter).interfaceId);
        assertEq(bytes4(j.readBytes(".ids.ISkillTokenKernel")), type(ISkillTokenKernel).interfaceId);
        assertEq(bytes4(j.readBytes(".ids.ITaskTenderKernel")), type(ITaskTenderKernel).interfaceId);
    }
}

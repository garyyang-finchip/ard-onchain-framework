// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

import {ARDBase} from "./ARDBase.t.sol";
import {IARDOnchainRegistry} from "../assets/erc-8444/contracts/interfaces/IARDOnchainRegistry.sol";
import {MockERC1271Wallet} from "./fixtures/aid/mocks/MockIdentityRegistry8004.sol";

contract ARDClaimsTest is ARDBase {
    string internal constant DOMAIN = "alice.example";
    bytes32 internal domainHash = keccak256(bytes(DOMAIN));

    // ------------------------------------------------------------ direct claims

    function test_claim_release_and_views() public {
        assertFalse(reg.hasClaim(domainHash, alice));
        assertEq(reg.domainHashOf(DOMAIN), domainHash);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit IARDOnchainRegistry.DomainClaimed(domainHash, alice, DOMAIN);
        reg.claimDomain(DOMAIN);
        assertTrue(reg.hasClaim(domainHash, alice));
        assertEq(reg.claimsOf(domainHash).length, 1);

        vm.prank(alice);
        vm.expectRevert(IARDOnchainRegistry.AlreadyClaimed.selector);
        reg.claimDomain(DOMAIN);

        // the registry records, it does not adjudicate: a second claimant is simply listed
        vm.prank(mallory);
        reg.claimDomain(DOMAIN);
        assertEq(reg.claimsOf(domainHash).length, 2);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit IARDOnchainRegistry.DomainReleased(domainHash, alice);
        reg.releaseDomain(DOMAIN);
        assertFalse(reg.hasClaim(domainHash, alice));
        address[] memory left = reg.claimsOf(domainHash);
        assertEq(left.length, 1);
        assertEq(left[0], mallory);

        vm.prank(alice);
        vm.expectRevert(IARDOnchainRegistry.NotClaimed.selector);
        reg.releaseDomain(DOMAIN);
    }

    function test_release_keeps_index_consistent_for_middle_element() public {
        address a = makeAddr("a");
        address b = makeAddr("b");
        address c = makeAddr("c");
        vm.prank(a);
        reg.claimDomain(DOMAIN);
        vm.prank(b);
        reg.claimDomain(DOMAIN);
        vm.prank(c);
        reg.claimDomain(DOMAIN);
        vm.prank(a);
        reg.releaseDomain(DOMAIN); // c moves into a's slot
        address[] memory list = reg.claimsOf(domainHash);
        assertEq(list.length, 2);
        assertEq(list[0], c);
        assertEq(list[1], b);
        assertTrue(reg.hasClaim(domainHash, c));
        vm.prank(c);
        reg.releaseDomain(DOMAIN);
        assertEq(reg.claimsOf(domainHash).length, 1);
        assertEq(reg.claimsOf(domainHash)[0], b);
        assertFalse(reg.hasClaim(domainHash, c));
    }

    function test_claim_cap_per_domain() public {
        for (uint256 i = 0; i < reg.MAX_CLAIMS_PER_DOMAIN(); i++) {
            vm.prank(address(uint160(0x1000 + i)));
            reg.claimDomain(DOMAIN);
        }
        vm.prank(mallory);
        vm.expectRevert(IARDOnchainRegistry.TooManyClaims.selector);
        reg.claimDomain(DOMAIN);
    }

    function test_domain_validation() public {
        string[8] memory bad = [
            "",
            "Alice.example",
            ".alice.example",
            "alice.example.",
            "alice..example",
            "alice_example",
            "alice example",
            "al\xc3\xafce.example"
        ];
        for (uint256 i = 0; i < bad.length; i++) {
            vm.prank(alice);
            vm.expectRevert(IARDOnchainRegistry.InvalidDomain.selector);
            reg.claimDomain(bad[i]);
        }
        bytes memory tooLong = new bytes(254);
        for (uint256 i = 0; i < 254; i++) {
            tooLong[i] = "a";
        }
        vm.prank(alice);
        vm.expectRevert(IARDOnchainRegistry.InvalidDomain.selector);
        reg.claimDomain(string(tooLong));

        // acceptable forms
        vm.startPrank(alice);
        reg.claimDomain("xn--80ak6aa92e.com");
        reg.claimDomain("a-b.c0.example");
        reg.claimDomain("localhost");
        vm.stopPrank();
    }

    // ------------------------------------------------------------ signed claims

    function test_claim_by_sig_eoa_then_nonce_advances_and_replay_fails() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(aliceKey, DOMAIN, alice, 0, deadline);

        vm.prank(mallory); // relayed by anyone
        reg.claimDomainBySig(DOMAIN, alice, 0, deadline, sig);
        assertTrue(reg.hasClaim(domainHash, alice));
        assertEq(reg.nonces(alice), 1);

        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.BadNonce.selector, 1, 0));
        reg.claimDomainBySig(DOMAIN, alice, 0, deadline, sig);
    }

    function test_claim_by_sig_rejects_expired_wrong_signer_wrong_domain() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(aliceKey, DOMAIN, alice, 0, deadline);

        vm.warp(deadline + 1);
        vm.expectRevert(abi.encodeWithSelector(IARDOnchainRegistry.SignatureExpired.selector, deadline));
        reg.claimDomainBySig(DOMAIN, alice, 0, deadline, sig);
        vm.warp(deadline - 1);

        // signature over alice.example presented for another domain
        vm.expectRevert(IARDOnchainRegistry.InvalidSignature.selector);
        reg.claimDomainBySig("evil.example", alice, 0, deadline, sig);

        // signed by someone else
        bytes memory other = _signClaim(0xB0B, DOMAIN, alice, 0, deadline);
        vm.expectRevert(IARDOnchainRegistry.InvalidSignature.selector);
        reg.claimDomainBySig(DOMAIN, alice, 0, deadline, other);

        // malformed length
        vm.expectRevert(IARDOnchainRegistry.InvalidSignature.selector);
        reg.claimDomainBySig(DOMAIN, alice, 0, deadline, hex"1234");
    }

    function test_claim_by_sig_contract_account_via_erc1271() public {
        MockERC1271Wallet wallet = new MockERC1271Wallet(alice);
        uint256 deadline = block.timestamp + 1 hours;
        // the wallet accepts signatures by its owner key; the claim is made for the wallet address
        bytes memory sig = _signClaim(aliceKey, DOMAIN, address(wallet), 0, deadline);
        reg.claimDomainBySig(DOMAIN, address(wallet), 0, deadline, sig);
        assertTrue(reg.hasClaim(domainHash, address(wallet)));
        assertFalse(reg.hasClaim(domainHash, alice));

        // a signature by a stranger is refused by the wallet
        bytes memory bad = _signClaim(0xB0B, DOMAIN, address(wallet), 1, deadline);
        vm.expectRevert(IARDOnchainRegistry.InvalidSignature.selector);
        reg.claimDomainBySig(DOMAIN, address(wallet), 1, deadline, bad);
    }

    function test_domain_separator_binds_chain_and_contract() public view {
        bytes32 expected = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("ARD Onchain Registry"),
                keccak256("1"),
                block.chainid,
                address(reg)
            )
        );
        assertEq(reg.DOMAIN_SEPARATOR(), expected);
        assertEq(
            reg.DOMAIN_CLAIM_TYPEHASH(),
            keccak256("DomainClaim(string domain,address controller,uint256 nonce,uint256 deadline)")
        );
    }
}

// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

/// @title ARD Onchain — kind adapter interface (draft, design round 2)
/// @notice One adapter per kind. The kernel asks the adapter whether an anchor exists,
///         who controls it, and whether it is backed (L2). The kernel stores none of this.
interface IARDKindAdapter {
    /// @return the kind id this adapter serves, keccak256("ard-onchain.kind.<name>")
    function kind() external view returns (bytes32);

    /// @dev skill: ownerOf(id) does not revert. task: tender exists.
    ///      agent: always true, id must be 0 (any address is a dormant identity). registry: always true.
    function exists(address target, uint256 id) external view returns (bool);

    /// @dev skill: ownerOf(id). task: tender creator / owner. agent: target. registry: target.
    function controllerOf(address target, uint256 id) external view returns (address);

    /// @dev L2 test. skill: package hash set. task: open with escrow balance > 0.
    ///      agent: active identity bound to an ERC-8004 registration. registry: always false onchain.
    function backed(address target, uint256 id) external view returns (bool);

    /// @dev Optional cross-check value, e.g. the skill package hash for provenance; 0 if none.
    function anchorHint(address target, uint256 id) external view returns (bytes32);
}

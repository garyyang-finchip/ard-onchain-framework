// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

/// @title ARD Onchain Registry — kernel interface (draft, design round 2)
/// @notice Records bind an ARD entry (descriptor) to an onchain anchor and its controller.
///         Authority belongs to addresses; domains are endorsements collected via claims.
///         Controllers are never stored: they are derived from the kind adapter at call time.
interface IARDOnchainRegistry {
    enum Status { None, Active, Suspended, Retired }

    struct Record {
        bytes32 kind;            // keccak256("ard-onchain.kind.<name>")
        address target;          // token contract, subject address, or registry/operator address
        uint256 id;              // token id; 0 for address anchors
        bytes32 descriptorHash;  // SHA-256 over the JCS (RFC 8785) form of the authored descriptor
        string  descriptorURI;   // optional location of the authored descriptor (not a trust source)
        string  urn;             // canonical URN claimed by the controller; may be empty
        Status  status;
        address registrant;      // msg.sender at registration (informational)
        uint64  updatedAt;
    }

    event Registered(
        bytes32 indexed recordId,
        bytes32 indexed kind,
        address indexed target,
        uint256 id,
        address registrant,
        bytes32 descriptorHash,
        string descriptorURI,
        string urn
    );
    event DescriptorUpdated(bytes32 indexed recordId, bytes32 descriptorHash, string descriptorURI, string urn);
    event StatusChanged(bytes32 indexed recordId, Status status);
    event DomainClaimed(bytes32 indexed domainHash, address indexed controller, string domain);
    event DomainReleased(bytes32 indexed domainHash, address indexed controller);
    event KindRegistered(bytes32 indexed kind, address adapter, string uri);

    // ---- records -------------------------------------------------------

    /// @dev Reverts unless the kind has an adapter, adapter.exists(target, id) is true,
    ///      and msg.sender == adapter.controllerOf(target, id). recordId = keccak256(abi.encode(chainid, target, id)).
    function register(
        bytes32 kind,
        address target,
        uint256 id,
        bytes32 descriptorHash,
        string calldata descriptorURI,
        string calldata urn
    ) external returns (bytes32 recordId);

    /// @dev Current controller only.
    function updateDescriptor(bytes32 recordId, bytes32 descriptorHash, string calldata descriptorURI, string calldata urn) external;

    /// @dev Current controller only. Retired is terminal.
    function setStatus(bytes32 recordId, Status status) external;

    // ---- domain claims -------------------------------------------------

    /// @dev Domain is normalized (lowercase, no trailing dot, punycode) before hashing.
    function claimDomain(string calldata domain) external;

    /// @dev EIP-712 typed claim signed by `controller`; ERC-1271 for contract accounts.
    function claimDomainBySig(
        string calldata domain,
        address controller,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external;

    function releaseDomain(string calldata domain) external;

    // ---- views ---------------------------------------------------------

    function recordIdOf(address target, uint256 id) external view returns (bytes32);
    function recordOf(bytes32 recordId) external view returns (Record memory);
    /// @dev Forwarded to the kind adapter; never cached.
    function controllerOf(bytes32 recordId) external view returns (address);
    /// @dev Forwarded to the kind adapter (L2 test).
    function backed(bytes32 recordId) external view returns (bool);
    function claimsOf(bytes32 domainHash) external view returns (address[] memory);
    function hasClaim(bytes32 domainHash, address controller) external view returns (bool);
    function kindAdapter(bytes32 kind) external view returns (address);
    function nonces(address controller) external view returns (uint256);

    /// @dev ERC-165.
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

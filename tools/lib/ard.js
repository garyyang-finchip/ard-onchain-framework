// Resolver-side profile helpers shared by the vector generator and the gateway.
// Everything here mirrors a normative statement of the ERC text; keep the two in step.
'use strict';

const canonicalize = require('canonicalize');
const { ethers } = require('ethers');

/** Members set by whoever publishes the entry (the controller's own manifest or a gateway alias): the JSON-LD envelope, the identifier and the ARD trust manifest.
 *  They are never part of the hashed descriptor: identification is committed by the record's `urn`
 *  and by the controller address, not by the content hash. */
const PUBLICATION_MEMBERS = ['@context', '@id', 'identifier', 'trustManifest'];

/** Members added by resolvers. They are never part of the hashed descriptor. */
const RESOLVED_MEMBERS = [
  'value:anchor',
  'value:adopted',
  'value:binding',
  'value:level',
  'value:status',
  'value:aliases',
  'value:canonical',
  'value:registry',
  'value:descriptorHash',
  'value:stale',
  'value:claimedUrn',
];

const KIND_NAMES = ['skill', 'task', 'agent', 'registry'];

function kindId(name) {
  return ethers.keccak256(ethers.toUtf8Bytes(`ard-onchain.kind.${name}`));
}

/** The hashed descriptor: content members only (no publication members, no resolved members). */
function authoredDescriptor(entry) {
  const out = {};
  for (const [k, v] of Object.entries(entry)) {
    if (!RESOLVED_MEMBERS.includes(k) && !PUBLICATION_MEMBERS.includes(k)) out[k] = v;
  }
  return out;
}

/** RFC 8785 canonical form of the authored descriptor. */
function canonicalDescriptor(entry) {
  return canonicalize(authoredDescriptor(entry));
}

/** SHA-256 over the canonical form; returns { hex: '0x…', digest: 'sha256:…' }. */
function descriptorHash(entry) {
  const canonical = canonicalDescriptor(entry);
  const hex = ethers.sha256(ethers.toUtf8Bytes(canonical));
  return { canonical, hex, digest: `sha256:${hex.slice(2)}` };
}

function recordId(chainId, target, id) {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  return ethers.keccak256(coder.encode(['uint256', 'address', 'uint256'], [chainId, target, id]));
}

function domainHash(domain) {
  return ethers.keccak256(ethers.toUtf8Bytes(domain));
}

/** CAIP identifier of an anchor. Token kinds -> CAIP-19 erc721; address kinds -> CAIP-10. */
function anchorCaip(kind, chainId, target, id) {
  const t = target.toLowerCase();
  if (kind === 'skill' || kind === 'task') return `eip155:${chainId}/erc721:${t}/${id}`;
  if (kind === 'agent') return `eip155:${chainId}:${t}`;
  if (kind === 'registry') return `eip155:${chainId}:${t}#${BigInt(id).toString(16)}`;
  throw new Error(`unknown kind ${kind}`);
}

/** Anchor encoding for gateway aliases: lowercase, ':' '/' '#' -> '-'. */
function anchorEncoding(caip) {
  return caip.toLowerCase().replace(/[:/#]/g, '-');
}

function gatewayAlias(gatewayDomain, caip) {
  return `urn:air:${gatewayDomain}:onchain:${anchorEncoding(caip)}`;
}

/** Publisher domain of an ARD URN (urn:air:<publisher>:…), or null. */
function urnPublisher(urn) {
  const m = /^urn:air:([^:]+):/.exec(urn || '');
  return m ? m[1].toLowerCase() : null;
}

const EIP712_DOMAIN = (chainId, verifyingContract) => ({
  name: 'ARD Onchain Registry',
  version: '1',
  chainId,
  verifyingContract,
});

const DOMAIN_CLAIM_TYPES = {
  DomainClaim: [
    { name: 'domain', type: 'string' },
    { name: 'controller', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

function claimDigest(chainId, verifyingContract, claim) {
  return ethers.TypedDataEncoder.hash(EIP712_DOMAIN(chainId, verifyingContract), DOMAIN_CLAIM_TYPES, claim);
}

/** Binding state of (domain, controller) from onchain claims and the domain's manifest. */
function bindingState({ claimants, manifest, controller }) {
  const c = controller.toLowerCase();
  const claimed = claimants.map((a) => a.toLowerCase());
  if (!claimed.includes(c)) return claimed.length ? 'unbound' : 'unbound';
  const acknowledged = new Set();
  if (manifest) {
    for (const a of manifest['value:controllers'] || []) acknowledged.add(didToAddress(a));
    for (const e of manifest.entries || []) {
      if (e['value:controller']) acknowledged.add(didToAddress(e['value:controller']));
    }
  }
  if (acknowledged.has(c)) return 'verified';
  return claimed.length > 1 ? 'contested' : 'claimed';
}

function didToAddress(s) {
  if (!s) return null;
  const m = /^(?:did:pkh:)?eip155:\d+:(0x[0-9a-fA-F]{40})$/.exec(s);
  return m ? m[1].toLowerCase() : String(s).toLowerCase();
}

module.exports = {
  PUBLICATION_MEMBERS,
  RESOLVED_MEMBERS,
  KIND_NAMES,
  kindId,
  authoredDescriptor,
  canonicalDescriptor,
  descriptorHash,
  recordId,
  domainHash,
  anchorCaip,
  anchorEncoding,
  gatewayAlias,
  urnPublisher,
  EIP712_DOMAIN,
  DOMAIN_CLAIM_TYPES,
  claimDigest,
  bindingState,
  didToAddress,
};

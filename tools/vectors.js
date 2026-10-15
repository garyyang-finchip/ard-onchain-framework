#!/usr/bin/env node
// Regenerates assets/erc-8444/vectors/*.json. Every value here is re-derived in Solidity by
// test/ARDVectors.t.sol, so the ethers/JS side and the solc side must agree byte for byte.
'use strict';

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const ard = require('./lib/ard');

const ROOT = path.resolve(__dirname, '..');
const VEC = path.join(ROOT, 'assets', 'erc-8444', 'vectors');
const EX = path.join(ROOT, 'assets', 'erc-8444', 'examples');
fs.mkdirSync(VEC, { recursive: true });

function write(name, obj) {
  fs.writeFileSync(path.join(VEC, name), JSON.stringify(obj, null, 2) + '\n');
  console.log('wrote', name);
}

// 1. kind ids ------------------------------------------------------------------------------
write('kind-ids.json', {
  description: 'kindId = keccak256("ard-onchain.kind.<name>"). Reserved names are listed but not defined.',
  kinds: Object.fromEntries(ard.KIND_NAMES.map((n) => [n, ard.kindId(n)])),
  reserved: Object.fromEntries(['assertion', 'policy', 'market'].map((n) => [n, ard.kindId(n)])),
});

// 2. record ids ----------------------------------------------------------------------------
const recordCases = [
  { chainId: 1, target: '0x1111111111111111111111111111111111111111', id: '42' },
  { chainId: 8453, target: '0x1111111111111111111111111111111111111111', id: '42' },
  { chainId: 11155111, target: '0xA62059A498E40C4Ae4aF926E2B00C1Ff122bDdb7', id: '8' },
  { chainId: 11155111, target: '0x2222222222222222222222222222222222222222', id: '0' },
  {
    chainId: 11155111,
    target: '0x6666666666666666666666666666666666666666',
    id: BigInt(ethers.keccak256(ethers.toUtf8Bytes('https://registry.finchip.ai/api/v1/'))).toString(),
  },
];
write('record-id.json', {
  description: 'recordId = keccak256(abi.encode(chainId, target, id)); the same anchor on another chain is another record.',
  cases: recordCases.map((c) => ({ ...c, recordId: ard.recordId(c.chainId, c.target, c.id) })),
});

// 3. domain claim digest + signature --------------------------------------------------------
const chainId = 11155111;
const verifyingContract = '0x1111111111111111111111111111111111111111';
const signer = new ethers.Wallet('0x00000000000000000000000000000000000000000000000000000000000a11ce');
const claim = { domain: 'alice.example', controller: signer.address, nonce: 0, deadline: 1800000000 };
const domainSeparator = ethers.TypedDataEncoder.hashDomain(ard.EIP712_DOMAIN(chainId, verifyingContract));
const structHash = ethers.TypedDataEncoder.hashStruct('DomainClaim', ard.DOMAIN_CLAIM_TYPES, claim);
const digest = ard.claimDigest(chainId, verifyingContract, claim);
(async () => {
  const signature = await signer.signTypedData(ard.EIP712_DOMAIN(chainId, verifyingContract), ard.DOMAIN_CLAIM_TYPES, claim);
  write('domain-claim.json', {
    description:
      'EIP-712 DomainClaim(string domain,address controller,uint256 nonce,uint256 deadline) under domain {name:"ARD Onchain Registry",version:"1"}. The Solidity test deploys the registry at verifyingContract on chainId and submits the signature through claimDomainBySig.',
    chainId,
    verifyingContract,
    privateKey: '0x00000000000000000000000000000000000000000000000000000000000a11ce',
    claim,
    domainHash: ard.domainHash(claim.domain),
    domainSeparator,
    typeHash: ethers.keccak256(
      ethers.toUtf8Bytes('DomainClaim(string domain,address controller,uint256 nonce,uint256 deadline)'),
    ),
    structHash,
    digest,
    signature,
  });

  // 4. descriptor hashes ------------------------------------------------------------------
  const files = ['skill.json', 'task.json', 'agent.json', 'registry.json'];
  const cases = files.map((f) => {
    const entry = JSON.parse(fs.readFileSync(path.join(EX, f), 'utf8'));
    const h = ard.descriptorHash(entry);
    return { file: `../examples/${f}`, identifier: entry.identifier, canonical: h.canonical, sha256: h.hex };
  });
  // the resolved entry of the gateway manifest hashes to the same value as the authored one it mirrors
  const manifest = JSON.parse(fs.readFileSync(path.join(EX, 'well-known-ard.json'), 'utf8'));
  const resolvedSkill = manifest.entries[1];
  const stripped = ard.descriptorHash(resolvedSkill);
  cases.push({
    file: '../examples/well-known-ard.json#entries[1]',
    identifier: resolvedSkill.identifier,
    note: 'a gateway alias entry: publication members (identifier, trustManifest) and resolved members are stripped before hashing, so this hashes to the same value as the authored skill.json it mirrors',
    canonical: stripped.canonical,
    sha256: stripped.hex,
  });
  write('descriptor-hash.json', {
    description:
      'descriptorHash = SHA-256(JCS(content members)), JCS per RFC 8785. Publication members (identifier, trustManifest) and resolved members are excluded. The canonical string is included so that a Solidity test can recompute sha256 over its UTF-8 bytes.',
    publicationMembers: ard.PUBLICATION_MEMBERS,
    resolvedMembers: ard.RESOLVED_MEMBERS,
    cases,
  });

  // 5. aliases ----------------------------------------------------------------------------
  const aliasCases = [
    { kind: 'skill', chainId: 8453, target: '0x1111111111111111111111111111111111111111', id: '42' },
    { kind: 'task', chainId: 11155111, target: '0xA62059A498E40C4Ae4aF926E2B00C1Ff122bDdb7', id: '8' },
    { kind: 'agent', chainId: 8453, target: '0x2222222222222222222222222222222222222222', id: '0' },
    {
      kind: 'registry',
      chainId: 8453,
      target: '0x6666666666666666666666666666666666666666',
      id: BigInt(ethers.keccak256(ethers.toUtf8Bytes('https://registry.finchip.ai/api/v1/'))).toString(),
    },
  ].map((c) => {
    const caip = ard.anchorCaip(c.kind, c.chainId, c.target, c.id);
    return { ...c, caip, alias: ard.gatewayAlias('registry.finchip.ai', caip) };
  });
  write('alias.json', {
    description:
      'Gateway alias = urn:air:<gateway-domain>:onchain:<anchor-encoding>; anchor-encoding = the CAIP string lowercased with ":", "/" and "#" replaced by "-". Token anchors are CAIP-19 erc721 ids; address anchors are CAIP-10 ids, a registry anchor carrying its discriminator after "#".',
    cases: aliasCases,
  });

  // 6. interface ids ----------------------------------------------------------------------
  const out = path.join(ROOT, 'out');
  const ifaces = {
    IARDOnchainRegistry: 'IARDOnchainRegistry.sol/IARDOnchainRegistry.json',
    IARDKindAdapter: 'IARDKindAdapter.sol/IARDKindAdapter.json',
    ISkillTokenKernel: 'ISkillTokenKernel.sol/ISkillTokenKernel.json',
    ITaskTenderKernel: 'ITaskTenderKernel.sol/ITaskTenderKernel.json',
  };
  const ids = {};
  for (const [name, rel] of Object.entries(ifaces)) {
    const p = path.join(out, rel);
    if (!fs.existsSync(p)) {
      console.warn(`skip ${name}: run forge build first (${rel} missing)`);
      continue;
    }
    const abi = JSON.parse(fs.readFileSync(p, 'utf8')).abi;
    const iface = new ethers.Interface(abi);
    let x = 0n;
    iface.forEachFunction((f) => {
      x ^= BigInt(f.selector);
    });
    ids[name] = '0x' + x.toString(16).padStart(8, '0');
  }
  write('interface-ids.json', {
    description: 'ERC-165 interface ids = XOR of all function selectors (ethers v6 over the forge ABI); re-derived with type(I).interfaceId in Solidity.',
    ids,
  });
})();

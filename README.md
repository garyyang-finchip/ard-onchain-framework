# ARD Onchain Framework

> **Agentic Resource Discovery (ARD) Onchain** — an address-rooted onchain value registry whose records are conformant ARD entries.

**Status:** design round 3 (2026-10-13) — draft ERC text (`ERCS/erc-9999.md`, placeholder number), reference kernel and four kind adapters (Solidity, Foundry, 43 tests against the real vendored companion contracts), cross-language vectors (ethers v6 + RFC 8785 ↔ solc), a Node.js resolver/gateway that passes the official ARD conformance CLI, and the Sepolia evidence script rehearsed on anvil. Not yet filed; not yet deployed on Sepolia.

## What it is

ARD (the Agentic Resource Discovery specification maintained by the ards-project working group) answers *what exists and who says so*. ARD Onchain answers *what it is worth, who stands behind it, and how it settles* — on the same entry object. Every record is a valid ARD entry; every gateway is a conformant ARD registry; agents and agent users outside Web3 discover onchain value through ordinary ARD search.

- **Value root = settlement root.** Authority over a record belongs to an address, never to a DNS zone. A domain is an endorsement an address collects: it claims the domain onchain (`claimDomain`, or a relayed EIP-712 signature) and the domain acknowledges it in its own `/.well-known/ard.json`. A domain without a key publishes dormant (L0) entries only.
- **Anchor is identity, URN is alias.** Records are identified by CAIP-19 / CAIP-10 anchors. The controller's URN is canonical only under a verified binding; every gateway serves every record under its own alias. Transfers change the controller and make the canonical name stale; the anchor does not move.
- **Kind is posture, type is format.** `skill` (offer), `task` (tender), `agent` (subject), `registry` (index) — orthogonal to ARD's `type`. New payload formats never add kinds. Reserved: `assertion`, `policy`, `market`.
- **Thin kernel.** The kernel stores kind, anchor, a content hash of the descriptor (JCS + SHA-256 over content members only), a canonical URN and a status, plus domain claims and a write-once kind table. Prices, escrow, credit and identity states are read live from the anchored contracts through adapters; controllers are derived, never stored.

Companion drafts anchored in v1: token-bound executable skills (ERC-8338), token-bound task tenders (ERC-8414), agent identity (ERC-8434) over ERC-8004; credit (ERC-8419) and collective decisions (ERC-8436) attach as facets. The ERC text refers to the unmerged ones descriptively.

## Repository

```
ERCS/erc-9999.md                     draft ERC text (self-contained; placeholder number 9999)
docs/design-memo.md                  design memo v0.2 — principles, object model, decisions log, upstream proposals
docs/test-record.md                  toolchain, sizes, full test list, gateway e2e steps, conformance results, limitations
docs/magicians-post.md               draft of the Ethereum Magicians thread
docs/sepolia-runbook.md              how to produce the Sepolia evidence set
assets/erc-9999/contracts/           ARDOnchainRegistry (kernel), interfaces/, adapters/ (Skill, Task, Agent, Registry), libraries/
assets/erc-9999/schemas/             value-context.jsonld, ai-task.schema.json
assets/erc-9999/examples/            one authored descriptor per kind + a gateway /.well-known/ard.json
assets/erc-9999/vectors/             kind-ids, record-id, domain-claim (EIP-712), descriptor-hash (JCS), alias, interface-ids
assets/erc-9999/vendor/ard/          ARD entry schema + context, Apache-2.0, pinned to ard-spec commit 49eb4df6
test/                                Foundry suites; test/fixtures/ = vendored real skill token, task tender kernel, AID registry
tools/lib/ard.js                     resolver-side profile helpers (member classes, JCS hash, record ids, aliases, EIP-712 claim)
tools/vectors.js                     regenerates the vectors
tools/make-manifest-example.js       rebuilds the gateway manifest example from the authored examples
tools/gateway/                       the reference resolver/gateway (server.js) and its anvil end-to-end test (test.js)
tools/conformance/                   the official ARD conformance CLI, vendored (Apache-2.0)
tools/make-sepolia-descriptors.js    descriptors + hashes for the evidence run
script/SepoliaEvidence.s.sol         Foundry script: deploy, anchors, records, transfer, close
scripts/make-filing-package.py       builds and lints the ethereum/ERCs submission package
```

## Build and test

```bash
forge install foundry-rs/forge-std   # once; lib/ is not vendored
forge build && forge test            # 43 tests
npm install
node tools/vectors.js                # regenerate vectors (after forge build, for the interface ids)
node tools/gateway/test.js           # anvil end-to-end + ARD conformance CLI (needs python3; `pip install jsonschema` for schema mode)
python3 scripts/make-filing-package.py --allow-tbd   # lint the ERC text and assets
```

`foundry.toml` pins solc 0.8.24. Runtime sizes: kernel 9,922 bytes; adapters 470–1,933 bytes. ERC-165 ids: `IARDOnchainRegistry` `0x881908a5`, `IARDKindAdapter` `0x67bde273`.

## Running a gateway

```bash
node tools/gateway/server.js --rpc https://<rpc> --registry 0x<kernel> --domain registry.example \
     --port 9010 --base-path /api/v1 --public-url https://registry.example/api/v1/ --operator 0x<operator>
```

See `tools/gateway/README.md`. The gateway serves `POST /search`, `POST /explore`, `GET /agents`, `GET /records/<id>` and `/.well-known/ard.json`; every served record carries `value:anchor` and `value:descriptorHash` so that any client can verify it against the chain.

## Filing

```bash
python3 scripts/make-filing-package.py --number <N> --discussions https://ethereum-magicians.org/t/...
# -> ercs-pr-package/ERCS/erc-<N>.md and ercs-pr-package/assets/erc-<N>/ ; the script lints the package
```

The script rejects literal references to unmerged drafts, external URLs other than rfc-editor.org, directory-style asset links, Chinese characters, missing first-mention links and RFC 2119 keywords inside Security Considerations.

## Upstream

Three proposals to ards-project once the Magicians thread exists: `application/ai-task+json` as a demand-side entry type (the payload validates without any onchain member), an alignment rule for DID identities in `trustManifest.identity`, and a registered `value` context.

## License

CC0-1.0 (`LICENSE.md`), except the vendored ARD material under `assets/erc-9999/vendor/ard/` and `tools/conformance/`, which stays under the Apache License 2.0.

# ARD Onchain Framework

> **Agentic Resource Discovery (ARD) Onchain** — an address-rooted onchain value registry whose records are conformant ARD entries.

**Status:** filed as [ethereum/ERCs#2073](https://github.com/ethereum/ERCs/pull/2073) and assigned **ERC-8444** (2026-10-15; discussion: [Ethereum Magicians 29963](https://ethereum-magicians.org/t/erc-8444-agentic-resource-discovery-ard-onchain/29963)). Contents: the ERC text (`ERCS/erc-8444.md`), reference kernel and four kind adapters (Solidity, Foundry, 43 tests against the real vendored companion contracts), cross-language vectors (ethers v6 + RFC 8785 ↔ solc), a Node.js resolver/gateway that passes the official ARD conformance CLI, and the **Sepolia reference deployment** (2026-10-15, kernel [`0x10c6d098F016Aeea6B0D52c68e5a8acB320a8A8A`](https://sepolia.etherscan.io/address/0x10c6d098F016Aeea6B0D52c68e5a8acB320a8A8A)) with one record per kind, documented in `docs/sepolia-evidence.md`.

## What it is

ARD (the Agentic Resource Discovery specification maintained by the ards-project working group) answers *what exists and who says so*. ARD Onchain answers *what it is worth, who stands behind it, and how it settles* — on the same entry object. Every record is a valid ARD entry; every gateway is a conformant ARD registry; agents and agent users outside Web3 discover onchain value through ordinary ARD search.

- **Value root = settlement root.** Authority over a record belongs to an address, never to a DNS zone. A domain is an endorsement an address collects: it claims the domain onchain (`claimDomain`, or a relayed EIP-712 signature) and the domain acknowledges it in its own `/.well-known/ard.json`. A domain without a key publishes dormant (L0) entries only.
- **Anchor is identity, URN is alias.** Records are identified by CAIP-19 / CAIP-10 anchors. The controller's URN is canonical only under a verified binding; every gateway serves every record under its own alias. Transfers change the controller and make the canonical name stale; the anchor does not move.
- **Kind is posture, type is format.** `skill` (offer), `task` (tender), `agent` (subject), `registry` (index) — orthogonal to ARD's `type`. New payload formats never add kinds. Reserved: `assertion`, `policy`, `market`.
- **Thin kernel.** The kernel stores kind, anchor, a content hash of the descriptor (JCS + SHA-256 over content members only), a canonical URN and a status, plus domain claims and a write-once kind table. Prices, escrow, credit and identity states are read live from the anchored contracts through adapters; controllers are derived, never stored.

Companion drafts anchored in v1: token-bound executable skills (ERC-8338), token-bound task tenders (ERC-8414), agent identity (ERC-8434) over ERC-8004; credit (ERC-8419) and collective decisions (ERC-8436) attach as facets. The ERC text refers to the unmerged ones descriptively.

## Repository

```
ERCS/erc-8444.md                     the ERC text (self-contained; as filed in ethereum/ERCs#2073)
docs/design-memo.md                  design memo v0.2 — principles, object model, decisions log, upstream proposals
docs/test-record.md                  toolchain, sizes, full test list, gateway e2e steps, conformance results, limitations
docs/magicians-post.md               the Ethereum Magicians thread opener
docs/sepolia-runbook.md              how the Sepolia evidence set is produced (Foundry script or offline signing)
docs/sepolia-evidence.md             the Sepolia deployment: addresses, anchors, records, resolved state, transactions
deployments/                         sepolia.json, sepolia-cases.json, sepolia-descriptors.json, the finchip.ai acknowledgment
assets/erc-8444/contracts/           ARDOnchainRegistry (kernel), interfaces/, adapters/ (Skill, Task, Agent, Registry), libraries/
assets/erc-8444/schemas/             value-context.jsonld, ai-task.schema.json
assets/erc-8444/examples/            one authored descriptor per kind + a gateway /.well-known/ard.json
assets/erc-8444/vectors/             kind-ids, record-id, domain-claim (EIP-712), descriptor-hash (JCS), alias, interface-ids
assets/erc-8444/vendor/ard/          ARD entry schema + context, Apache-2.0, pinned to ard-spec commit 49eb4df6
test/                                Foundry suites; test/fixtures/ = vendored real skill token, task tender kernel, AID registry
tools/lib/ard.js                     resolver-side profile helpers (member classes, JCS hash, record ids, aliases, EIP-712 claim)
tools/vectors.js                     regenerates the vectors
tools/make-manifest-example.js       rebuilds the gateway manifest example from the authored examples
tools/gateway/                       the reference resolver/gateway (server.js) and its anvil end-to-end test (test.js)
tools/conformance/                   the official ARD conformance CLI, vendored (Apache-2.0)
tools/make-sepolia-descriptors.js    authors the four Sepolia descriptors (hashes, data: URIs) and the domain acknowledgment file
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
python3 scripts/make-filing-package.py               # build + lint the ethereum/ERCs package (ERC-8444)
```

`foundry.toml` pins solc 0.8.24. Runtime sizes: kernel 9,922 bytes; adapters 470–1,933 bytes. ERC-165 ids: `IARDOnchainRegistry` `0x881908a5`, `IARDKindAdapter` `0x67bde273`.

## Running a gateway

```bash
node tools/gateway/server.js --rpc https://<rpc> --registry 0x<kernel> --domain registry.example \
     --port 9010 --base-path /api/v1 --public-url https://registry.example/api/v1/ --operator 0x<operator>
```

See `tools/gateway/README.md`. The gateway serves `POST /search`, `POST /explore`, `GET /agents`, `GET /records/<id>` and `/.well-known/ard.json`; every served record carries `value:anchor` and `value:descriptorHash` so that any client can verify it against the chain.

## Sepolia deployment

| contract | address |
|---|---|
| `ARDOnchainRegistry` (kernel) | `0x10c6d098F016Aeea6B0D52c68e5a8acB320a8A8A` |
| `SkillAdapter` / `TaskAdapter` / `AgentAdapter` / `RegistryAdapter` | `0x08Be92a9446592fAeaaB976556e09e028662F12F` / `0x0BAB1fEE185A4803a1aC65F6dA59941eeCaE71dB` / `0x38898d038F4a8fCE3e13447bE7Eb1ECd128cE25C` / `0x32C85829da0be0Fd66ac45eF54d4c393Fcd7149E` |
| `AIDRegistry` (reference) | `0x36E4a7BDe8a9D7d445042495180b64C7AF77Fd7E` |
| `SkillToken` (reference fixture) | `0x82F20280D49F1DDC67e1840339dBbc534FEC8F97` |

Anchored to the live token-bound tender kernel `0xA62059A498E40C4Ae4aF926E2B00C1Ff122bDdb7` and the official ERC-8004 Identity Registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`. One record per kind, a domain claim, a skill transfer and a tender cancellation are on chain; the gateway serves the records and passes the conformance CLI against them. Details, transaction list and the resolved state: `docs/sepolia-evidence.md`.

## Filing

```bash
python3 scripts/make-filing-package.py            # -> ercs-pr-package/ERCS/erc-8444.md + ercs-pr-package/assets/erc-8444/
```

The package mirrors the ethereum/ERCs layout for PR #2073 (branch `add-erc-ard-onchain`). The script rejects literal references to unmerged drafts, external URLs other than rfc-editor.org, directory-style asset links, Chinese characters, missing first-mention links, proposal references inside backticks and RFC 2119 keywords inside Security Considerations.

## Upstream

Three proposals to ards-project, now that the thread and the deployment exist: `application/ai-task+json` as a demand-side entry type (the payload validates without any onchain member), an alignment rule for DID identities in `trustManifest.identity`, and a registered `value` context.

## License

CC0-1.0 (`LICENSE.md`), except the vendored ARD material under `assets/erc-8444/vendor/ard/` and `tools/conformance/`, which stays under the Apache License 2.0.

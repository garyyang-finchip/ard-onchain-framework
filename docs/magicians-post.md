# Draft ERC: Agentic Resource Discovery (ARD) Onchain — an address-rooted value registry whose records are ARD entries

*(Posted on Ethereum Magicians on 2026-10-13 as topic 29963; after the number was assigned the thread was retitled `ERC-8444: Agentic Resource Discovery (ARD) Onchain` and now lives at https://ethereum-magicians.org/t/erc-8444-agentic-resource-discovery-ard-onchain/29963 . `discussions-to` in `ERCS/erc-8444.md` points there; the filing package is built with `scripts/make-filing-package.py`.)*

**Repository:** https://github.com/garyyang-finchip/ard-onchain-framework
**PR:** https://github.com/ethereum/ERCs/pull/2073 (assigned ERC-8444; merged 2026-10-15, status Draft)

## What this is

Google's ARD (Agentic Resource Discovery, now an open spec under the ards-project working group with Microsoft, Hugging Face, GoDaddy and others) gives agents a way to find MCP servers, A2A agents, skills and APIs through domain-anchored manifests and federated registries. It deliberately stops at discovery: no price, payment, settlement, escrow or credit; no demand side; trust rooted in DNS.

This draft adds the value layer under ARD and keeps every record a valid ARD entry:

- **Value root = settlement root.** Authority over a record belongs to an address — the one that would be paid — never to a domain. A domain is an endorsement an address collects: it claims the domain onchain and the domain acknowledges it in its own `/.well-known/ard.json`. Publishers without a key stay discoverable as dormant (L0) entries.
- **Anchor is identity, URN is alias.** Records are identified by CAIP-19 / CAIP-10 anchors. The controller's URN is canonical only under a verified binding; every gateway serves every record under its own alias. Transfers are harmless: the controller changes, the canonical name goes stale, the anchor stays.
- **Kind is posture, type is format.** Four kinds — `skill` (offer), `task` (tender), `agent` (subject), `registry` (index) — orthogonal to ARD's `type`. The `task` kind is the first ARD entry whose reader is a supplier looking for work; its payload is designed to be adoptable upstream without any onchain member.

The kernel is thin: kind, anchor, a content hash of the descriptor (JCS + SHA-256), a canonical URN and a status, plus domain claims and a write-once kind table. Prices, escrow balances, credit and identity states are read live from the anchored contracts through kind adapters; controllers are derived, never stored.

## What is in the repository

- The draft text (`ERCS/erc-8444.md`) — self-contained; companion drafts are referenced descriptively.
- Reference kernel + four adapters (Solidity, Foundry), 43 tests against the real vendored skill token, task tender and agent identity contracts, cross-language vectors (ethers v6 + RFC 8785 ↔ solc).
- A Node.js resolver/gateway that indexes the kernel and serves `POST /search`, `POST /explore`, `GET /agents` and `/.well-known/ard.json`; an end-to-end run on anvil covering all four kinds, a hash-mismatch record, binding states, a transfer that makes a canonical URN stale, a provenance drift and a cancelled tender; the official ARD conformance CLI (vendored, schema mode) passes against the gateway with 0 errors and 0 warnings.

## Questions I would like feedback on

1. Is "address as the only root, domain as collected endorsement" the right boundary for ARD interoperability, or should a domain-only publisher be able to reach L1 through some other proof?
2. The descriptor hash excludes the ARD envelope (`identifier`, `trustManifest`, `@context`) so that gateway aliases verify against the same commitment. Does anyone see a case where the envelope needs to be committed?
3. Same-chain anchors only in v1; cross-chain duplicates are separate records. Objections?
4. The `task` payload (`application/ai-task+json`) — anything missing before I propose it upstream?

Sepolia deployment and the upstream proposals follow once the thread exists.

---

**Update (2026-10-15):** filed as ethereum/ERCs#2073, assigned ERC-8444 and merged the same day as a Draft (https://eips.ethereum.org/ERCS/erc-8444); thread title updated to match. The reference deployment is on Sepolia — kernel `0x10c6d098F016Aeea6B0D52c68e5a8acB320a8A8A`, one record per kind anchored to a token-bound skill, the live token-bound tender kernel (`0xA620…dDb7`, tender #17 with escrow), an address bound to the official ERC-8004 Identity Registry (agentId 10855) and a gateway endpoint, plus domain claims, a skill transfer (the new holder then replaced the descriptor — only the live controller can) and a tender cancellation; all seven contracts are verified on Sourcify; the gateway serves the records as ARD entries and the official conformance CLI passes against them. Addresses, transactions and the resolved state: `docs/sepolia-evidence.md` in the repository.

**Update (2026-10-16):** the first two reviews on the thread were answered. ted0x asked whether post-match order amendments belong in the `task` payload: no — the payload is a hash-committed snapshot of the tender at discovery time, amendments live in the order and settlement contracts the anchor points to, and a changed tender surfaces as a new descriptor version and a provenance drift. Revinand showed that "transfers are harmless" overstated the case at the descriptor level: after a transfer the record kept serving the former controller's endpoint, terms and payee, and the e2e test expected exactly that. The fix separates *control* (the right to change the descriptor) from *adoption* (the current controller committed the descriptor being served): the kernel records the attestor on `register` and `updateDescriptor`, resolvers serve a record only while the attestor is the live controller, and an unadopted record is flagged `value:adopted: false`, excluded from search and listing and inspectable until the new controller commits a descriptor (the same hash is accepted). Spec text, kernel, 44 tests, the gateway and the e2e run (20 steps) carry the change; filed as a follow-up pull request to ethereum/ERCs. The Sepolia reference deployment was redone on the v1.1 kernel (`0x126795eCa2A10ea5B2d065a8049e01B6fcDAaa78`) with the scenario on chain: the skill record registered by its holder with a descriptor that already names the transferee, the transfer that leaves it unadopted (excluded from discovery, inspectable), and the one same-hash `updateDescriptor` that adopts it; details in `docs/sepolia-evidence.md`.

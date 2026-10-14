# Draft ERC: Agentic Resource Discovery (ARD) Onchain — an address-rooted value registry whose records are ARD entries

*(Posted on Ethereum Magicians on 2026-10-13 as topic 29963: https://ethereum-magicians.org/t/draft-erc-agentic-resource-discovery-ard-onchain-an-address-rooted-value-registry-whose-records-are-ard-entries/29963 . `discussions-to` in `ERCS/erc-9999.md` points there; the filing package is built with `scripts/make-filing-package.py`.)*

**Repository:** https://github.com/garyyang-finchip/ard-onchain-framework
**PR:** to be added after filing

## What this is

Google's ARD (Agentic Resource Discovery, now an open spec under the ards-project working group with Microsoft, Hugging Face, GoDaddy and others) gives agents a way to find MCP servers, A2A agents, skills and APIs through domain-anchored manifests and federated registries. It deliberately stops at discovery: no price, payment, settlement, escrow or credit; no demand side; trust rooted in DNS.

This draft adds the value layer under ARD and keeps every record a valid ARD entry:

- **Value root = settlement root.** Authority over a record belongs to an address — the one that would be paid — never to a domain. A domain is an endorsement an address collects: it claims the domain onchain and the domain acknowledges it in its own `/.well-known/ard.json`. Publishers without a key stay discoverable as dormant (L0) entries.
- **Anchor is identity, URN is alias.** Records are identified by CAIP-19 / CAIP-10 anchors. The controller's URN is canonical only under a verified binding; every gateway serves every record under its own alias. Transfers are harmless: the controller changes, the canonical name goes stale, the anchor stays.
- **Kind is posture, type is format.** Four kinds — `skill` (offer), `task` (tender), `agent` (subject), `registry` (index) — orthogonal to ARD's `type`. The `task` kind is the first ARD entry whose reader is a supplier looking for work; its payload is designed to be adoptable upstream without any onchain member.

The kernel is thin: kind, anchor, a content hash of the descriptor (JCS + SHA-256), a canonical URN and a status, plus domain claims and a write-once kind table. Prices, escrow balances, credit and identity states are read live from the anchored contracts through kind adapters; controllers are derived, never stored.

## What is in the repository

- The draft text (`ERCS/erc-9999.md`, placeholder number) — self-contained; companion drafts are referenced descriptively.
- Reference kernel + four adapters (Solidity, Foundry), 43 tests against the real vendored skill token, task tender and agent identity contracts, cross-language vectors (ethers v6 + RFC 8785 ↔ solc).
- A Node.js resolver/gateway that indexes the kernel and serves `POST /search`, `POST /explore`, `GET /agents` and `/.well-known/ard.json`; an end-to-end run on anvil covering all four kinds, a hash-mismatch record, binding states, a transfer that makes a canonical URN stale, a provenance drift and a cancelled tender; the official ARD conformance CLI (vendored, schema mode) passes against the gateway with 0 errors and 0 warnings.

## Questions I would like feedback on

1. Is "address as the only root, domain as collected endorsement" the right boundary for ARD interoperability, or should a domain-only publisher be able to reach L1 through some other proof?
2. The descriptor hash excludes the ARD envelope (`identifier`, `trustManifest`, `@context`) so that gateway aliases verify against the same commitment. Does anyone see a case where the envelope needs to be committed?
3. Same-chain anchors only in v1; cross-chain duplicates are separate records. Objections?
4. The `task` payload (`application/ai-task+json`) — anything missing before I propose it upstream?

Sepolia deployment and the upstream proposals follow once the thread exists.

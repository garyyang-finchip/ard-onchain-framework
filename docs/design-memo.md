# ARD Onchain — design memo v0.2

Status: design round 3 (2026-10-13). Companion to `ERCS/erc-9999.md`; the ERC text is normative, this memo records the reasoning and the decisions log.

## 1. One sentence

ARD answers *what exists and who says so*; ARD Onchain answers *what it is worth, who stands behind it, and how it settles*. Both live on the same entry object.

## 2. The three gaps and the three decisions

ARD v0.91 defines discovery and nothing else: no price, payment, settlement, escrow or credit; no demand side; trust rooted in domain ownership. Those three gaps are exactly the territory of token-bound executable skills (supply side), token-bound task tenders (demand side) and address-anchored agent identity (the party). ARD Onchain is not a second ARD; it is the value layer under ARD.

1. **Value root = settlement root.** Authority belongs to the address that would receive the money. A domain is an endorsement an address collects, never a second root; a domain without a key publishes dormant entries only. This costs Web2 publishers nothing: whoever gets paid in the agent economy already holds an address (the payee of an HTTP 402 payment is one).
2. **Anchor is identity, URN is alias.** Records are identified by CAIP-19 / CAIP-10 anchors. The controller's URN is canonical only under a verified domain binding; every gateway serves the record under its own alias. Equality is by anchor.
3. **Kind is posture, type is format.** `skill` (offer), `task` (tender), `agent` (subject), `registry` (index). ARD `type` is orthogonal. New payload formats never add kinds; reserved postures: `assertion`, `policy`, `market`.

A fourth, derived decision: every ARD entry is already a dormant value record (L0) until a controlling address anchors it (L1), and it is backed (L2) when the anchored contract says the value is live.

## 3. Object model

- **Record** = kind + anchor `(chainId, target, id)` + `descriptorHash` + `descriptorURI` + canonical `urn` + status (`Active`, `Suspended`, `Retired` terminal). `recordId = keccak256(abi.encode(chainId, target, id))`; one record per anchor; same-chain anchors only.
- **Controller** = derived by the kind adapter at call time, never stored. Skill and task: the token owner (the seller / the demander), not the update authority or the acceptance authority. Agent and registry: the address itself.
- **Descriptor** = the ARD entry plus `value:` members. Three member classes: publication (`@context`, `@id`, `identifier`, `trustManifest`: set by whoever publishes the entry), resolved (`value:anchor`, `value:binding`, `value:level`, `value:status`, `value:aliases`, `value:canonical`, `value:stale`, `value:claimedUrn`, `value:registry`, `value:descriptorHash`: computed by resolvers), content (everything else). `descriptorHash = SHA-256(JCS(content members))`. A gateway alias entry therefore hashes to the same value as the controller's own entry.
- **Binding** of (domain, address): claims onchain (`claimDomain` / EIP-712 `claimDomainBySig` with ERC-1271), acknowledgment off-chain (`value:controllers` or an entry's `value:controller` in the domain's `/.well-known/ard.json`), states computed by resolvers: `unbound` / `claimed` / `verified` / `contested`; a record's `value:binding` reports `third-party` for `unbound` and `none` without a URN.
- **Level**: L0 no record; L1 Active record; L2 Active, adapter `backed`, and for skill/task the descriptor's `value:provenance.packageDigest` equals the adapter's anchor hint. Levels and binding states are orthogonal; clients see (level, binding, credit).

## 4. Kind adapters

| kind | exists | controllerOf | backed | anchorHint |
|---|---|---|---|---|
| skill | ERC-165 skill kernel id + `ownerOf` | `ownerOf` | package hash != 0 | package hash |
| task | ERC-165 tender kernel id + `ownerOf` | `ownerOf` | not cancelled, escrow > 0, settleBy unset or future | task hash |
| agent | `id == 0`, nonzero address | the address | identity registry reports ACTIVE | document digest |
| registry | `id != 0`, nonzero address | the address | never | 0 |

The registry discriminator (`id = keccak256(endpointURL)` recommended) keeps an operator's registry records apart from its own agent record. Adapters never revert from views: a destroyed anchor is `exists == false`, controller zero, not backed.

## 5. Resolver and gateway

A gateway is a conformant ARD registry over an index built from `Registered` events: it fetches each descriptor, drops hash mismatches, computes binding, canonical URN, aliases, level and status, and serves `POST /search` (with `auto` / `referrals` / `none`), `POST /explore`, `GET /agents` and `/.well-known/ard.json` (listing itself as `application/ai-registry+json`). Every served record carries `value:anchor` and `value:descriptorHash`; any client can reproduce the gateway's work against the chain or a second gateway. The reference gateway passes the official ARD conformance CLI in schema mode (see `docs/test-record.md`).

## 6. Decisions log (round 3)

| # | question | ruling |
|---|---|---|
| 1 | ERC-1155 anchors | Out of v1. Controller derivation is the adapter's business; an 1155 adapter would define the controller as the per-id issuer. No kernel change. |
| 2 | `registry` kind at L2 | Never backed onchain (L1 cap). Whether an endpoint is a conformant ARD registry is a resolver-side observation. |
| 3 | Cross-chain duplicates | Separate records in v1; a `value:family` link is a future profile. |
| 4 | Payload-level acknowledgment (SKILL.md frontmatter, package manifest) | Deferred to v2. v1 acknowledges through the domain manifest only. |
| 5 | Onchain mirror of a verified binding | Not a kernel feature. Where an onchain consumer needs it, a trusted party issues an assertion (a Know-Your-Agent scheme fits); the ERC defines no assertion registry. |
| 6 | Descriptor canonicalization | JCS (RFC 8785) + SHA-256 over content members only; publication and resolved members excluded. |
| 7 | Alias encoding | CAIP string lowercased, `:` `/` `#` replaced by `-`; registry anchors carry `#<id hex>`. |
| 8 | Records without a URN | Allowed; served under aliases only. |
| 9 | Anti-spam stake | None. Gas plus the adapter's existence and controller checks suffice. |
| 10 | Sepolia evidence | Four kinds, one claim with acknowledgment, one skill transfer producing a stale canonical URN, one tender closing. Pending deployment. |

Other rulings taken while building: `Retired` is terminal and binds later holders (suspend to pause); the kind table is write-once and ownership can be renounced; `descriptorHash` must be nonzero; a domain string is accepted only in normalized form; at most 64 claimants per domain.

## 7. Upstream proposals (ards-project)

1. `application/ai-task+json` as a demand-side entry type; the payload in `assets/erc-9999/schemas/ai-task.schema.json` is valid without any onchain member.
2. A rule for `trustManifest.identity` given as a DID: alignment with the URN's publisher domain through a published binding (the acknowledgment of section 5).
3. A registered `value` context, or a general note on value extensions.

To be opened with the example JSON and the gateway attached, after the Magicians thread exists.

## 8. Filing notes

Title 40 characters, no "standard"; `requires` 165, 712, 1271 only; companion drafts referenced descriptively (their numbers never appear in the ERC text); no external links except rfc-editor.org; ARD schema vendored under Apache-2.0; asset links written `../assets/eip-9999/…` and never to directories. `scripts/make-filing-package.py` lints all of this.

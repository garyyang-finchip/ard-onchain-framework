# ARD Onchain

**Agentic Resource Discovery (ARD) Onchain** — an address-rooted onchain value registry whose records are conformant ARD entries.

Status: design round 2 skeleton (2026-10-12). Nothing here is final; the ERC text is a skeleton, the interfaces are drafts, and the number `9999` is a placeholder until an EIP editor assigns one.

## What it is

ARD (Agentic Resource Discovery, maintained by the ards-project working group) answers *what exists and who says so*. ARD Onchain answers *what it is worth, who stands behind it, and how it settles*. Both live on the same entry object: every ARD Onchain record is a valid ARD entry, and every ARD Onchain gateway is a conformant ARD registry, so agents and agent users outside Web3 can discover and use onchain value through ordinary ARD search.

Design pillars:

- **Value root = settlement root.** Authority over a record belongs to an address, never to a DNS zone. A domain is an endorsement an address can collect, not a second root. Any party that gets paid in the agent economy already holds an address.
- **Anchor is identity, URN is alias.** A record is identified by its CAIP-19 / CAIP-10 anchor. ARD URNs are aliases: the controller's canonical URN (only with a verified domain binding) plus per-gateway aliases.
- **Kind is posture, type is format.** `value:kind` says which side of a trade the entry occupies (`skill` offer, `task` tender, `agent` subject, `registry` index); the ARD `type` says what the payload format is. The two are orthogonal; new payload formats never add kinds.
- **Every ARD entry is a dormant value record** until a controlling address anchors it onchain (L0 → L1 → L2).

Anchors in v1: ERC-8338 token-bound executable skills (`skill`), ERC-8414 token-bound task tenders (`task`), ERC-8434 agent identity over ERC-8004 (`agent`), and ARD registry endpoints (`registry`). Credit (ERC-8419) and dispute policies (ERC-8436) attach as facets. Reserved kinds: `assertion`, `policy`, `market`.

## Layout

```
ERCS/erc-9999.md                         ERC skeleton (preamble + section stubs + interfaces)
assets/erc-9999/
  contracts/IARDOnchainRegistry.sol      kernel interface (draft)
  contracts/IARDKindAdapter.sol          kind adapter interface (draft)
  schemas/value-context.jsonld           JSON-LD context for the `value:` namespace
  schemas/ai-task.schema.json            draft schema for application/ai-task+json
  examples/skill.json                    authored entry, kind=skill
  examples/task.json                     authored entry, kind=task
  examples/agent.json                    authored entry, kind=agent
  examples/registry.json                 authored entry, kind=registry
  examples/well-known-ard.json           a gateway's /.well-known/ard.json with resolved facets
  vendor/ard/README.md                   what to vendor from the ARD spec (Apache-2.0) and why
```

Planned (next round): reference kernel + three adapters (Foundry), vectors, a TypeScript gateway that passes the ards-project conformance CLI, Sepolia evidence.

## Pinned upstream

ARD specification v0.91 (Status: Proposal). The profile in this repository is versioned independently and pins that version; the onchain kernel does not depend on any ARD field name. Known upstream drift already observed between v0.9 and v0.91: manifest path `/.well-known/ai-catalog.json` → `/.well-known/ard.json`; MCP media type spelled both `application/mcp-server+json` and `application/mcp-server-card+json`; URN segment count inconsistent across examples.

## License

CC0-1.0 for the ERC text and assets, except vendored ARD material under `assets/erc-9999/vendor/ard/`, which keeps its Apache-2.0 license and notice.

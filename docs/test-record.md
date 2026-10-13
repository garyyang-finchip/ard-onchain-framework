# Test record — reference implementation v0.3 (2026-10-13)

## Toolchain

- Foundry 1.5.1-stable (forge, anvil), solc 0.8.24, optimizer 200 runs, no via-IR
- Node.js 22, ethers 6.17, `canonicalize` 2.0 (RFC 8785)
- Python 3 with `jsonschema` 4.26 for the ARD conformance CLI's schema mode
- ARD specification v0.91, ards-project/ard-spec commit `49eb4df6f3841ccecc5c31d5175117337b568bdf` (2026-10-11): `ard-entry.schema.json`, `ard.context.jsonld` and `conformance/bin/conformance-test` vendored

## Contract sizes (runtime bytes)

| contract | runtime | note |
|---|---|---|
| `ARDOnchainRegistry` | 9,922 | kernel; 14,654 bytes under the EIP-170 limit |
| `SkillAdapter` | 1,248 | |
| `TaskAdapter` | 1,933 | |
| `AgentAdapter` | 1,288 | |
| `RegistryAdapter` | 470 | |

ERC-165 ids: `IARDOnchainRegistry` `0x881908a5`, `IARDKindAdapter` `0x67bde273`, skill kernel `0x734553a6`, tender kernel `0xc319d532` (the vendored neutral interfaces reproduce the ids the real tokens declare; asserted in `ARDAdaptersTest`).

## Foundry suites — 43 tests, 0 failures

Fixtures: the real `SkillToken`, `TaskToken` + `TaskVault` and `AIDRegistry` + `MockIdentityRegistry8004` vendored under `test/fixtures/` (commits in `test/fixtures/README.md`).

`ARDRecordsTest` (20): register each kind; `Registered` event; unknown kind, empty descriptor, missing anchor, non-controller, wrong kind for an anchor; one record per anchor even under another kind; agent and registry anchors of one address do not collide; only an address registers itself as agent; an agent record needs no identity registration; descriptor update by controller only, zero hash and unknown record rejected; status transitions and the terminality of `Retired`; controller follows a token transfer and is never cached; a burned anchor reports a zero controller and blocks mutation; kind registration owner-only, write-once, adapter-checked; ownership transfer and renounce; views revert on unknown records; `supportsInterface`.

`ARDClaimsTest` (8): claim, duplicate, second claimant, release and views; release keeps the index consistent; 64-claim cap; domain validation (empty, uppercase, leading or trailing dot, empty label, underscore, space, non-ASCII, 254 bytes rejected; punycode, hyphenated labels and a single label accepted); signed claim by an EOA then nonce advance and replay failure; expired, wrong-domain, wrong-signer and malformed signatures; signed claim by an ERC-1271 contract account; domain separator and type hash.

`ARDAdaptersTest` (10): vendored interface ids equal the deployed tokens; skill existence, controller and hint; skill hint follows package updates; task backed only while live (settleBy), false when cancelled, false without escrow; task controller is the owner, not the judge; agent states active → stale (liveness) → active (heartbeat) → stale (agent moved) → retired, document digest as hint; agent adapter without an identity registry; registry adapter discriminator and never backed.

`ARDVectorsTest` (5): kind ids, record ids (five chains), the EIP-712 domain claim vector accepted by a registry deployed at the vector's address and chain, descriptor hashes as SHA-256 of the canonical bytes with the alias entry equal to the authored entry, interface ids.

## Gateway end-to-end — 19 steps, PASS (`node tools/gateway/test.js`)

On anvil (chain 31337) with the real kernel, adapters, skill token, task token and AID registry:

1. kernel deployed, four kinds registered
2. anchors: skill #1 (alice), funded tender #1 (bob, 0.01 ETH escrow, judged), AID-active identity (carol)
3. records registered for all four kinds plus one whose published descriptor does not match the committed hash
4. claims: alice and mallory claim `alice.example` (alice acknowledged in the manifest); carol claims `carol.example` (listed, not acknowledged); the operator claims `registry.example` (acknowledged)
5. gateway serves 4 entries, excludes 1 (hash mismatch)
6. skill: canonical URN served, binding `verified`, level 2, anchor and descriptor hash exposed
7. task: unclaimed publisher domain → `third-party`, alias identifier, level 2 while escrowed
8. agent: `claimed`, alias identifier, level 2 through the active identity
9. registry: `verified`, level capped at 1
10. `POST /search`: ranking, `value:kind` filter, referrals, pagination, 400 on missing text
11. `POST /explore`: facets by `value:kind` and `type`, both request shapes
12. `GET /agents`: deterministic listing with a filter
13. `/.well-known/ard.json`: the gateway lists itself and every served record
14. ARD conformance CLI, manifest mode with JSON Schema: PASS, 0 errors, 0 warnings
15. ARD conformance CLI, registry mode: PASS, 0 errors, 0 warnings
16. skill transferred to mallory: binding `contested`, canonical URN stale, served under the alias
17. skill package updated under the old descriptor: provenance mismatch → level 1
18. tender cancelled → level 1
19. agent record retired → dropped from search, still inspectable at `/records/<id>`

The last run is recorded in `docs/gateway-e2e-last-run.json`.

## Stated limitations

- The gateway's `score` is a token-overlap stand-in for semantic relevance; ARD only requires a 0–100 integer and says the score is not a trust signal.
- Descriptor fetching supports `data:`, `http(s):`, `file:` and `ipfs:` (through a configurable gateway); the e2e run uses `data:` URIs and local manifest overrides, so no network is involved.
- Federation `auto` queries configured upstreams and merges by score; there is no de-duplication across registries beyond `value:anchor`.
- No Sepolia deployment yet; the planned evidence set is in `docs/design-memo.md` §6.

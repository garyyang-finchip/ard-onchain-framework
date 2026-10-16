# Sepolia evidence — ARD Onchain reference deployment

Current deployment: kernel **v1.1** (attestor / adoption semantics), deployed 2026-10-16 on Sepolia (chain 11155111) from `0xCcFDEE360c9CDc79005e4ddA9845f3A24EE37A25`, reusing the adapters, the reference agent identity registry, the reference skill token and the official ERC-8004 identity of the first deployment (2026-10-15, kernel `0x10c6d098…8A8A`, kept on chain as history; see the appendix). This document records what is on chain, what the gateway served from it, and how to check both. Machine-readable copies: `deployments/sepolia.json` (addresses, anchors, records, the adoption demonstration, claims, verification), `deployments/sepolia-cases.json` (every transaction with block and gas; the first run under `previousRun`) and `docs/gateway-sepolia-last-run.json` (the served entries, the unadopted state and the conformance results). State below was read at block 11924668; the unadopted state at block 11924598.

## Contracts

| contract | address | role |
|---|---|---|
| `ARDOnchainRegistry` v1.1 | [`0x126795eCa2A10ea5B2d065a8049e01B6fcDAaa78`](https://sepolia.etherscan.io/address/0x126795eCa2A10ea5B2d065a8049e01B6fcDAaa78) | the kernel (records with attestor, domain claims, kind table); deployed 2026-10-16 |
| `SkillAdapter` | [`0x08Be92a9446592fAeaaB976556e09e028662F12F`](https://sepolia.etherscan.io/address/0x08Be92a9446592fAeaaB976556e09e028662F12F) | kind `skill` over token-bound executable skills (reused) |
| `TaskAdapter` | [`0x0BAB1fEE185A4803a1aC65F6dA59941eeCaE71dB`](https://sepolia.etherscan.io/address/0x0BAB1fEE185A4803a1aC65F6dA59941eeCaE71dB) | kind `task` over token-bound task tenders (reused) |
| `AgentAdapter` | [`0x38898d038F4a8fCE3e13447bE7Eb1ECd128cE25C`](https://sepolia.etherscan.io/address/0x38898d038F4a8fCE3e13447bE7Eb1ECd128cE25C) | kind `agent`, liveness from the AID registry below (reused) |
| `RegistryAdapter` | [`0x32C85829da0be0Fd66ac45eF54d4c393Fcd7149E`](https://sepolia.etherscan.io/address/0x32C85829da0be0Fd66ac45eF54d4c393Fcd7149E) | kind `registry` (gateway endpoints) (reused) |
| `AIDRegistry` (reference, 30 d default / 365 d max liveness) | [`0x36E4a7BDe8a9D7d445042495180b64C7AF77Fd7E`](https://sepolia.etherscan.io/address/0x36E4a7BDe8a9D7d445042495180b64C7AF77Fd7E) | address-anchored agent identity, bound to the official ERC-8004 Identity Registry (reused) |
| `SkillToken` (reference fixture, `ARD Onchain evidence skill` / `ARDS`) | [`0x82F20280D49F1DDC67e1840339dBbc534FEC8F97`](https://sepolia.etherscan.io/address/0x82F20280D49F1DDC67e1840339dBbc534FEC8F97) | the skill kernel the skill record is anchored to (reused) |

Live contracts used as anchors, not deployed by this run: the token-bound task tender kernel `TaskToken` [`0xA62059A498E40C4Ae4aF926E2B00C1Ff122bDdb7`](https://sepolia.etherscan.io/address/0xA62059A498E40C4Ae4aF926E2B00C1Ff122bDdb7) and the official ERC-8004 Identity Registry [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://sepolia.etherscan.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e).

Adapters are stateless with respect to the kernel, so a new kernel reuses them: the kind table of the new instance points at the same four adapter addresses. The kernel is the only contract that changed between the two deployments (runtime 9,939 bytes; `registrant` became `attestor`, set by `register` and by every `updateDescriptor`).

Source verification: the v1.1 kernel is verified on Sourcify as an **exact match** (creation and runtime bytecode, metadata hash included; `https://repo.sourcify.dev/11155111/0x126795eCa2A10ea5B2d065a8049e01B6fcDAaa78`), from solc 0.8.24+commit.e11b9ed9, optimizer 200 runs, EVM cancun, source unit names as in this repository; the six reused contracts keep their exact matches from 2026-10-15. The same standard-JSON input reproduces the signed deployment transaction byte for byte; Etherscan verification was forwarded by Sourcify and can also be submitted from the input with an API key.

## Kinds

| kind | id (`keccak256("ard-onchain.kind.<name>")`) | adapter |
|---|---|---|
| `skill` | `0x75357da1ea166b9845548f84f7855b7f122cfc7dc349e5edbdca01bd8ca7b0bb` | `SkillAdapter` |
| `task` | `0x119c021f95332a1e2d06adbfe8e298dc2484ac0daa16e4cd837d8de82fbba87c` | `TaskAdapter` |
| `agent` | `0x283cdd5ece2ad33dc6be3a32a7a140a653c611b0296c9b54878ae0439bbef3a2` | `AgentAdapter` |
| `registry` | `0x455d1d9d2b151bdfaa173c1cee0ee26ece8e7bdb98830e8e3ca1e180989cf3c6` | `RegistryAdapter` |

## Anchors and records

One record per kind. Three were registered by the deployer; the skill record was registered by the address that held the skill at the time (the second holder of the first run), which is what the adoption demonstration below needs.

| kind | anchor (CAIP) | record id | canonical URN claimed | descriptor hash |
|---|---|---|---|---|
| `skill` | `eip155:11155111/erc721:0x82f20280d49f1ddc67e1840339dbbc534fec8f97/1` | `0x4683d8e0…c4b8` | `urn:air:finchip.ai:skills:daily-finance-brief` | `0x4677233b…03b4` |
| `task` | `eip155:11155111/erc721:0xa62059a498e40c4ae4af926e2b00c1ff122bddb7/18` | `0x5d53381c…a8e5` | `urn:air:finchip.ai:tenders:oracle-basis-feed` | `0x6790eb2b…7831` |
| `agent` | `eip155:11155111:0xccfdee360c9cdc79005e4dda9845f3a24ee37a25` | `0xb2e9339e…6489` | `urn:air:finchip.ai:agents:finch-analyst` | `0x8d3f624c…25f0` |
| `registry` | `eip155:11155111:0xccfdee360c9cdc79005e4dda9845f3a24ee37a25#fa187c88…27dd6a` | `0x2abc385a…418c` | `urn:air:registry.finchip.ai:registry:sepolia` | `0xb631b153…f6bb` |

Full record ids and hashes are in `deployments/sepolia.json`; the descriptors are authored by `tools/make-sepolia-descriptors.js` and kept in `deployments/sepolia-descriptors.json`.

- The skill is token #1 of the reference skill token (`skillMd` = SHA-256 of `# ARD Onchain evidence skill`, package digest `0x2473da0a…3144d`). It was held by `0x81EcAc174eba407efEb6698927d16dC6494CA60C` when the run started, registered on the new kernel by that holder, then transferred back to the deployer, who adopted the descriptor (below).
- The task is tender #18 of the live tender kernel, minted for this run: native asset, 0.0005 ETH per completion, two completions, judged by the publisher, settle-by 2026-12-15, 7-day judgment window; 0.001 ETH escrowed in the tender's vault; live (not cancelled), so the record is backed. Tender #17 of the first run stays cancelled.
- The agent is the deployer address itself, bound through the reference AID registry to agentId 10855 on the official ERC-8004 Identity Registry (state `ACTIVE`).
- The registry anchor is the deployer address with the discriminator `keccak256("https://registry.finchip.ai/api/v1/")`; its descriptor's `value:indexes` names the v1.1 kernel.
- Domain claims on the new kernel: `finchip.ai` and `registry.finchip.ai`, both by the deployer. (Claims live in the kernel, so the first kernel's claims do not carry over.)

Descriptors are published as `data:application/json;base64` URIs, so every record is self-contained; the committed hash is SHA-256 over the RFC 8785 canonical form of the content members (`@context`, `@id`, `identifier`, `trustManifest` excluded). All four carry the `https://eips.ethereum.org/assets/eip-8444/ns#` context and `updatedAt` 2026-10-16.

## Adoption demonstration (the reviewer's scenario)

The thread review asked what happens when an anchor changes hands: the record keeps the descriptor the former controller committed, so the new controller would advertise the former controller's endpoint, terms and payee. The run reproduces the scenario on chain, including the "pre-naming" variant in which the seller writes the buyer into the descriptor in advance:

1. The second holder, controlling skill #1, registers the skill record with a descriptor whose authored `value:controller` and settlement `payee` already name the deployer (transaction 2 of the second holder). The kernel records the second holder as the attestor — the address that sent the committing transaction, not the address written in the descriptor.
2. The second holder transfers skill #1 to the deployer (transaction 3 of the second holder, block 11924594). `controllerOf` now returns the deployer; `attestor` is still the second holder.
3. **State at block 11924598 (unadopted):** the gateway indexes four records and serves three. The skill record is excluded with the reason `descriptor not adopted by the current controller`; `POST /search` for "finance brief daily" does not return it; `GET /records/0x4683d8e0…c4b8` still answers, with `consistent: true`, `adopted: false`, `controller` = deployer, `attestor` = second holder and the entry flagged `value:adopted: false` — the authored `value:controller` naming the deployer changed nothing. The conformance CLI passes on the three-entry manifest.
4. The deployer calls `updateDescriptor` with the **same** hash, URI and URN (transaction 52, block 11924660, 233,165 gas — one call, no new descriptor). The kernel records the deployer as the attestor.
5. **State at block 11924668 (adopted):** all four records served, `value:adopted: true`, the skill at level 2 under the gateway alias with its canonical URN reported stale until the domain acknowledges.

`deployments/sepolia.json` carries the two readings under `adoptionDemonstration`; `docs/gateway-sepolia-last-run.json` carries the gateway's view of both states under `unadoptedState` and `served`.

## Resolved state served by the gateway (block 11924668)

`tools/gateway/server.js` indexed the v1.1 kernel and served the four records as ARD entries; the vendored ARD conformance CLI passed in both modes (manifest with JSON Schema: `PASS`, 0 errors, 0 warnings, 2 informational; registry: `PASS`, 0 errors, 0 warnings). The served manifest and the probe results are in `docs/gateway-sepolia-last-run.json`.

Before the publisher domains serve their acknowledgments (the state at the time of writing):

| kind | identifier served | `value:binding` | `value:level` | `value:adopted` | why |
|---|---|---|---|---|---|
| `skill` | alias `urn:air:registry.finchip.ai:onchain:eip155-11155111-erc721-0x82f2…8f97-1` | `claimed` | 2 | true | the deployer claims `finchip.ai` and the domain has not yet acknowledged; the canonical URN is reported in `value:stale`; the token is backed and its package digest equals the anchor hint; attestor = controller |
| `task` | alias `…-0xa620…ddb7-18` | `claimed` | 2 | true | same claim; tender #18 is live and escrowed |
| `agent` | alias `…-0xccfd…7a25` | `claimed` | 2 | true | same claim; the identity is `ACTIVE` in the AID registry |
| `registry` | alias `…-0xccfd…7a25-fa18…dd6a` | `claimed` | 1 | true | the deployer claims `registry.finchip.ai`, not yet acknowledged; registry endpoints are capped at level 1 |

Once `https://finchip.ai/.well-known/ard.json` serves `deployments/acknowledgment-finchip.ai.well-known-ard.json` (the deployer listed in `value:controllers`, the three entries included) and the gateway at `registry.finchip.ai` serves its own manifest (`--operator 0xCcFD…7A25 --registry-name sepolia`), the same run resolves every record as `verified` under its canonical URN — skill L2, task L2, agent L2, registry L1 — which is what the `projectedWithAcknowledgments` block of `docs/gateway-sepolia-last-run.json` shows (produced with `--manifest-override` for both domains).

The sandbox that produced this run has no outbound RPC access, so the gateway was run against a pinned-block JSON-RPC replay of Sepolia (every `eth_getLogs` / `eth_call` answered from responses recorded through a browser relay); the gateway code is unchanged and anyone can repeat the run live:

```bash
node tools/gateway/server.js --rpc https://ethereum-sepolia-rpc.publicnode.com \
  --registry 0x126795eCa2A10ea5B2d065a8049e01B6fcDAaa78 --from-block 11924570 \
  --domain registry.finchip.ai --public-url https://registry.finchip.ai/api/v1/ \
  --operator 0xCcFDEE360c9CDc79005e4ddA9845f3A24EE37A25 --registry-name sepolia --port 9010
python3 tools/conformance/conformance-test manifest http://127.0.0.1:9010/.well-known/ard.json
python3 tools/conformance/conformance-test registry http://127.0.0.1:9010/api/v1
```

## Transactions

Fifteen transactions, all successful, signed offline and broadcast through a public Sepolia endpoint; thirteen by the deployer (nonces 40–52) and two by the second holder (nonces 2–3). Every gas limit comes from a live `eth_estimateGas` (Sepolia's current schedule charges several times more per deployed byte and per storage write than anvil's default schedule: 15.69 M for the kernel, 5.5–8.2 M per `register` with a 1.2–2.1 KB `data:` descriptor). Re-committing an unchanged descriptor is cheap (233 k), because the storage already holds the values.

<!-- tx-table:start -->
| # | phase | transaction | block | gas used | effect |
|---|---|---|---|---|---|
| 40 | deploy | `deploy ARDOnchainRegistry v1.1` [0xfcba5283…855f](https://sepolia.etherscan.io/tx/0xfcba5283bee1610dc2d2b375be85aedb11b72069310ca8d0f8fc08b3c346855f) | 11924570 | 15,690,770 | created 0x126795eCa2A10ea5B2d065a8049e01B6fcDAaa78 (kernel with attestor / adoption semantics) |
| 41 | configure | `registerKind skill` [0xba6f5e8d…6f8d](https://sepolia.etherscan.io/tx/0xba6f5e8dcbb1307ea13f76de259861f53963351d721762b729abd3ddef2d6f8d) | 11924576 | 135,663 | kind registered on the new kernel (existing SkillAdapter; write-once) |
| 42 | configure | `registerKind task` [0x807d2cb0…8a3d](https://sepolia.etherscan.io/tx/0x807d2cb0961c3802a4a9f2728b46037ca4cc15694e9056dfc5e962788b9e8a3d) | 11924576 | 135,651 | kind registered on the new kernel (existing TaskAdapter; write-once) |
| 43 | configure | `registerKind agent` [0x8fdcfe38…5ceb](https://sepolia.etherscan.io/tx/0x8fdcfe385d8856d32e02399fd2c00fe830260cb1105293108afb795fc9805ceb) | 11924576 | 135,663 | kind registered on the new kernel (existing AgentAdapter; write-once) |
| 44 | configure | `registerKind registry` [0x24a5eabd…22e8](https://sepolia.etherscan.io/tx/0x24a5eabdb1aa0b436c0183f892870e9647ad9d4419d03665191327557bce22e8) | 11924576 | 135,676 | kind registered on the new kernel (existing RegistryAdapter; write-once) |
| 45 | configure | `TaskToken.mintTask -> #18` [0x96d7b5e3…3693](https://sepolia.etherscan.io/tx/0x96d7b5e30d12303666cee6435a069ea6b3c1bb9892392fb2a752d888d5c13693) | 11924576 | 3,420,926 | tender #18 minted on the live tender kernel (60-day settle-by) |
| 46 | records | `TaskToken.fundTask #18 0.001 ETH` [0x69d58a90…038c](https://sepolia.etherscan.io/tx/0x69d58a90587edbc9bf66dad85c2dc479058a667782d10ba948a5d50d95c7038c) | 11924591 | 381,329 | 0.001 ETH escrowed in the tender vault |
| 47 | records | `register task record` [0x70c328bb…5544](https://sepolia.etherscan.io/tx/0x70c328bb97e4e12c6d5ea2a23e8b8d93d7d521442e51511c909d6ec3de385544) | 11924591 | 8,243,909 | record registered (Registered event; attestor = deployer) |
| 48 | records | `register agent record` [0x4aa1335a…4e46](https://sepolia.etherscan.io/tx/0x4aa1335ad30182aa059d77554cbfe573ecb7d7d453942ab7cb971ddc7bf54e46) | 11924591 | 6,349,184 | record registered (Registered event; attestor = deployer) |
| 49 | records | `register registry record` [0x0a3dbb3f…7fa9](https://sepolia.etherscan.io/tx/0x0a3dbb3f59f3d54d07d12eeb524a79c9aa60316ce0748264dbf826e5888e7fa9) | 11924591 | 5,459,517 | record registered (Registered event; attestor = deployer) |
| 50 | records | `claimDomain(finchip.ai)` [0x8c31dd10…c807](https://sepolia.etherscan.io/tx/0x8c31dd1069fb55c7edd4c57852a6439ee06ea613407a78fbe9aa6fa95b6bc807) | 11924591 | 354,175 | publisher domain claimed by the deployer |
| 51 | records | `claimDomain(registry.finchip.ai)` [0xdca92640…7cd8](https://sepolia.etherscan.io/tx/0xdca9264041ff0d29b3dfd44d43c44e42f577f86ff6895d6bd2924b72a8477cd8) | 11924591 | 357,646 | gateway domain claimed by the deployer |
| 2 (second holder) | records | `register skill record (by holder2, descriptor names the deployer)` [0x0997de17…1482](https://sepolia.etherscan.io/tx/0x0997de17cddd12381f3cbad354c8a9205ad65f1c6e9159026cbf193dd5ce1482) | 11924591 | 7,244,713 | skill #1 registered by its holder; the descriptor already names the deployer as value:controller and payee (attestor = holder2) |
| 3 (second holder) | transfer | `SkillToken.transferFrom(holder2 -> deployer, #1)` [0xa8c85d05…69c9](https://sepolia.etherscan.io/tx/0xa8c85d05461354bc7b0f8fe7c261b986792394dfe641fd7a761be21a105269c9) | 11924594 | 144,712 | skill #1 transferred to the deployer: controller moves, attestor stays holder2 -> record unadopted, withheld from discovery |
| 52 | adopt | `updateDescriptor skill (same hash: adoption by the new controller)` [0x394d2b88…5641](https://sepolia.etherscan.io/tx/0x394d2b88ffd3b577ad560ff9be11d6116bf017d442308ef9d64b2c7716885641) | 11924660 | 233,165 | the deployer re-commits the same descriptor hash: attestor = deployer -> record adopted and served again (DescriptorUpdated event) |
<!-- tx-table:end -->

Total fees: about 0.00005 ETH (base fee 532 wei, priority fee 0.001 gwei) plus the 0.001 ETH escrow of tender #18.

## What the run shows

1. Four kinds anchored to real contracts on a kernel with adoption semantics: a token-bound executable skill, a live token-bound tender with visible escrow, an address bound to the official identity registry, and a gateway endpoint.
2. The gateway serves them as ordinary ARD entries and passes the official conformance CLI; every entry carries `value:anchor`, `value:descriptorHash` and `value:adopted`, so any client can re-derive the record from the chain.
3. Control and adoption are distinct on chain: after the transfer the record stayed consistent but unadopted, was withheld from search and listing, remained inspectable, and returned to discovery after one `updateDescriptor` by the new controller — with the same hash, and regardless of the authored `value:controller`.
4. Binding states move with evidence, not with registration: `claimed` with one claimant and no acknowledgment, `verified` only once the domain acknowledges — and the acknowledgment file is the only step that remains on the publisher's side.

## Appendix — first deployment (2026-10-15, superseded)

The first kernel [`0x10c6d098F016Aeea6B0D52c68e5a8acB320a8A8A`](https://sepolia.etherscan.io/address/0x10c6d098F016Aeea6B0D52c68e5a8acB320a8A8A) (v0.3: `registrant` recorded at registration only, no adoption rule) stays on chain with its four records, its claims by two addresses and its history, and is no longer indexed by the reference gateway. Its run — thirty transactions, blocks 11918355–11919033, state read at 11919047 — deployed the kernel and the six contracts reused above, minted skill #1 to the deployer, minted and funded tender #17, bound the deployer to agentId 10855, registered one record per kind, claimed `finchip.ai`, transferred the skill to the second holder `0x81EcAc174eba407efEb6698927d16dC6494CA60C`, cancelled tender #17, replaced the four descriptors (the skill's by the second holder, as only the live controller can), and claimed `finchip.ai` from the second holder and `registry.finchip.ai` from the deployer. Its resolved state (skill `contested` L2, task `contested` L1, agent `contested` L2, registry `claimed` L1 before acknowledgment; all `verified` under the acknowledgment projection) and its conformance results are kept in `docs/gateway-sepolia-last-run.json` under `previousRun`; the records and claims in `deployments/sepolia.json` under `previousKernel`; the transactions in `deployments/sepolia-cases.json` under `previousRun`. All seven contracts of that run are Sourcify exact matches.

The first attempt at the deployments (nonces 0–5, not listed) ran out of gas because of Sepolia's gas schedule — every later limit came from a live `eth_estimateGas`. (Sepolia is already on the next protocol upgrade: receipts of plain ETH transfers carry a transfer log from the system address, and contract creation and storage are repriced.)

<!-- tx-table-v1:start -->
| # | phase | transaction | block | gas used | effect |
|---|---|---|---|---|---|
| 12 | identity | `ERC-8004 register() on the official Identity Registry` [0xdee170d3…4210](https://sepolia.etherscan.io/tx/0xdee170d37aea41609e05d8afe20696a987705bb9a0967746e11e9d1710cd4210) | 11918355 | 372,643 | agentId 10855 minted to the deployer on the official ERC-8004 Identity Registry |
| 13 | deploy | `deploy ARDOnchainRegistry` [0xb76dc471…357f](https://sepolia.etherscan.io/tx/0xb76dc47189ce509dc70fd543ac305c1e6fcdcbbd92258516e8c6092623d5357f) | 11918525 | 15,664,534 | created 0x10c6d098F016Aeea6B0D52c68e5a8acB320a8A8A |
| 14 | deploy | `deploy SkillAdapter` [0xd5a7a716…f91e](https://sepolia.etherscan.io/tx/0xd5a7a716c6fd7675dce37547782fe0dc6d4e7ccf4a1c04f15a301f9d6803f91e) | 11918525 | 2,137,831 | created 0x08Be92a9446592fAeaaB976556e09e028662F12F |
| 15 | deploy | `deploy TaskAdapter` [0x658bd29f…c81a](https://sepolia.etherscan.io/tx/0x658bd29f138651f7c515fd78fdcb3a2b6c4a2a8bf4854c37efa414651398c81a) | 11918525 | 3,197,130 | created 0x0BAB1fEE185A4803a1aC65F6dA59941eeCaE71dB |
| 16 | deploy | `deploy AIDRegistry(30d,365d)` [0x917e0fcf…b395](https://sepolia.etherscan.io/tx/0x917e0fcf7fdebf3fe26cc640d1c313299a2c2c24995b63ec5c3469d5c68ab395) | 11918525 | 13,388,719 | created 0x36E4a7BDe8a9D7d445042495180b64C7AF77Fd7E |
| 17 | deploy | `deploy AgentAdapter(aid)` [0x54d08df7…e2fb](https://sepolia.etherscan.io/tx/0x54d08df7f9f7d44b14ad5cb0deb482522df8722a9f93fabae88dfc68a49be2fb) | 11918525 | 2,200,494 | created 0x38898d038F4a8fCE3e13447bE7Eb1ECd128cE25C |
| 18 | deploy | `deploy RegistryAdapter` [0x79ff9da8…04f7](https://sepolia.etherscan.io/tx/0x79ff9da8bf3aef87a085fe5f9b5d9d325e830c442e66f5e6eac17ff7597d04f7) | 11918525 | 934,693 | created 0x32C85829da0be0Fd66ac45eF54d4c393Fcd7149E |
| 19 | deploy | `deploy SkillToken fixture` [0xeb87879d…6a2d](https://sepolia.etherscan.io/tx/0xeb87879d9d9cf19d3ed34f0113f9496bb04d96ed0d9bb65cbde71f8d31d96a2d) | 11918525 | 13,697,577 | created 0x82F20280D49F1DDC67e1840339dBbc534FEC8F97 |
| 20 | configure | `registerKind skill` [0x633daf66…9dab](https://sepolia.etherscan.io/tx/0x633daf66f3f789b1f322bace4a0f277d90b71bf9656403e3724dede028b79dab) | 11918539 | 135,663 | kind registered on the kernel (write-once) |
| 21 | configure | `registerKind task` [0x6a3d731b…3e80](https://sepolia.etherscan.io/tx/0x6a3d731b209a2b645a78859639095fcc9c496ebad615ef71e9e0ca07267a3e80) | 11918539 | 135,651 | kind registered on the kernel (write-once) |
| 22 | configure | `registerKind agent` [0xed101b1b…0c64](https://sepolia.etherscan.io/tx/0xed101b1bf1cc092fc848ad093a59c4de633674747852240fb6d39f6801a20c64) | 11918539 | 135,663 | kind registered on the kernel (write-once) |
| 23 | configure | `registerKind registry` [0x4b29bfb6…b026](https://sepolia.etherscan.io/tx/0x4b29bfb6a2b5c0ed1f4b99e75572a3e1de06d7d3168f188ed6f1d2ea2501b026) | 11918539 | 135,676 | kind registered on the kernel (write-once) |
| 24 | configure | `mintSkill #1 to deployer` [0x30ac36c2…e618](https://sepolia.etherscan.io/tx/0x30ac36c2ff1231f82e6336a28d84c9793c545ed82c210302f409136d0017e618) | 11918539 | 1,028,780 | skill #1 minted to the deployer (reference skill token) |
| 25 | anchors | `AIDRegistry.bind(official 8004, agentId)` [0xc798c2e0…75c3](https://sepolia.etherscan.io/tx/0xc798c2e00568ba63cdc2bc059d94243081f612e8dc019f046d0ddf356d2275c3) | 11918552 | 584,989 | address bound to agentId 10855; state ACTIVE |
| 26 | anchors | `TaskToken.mintTask -> #17` [0x5527e3ff…95be](https://sepolia.etherscan.io/tx/0x5527e3ff3565dc2fdc2d2476942efa4a7cc8d7725739baf301f640b1f95f95be) | 11918552 | 3,518,846 | tender #17 minted on the live tender kernel |
| 27 | records | `TaskToken.fundTask #17 0.001 ETH` [0x14b07e22…5613](https://sepolia.etherscan.io/tx/0x14b07e22ae970dd22e8cbc3db9768b3371e7193f3ecf73347042638a1b735613) | 11918594 | 381,329 | 0.001 ETH escrowed in the tender vault |
| 28 | records | `register skill record` [0x5c2847aa…1b24](https://sepolia.etherscan.io/tx/0x5c2847aace8580d4f7dbc15d0031a313615ff869a1e098dc3f5357589de41b24) | 11918594 | 8,242,388 | record registered (Registered event) |
| 29 | records | `register task record` [0x32bdadac…738d](https://sepolia.etherscan.io/tx/0x32bdadacaebd66080a133ca13326a926acacb37b0ee75079038803fac334738d) | 11918594 | 9,352,737 | record registered (Registered event) |
| 30 | records | `register agent record` [0x22e5b16a…b6f3](https://sepolia.etherscan.io/tx/0x22e5b16ac0de1422dbcb56f051179386889b9f03502dc424ea42bd879c8cb6f3) | 11918594 | 6,792,692 | record registered (Registered event) |
| 31 | records | `register registry record` [0xcb44d160…8620](https://sepolia.etherscan.io/tx/0xcb44d160605f8327217d31f8219c4e10be8e2fc13743043d8ca865a00dda8620) | 11918594 | 4,905,184 | record registered (Registered event) |
| 32 | records | `claimDomain(finchip.ai)` [0xcfad05bc…5d70](https://sepolia.etherscan.io/tx/0xcfad05bcba88e37ea33e241b8eae20f3e1a2f4ba363f5f9e839ab22bbd5b5d70) | 11918594 | 354,175 | domain claimed by the deployer |
| 33 | cases | `SkillToken.transferFrom(deployer -> 0x81EcAc174eba407efEb6698927d16dC6494CA60C, #1)` [0x70d82856…f105](https://sepolia.etherscan.io/tx/0x70d8285666ec71a5794038d25bddf0d5abab5445710ba48c6395e0ce1657f105) | 11918600 | 144,712 | skill #1 transferred to 0x81EcAc174eba407efEb6698927d16dC6494CA60C: controller follows the token |
| 34 | cases | `TaskToken.cancelTask(#17)` [0xdbc67773…7a46](https://sepolia.etherscan.io/tx/0xdbc677735d5792d384d08ae8b1faac2c9df92a8968427d4b61b31d93535a7a46) | 11918600 | 131,983 | tender #17 cancelled: no longer backed |
| 35 | descriptors | `updateDescriptor task` [0x4eccc28c…77be](https://sepolia.etherscan.io/tx/0x4eccc28cef7343264066c89505d676c814ff4c61d38acb5c9733434fb91a77be) | 11918970 | 885,477 | descriptor replaced by the controller (DescriptorUpdated event) |
| 36 | descriptors | `updateDescriptor agent` [0x4a3cb0ea…4a64](https://sepolia.etherscan.io/tx/0x4a3cb0eac2e7fa73666d84d79e16b99fb044b56e6d5f4c87313efdb1e8714a64) | 11918970 | 595,665 | descriptor replaced by the controller (DescriptorUpdated event) |
| 37 | descriptors | `updateDescriptor registry` [0x43470888…72b1](https://sepolia.etherscan.io/tx/0x4347088878fa5fdedb0604419494ea7379c6682030dcfb56250cc4ffb8c872b1) | 11918970 | 996,470 | descriptor replaced by the controller (DescriptorUpdated event) |
| 38 | descriptors | `claimDomain(registry.finchip.ai)` [0x5d0e65e5…d1fa](https://sepolia.etherscan.io/tx/0x5d0e65e52b34a81bf483042117edf9ebf596e3597ae52ac930529d588bcdd1fa) | 11918970 | 357,646 | gateway domain claimed by the deployer |
| 39 | descriptors | `fund holder2 0.002 ETH` [0x5687e224…6604](https://sepolia.etherscan.io/tx/0x5687e2241c9dea83be86235ccb40faaae65e9e9f3524e43a1f02616a1aeb6604) | 11918970 | 204,600 | second holder funded for its own transaction |
| 0 (second holder) | descriptors | `updateDescriptor skill (by holder2)` [0x6ae2586f…d222](https://sepolia.etherscan.io/tx/0x6ae2586fb12534e1cb6bade42ab1a64386f0566ce6f99bbb0b1298fcc157d222) | 11919033 | 727,484 | skill descriptor replaced by the new holder (only the live controller can) |
| 1 (second holder) | descriptors | `claimDomain(finchip.ai) (by holder2)` [0xadf8685b…b10d](https://sepolia.etherscan.io/tx/0xadf8685b2006ac46441fe5bfd917270b4be677a9526fd6be61c3d7d5f9d4b10d) | 11919033 | 256,255 | publisher domain claimed by the new holder as well (two claimants until the domain acknowledges) |
<!-- tx-table-v1:end -->

Total fees of the first run: about 0.0001 ETH plus the 0.001 ETH escrow (tender #17, since cancelled) and the 0.002 ETH given to the second holder.

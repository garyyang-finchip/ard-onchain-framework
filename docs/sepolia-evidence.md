# Sepolia evidence — ARD Onchain reference deployment

Deployed 2026-10-15 on Sepolia (chain 11155111) from `0xCcFDEE360c9CDc79005e4ddA9845f3A24EE37A25`. This document records what is on chain, what the gateway served from it, and how to check both. Machine-readable copies: `deployments/sepolia.json` (addresses, anchors, records, claims) and `deployments/sepolia-cases.json` (every transaction with block and gas).

## Contracts

| contract | address | role |
|---|---|---|
| `ARDOnchainRegistry` | [`0x10c6d098F016Aeea6B0D52c68e5a8acB320a8A8A`](https://sepolia.etherscan.io/address/0x10c6d098F016Aeea6B0D52c68e5a8acB320a8A8A) | the kernel (records, domain claims, kind table) |
| `SkillAdapter` | [`0x08Be92a9446592fAeaaB976556e09e028662F12F`](https://sepolia.etherscan.io/address/0x08Be92a9446592fAeaaB976556e09e028662F12F) | kind `skill` over token-bound executable skills |
| `TaskAdapter` | [`0x0BAB1fEE185A4803a1aC65F6dA59941eeCaE71dB`](https://sepolia.etherscan.io/address/0x0BAB1fEE185A4803a1aC65F6dA59941eeCaE71dB) | kind `task` over token-bound task tenders |
| `AgentAdapter` | [`0x38898d038F4a8fCE3e13447bE7Eb1ECd128cE25C`](https://sepolia.etherscan.io/address/0x38898d038F4a8fCE3e13447bE7Eb1ECd128cE25C) | kind `agent`, liveness from the AID registry below |
| `RegistryAdapter` | [`0x32C85829da0be0Fd66ac45eF54d4c393Fcd7149E`](https://sepolia.etherscan.io/address/0x32C85829da0be0Fd66ac45eF54d4c393Fcd7149E) | kind `registry` (gateway endpoints) |
| `AIDRegistry` (reference, 30 d default / 365 d max liveness) | [`0x36E4a7BDe8a9D7d445042495180b64C7AF77Fd7E`](https://sepolia.etherscan.io/address/0x36E4a7BDe8a9D7d445042495180b64C7AF77Fd7E) | address-anchored agent identity, bound to the official ERC-8004 Identity Registry |
| `SkillToken` (reference fixture, `ARD Onchain evidence skill` / `ARDS`) | [`0x82F20280D49F1DDC67e1840339dBbc534FEC8F97`](https://sepolia.etherscan.io/address/0x82F20280D49F1DDC67e1840339dBbc534FEC8F97) | the skill kernel the skill record is anchored to |

Live contracts used as anchors, not deployed by this run: the token-bound task tender kernel `TaskToken` [`0xA62059A498E40C4Ae4aF926E2B00C1Ff122bDdb7`](https://sepolia.etherscan.io/address/0xA62059A498E40C4Ae4aF926E2B00C1Ff122bDdb7) and the official ERC-8004 Identity Registry [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://sepolia.etherscan.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e).

Compiler: solc 0.8.24, optimizer 200 runs, EVM cancun; the standard-JSON inputs that reproduce the deployed creation bytecode byte for byte (metadata hash included) are kept with the deliverables of the run and submitted to the explorers (see "Source verification" below).

## Kinds

| kind | id (`keccak256("ard-onchain.kind.<name>")`) | adapter |
|---|---|---|
| `skill` | `0x75357da1ea166b9845548f84f7855b7f122cfc7dc349e5edbdca01bd8ca7b0bb` | `SkillAdapter` |
| `task` | `0x119c021f95332a1e2d06adbfe8e298dc2484ac0daa16e4cd837d8de82fbba87c` | `TaskAdapter` |
| `agent` | `0x283cdd5ece2ad33dc6be3a32a7a140a653c611b0296c9b54878ae0439bbef3a2` | `AgentAdapter` |
| `registry` | `0x455d1d9d2b151bdfaa173c1cee0ee26ece8e7bdb98830e8e3ca1e180989cf3c6` | `RegistryAdapter` |

## Anchors and records

One record per kind, all registered by the deployer (the controller of every anchor at registration time):

| kind | anchor (CAIP) | record id | canonical URN claimed |
|---|---|---|---|
| `skill` | `eip155:11155111/erc721:0x82f20280d49f1ddc67e1840339dbbc534fec8f97/1` | `0x4683d8e06dbef3a5e684813f14d46eeab4f8d6d1d6382bf02b70cb5469d0c4b8` | `urn:air:finchip.ai:skills:daily-finance-brief` |
| `task` | `eip155:11155111/erc721:0xa62059a498e40c4ae4af926e2b00c1ff122bddb7/17` | `0xd9f727824f1c84ed9b5315a1f3c0f31802402702d0e8a1d7b5b954133e309000` | `urn:air:finchip.ai:tenders:oracle-basis-feed` |
| `agent` | `eip155:11155111:0xccfdee360c9cdc79005e4dda9845f3a24ee37a25` | `0xb2e9339ea195ca1d497e808392a6946e8fdd297149d6aed5a092c8d20e476489` | `urn:air:finchip.ai:agents:finch-analyst` |
| `registry` | `eip155:11155111:0xccfdee360c9cdc79005e4dda9845f3a24ee37a25#fa187c88…27dd6a` | `0x2abc385a21e2dc7727d162bcfca7488dd794d6b0e199a4a7f45a87b23843418c` | `urn:air:registry.finchip.ai:registry:sepolia` |

- The skill is token #1 of the reference skill token (`skillMd` = SHA-256 of `# ARD Onchain evidence skill`, package digest `0x2473da0a…3144d`), minted to the deployer and later transferred to a second holder `0x81EcAc174eba407efEb6698927d16dC6494CA60C`.
- The task is tender #17 of the live tender kernel: native asset, 0.0005 ETH per completion, two completions, judged by the publisher, settle-by 60 days, 7-day judgment window; 0.001 ETH escrowed in the tender's vault; later cancelled by its update authority.
- The agent is the deployer address itself, bound through the reference AID registry to agentId 10855 on the official ERC-8004 Identity Registry (state `ACTIVE`).
- The registry anchor is the deployer address with the discriminator `keccak256("https://registry.finchip.ai/api/v1/")`.
- The deployer claimed `finchip.ai` on chain (`claimDomain`). The domain's acknowledgment file is `deployments/acknowledgment-finchip.ai.well-known-ard.json`, to be served as `https://finchip.ai/.well-known/ard.json`.

Descriptors are published as `data:application/json;base64` URIs, so every record is self-contained; the committed hash is SHA-256 over the RFC 8785 canonical form of the content members (`@context`, `@id`, `identifier`, `trustManifest` excluded).

## Resolved state served by the gateway (block 11918615)

`tools/gateway/server.js` indexed the kernel and served the four records as ARD entries; the vendored ARD conformance CLI passed in both modes (manifest with JSON Schema: `PASS`, 0 errors, 0 warnings, 2 informational; registry: `PASS`, 0 errors, 0 warnings).

| kind | identifier served | `value:binding` | `value:level` | `value:status` | why |
|---|---|---|---|---|---|
| `skill` | alias `urn:air:registry.finchip.ai:onchain:eip155-11155111-erc721-0x82f2…8f97-1` | `third-party` | 2 | Active | the token moved to the second holder, who has not claimed `finchip.ai`; the canonical URN is reported in `value:stale`; the skill is still backed and its package digest equals the anchor hint |
| `task` | alias `…-0xa620…ddb7-17` | `claimed` | 1 | Active | the deployer claimed `finchip.ai` but the domain has not acknowledged it yet; the tender is cancelled, so the record is no longer backed |
| `agent` | alias `…-0xccfd…7a25` | `claimed` | 2 | Active | claimed, not yet acknowledged; the identity is `ACTIVE` in the AID registry |
| `registry` | alias `…-0xccfd…7a25-fa18…dd6a` | `third-party` | 1 | Active | the URN publisher is `registry.finchip.ai`, which nobody has claimed on chain; registry endpoints are capped at level 1 |

Once `https://finchip.ai/.well-known/ard.json` serves the acknowledgment file, the task and agent records resolve as `verified` under their canonical URNs; the skill follows when the second holder claims `finchip.ai` (listed in the same file). The gateway at `registry.finchip.ai`, run with `--operator 0xCcFD…7A25 --registry-name sepolia`, acknowledges the registry record itself.

The sandbox that produced this run has no outbound RPC access, so the gateway was run against a pinned-block JSON-RPC replay of Sepolia (block 11918615, every `eth_getLogs` / `eth_call` answered from responses recorded through a browser relay); the gateway code is unchanged and anyone can repeat the run live:

```bash
node tools/gateway/server.js --rpc https://ethereum-sepolia-rpc.publicnode.com \
  --registry 0x10c6d098F016Aeea6B0D52c68e5a8acB320a8A8A --from-block 11918525 \
  --domain registry.finchip.ai --public-url https://registry.finchip.ai/api/v1/ \
  --operator 0xCcFDEE360c9CDc79005e4ddA9845f3A24EE37A25 --registry-name sepolia --port 9010
python3 tools/conformance/conformance-test manifest http://127.0.0.1:9010/.well-known/ard.json
python3 tools/conformance/conformance-test registry http://127.0.0.1:9010/api/v1
```

## Transactions

All transactions were signed offline and broadcast through a public Sepolia endpoint; the first attempt at the deployments (nonces 0–5, not listed) ran out of gas because Sepolia's current gas schedule charges several times more per deployed byte and per storage write than anvil's default schedule — every limit below comes from a live `eth_estimateGas`.

<!-- tx-table:start -->
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
<!-- tx-table:end -->

Total fees for the listed transactions: about 0.00009 ETH (base fee 17 wei, priority fee 0.001 gwei) plus the 0.001 ETH escrow.

## Source verification

The seven contracts' standard-JSON inputs were recompiled with solc 0.8.24+commit.e11b9ed9 and compared with the signed deployment transactions: the creation bytecode matches byte for byte, metadata hash included. Submission to Sourcify and Etherscan is recorded in `deployments/sepolia.json` under `verification` once accepted.

## What the run shows

1. Four kinds anchored to real contracts: a token-bound executable skill, a live token-bound tender with visible escrow, an address bound to the official identity registry, and a gateway endpoint.
2. The gateway serves them as ordinary ARD entries and passes the official conformance CLI; every entry carries `value:anchor` and `value:descriptorHash`, so any client can re-derive the record from the chain.
3. Controllers are derived live: after the transfer, `controllerOf(skill)` is the second holder, the claimed URN is reported stale and the record is served under the gateway alias; after the cancellation, the task record drops to level 1 while staying Active and discoverable.
4. Binding states move with evidence, not with registration: `claimed` until the domain acknowledges, `third-party` where the controller never claimed the publisher domain, `verified` only when both sides agree.

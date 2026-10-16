# Sepolia evidence runbook

The evidence set of `docs/design-memo.md` §6 — one record per kind, a domain claim, a skill transfer that makes a canonical URN stale and leaves the record unadopted, the adoption by the new controller, a tender closing — was produced on 2026-10-15 (first kernel) and 2026-10-16 (kernel v1.1 with the adoption demonstration); the result is in `docs/sepolia-evidence.md` and `deployments/`. This page records how to produce it, either with the Foundry script (the reference path, rehearsed on anvil) or by signing offline when the build environment has no RPC access (the path actually used).

## Inputs

| variable | meaning |
|---|---|
| `TASK_TOKEN` | the live token-bound task tender kernel on Sepolia (`0xA62059A498E40C4Ae4aF926E2B00C1Ff122bDdb7`) |
| `IDENTITY_REGISTRY_8004` | the official ERC-8004 Identity Registry on Sepolia (`0x8004A818BFB912233c491871b3d84c89A494BD9e`) |
| `AID_REGISTRY` | optional; an existing agent identity registry. Unset: the script deploys the reference one |
| `SKILL_TOKEN` | optional; an existing skill token contract. Unset: the script deploys the reference one as a fixture |
| `SKILL_PKG`, `TASK_HASH` | SHA-256 digests of the evidence skill package and task package (any fixed bytes; they are what `value:provenance.packageDigest` must equal) |
| `PUBLISHER_DOMAIN` | the domain the deployer claims (`finchip.ai`) |
| `SECOND_HOLDER` | the address that receives the skill in the transfer phase |

The deployer key signs everything and is the controller of all four records at registration time.

## Gas on Sepolia

Sepolia's current gas schedule is not anvil's default schedule: on 2026-10-15 a contract creation cost about 1,400–1,700 gas more per deployed byte than on anvil (kernel: 15.66 M instead of ~2.6 M), and a `register` call storing a 1.2–2.2 KB `data:` descriptor cost 4.9–9.4 M. Gas limits copied from a local replay run out of gas on chain; take every limit from a live `eth_estimateGas` against Sepolia and keep `maxFeePerGas` low (the node requires `balance >= gasLimit × maxFeePerGas` per transaction; the base fee was 17 wei). Fees are negligible: the whole run cost under 0.0001 ETH plus the 0.001 ETH escrow.

## Phases (Foundry script)

```bash
export FOUNDRY_SOLC=...  # if solc cannot be downloaded
export RPC=https://<sepolia-rpc> PK=0x<deployer-key>
export TASK_TOKEN=0xA62059A498E40C4Ae4aF926E2B00C1Ff122bDdb7
export IDENTITY_REGISTRY_8004=0x8004A818BFB912233c491871b3d84c89A494BD9e
export SKILL_PKG=0x$(printf 'ard-onchain evidence skill package' | sha256sum | cut -d' ' -f1)
export TASK_HASH=0x$(printf 'ard-onchain evidence task package' | sha256sum | cut -d' ' -f1)

forge script script/SepoliaEvidence.s.sol:SepoliaEvidence --sig "deployCore()" --rpc-url $RPC --private-key $PK --broadcast
forge script script/SepoliaEvidence.s.sol:SepoliaEvidence --sig "anchors()"    --rpc-url $RPC --private-key $PK --broadcast
node tools/make-sepolia-descriptors.js --chain-id 11155111 --skill-pkg $SKILL_PKG --task-hash $TASK_HASH \
     --controller 0x<deployer> --domain finchip.ai --gateway-url https://registry.finchip.ai/api/v1/ \
     --registry 0x<kernel> --skill-token 0x<skill token> --skill-id 1 --task-token $TASK_TOKEN --task-id <id> \
     --settle-by <unix seconds of the tender's settleBy>
PUBLISHER_DOMAIN=finchip.ai forge script script/SepoliaEvidence.s.sol:SepoliaEvidence --sig "records()" --rpc-url $RPC --private-key $PK --broadcast
# publish the acknowledgment (below), then
SECOND_HOLDER=0x<other> forge script script/SepoliaEvidence.s.sol:SepoliaEvidence --sig "transfer()" --rpc-url $RPC --private-key $PK --broadcast
forge script script/SepoliaEvidence.s.sol:SepoliaEvidence --sig "adopt()" --rpc-url $RPC --private-key 0x<second holder key> --broadcast
forge script script/SepoliaEvidence.s.sol:SepoliaEvidence --sig "close()" --rpc-url $RPC --private-key $PK --broadcast
```

`adopt()` is broadcast by the account that holds the skill after `transfer()`: it re-commits the descriptor the record already carries (same hash), which makes that account the attestor. Between `transfer()` and `adopt()` the gateway withholds the skill record from search and listing and reports it as unadopted at `GET /records/<id>`.

`forge script` estimates gas against the target RPC, so the schedule note above is handled; `deployments/sepolia.json` accumulates the state between phases.

## Phases (offline signing)

The 2026-10-15 run was signed in an environment that could not reach any RPC: each phase was planned as a list of transactions (predicted `CREATE` addresses from the deployer's nonce, calldata from the Foundry artifacts), estimated with `eth_estimateGas` through a relay, signed with ethers v6 (EIP-1559, chain 11155111) and broadcast with `eth_sendRawTransaction`, the returned hash checked against the hash of the signed bytes. Phases were sequenced so that every call was estimated against the state the previous phase had created: deployments → kinds and the skill mint → the AID binding and the tender mint → escrow, the four `register` calls and `claimDomain` → the transfer and the cancellation → the descriptor replacements (three by the deployer, the skill's by the second holder from its own funded account) and the remaining domain claims. Receipts, addresses and the resolved record views were then read at one pinned block and written to `deployments/sepolia.json` and `deployments/sepolia-cases.json`.

The 2026-10-16 run (kernel v1.1) used the same relay: kernel deployment → the four `registerKind` calls against the existing adapters and a new tender mint → escrow, three `register` calls and two `claimDomain` calls by the deployer plus the skill's `register` by the address holding skill #1 → the transfer of the skill to the deployer (read at one pinned block: the unadopted state) → the deployer's `updateDescriptor` with the unchanged hash (read at a second pinned block: the adopted state). The gateway was run against both snapshots.

## Acknowledgment

For the skill, task and agent records to reach `binding = verified` under their canonical URNs, `https://finchip.ai/.well-known/ard.json` must list the controllers and the entries. `tools/make-sepolia-descriptors.js` writes the file to serve as `deployments/acknowledgment-finchip.ai.well-known-ard.json`:

```json
{
  "@context": [ "https://agenticresourcediscovery.org/context/v1", { "value": "https://eips.ethereum.org/assets/eip-8444/ns#" } ],
  "value:controllers": [ "did:pkh:eip155:11155111:0x<deployer>", "did:pkh:eip155:11155111:0x<second holder>" ],
  "entries": [ <skill descriptor>, <task descriptor>, <agent descriptor> ]
}
```

The registry record's publisher domain is the gateway's own host; the gateway acknowledges it by serving its manifest with `--operator 0x<deployer> --registry-name sepolia`. Without the acknowledgments the records resolve as `claimed` (or `third-party` where the controller never claimed the domain) and are served under gateway aliases, which is also a legitimate evidence state and is what `docs/sepolia-evidence.md` records.

## What the run proves

1. Four kinds anchored to real contracts: the reference skill token, the live tender kernel (escrow visible in the token's vault), an address bound to the official identity registry, a gateway endpoint.
2. The gateway (`node tools/gateway/server.js --rpc $RPC --registry <kernel> --domain registry.finchip.ai ...`) serves them as ARD entries; the conformance CLI passes against it.
3. After `transfer()`, `controllerOf(skill)` is the new holder, the canonical URN is reported as stale, and the record is unadopted: withheld from search and listing, inspectable at `GET /records/<id>` with `value:adopted: false`. After `adopt()` by the new holder the record is served again under the alias. After `close()`, the task record drops to level 1.

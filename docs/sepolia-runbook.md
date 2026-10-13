# Sepolia evidence runbook

`script/SepoliaEvidence.s.sol` deploys the kernel with its four adapters and produces the evidence set of `docs/design-memo.md` §6: one record per kind, one domain claim, one skill transfer that makes a canonical URN stale, one tender closing. Each phase is a separate `--sig` so that it can be retried; state accumulates in `deployments/sepolia.json`. Rehearsed end to end on anvil on 2026-10-13.

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

The deployer key signs everything and is the controller of all four records. Budget: about 0.02 Sepolia ETH (deployment ~2.3 M gas, anchors ~1.1 M, records ~0.6 M, plus 0.001 ETH escrow).

## Phases

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
     --controller 0x<deployer> --domain finchip.ai --gateway-url https://registry.finchip.ai/api/v1/
PUBLISHER_DOMAIN=finchip.ai forge script script/SepoliaEvidence.s.sol:SepoliaEvidence --sig "records()" --rpc-url $RPC --private-key $PK --broadcast
# publish the acknowledgment (below), then
SECOND_HOLDER=0x<other> forge script script/SepoliaEvidence.s.sol:SepoliaEvidence --sig "transfer()" --rpc-url $RPC --private-key $PK --broadcast
forge script script/SepoliaEvidence.s.sol:SepoliaEvidence --sig "close()" --rpc-url $RPC --private-key $PK --broadcast
```

## Acknowledgment

For the skill and agent records to reach `binding = verified` with their canonical URNs, `https://finchip.ai/.well-known/ard.json` must list the deployer and the entries:

```json
{
  "value:controllers": ["did:pkh:eip155:11155111:0x<deployer>"],
  "entries": [ <skill descriptor>, <agent descriptor> ]
}
```

The descriptors are the `descriptor` members of `deployments/sepolia-descriptors.json`. Without the acknowledgment the records resolve as `claimed` and are served under gateway aliases, which is also a legitimate evidence state.

## What the run proves

1. Four kinds anchored to real contracts: the reference skill token, the live tender kernel (escrow visible in the token's vault), an address bound to the official identity registry, a gateway endpoint.
2. The gateway (`node tools/gateway/server.js --rpc $RPC --registry <kernel> --domain registry.finchip.ai ...`) serves them as ARD entries; the conformance CLI passes against it.
3. After `transfer()`, `controllerOf(skill)` is the second holder, the canonical URN is reported as stale, and the record is served under the alias; after `close()`, the task record drops to level 1.

Record the transactions (block, hash, gas) in `deployments/sepolia-cases.json` and the addresses in the README table when done.

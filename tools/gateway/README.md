# ARD Onchain gateway (reference resolver)

A conformant ARD registry whose index is an ARD Onchain Registry instance. Plain Node.js (22+), ethers v6, no framework.

```bash
npm install
node tools/gateway/server.js \
  --rpc https://<rpc> --registry 0x<kernel> --domain registry.example \
  --port 9010 --base-path /api/v1 --public-url https://registry.example/api/v1/ \
  --operator 0x<operator> [--referral https://other.example/api/v1/]... [--upstream https://peer.example/api/v1/]...
```

What it does on every sync (`--sync-interval`, default 15 s): reads `Registered` events from `--from-block`, refreshes every record's live views (`recordOf`, `controllerOf`, `backed`, `anchorHintOf`), fetches each descriptor (`data:`, `http(s):`, `file:`, `ipfs:` through `--ipfs-gateway`), drops descriptors whose content hash does not match the record, resolves the binding of the record's URN publisher domain against onchain claims plus the domain's `/.well-known/ard.json`, and builds the served entry with the resolved `value:` members.

Endpoints (relative to `--base-path`):

| route | ARD | notes |
|---|---|---|
| `POST /search` | MUST | `query.text`, `query.filter` (keys AND, values OR, dot paths), `federation` `auto` / `referrals` / `none`, `pageSize` ≤ 100, `pageToken`; results carry `score` 0–100 and `source` |
| `POST /explore` | SHOULD | `resultType: "facets"` with `facets: [{ field, limit, minCount }]`, or `resultType: { facets: [...] }` |
| `GET /agents` | MAY | deterministic listing; `filter=key="value" AND ...`, `pageSize`, `pageToken` |
| `GET /records/<recordId>` | — | the raw record, consistency verdict and served entry |
| `GET /healthz` | — | sync state and excluded records with reasons |
| `GET /.well-known/ard.json` (root) | MUST | the gateway's own `application/ai-registry+json` entry plus every served record |

Test overrides: `--manifest-override <domain>=<file>` substitutes a domain's manifest; `--descriptor-override <uri>=<file>` substitutes a descriptor.

`node tools/gateway/test.js` runs the end-to-end scenario on a local anvil (see `docs/test-record.md`), including the vendored ARD conformance CLI (`tools/conformance/`, Apache-2.0, ards-project).

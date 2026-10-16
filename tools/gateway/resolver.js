// Resolver: turns onchain records into served ARD entries with resolved facets.
'use strict';

const fs = require('fs');
const { ethers } = require('ethers');
const ard = require('../lib/ard');

const STATUS_NAMES = ['None', 'Active', 'Suspended', 'Retired'];
const KIND_BY_ID = Object.fromEntries(ard.KIND_NAMES.map((n) => [ard.kindId(n), n]));

/** Fetch a descriptor by URI: data:, http(s):, ipfs: (through a gateway). Returns parsed JSON or null. */
async function fetchJson(uri, { ipfsGateway, fetchImpl = fetch, overrides = {} } = {}) {
  try {
    if (overrides[uri]) return JSON.parse(fs.readFileSync(overrides[uri], 'utf8'));
    if (uri.startsWith('ipfs://')) uri = ipfsGateway.replace(/\/$/, '') + '/' + uri.slice('ipfs://'.length);
    if (uri.startsWith('file://')) return JSON.parse(fs.readFileSync(uri.slice('file://'.length), 'utf8'));
    const res = await fetchImpl(uri, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

/** The domain's /.well-known/ard.json, with an override table for tests. */
async function fetchManifest(domain, opts) {
  if (!domain) return null;
  const { manifestOverrides = {} } = opts;
  if (manifestOverrides[domain]) {
    try {
      return JSON.parse(fs.readFileSync(manifestOverrides[domain], 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return fetchJson(`https://${domain}/.well-known/ard.json`, opts);
}

/** Binding state of (domain, controller): onchain claims + domain acknowledgment. */
function bindingState(domain, controller, claimants, manifest) {
  const c = controller.toLowerCase();
  const claimed = (claimants || []).map((a) => a.toLowerCase());
  if (!claimed.includes(c)) return 'unbound';
  const acknowledged = new Set();
  if (manifest) {
    for (const a of manifest['value:controllers'] || []) acknowledged.add(ard.didToAddress(a));
    for (const e of manifest.entries || []) if (e['value:controller']) acknowledged.add(ard.didToAddress(e['value:controller']));
  }
  if (acknowledged.has(c)) return 'verified';
  return claimed.length > 1 ? 'contested' : 'claimed';
}

function hintMatchesProvenance(kind, hintHex, authored) {
  if (!hintHex || /^0x0+$/.test(hintHex)) return true; // the kind carries no hint
  if (kind !== 'skill' && kind !== 'task') return true; // only package-bearing kinds are compared
  const prov = authored['value:provenance'];
  const stated = prov && prov.packageDigest;
  if (!stated) return false;
  return stated.toLowerCase() === `sha256:${hintHex.slice(2).toLowerCase()}`;
}

/** A record is adopted when the controller that committed its current descriptor is still its controller. */
function isAdopted(rec) {
  if (!rec.controller || rec.controller === ethers.ZeroAddress || !rec.attestor) return false;
  return rec.attestor.toLowerCase() === rec.controller.toLowerCase();
}

/**
 * Build the served view of one record.
 * @param rec   { recordId, kind, target, id, descriptorHash, descriptorURI, urn, status, attestor, controller, backed, anchorHint }
 * @param ctx   { chainId, registryAddress, gatewayDomain, claimsOf(domainHash)->address[], fetch options }
 * The result carries `consistent` (descriptor fetched and hash matches) and `adopted` (attestor == controller);
 * gateways serve a record in discovery only when both hold.
 */
async function resolveRecord(rec, ctx) {
  const kind = KIND_BY_ID[rec.kind] || rec.kind;
  const out = { recordId: rec.recordId, kind, consistent: false, adopted: isAdopted(rec), reasons: [] };
  if (!out.adopted) out.reasons.push('descriptor not adopted by the current controller');

  const authoredRaw = rec.descriptorURI ? await fetchJson(rec.descriptorURI, ctx) : null;
  if (!authoredRaw) {
    out.reasons.push('descriptor unavailable');
    return out;
  }
  const h = ard.descriptorHash(authoredRaw);
  if (h.hex.toLowerCase() !== rec.descriptorHash.toLowerCase()) {
    out.reasons.push(`descriptor hash mismatch: chain ${rec.descriptorHash} fetched ${h.hex}`);
    return out;
  }
  out.consistent = true;

  const content = ard.authoredDescriptor(authoredRaw);
  const caip = ard.anchorCaip(kind, ctx.chainId, rec.target, rec.id);
  const alias = ard.gatewayAlias(ctx.gatewayDomain, caip);

  // binding of (URN publisher domain, controller)
  let binding = 'none';
  let canonical = null;
  const stale = [];
  if (rec.urn) {
    const pub = ard.urnPublisher(rec.urn);
    if (!pub) {
      binding = 'none';
    } else {
      const claimants = await ctx.claimsOf(ard.domainHash(pub));
      const manifest = await fetchManifest(pub, ctx);
      const st = rec.controller === ethers.ZeroAddress ? 'unbound' : bindingState(pub, rec.controller, claimants, manifest);
      binding = st === 'unbound' ? 'third-party' : st;
      const listed = !!(manifest && (manifest.entries || []).some((e) => e.identifier === rec.urn));
      if (st === 'verified' && listed) canonical = rec.urn;
      else stale.push(rec.urn);
    }
  }

  const statusName = STATUS_NAMES[rec.status] || String(rec.status);
  let level = 0;
  if (statusName === 'Active') {
    level = 1;
    if (rec.backed && hintMatchesProvenance(kind, rec.anchorHint, content)) level = 2;
  }

  const entry = {
    identifier: canonical || alias,
    trustManifest: { identity: canonical ? ard.urnPublisher(canonical) : ctx.gatewayDomain },
    ...content,
    'value:anchor': caip,
    'value:adopted': out.adopted,
    'value:aliases': [alias],
    'value:binding': binding,
    'value:level': level,
    'value:status': statusName,
    'value:registry': `eip155:${ctx.chainId}:${ctx.registryAddress.toLowerCase()}`,
    'value:descriptorHash': h.digest,
  };
  if (canonical) entry['value:canonical'] = canonical;
  if (stale.length) entry['value:stale'] = stale;
  if (!canonical && rec.urn) entry['value:claimedUrn'] = rec.urn;

  out.entry = entry;
  out.alias = alias;
  out.canonical = canonical;
  return out;
}

module.exports = { resolveRecord, isAdopted, bindingState, fetchJson, fetchManifest, hintMatchesProvenance, KIND_BY_ID, STATUS_NAMES };

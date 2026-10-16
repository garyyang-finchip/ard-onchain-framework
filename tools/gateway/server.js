#!/usr/bin/env node
// ARD Onchain gateway: a conformant ARD registry whose index is an ARD Onchain Registry instance.
//
//   node tools/gateway/server.js --rpc http://127.0.0.1:8545 --registry 0x... --domain registry.example \
//        --port 9010 --base-path /api/v1 [--manifest-override alice.example=/path/ard.json]... \
//        [--descriptor-override <uri>=/path/desc.json]... [--referral <registry-url>]... [--upstream <registry-url>]...
//
// Endpoints (relative to --base-path): POST /search (MUST), POST /explore (SHOULD), GET /agents (MAY),
// GET /records/<recordId>, GET /healthz; and GET /.well-known/ard.json at the root.
'use strict';

const http = require('http');
const { URL } = require('url');
const { ethers } = require('ethers');
const { Indexer } = require('./indexer');
const { resolveRecord } = require('./resolver');
const search = require('./search');

function parseArgs(argv) {
  const o = {
    rpc: 'http://127.0.0.1:8545',
    registry: null,
    domain: 'localhost',
    port: 9010,
    basePath: '/api/v1',
    fromBlock: 0,
    ipfsGateway: 'https://ipfs.io/ipfs',
    manifestOverrides: {},
    descriptorOverrides: {},
    referrals: [],
    upstreams: [],
    operator: null,
    registryName: 'main',
    publicUrl: null,
    syncIntervalMs: 15000,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === '--rpc') (o.rpc = v), i++;
    else if (a === '--registry') (o.registry = v), i++;
    else if (a === '--domain') (o.domain = v), i++;
    else if (a === '--port') (o.port = Number(v)), i++;
    else if (a === '--base-path') (o.basePath = v.replace(/\/$/, '')), i++;
    else if (a === '--from-block') (o.fromBlock = Number(v)), i++;
    else if (a === '--ipfs-gateway') (o.ipfsGateway = v), i++;
    else if (a === '--manifest-override') {
      const [d, p] = v.split('=');
      o.manifestOverrides[d] = p;
      i++;
    } else if (a === '--descriptor-override') {
      const idx = v.indexOf('=');
      o.descriptorOverrides[v.slice(0, idx)] = v.slice(idx + 1);
      i++;
    } else if (a === '--referral') o.referrals.push(v), i++;
    else if (a === '--upstream') o.upstreams.push(v), i++;
    else if (a === '--operator') (o.operator = v), i++;
    else if (a === '--registry-name') (o.registryName = v), i++;
    else if (a === '--public-url') (o.publicUrl = v), i++;
    else if (a === '--sync-interval') (o.syncIntervalMs = Number(v)), i++;
  }
  return o;
}

async function createGateway(cfg) {
  const provider = new ethers.JsonRpcProvider(cfg.rpc);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  const indexer = new Indexer(provider, cfg.registry, { fromBlock: cfg.fromBlock });
  const state = { entries: [], excluded: [], byId: new Map(), lastSync: null };
  const publicUrl = cfg.publicUrl || `http://${cfg.domain}:${cfg.port}${cfg.basePath}/`;

  const ctx = {
    chainId,
    registryAddress: cfg.registry,
    gatewayDomain: cfg.domain,
    ipfsGateway: cfg.ipfsGateway,
    manifestOverrides: cfg.manifestOverrides,
    overrides: cfg.descriptorOverrides,
    claimsOf: (h) => indexer.claimsOf(h),
  };

  async function sync() {
    const records = await indexer.sync();
    const entries = [];
    const excluded = [];
    const byId = new Map();
    for (const rec of records.values()) {
      const r = await resolveRecord(rec, ctx);
      byId.set(rec.recordId, { rec, resolved: r });
      if (r.consistent && r.adopted && r.entry['value:status'] !== 'Retired') entries.push(r.entry);
      else excluded.push({ recordId: rec.recordId, reasons: r.reasons.length ? r.reasons : ['retired'] });
    }
    state.entries = entries;
    state.excluded = excluded;
    state.byId = byId;
    state.lastSync = new Date().toISOString();
    return state;
  }

  function selfEntry() {
    return {
      identifier: `urn:air:${cfg.domain}:registry:${cfg.registryName}`,
      displayName: `ARD Onchain gateway (${cfg.domain})`,
      description: `ARD registry endpoint indexing the ARD Onchain Registry at eip155:${chainId}:${cfg.registry}. Results carry onchain anchors and descriptor hashes for independent verification.`,
      type: 'application/ai-registry+json',
      url: publicUrl,
      representativeQueries: ['onchain skills and tasks with verifiable anchors', 'agent tenders paying onchain'],
      trustManifest: { identity: cfg.domain },
      'value:kind': 'registry',
      ...(cfg.operator ? { 'value:controller': `did:pkh:eip155:${chainId}:${cfg.operator.toLowerCase()}` } : {}),
      'value:indexes': [`eip155:${chainId}:${cfg.registry.toLowerCase()}`],
    };
  }

  function manifest() {
    return {
      '@context': ['https://agenticresourcediscovery.org/context/v1', { value: 'https://eips.ethereum.org/assets/eip-8444/ns#' }],
      ...(cfg.operator ? { 'value:controllers': [`did:pkh:eip155:${chainId}:${cfg.operator.toLowerCase()}`] } : {}),
      entries: [selfEntry(), ...state.entries],
    };
  }

  function referralEntries() {
    return cfg.referrals.map((u, i) => ({
      identifier: `urn:air:${new URL(u).hostname}:registry:referral-${i}`,
      type: 'application/ai-registry+json',
      url: u,
    }));
  }

  async function doSearch(body) {
    const q = body.query || {};
    const text = typeof q.text === 'string' ? q.text : '';
    if (!text) return { status: 400, body: { errorCode: 'INVALID_ARGUMENT', message: "Missing 'query.text'." } };
    const federation = body.federation || 'auto';
    const pageSize = Math.min(100, Math.max(1, Number(body.pageSize) || 10));
    const offset = search.decodeToken(body.pageToken);

    let results = state.entries
      .filter((e) => search.matchesFilter(e, q.filter))
      .map((e) => ({ ...e, score: search.score(e, text), source: publicUrl }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || (a.identifier < b.identifier ? -1 : 1));

    if (federation === 'auto') {
      for (const u of cfg.upstreams) {
        try {
          const res = await fetch(u.replace(/\/$/, '') + '/search', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ query: q, federation: 'none', pageSize }),
          });
          if (res.ok) {
            const data = await res.json();
            for (const r of data.results || []) results.push({ ...r, source: r.source || u });
          }
        } catch (e) {
          /* an unreachable upstream is skipped */
        }
      }
      results.sort((a, b) => b.score - a.score);
    }
    const page = results.slice(offset, offset + pageSize);
    const out = { results: page };
    if (federation === 'referrals') out.referrals = referralEntries();
    if (offset + pageSize < results.length) out.pageToken = search.encodeToken(offset + pageSize);
    return { status: 200, body: out };
  }

  function doExplore(body) {
    const q = body.query || {};
    let spec = body.resultType;
    if (spec === 'facets' || spec === undefined) spec = body.facets || [{ field: 'type' }];
    else if (spec && typeof spec === 'object' && Array.isArray(spec.facets)) spec = spec.facets;
    else return { status: 400, body: { errorCode: 'INVALID_ARGUMENT', message: "Unsupported 'resultType'." } };
    const pool = state.entries
      .filter((e) => search.matchesFilter(e, q.filter))
      .filter((e) => !q.text || search.score(e, q.text) > 0);
    return { status: 200, body: { resultType: 'facets', facets: search.facets(pool, spec) } };
  }

  function doList(url) {
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));
    const offset = search.decodeToken(url.searchParams.get('pageToken'));
    const filterParam = url.searchParams.get('filter');
    let items = state.entries.slice().sort((a, b) => (a.identifier < b.identifier ? -1 : 1));
    if (filterParam) {
      // minimal EBNF subset: key="value" [AND key="value"]...
      const filter = {};
      for (const clause of filterParam.split(/\s+AND\s+/i)) {
        const m = /^\s*([^=\s]+)\s*=\s*"?([^"]*)"?\s*$/.exec(clause);
        if (m) (filter[m[1]] = filter[m[1]] || []).push(m[2]);
      }
      items = items.filter((e) => search.matchesFilter(e, filter));
    }
    const page = items.slice(offset, offset + pageSize);
    const out = { items: page, total: items.length };
    out.pageToken = offset + pageSize < items.length ? search.encodeToken(offset + pageSize) : null;
    return { status: 200, body: out };
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const send = (status, body) => {
      res.writeHead(status, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
      });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.method === 'OPTIONS') return send(204, {});
      const rel = url.pathname.startsWith(cfg.basePath) ? url.pathname.slice(cfg.basePath.length) || '/' : null;
      if (req.method === 'GET' && url.pathname === '/.well-known/ard.json') return send(200, manifest());
      if (rel === null) return send(404, { errorCode: 'NOT_FOUND', message: `Route ${req.method} ${url.pathname} not found.` });
      if (req.method === 'GET' && (rel === '/healthz' || rel === '/')) {
        return send(200, {
          ok: true,
          chainId,
          registry: cfg.registry,
          records: state.byId.size,
          served: state.entries.length,
          excluded: state.excluded,
          lastSync: state.lastSync,
        });
      }
      if (req.method === 'GET' && rel === '/agents') {
        const r = doList(url);
        return send(r.status, r.body);
      }
      if (req.method === 'GET' && rel.startsWith('/records/')) {
        const id = rel.slice('/records/'.length);
        const hit = state.byId.get(id);
        if (!hit) return send(404, { errorCode: 'NOT_FOUND', message: 'unknown record' });
        return send(200, { record: { ...hit.rec, id: String(hit.rec.id) }, consistent: hit.resolved.consistent, adopted: hit.resolved.adopted, reasons: hit.resolved.reasons, entry: hit.resolved.entry || null });
      }
      if (req.method === 'POST' && (rel === '/search' || rel === '/explore')) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        let body;
        try {
          body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        } catch (e) {
          return send(400, { errorCode: 'INVALID_ARGUMENT', message: `Invalid JSON: ${e.message}` });
        }
        const r = rel === '/search' ? await doSearch(body) : doExplore(body);
        return send(r.status, r.body);
      }
      return send(404, { errorCode: 'NOT_FOUND', message: `Route ${req.method} ${url.pathname} not found.` });
    } catch (e) {
      return send(500, { errorCode: 'INTERNAL_ERROR', message: e.message });
    }
  });

  return {
    cfg,
    chainId,
    state,
    sync,
    manifest,
    server,
    listen: () =>
      new Promise((resolve) => server.listen(cfg.port, '127.0.0.1', () => resolve(server.address().port))),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

if (require.main === module) {
  const cfg = parseArgs(process.argv.slice(2));
  if (!cfg.registry) {
    console.error('usage: server.js --rpc <url> --registry <address> --domain <gateway-domain> [--port N] [--base-path /api/v1]');
    process.exit(2);
  }
  createGateway(cfg)
    .then(async (gw) => {
      await gw.sync();
      const port = await gw.listen();
      console.log(`ARD Onchain gateway for chain ${gw.chainId}: http://127.0.0.1:${port}${cfg.basePath}/  (${gw.state.entries.length} entries served, ${gw.state.excluded.length} excluded)`);
      setInterval(() => gw.sync().catch((e) => console.error('sync failed:', e.message)), cfg.syncIntervalMs);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { createGateway, parseArgs };

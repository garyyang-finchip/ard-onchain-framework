#!/usr/bin/env node
// End-to-end: a local chain (anvil) with the real kernel, adapters, skill token, task token and AID
// registry; records of all four kinds plus one inconsistent record; the gateway serving them; the
// official ARD conformance CLI probing the gateway. Run after `forge build`:
//
//   node tools/gateway/test.js
'use strict';

const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ethers } = require('ethers');
const ard = require('../lib/ard');
const { createGateway } = require('./server');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'out');
const EX = path.join(ROOT, 'assets', 'erc-8444', 'examples');
const PORT = 9011;
const RPC_PORT = 8547;
const GATEWAY_DOMAIN = 'registry.example';
const BASE = `http://127.0.0.1:${PORT}/api/v1`;

function artifact(name, file) {
  const p = path.join(OUT, file || `${name}.sol`, `${name}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  return { abi: j.abi, bytecode: j.bytecode.object };
}

async function deploy(signer, name, args = [], file) {
  const a = artifact(name, file);
  const f = new ethers.ContractFactory(a.abi, a.bytecode, signer);
  const c = await f.deploy(...args);
  await c.waitForDeployment();
  return c;
}

function dataUri(obj) {
  return 'data:application/json;base64,' + Buffer.from(JSON.stringify(obj)).toString('base64');
}

function sha256Hex(bytes) {
  return ethers.sha256(bytes);
}

const did = (chainId, addr) => `did:pkh:eip155:${chainId}:${addr.toLowerCase()}`;

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
async function get(url) {
  const res = await fetch(url);
  return { status: res.status, body: await res.json() };
}

function conformance(args) {
  // the vendored CLI resolves its schema at ../../spec/schemas relative to its own location
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ard-conf-'));
  fs.mkdirSync(path.join(tmp, 'conformance', 'bin'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'spec', 'schemas'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'tools', 'conformance', 'conformance-test'), path.join(tmp, 'conformance', 'bin', 'conformance-test'));
  fs.copyFileSync(path.join(ROOT, 'assets', 'erc-8444', 'vendor', 'ard', 'ard-entry.schema.json'), path.join(tmp, 'spec', 'schemas', 'ard-entry.schema.json'));
  // async: the gateway runs in this process, so the event loop must keep serving while the CLI probes it;
  // loopback must not be routed through an outbound proxy configured in the environment
  const env = { ...process.env, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' };
  return new Promise((resolve) => {
    const child = spawn('python3', ['-I', path.join(tmp, 'conformance', 'bin', 'conformance-test'), ...args], { env });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
}

(async () => {
  const anvil = spawn('anvil', ['--port', String(RPC_PORT), '--silent']);
  const record = { steps: [] };
  const step = (s) => {
    record.steps.push(s);
    console.log('  -', s);
  };
  let gw;
  try {
    await new Promise((r) => setTimeout(r, 1500));
    const provider = new ethers.JsonRpcProvider(`http://127.0.0.1:${RPC_PORT}`);
    const chainId = Number((await provider.getNetwork()).chainId);
    const [deployer, alice, bob, carol, mallory, operator, dave] = await Promise.all(
      [0, 1, 2, 3, 4, 5, 6].map(async (i) => provider.getSigner(i)),
    );
    const addr = async (s) => (await s.getAddress()).toLowerCase();
    const A = { alice: await addr(alice), bob: await addr(bob), carol: await addr(carol), mallory: await addr(mallory), operator: await addr(operator), dave: await addr(dave) };

    console.log('deploying on anvil (chain', chainId + ')');
    const reg = await deploy(deployer, 'ARDOnchainRegistry');
    const skillAdapter = await deploy(deployer, 'SkillAdapter');
    const taskAdapter = await deploy(deployer, 'TaskAdapter');
    const id8004 = await deploy(deployer, 'MockIdentityRegistry8004');
    const aid = await deploy(deployer, 'AIDRegistry', [30 * 86400, 365 * 86400]);
    const agentAdapter = await deploy(deployer, 'AgentAdapter', [await aid.getAddress()]);
    const registryAdapter = await deploy(deployer, 'RegistryAdapter');
    for (const [n, a] of [['skill', skillAdapter], ['task', taskAdapter], ['agent', agentAdapter], ['registry', registryAdapter]]) {
      await (await reg.registerKind(ard.kindId(n), await a.getAddress(), `kind:${n}`)).wait();
    }
    const skills = await deploy(deployer, 'SkillToken', ['Skill', 'SKL']);
    const tasks = await deploy(deployer, 'TaskToken', ['Task', 'TSK']);
    const REG = (await reg.getAddress()).toLowerCase();
    step(`kernel ${REG}, kinds registered, real skill/task/AID contracts deployed`);

    // ---- anchors --------------------------------------------------------------------------
    const skillPkg = sha256Hex(ethers.toUtf8Bytes('skill package bytes'));
    const skillMd = sha256Hex(ethers.toUtf8Bytes('# skill'));
    await (await skills.connect(alice).mintSkill(A.alice, A.alice, skillMd, skillPkg, 'ipfs://skill')).wait();
    const skillId = 1;

    const taskHash = sha256Hex(ethers.toUtf8Bytes('task package bytes'));
    const now = (await provider.getBlock('latest')).timestamp;
    const terms = { asset: ethers.ZeroAddress, rewardPerCompletion: ethers.parseEther('0.001'), maxCompletions: 0, submitBy: 0, settleBy: now + 90 * 86400, epochLength: 0, maxCompletionsPerEpoch: 0, judgmentWindow: 7 * 86400 };
    await (await tasks.connect(bob).mintTask(A.bob, A.bob, A.operator, sha256Hex(ethers.toUtf8Bytes('# task')), taskHash, 'ipfs://task', terms)).wait();
    const taskId = 1;
    await (await tasks.connect(bob).fundTask(taskId, ethers.parseEther('0.01'), { value: ethers.parseEther('0.01') })).wait();

    await (await id8004.connect(carol).register()).wait();
    await (await aid.connect(carol).bind(await id8004.getAddress(), 1)).wait();
    step('anchors: skill #1 (alice), funded tender #1 (bob), AID-active identity (carol)');

    // ---- descriptors (authored; content taken from the examples, provenance = live hints) ----
    const skillEx = JSON.parse(fs.readFileSync(path.join(EX, 'skill.json'), 'utf8'));
    const taskEx = JSON.parse(fs.readFileSync(path.join(EX, 'task.json'), 'utf8'));
    const agentEx = JSON.parse(fs.readFileSync(path.join(EX, 'agent.json'), 'utf8'));
    const registryEx = JSON.parse(fs.readFileSync(path.join(EX, 'registry.json'), 'utf8'));

    const skillDesc = { ...skillEx, identifier: 'urn:air:alice.example:skills:one', trustManifest: { identity: 'alice.example' }, 'value:controller': did(chainId, A.alice), 'value:provenance': { packageDigest: `sha256:${skillPkg.slice(2)}` } };
    const taskDesc = { ...taskEx, identifier: 'urn:air:bob.example:tenders:one', trustManifest: { identity: 'bob.example' }, 'value:controller': did(chainId, A.bob), 'value:provenance': { packageDigest: `sha256:${taskHash.slice(2)}` } };
    const agentDesc = { ...agentEx, identifier: 'urn:air:carol.example:agents:carol', trustManifest: { identity: did(chainId, A.carol) }, 'value:controller': did(chainId, A.carol) };
    const registryUrl = `${BASE}/`;
    const registryDesc = { ...registryEx, identifier: `urn:air:${GATEWAY_DOMAIN}:registry:main`, url: registryUrl, trustManifest: { identity: GATEWAY_DOMAIN }, 'value:controller': did(chainId, A.operator), 'value:indexes': [`eip155:${chainId}:${REG}`] };
    const registryDisc = BigInt(ethers.keccak256(ethers.toUtf8Bytes(registryUrl)));

    const h = (d) => ard.descriptorHash(d).hex;
    await (await reg.connect(alice).register(ard.kindId('skill'), await skills.getAddress(), skillId, h(skillDesc), dataUri(skillDesc), skillDesc.identifier)).wait();
    await (await reg.connect(bob).register(ard.kindId('task'), await tasks.getAddress(), taskId, h(taskDesc), dataUri(taskDesc), taskDesc.identifier)).wait();
    await (await reg.connect(carol).register(ard.kindId('agent'), A.carol, 0, h(agentDesc), dataUri(agentDesc), agentDesc.identifier)).wait();
    await (await reg.connect(operator).register(ard.kindId('registry'), A.operator, registryDisc, h(registryDesc), dataUri(registryDesc), registryDesc.identifier)).wait();
    // dave commits to one descriptor but publishes another -> inconsistent
    const daveDesc = { ...agentEx, identifier: 'urn:air:dave.example:agents:dave', 'value:controller': did(chainId, A.dave) };
    await (await reg.connect(dave).register(ard.kindId('agent'), A.dave, 0, h({ ...daveDesc, description: 'what dave committed to' }), dataUri(daveDesc), daveDesc.identifier)).wait();
    step('records registered: skill, task, agent, registry, plus one with a descriptor hash mismatch');

    // ---- claims + domain manifests ---------------------------------------------------------
    await (await reg.connect(alice).claimDomain('alice.example')).wait();
    await (await reg.connect(mallory).claimDomain('alice.example')).wait(); // a squatter's claim
    await (await reg.connect(carol).claimDomain('carol.example')).wait();
    await (await reg.connect(operator).claimDomain(GATEWAY_DOMAIN)).wait();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ard-manifests-'));
    const writeManifest = (name, m) => {
      const p = path.join(tmp, name + '.json');
      fs.writeFileSync(p, JSON.stringify(m));
      return p;
    };
    const manifestOverrides = {
      'alice.example': writeManifest('alice', { entries: [skillDesc] }), // acknowledges alice (value:controller)
      'carol.example': writeManifest('carol', { entries: [{ ...agentDesc, 'value:controller': undefined }] }), // lists the URN, acknowledges nobody
      [GATEWAY_DOMAIN]: writeManifest('registry', { 'value:controllers': [did(chainId, A.operator)], entries: [registryDesc] }),
    };
    step('claims: alice + mallory claim alice.example (alice acknowledged), carol claims carol.example (unacknowledged), operator claims registry.example (acknowledged)');

    // ---- gateway ---------------------------------------------------------------------------
    gw = await createGateway({ rpc: `http://127.0.0.1:${RPC_PORT}`, registry: REG, domain: GATEWAY_DOMAIN, port: PORT, basePath: '/api/v1', fromBlock: 0, ipfsGateway: 'https://ipfs.io/ipfs', manifestOverrides, descriptorOverrides: {}, referrals: ['https://registry.other.example/api/v1/'], upstreams: [], operator: A.operator, registryName: 'main', publicUrl: registryUrl, syncIntervalMs: 60000 });
    await gw.sync();
    await gw.listen();
    step(`gateway up at ${BASE}/ serving ${gw.state.entries.length} entries, ${gw.state.excluded.length} excluded`);

    const byKind = Object.fromEntries(gw.state.entries.map((e) => [e['value:kind'], e]));
    assert.strictEqual(gw.state.entries.length, 4, 'four consistent records served');
    assert.strictEqual(gw.state.excluded.length, 1, 'one record excluded');
    assert.ok(gw.state.excluded[0].reasons[0].startsWith('descriptor hash mismatch'), 'excluded for hash mismatch');

    // skill: verified binding -> canonical URN, level 2 (backed + provenance matches hint)
    assert.strictEqual(byKind.skill.identifier, 'urn:air:alice.example:skills:one');
    assert.strictEqual(byKind.skill['value:binding'], 'verified');
    assert.strictEqual(byKind.skill['value:level'], 2);
    assert.strictEqual(byKind.skill['value:anchor'], `eip155:${chainId}/erc721:${(await skills.getAddress()).toLowerCase()}/1`);
    assert.strictEqual(byKind.skill['value:descriptorHash'], `sha256:${h(skillDesc).slice(2)}`);
    assert.deepStrictEqual(byKind.skill['value:aliases'], [ard.gatewayAlias(GATEWAY_DOMAIN, byKind.skill['value:anchor'])]);
    step('skill: canonical URN served, binding verified, level 2, anchor + descriptor hash exposed');

    // task: bob never claimed bob.example -> third-party, served under the gateway alias
    assert.strictEqual(byKind.task['value:binding'], 'third-party');
    assert.strictEqual(byKind.task.identifier, byKind.task['value:aliases'][0]);
    assert.strictEqual(byKind.task['value:claimedUrn'], 'urn:air:bob.example:tenders:one');
    assert.strictEqual(byKind.task['value:level'], 2, 'funded live tender is backed');
    step('task: unclaimed publisher domain -> third-party binding, alias identifier, level 2 while escrowed');

    // agent: claimed but not acknowledged
    assert.strictEqual(byKind.agent['value:binding'], 'claimed');
    assert.strictEqual(byKind.agent.identifier, byKind.agent['value:aliases'][0]);
    assert.strictEqual(byKind.agent['value:level'], 2, 'AID ACTIVE is backed');
    step('agent: claimed-but-unacknowledged domain -> alias identifier, level 2 via active identity');

    // registry: verified, never backed
    assert.strictEqual(byKind.registry['value:binding'], 'verified');
    assert.strictEqual(byKind.registry.identifier, `urn:air:${GATEWAY_DOMAIN}:registry:main`);
    assert.strictEqual(byKind.registry['value:level'], 1);
    step('registry: verified binding, level capped at 1 onchain');

    // ---- ARD registry interface -------------------------------------------------------------
    let r = await post(`${BASE}/search`, { query: { text: 'daily finance brief' }, federation: 'none', pageSize: 10 });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.results[0]['value:kind'], 'skill');
    assert.ok(r.body.results[0].score > r.body.results[r.body.results.length - 1].score);
    assert.ok(r.body.results.every((x) => typeof x.score === 'number' && x.source === registryUrl));
    r = await post(`${BASE}/search`, { query: { text: 'who pays for hourly basis data', filter: { 'value:kind': ['task'] } }, federation: 'referrals' });
    assert.strictEqual(r.body.results.length, 1);
    assert.strictEqual(r.body.results[0]['value:kind'], 'task');
    assert.strictEqual(r.body.referrals.length, 1);
    assert.strictEqual(r.body.referrals[0].type, 'application/ai-registry+json');
    r = await post(`${BASE}/search`, { query: { text: 'agent finance brief feed registry' }, federation: 'none', pageSize: 2 });
    assert.strictEqual(r.body.results.length, 2);
    assert.ok(r.body.pageToken);
    const r2 = await post(`${BASE}/search`, { query: { text: 'agent finance brief feed registry' }, federation: 'none', pageSize: 2, pageToken: r.body.pageToken });
    assert.ok(r2.body.results.length >= 1 && r2.body.results[0].identifier !== r.body.results[0].identifier);
    r = await post(`${BASE}/search`, { query: {} });
    assert.strictEqual(r.status, 400);
    step('POST /search: ranking, value:kind filter, referrals, pagination, 400 on missing text');

    r = await post(`${BASE}/explore`, { query: { text: 'finance' }, resultType: 'facets', facets: [{ field: 'value:kind' }, { field: 'type' }] });
    assert.strictEqual(r.body.resultType, 'facets');
    assert.ok(r.body.facets['value:kind'].buckets.length >= 1);
    r = await post(`${BASE}/explore`, { query: { text: 'a' }, resultType: { facets: [{ field: 'type' }] } });
    assert.strictEqual(r.status, 200);
    step('POST /explore: facets by value:kind and type (both request shapes)');

    r = await get(`${BASE}/agents?pageSize=10`);
    assert.strictEqual(r.body.items.length, 4);
    r = await get(`${BASE}/agents?filter=${encodeURIComponent('value:kind="agent"')}`);
    assert.strictEqual(r.body.items.length, 1);
    step('GET /agents: deterministic listing with a filter');

    r = await get(`http://127.0.0.1:${PORT}/.well-known/ard.json`);
    assert.strictEqual(r.body.entries.length, 5);
    assert.strictEqual(r.body.entries[0].type, 'application/ai-registry+json');
    assert.deepStrictEqual(r.body['value:controllers'], [did(chainId, A.operator)]);
    step('/.well-known/ard.json: the gateway lists itself and every served record');

    // ---- conformance CLI (official, vendored) ------------------------------------------------
    const m = await conformance(['manifest', `http://127.0.0.1:${PORT}/.well-known/ard.json`]);
    assert.strictEqual(m.code, 0, 'manifest conformance:\n' + m.out);
    const reg2 = await conformance(['registry', BASE]);
    assert.strictEqual(reg2.code, 0, 'registry conformance:\n' + reg2.out);
    const summary = (o) => (o.match(/CONFORMANCE STATUS: .*|Validated with .*|Registry .* Summary.*|.*critical.*/g) || []).map((s) => s.replace(/\x1b\[[0-9;]*m/g, '')).join(' | ');
    step('ARD conformance CLI (vendored, schema mode): manifest PASS — ' + summary(m.out));
    step('ARD conformance CLI (vendored): registry PASS — ' + summary(reg2.out));

    // ---- transfer: the descriptor alice committed is no longer adopted -> out of discovery ----------
    await (await skills.connect(alice).transferFrom(A.alice, A.mallory, skillId)).wait();
    await gw.sync();
    const skillRecordId = ard.recordId(chainId, await skills.getAddress(), skillId);
    assert.strictEqual(gw.state.entries.find((e) => e['value:kind'] === 'skill'), undefined, 'unadopted skill is not served');
    const unadopted = gw.state.excluded.find((x) => x.recordId === skillRecordId);
    assert.ok(unadopted && unadopted.reasons.includes('descriptor not adopted by the current controller'), 'excluded as unadopted');
    const inspect = await get(`${BASE}/records/${skillRecordId}`);
    assert.strictEqual(inspect.body.consistent, true);
    assert.strictEqual(inspect.body.adopted, false);
    assert.strictEqual(inspect.body.entry['value:adopted'], false, 'inspectable with value:adopted false');
    assert.strictEqual(inspect.body.record.controller.toLowerCase(), A.mallory);
    assert.strictEqual(inspect.body.record.attestor.toLowerCase(), A.alice);
    step('skill transferred to mallory: descriptor committed by alice is unadopted -> excluded from discovery, inspectable at /records');

    // ---- adoption: the new controller commits the same descriptor again -> served, re-derived -------
    await (await reg.connect(mallory).updateDescriptor(skillRecordId, h(skillDesc), dataUri(skillDesc), skillDesc.identifier)).wait();
    await gw.sync();
    const skillAfter = gw.state.entries.find((e) => e['value:kind'] === 'skill');
    assert.ok(skillAfter, 'served again once mallory adopted it');
    assert.strictEqual(skillAfter['value:adopted'], true);
    assert.strictEqual(skillAfter['value:binding'], 'contested', 'mallory claimed alice.example but is not acknowledged');
    assert.strictEqual(skillAfter.identifier, skillAfter['value:aliases'][0]);
    assert.deepStrictEqual(skillAfter['value:stale'], ['urn:air:alice.example:skills:one']);
    assert.strictEqual(skillAfter['value:canonical'], undefined);
    assert.strictEqual(skillAfter['value:level'], 2);
    step('mallory re-committed the descriptor (same hash): adopted, binding contested, canonical URN stale, served under alias');

    // provenance drift: the publisher (alice, update authority) changes the package -> hint != stated -> level 1
    await (await skills.connect(alice).updateSkill(skillId, skillMd, sha256Hex(ethers.toUtf8Bytes('new package')))).wait();
    await gw.sync();
    assert.strictEqual(gw.state.entries.find((e) => e['value:kind'] === 'skill')['value:level'], 1);
    step('skill package updated under the old descriptor: provenance mismatch -> level 1');

    // tender cancelled -> no longer backed
    await (await tasks.connect(bob).cancelTask(taskId)).wait();
    await gw.sync();
    assert.strictEqual(gw.state.entries.find((e) => e['value:kind'] === 'task')['value:level'], 1);
    step('tender cancelled: level 1');

    // carol retires her record -> excluded
    const carolId = ard.recordId(chainId, A.carol, 0);
    await (await reg.connect(carol).setStatus(carolId, 3)).wait();
    await gw.sync();
    assert.strictEqual(gw.state.entries.length, 3);
    r = await get(`${BASE}/records/${carolId}`);
    assert.strictEqual(r.body.entry['value:status'], 'Retired');
    step('agent record retired: dropped from search, still inspectable at /records/<id>');

    console.log('\nGATEWAY E2E: PASS (' + record.steps.length + ' steps)');
    fs.writeFileSync(path.join(ROOT, 'docs', 'gateway-e2e-last-run.json'), JSON.stringify({ ranAt: new Date().toISOString(), chainId, steps: record.steps }, null, 2) + '\n');
  } catch (e) {
    console.error('\nGATEWAY E2E: FAIL');
    console.error(e);
    process.exitCode = 1;
  } finally {
    if (gw) await gw.close();
    anvil.kill();
  }
})();

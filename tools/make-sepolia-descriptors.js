#!/usr/bin/env node
// Authors the four descriptors of the Sepolia evidence run and writes their content hashes and data: URIs to
// deployments/sepolia-descriptors.json (read by script/SepoliaEvidence.s.sol and by the relay scripts).
// The descriptors describe the real Sepolia anchors: native-asset settlement, the live tender's terms, the
// deployer's identity; nothing is copied from the Base-flavoured examples in assets/erc-8444/examples.
//
//   node tools/make-sepolia-descriptors.js --chain-id 11155111 --skill-pkg 0x<sha256> --skill-card 0x<sha256> \
//        --task-hash 0x<sha256> --task-card 0x<sha256> --controller 0x<deployer> [--skill-controller 0x<holder>] \
//        --domain <publisher-domain> --gateway-url https://<gateway>/api/v1/ --registry 0x<kernel> \
//        --skill-token 0x<addr> --skill-id 1 --task-token 0x<addr> --task-id 17 --settle-by <unix seconds> \
//        [--updated-at 2026-10-15T00:00:00Z]
'use strict';

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const ard = require('./lib/ard');

const ROOT = path.resolve(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean));
const need = (k) => {
  if (!args[k]) throw new Error(`missing --${k}`);
  return args[k];
};
const chainId = Number(args['chain-id'] || 11155111);
const controller = need('controller').toLowerCase();
const skillController = (args['skill-controller'] || controller).toLowerCase();
const domain = args.domain || 'finchip.ai';
const gatewayUrl = args['gateway-url'] || 'https://registry.finchip.ai/api/v1/';
const gatewayHost = new URL(gatewayUrl).hostname;
const registry = need('registry').toLowerCase();
const skillToken = need('skill-token').toLowerCase();
const taskToken = need('task-token').toLowerCase();
const skillId = args['skill-id'] || '1';
const taskId = args['task-id'] || '1';
const skillPkg = need('skill-pkg');
const skillCard = args['skill-card'];
const taskHash = need('task-hash');
const taskCard = args['task-card'];
const settleBy = new Date(Number(need('settle-by')) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const updatedAt = args['updated-at'] || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

const did = (a) => `did:pkh:eip155:${chainId}:${a}`;
const NATIVE = `eip155:${chainId}/slip44:60`;
const CONTEXT = ['https://agenticresourcediscovery.org/context/v1', { value: 'https://eips.ethereum.org/assets/eip-8444/ns#' }];
const digest = (h) => `sha256:${h.slice(2).toLowerCase()}`;

const skill = {
  '@context': CONTEXT,
  identifier: `urn:air:${domain}:skills:daily-finance-brief`,
  displayName: 'FinChip Daily Finance Brief',
  description: 'Generates the daily global finance brief: 60-instrument dashboard, top headlines, short analysis. Sepolia evidence record of the ARD Onchain reference deployment.',
  type: 'application/ai-skill+md',
  url: `https://${domain}/skills/daily-finance-brief/SKILL.md`,
  tags: ['finance', 'report', 'daily', 'sepolia-evidence'],
  capabilities: ['DailyFinanceBrief'],
  representativeQueries: ["generate today's global markets brief", 'daily finance report with crypto and FX dashboard', 'morning market summary as PDF'],
  version: '1.4.0',
  updatedAt,
  trustManifest: { identity: domain },
  'value:kind': 'skill',
  'value:controller': did(skillController),
  'value:terms': { unit: 'call', price: { amount: '0.0001', currency: 'ETH', asset: NATIVE } },
  'value:settlement': [{ rail: 'onchain', payee: `eip155:${chainId}:${skillController}`, asset: NATIVE }],
  'value:provenance': { packageDigest: digest(skillPkg), ...(skillCard ? { cardDigest: digest(skillCard) } : {}) },
};

const task = {
  '@context': CONTEXT,
  identifier: `urn:air:${domain}:tenders:oracle-basis-feed`,
  displayName: 'Standing bounty: hourly BTC/ETH basis feed',
  description: 'Pays per accepted delivery of a verified BTC and ETH perpetual basis feed. Two completions, judged by the publisher. Sepolia evidence tender of the ARD Onchain reference deployment, escrowed in the live token-bound tender kernel.',
  type: 'application/ai-task+json',
  tags: ['bounty', 'oracle', 'price-feed', 'sepolia-evidence'],
  representativeQueries: ['tasks paying for price-feed delivery', 'who pays for hourly basis data', 'standing oracle bounties for agents'],
  updatedAt,
  trustManifest: { identity: domain },
  data: {
    wants: ['application/ai-skill+md', 'application/mcp-server-card+json'],
    specDigest: digest(taskHash),
    specURI: `https://${domain}/tenders/oracle-basis-feed/spec.json`,
    bounty: { amount: '0.0005', currency: 'ETH', asset: NATIVE },
    cardinality: 'replicated',
    copies: 2,
    acceptance: { mode: 'judge', ref: `eip155:${chainId}:${controller}` },
    deadlines: { settleBy, judgmentWindow: 'P7D' },
  },
  'value:kind': 'task',
  'value:controller': did(controller),
  'value:provenance': { packageDigest: digest(taskHash), ...(taskCard ? { cardDigest: digest(taskCard) } : {}) },
};

const agent = {
  '@context': CONTEXT,
  identifier: `urn:air:${domain}:agents:finch-analyst`,
  displayName: 'Finch Analyst',
  description: 'Research agent that produces market briefs and fulfils price-feed tenders. Sepolia evidence identity of the ARD Onchain reference deployment, bound to its agent identity registration.',
  type: 'application/a2a-agent-card+json',
  url: `https://${domain}/.well-known/agent-card.json`,
  capabilities: ['MarketBrief', 'PriceFeedDelivery'],
  representativeQueries: ['an agent that writes daily market briefs', 'agent that can deliver hourly basis feeds'],
  updatedAt,
  trustManifest: { identity: did(controller) },
  'value:kind': 'agent',
  'value:controller': did(controller),
  'value:registration': `https://${domain}/.well-known/agent-registration.json`,
  'value:settlement': [{ rail: 'onchain', payee: `eip155:${chainId}:${controller}`, asset: NATIVE }],
};

const registryDesc = {
  '@context': CONTEXT,
  identifier: `urn:air:${gatewayHost}:registry:sepolia`,
  displayName: 'ARD Onchain gateway for Sepolia',
  description: `ARD registry endpoint indexing the ARD Onchain Registry at eip155:${chainId}:${registry}. Results carry onchain anchors and descriptor hashes for independent verification.`,
  type: 'application/ai-registry+json',
  url: gatewayUrl,
  representativeQueries: ['onchain skills and tasks with verifiable anchors', 'agent tenders paying onchain'],
  updatedAt,
  trustManifest: { identity: gatewayHost },
  'value:kind': 'registry',
  'value:controller': did(controller),
  'value:indexes': [`eip155:${chainId}:${registry}`],
};

const dataUri = (o) => 'data:application/json;base64,' + Buffer.from(JSON.stringify(o)).toString('base64');
const out = {};
for (const [name, d] of Object.entries({ skill, task, agent, registry: registryDesc })) {
  const h = ard.descriptorHash(d);
  out[name] = { identifier: d.identifier, descriptorHash: h.hex, descriptorURI: dataUri(d), descriptor: d };
}
out.registryDiscriminator = ethers.keccak256(ethers.toUtf8Bytes(gatewayUrl));
out.anchors = { skill: `eip155:${chainId}/erc721:${skillToken}/${skillId}`, task: `eip155:${chainId}/erc721:${taskToken}/${taskId}`, agent: `eip155:${chainId}:${controller}`, registry: `eip155:${chainId}:${controller}#${out.registryDiscriminator.slice(2)}` };
fs.mkdirSync(path.join(ROOT, 'deployments'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'deployments', 'sepolia-descriptors.json'), JSON.stringify(out, null, 2) + '\n');

// The publisher domain's acknowledgment: what https://<domain>/.well-known/ard.json must serve for the skill,
// task and agent records to resolve with binding = verified under their canonical URNs. It lists every
// controller the domain stands behind and the entries themselves (publication members included).
const ack = {
  '@context': CONTEXT,
  'value:controllers': [...new Set([did(controller), did(skillController)])],
  entries: [skill, task, agent],
};
fs.writeFileSync(path.join(ROOT, 'deployments', `acknowledgment-${domain}.well-known-ard.json`), JSON.stringify(ack, null, 2) + '\n');
console.log('wrote deployments/sepolia-descriptors.json for controller', controller, skillController !== controller ? `(skill controller ${skillController})` : '');
console.log(`wrote deployments/acknowledgment-${domain}.well-known-ard.json (publish as https://${domain}/.well-known/ard.json)`);

#!/usr/bin/env node
// Prepares the authored descriptors for the Sepolia evidence run and writes their content hashes and
// data: URIs to deployments/sepolia-descriptors.json, which script/SepoliaEvidence.s.sol reads.
//
//   node tools/make-sepolia-descriptors.js --chain-id 11155111 --skill-pkg 0x<sha256> --task-hash 0x<sha256> \
//        --controller 0x<deployer> --domain <publisher-domain> --gateway-url https://<gateway>/api/v1/
'use strict';

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const ard = require('./lib/ard');

const ROOT = path.resolve(__dirname, '..');
const EX = path.join(ROOT, 'assets', 'erc-9999', 'examples');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean));
const chainId = Number(args['chain-id'] || 11155111);
const controller = (args.controller || '0x0000000000000000000000000000000000000000').toLowerCase();
const domain = args.domain || 'finchip.ai';
const gatewayUrl = args['gateway-url'] || 'https://registry.finchip.ai/api/v1/';
const skillPkg = args['skill-pkg'] || '0x' + '11'.repeat(32);
const taskHash = args['task-hash'] || '0x' + '22'.repeat(32);
const did = `did:pkh:eip155:${chainId}:${controller}`;

const load = (f) => JSON.parse(fs.readFileSync(path.join(EX, f), 'utf8'));
const dataUri = (o) => 'data:application/json;base64,' + Buffer.from(JSON.stringify(o)).toString('base64');

const skill = { ...load('skill.json'), identifier: `urn:air:${domain}:skills:daily-finance-brief`, trustManifest: { identity: domain }, 'value:controller': did, 'value:provenance': { packageDigest: `sha256:${skillPkg.slice(2)}` } };
const task = { ...load('task.json'), identifier: `urn:air:${domain}:tenders:oracle-basis-feed`, trustManifest: { identity: domain }, 'value:controller': did, 'value:provenance': { packageDigest: `sha256:${taskHash.slice(2)}` } };
const agent = { ...load('agent.json'), identifier: `urn:air:${domain}:agents:finch-analyst`, trustManifest: { identity: did }, 'value:controller': did };
const registry = { ...load('registry.json'), identifier: `urn:air:${new URL(gatewayUrl).hostname}:registry:sepolia`, url: gatewayUrl, trustManifest: { identity: new URL(gatewayUrl).hostname }, 'value:controller': did, 'value:indexes': [] };

const out = {};
for (const [name, d] of Object.entries({ skill, task, agent, registry })) {
  const h = ard.descriptorHash(d);
  out[name] = { identifier: d.identifier, descriptorHash: h.hex, descriptorURI: dataUri(d), descriptor: d };
}
out.registryDiscriminator = ethers.keccak256(ethers.toUtf8Bytes(gatewayUrl));
fs.mkdirSync(path.join(ROOT, 'deployments'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'deployments', 'sepolia-descriptors.json'), JSON.stringify(out, null, 2) + '\n');
console.log('wrote deployments/sepolia-descriptors.json for controller', controller);

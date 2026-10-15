#!/usr/bin/env node
// Rebuilds assets/erc-8444/examples/well-known-ard.json from the authored examples: a gateway
// manifest that lists itself (registry.json) and serves skill.json under a gateway alias with
// resolved facets. Keeping the alias entry derived guarantees that its content members hash to the
// same descriptorHash as the authored entry (see vectors/descriptor-hash.json).
'use strict';

const fs = require('fs');
const path = require('path');
const ard = require('./lib/ard');

const EX = path.resolve(__dirname, '..', 'assets', 'erc-8444', 'examples');
const skill = JSON.parse(fs.readFileSync(path.join(EX, 'skill.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(EX, 'registry.json'), 'utf8'));

const GATEWAY_DOMAIN = 'registry.finchip.ai';
const GATEWAY_CONTROLLER = 'did:pkh:eip155:8453:0x6666666666666666666666666666666666666666';
const REGISTRY_INSTANCE = 'eip155:8453:0x7777777777777777777777777777777777777777';

const caip = ard.anchorCaip('skill', 8453, '0x1111111111111111111111111111111111111111', '42');
const alias = ard.gatewayAlias(GATEWAY_DOMAIN, caip);
const h = ard.descriptorHash(skill);

const aliasEntry = {
  identifier: alias,
  trustManifest: { identity: GATEWAY_DOMAIN },
  ...ard.authoredDescriptor(skill),
  'value:anchor': caip,
  'value:canonical': skill.identifier,
  'value:aliases': [alias],
  'value:binding': 'verified',
  'value:level': 2,
  'value:status': 'Active',
  'value:registry': REGISTRY_INSTANCE,
  'value:descriptorHash': h.digest,
};

const registryEntry = {
  identifier: registry.identifier,
  trustManifest: registry.trustManifest,
  ...ard.authoredDescriptor(registry),
};

const manifest = {
  '@context': skill['@context'],
  'value:controllers': [GATEWAY_CONTROLLER],
  entries: [registryEntry, aliasEntry],
};

fs.writeFileSync(path.join(EX, 'well-known-ard.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('wrote well-known-ard.json;', alias, h.digest);

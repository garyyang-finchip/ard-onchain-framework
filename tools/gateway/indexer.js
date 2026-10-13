// Indexer: reads the kernel's events and current views into an in-memory record table.
'use strict';

const { ethers } = require('ethers');

const REGISTRY_ABI = [
  'event Registered(bytes32 indexed recordId, bytes32 indexed kind, address indexed target, uint256 id, address registrant, bytes32 descriptorHash, string descriptorURI, string urn)',
  'event DescriptorUpdated(bytes32 indexed recordId, bytes32 descriptorHash, string descriptorURI, string urn)',
  'event StatusChanged(bytes32 indexed recordId, uint8 status)',
  'event DomainClaimed(bytes32 indexed domainHash, address indexed controller, string domain)',
  'event DomainReleased(bytes32 indexed domainHash, address indexed controller)',
  'function recordOf(bytes32) view returns (tuple(bytes32 kind, address target, uint256 id, bytes32 descriptorHash, string descriptorURI, string urn, uint8 status, address registrant, uint64 updatedAt))',
  'function controllerOf(bytes32) view returns (address)',
  'function backed(bytes32) view returns (bool)',
  'function anchorHintOf(bytes32) view returns (bytes32)',
  'function claimsOf(bytes32) view returns (address[])',
];

class Indexer {
  constructor(provider, registryAddress, { fromBlock = 0 } = {}) {
    this.provider = provider;
    this.registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
    this.fromBlock = fromBlock;
    this.records = new Map(); // recordId -> rec
    this.lastBlock = fromBlock - 1;
  }

  /** Pull new events, then refresh every record's live views (controller, backed, hint, status). */
  async sync() {
    const latest = await this.provider.getBlockNumber();
    if (latest > this.lastBlock) {
      const from = this.lastBlock + 1;
      const logs = await this.registry.queryFilter(this.registry.filters.Registered(), from, latest);
      for (const log of logs) {
        const a = log.args;
        this.records.set(a.recordId, { recordId: a.recordId, kind: a.kind, target: a.target, id: a.id.toString() });
      }
      this.lastBlock = latest;
    }
    for (const rec of this.records.values()) {
      const r = await this.registry.recordOf(rec.recordId);
      rec.descriptorHash = r.descriptorHash;
      rec.descriptorURI = r.descriptorURI;
      rec.urn = r.urn;
      rec.status = Number(r.status);
      rec.registrant = r.registrant;
      rec.updatedAt = Number(r.updatedAt);
      rec.controller = await this.registry.controllerOf(rec.recordId);
      rec.backed = await this.registry.backed(rec.recordId);
      rec.anchorHint = await this.registry.anchorHintOf(rec.recordId);
    }
    return this.records;
  }

  claimsOf(domainHash) {
    return this.registry.claimsOf(domainHash);
  }
}

module.exports = { Indexer, REGISTRY_ABI };

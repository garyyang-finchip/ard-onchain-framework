// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {ARDOnchainRegistry} from "../assets/erc-8444/contracts/ARDOnchainRegistry.sol";
import {IARDOnchainRegistry} from "../assets/erc-8444/contracts/interfaces/IARDOnchainRegistry.sol";
import {ARDKinds} from "../assets/erc-8444/contracts/libraries/ARDKinds.sol";
import {SkillAdapter} from "../assets/erc-8444/contracts/adapters/SkillAdapter.sol";
import {TaskAdapter} from "../assets/erc-8444/contracts/adapters/TaskAdapter.sol";
import {AgentAdapter} from "../assets/erc-8444/contracts/adapters/AgentAdapter.sol";
import {RegistryAdapter} from "../assets/erc-8444/contracts/adapters/RegistryAdapter.sol";
import {SkillToken} from "../test/fixtures/skill-token/SkillToken.sol";
import {TaskToken} from "../test/fixtures/task-token/TaskToken.sol";
import {ITaskTender} from "../test/fixtures/task-token/interfaces/ITaskTender.sol";
import {AIDRegistry} from "../test/fixtures/aid/AIDRegistry.sol";

interface IIdentityRegistry8004 {
    function register() external returns (uint256 agentId);
}

/// @dev Sepolia evidence run, in phases so that each can be retried:
///        DeployCore   kernel + four adapters (+ a fresh AIDRegistry unless AID_REGISTRY is set)
///        Anchors      a fresh SkillToken fixture (unless SKILL_TOKEN is set), one skill, one funded
///                     tender on the live TaskToken (TASK_TOKEN), one identity bound to the official
///                     ERC-8004 Identity Registry (IDENTITY_REGISTRY_8004)
///        Records      the four records from deployments/sepolia-descriptors.json + a domain claim
///        Transfer     the skill moves to SECOND_HOLDER: controller changes, canonical URN goes stale
///        Close        the tender is cancelled: level drops to 1
///      State is kept in deployments/sepolia.json.
contract SepoliaEvidence is Script {
    using stdJson for string;

    string internal constant STATE = "deployments/sepolia.json";
    string internal constant DESC = "deployments/sepolia-descriptors.json";

    function _state() internal view returns (string memory) {
        string memory p = string.concat(vm.projectRoot(), "/", STATE);
        try vm.readFile(p) returns (string memory s) {
            return s;
        } catch {
            return "{}";
        }
    }

    function _addr(string memory key) internal view returns (address) {
        string memory s = _state();
        if (!vm.keyExistsJson(s, key)) return address(0);
        return s.readAddress(key);
    }

    function _write(string memory key, string memory value) internal {
        string memory p = string.concat(vm.projectRoot(), "/", STATE);
        vm.createDir(string.concat(vm.projectRoot(), "/deployments"), true);
        if (bytes(_state()).length <= 2) vm.writeFile(p, "{}");
        vm.writeJson(value, p, key);
    }

    // ---------------------------------------------------------------- phase 1

    function deployCore() external {
        address aid = vm.envOr("AID_REGISTRY", address(0));
        vm.startBroadcast();
        ARDOnchainRegistry reg = new ARDOnchainRegistry();
        SkillAdapter sa = new SkillAdapter();
        TaskAdapter ta = new TaskAdapter();
        if (aid == address(0)) aid = address(new AIDRegistry(30 days, 365 days));
        AgentAdapter aa = new AgentAdapter(aid);
        RegistryAdapter ra = new RegistryAdapter();
        reg.registerKind(ARDKinds.SKILL, address(sa), "kind:skill");
        reg.registerKind(ARDKinds.TASK, address(ta), "kind:task");
        reg.registerKind(ARDKinds.AGENT, address(aa), "kind:agent");
        reg.registerKind(ARDKinds.REGISTRY, address(ra), "kind:registry");
        vm.stopBroadcast();
        _write(".registry", vm.toString(address(reg)));
        _write(".skillAdapter", vm.toString(address(sa)));
        _write(".taskAdapter", vm.toString(address(ta)));
        _write(".agentAdapter", vm.toString(address(aa)));
        _write(".registryAdapter", vm.toString(address(ra)));
        _write(".aidRegistry", vm.toString(aid));
        console2.log("registry", address(reg));
    }

    // ---------------------------------------------------------------- phase 2

    function anchors() external {
        address skillToken = vm.envOr("SKILL_TOKEN", address(0));
        address taskToken = vm.envAddress("TASK_TOKEN");
        address identity = vm.envAddress("IDENTITY_REGISTRY_8004");
        bytes32 skillPkg = vm.envBytes32("SKILL_PKG");
        bytes32 taskHash = vm.envBytes32("TASK_HASH");
        address aid = _addr(".aidRegistry");
        address me = msg.sender;

        vm.startBroadcast();
        if (skillToken == address(0)) skillToken = address(new SkillToken("ARD Onchain evidence skill", "ARDS"));
        uint256 skillId = SkillToken(skillToken).mintSkill(me, me, sha256("# skill"), skillPkg, "ipfs://ard-onchain-evidence-skill");

        ITaskTender.TenderTerms memory terms = ITaskTender.TenderTerms({
            asset: address(0),
            rewardPerCompletion: 0.0005 ether,
            maxCompletions: 2,
            submitBy: 0,
            settleBy: uint64(block.timestamp + 60 days),
            epochLength: 0,
            maxCompletionsPerEpoch: 0,
            judgmentWindow: 7 days
        });
        uint256 taskId = TaskToken(taskToken).mintTask(me, me, me, sha256("# task"), taskHash, "ipfs://ard-onchain-evidence-task", terms);
        TaskToken(taskToken).fundTask{value: 0.001 ether}(taskId, 0.001 ether);

        uint256 agentId = IIdentityRegistry8004(identity).register();
        AIDRegistry(aid).bind(identity, agentId);
        vm.stopBroadcast();

        _write(".skillToken", vm.toString(skillToken));
        _write(".skillId", vm.toString(skillId));
        _write(".taskToken", vm.toString(taskToken));
        _write(".taskId", vm.toString(taskId));
        _write(".identityRegistry8004", vm.toString(identity));
        _write(".agentId8004", vm.toString(agentId));
        console2.log("skill", skillToken, skillId);
        console2.log("task", taskToken, taskId);
        console2.log("agentId", agentId);
    }

    // ---------------------------------------------------------------- phase 3

    function records() external {
        string memory d = vm.readFile(string.concat(vm.projectRoot(), "/", DESC));
        ARDOnchainRegistry reg = ARDOnchainRegistry(_addr(".registry"));
        string memory domain = vm.envString("PUBLISHER_DOMAIN");

        vm.startBroadcast();
        _write(".records.skill", vm.toString(_reg(reg, d, "skill", ARDKinds.SKILL, _addr(".skillToken"), _state().readUint(".skillId"))));
        _write(".records.task", vm.toString(_reg(reg, d, "task", ARDKinds.TASK, _addr(".taskToken"), _state().readUint(".taskId"))));
        _write(".records.agent", vm.toString(_reg(reg, d, "agent", ARDKinds.AGENT, msg.sender, 0)));
        _write(".records.registry", vm.toString(_reg(reg, d, "registry", ARDKinds.REGISTRY, msg.sender, uint256(d.readBytes32(".registryDiscriminator")))));
        reg.claimDomain(domain);
        vm.stopBroadcast();

        _write(".claimedDomain", domain);
        console2.log("records registered; domain claimed:", domain);
    }

    function _reg(ARDOnchainRegistry reg, string memory d, string memory name, bytes32 kind, address target, uint256 id)
        internal
        returns (bytes32)
    {
        return reg.register(
            kind,
            target,
            id,
            d.readBytes32(string.concat(".", name, ".descriptorHash")),
            d.readString(string.concat(".", name, ".descriptorURI")),
            d.readString(string.concat(".", name, ".identifier"))
        );
    }

    // ---------------------------------------------------------------- phase 4

    function transfer() external {
        address holder = vm.envAddress("SECOND_HOLDER");
        string memory s = _state();
        SkillToken skill = SkillToken(_addr(".skillToken"));
        uint256 skillId = s.readUint(".skillId");
        vm.startBroadcast();
        skill.transferFrom(msg.sender, holder, skillId);
        vm.stopBroadcast();
        _write(".secondHolder", vm.toString(holder));
        console2.log("skill transferred to", holder);
    }

    // ---------------------------------------------------------------- phase 5

    function close() external {
        string memory s = _state();
        TaskToken task = TaskToken(_addr(".taskToken"));
        uint256 taskId = s.readUint(".taskId");
        vm.startBroadcast();
        task.cancelTask(taskId);
        vm.stopBroadcast();
        console2.log("tender cancelled", taskId);
    }
}

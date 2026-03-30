import { BigInt } from "@graphprotocol/graph-ts";
import {
  AgentRegistered,
  AgentURIUpdated,
  AgentWalletUpdated,
  AgentMetadataSet as AgentMetadataSetEvent,
  AgentStatusChanged,
} from "../../generated/TAGITAgentIdentity/TAGITAgentIdentity";
import {
  Agent,
  AgentMetadata,
  AgentStatusChange,
} from "../../generated/schema";
import { ZERO_BD } from "../helpers/constants";
import { statusToLabel } from "../helpers/constants";
import { getOrCreateProtocol } from "../helpers/protocol";

export function handleAgentRegistered(event: AgentRegistered): void {
  let agentId = event.params.agentId.toString();
  let agent = new Agent(agentId);

  agent.agentId = event.params.agentId;
  agent.registrant = event.params.registrant;
  agent.wallet = event.params.wallet;
  agent.uri = event.params.uri;
  agent.status = 0;
  agent.statusLabel = statusToLabel(0);
  agent.registeredAt = event.block.timestamp;
  agent.registeredAtBlock = event.block.number;

  agent.stakeAmount = BigInt.fromI32(0);
  agent.staker = null;
  agent.hasMinBond = false;

  agent.feedbackCount = 0;
  agent.activeFeedbackCount = 0;
  agent.ratingSum = 0;
  agent.averageRating = ZERO_BD;

  agent.validationRequestCount = 0;
  agent.validationPassedCount = 0;
  agent.validationFailedCount = 0;
  agent.isValidated = false;

  agent.save();

  let protocol = getOrCreateProtocol();
  protocol.totalAgents += 1;
  protocol.save();
}

export function handleAgentURIUpdated(event: AgentURIUpdated): void {
  let agent = Agent.load(event.params.agentId.toString());
  if (agent == null) return;

  agent.uri = event.params.newURI;
  agent.save();
}

export function handleAgentWalletUpdated(event: AgentWalletUpdated): void {
  let agent = Agent.load(event.params.agentId.toString());
  if (agent == null) return;

  agent.wallet = event.params.newWallet;
  agent.save();
}

export function handleAgentMetadataSet(event: AgentMetadataSetEvent): void {
  let agent = Agent.load(event.params.agentId.toString());
  if (agent == null) return;

  let metadataId =
    event.params.agentId.toString() + "-" + event.params.key;
  let metadata = AgentMetadata.load(metadataId);
  if (metadata == null) {
    metadata = new AgentMetadata(metadataId);
    metadata.agent = agent.id;
    metadata.key = event.params.key;
  }

  metadata.value = event.params.value;
  metadata.updatedAt = event.block.timestamp;
  metadata.updatedAtBlock = event.block.number;
  metadata.save();
}

export function handleAgentStatusChanged(event: AgentStatusChanged): void {
  let agent = Agent.load(event.params.agentId.toString());
  if (agent == null) return;

  let oldStatus = event.params.oldStatus;
  let newStatus = event.params.newStatus;

  agent.status = newStatus;
  agent.statusLabel = statusToLabel(newStatus);
  agent.save();

  // Create immutable status change record
  let changeId =
    event.params.agentId.toString() +
    "-" +
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let change = new AgentStatusChange(changeId);
  change.agent = agent.id;
  change.oldStatus = oldStatus;
  change.newStatus = newStatus;
  change.oldStatusLabel = statusToLabel(oldStatus);
  change.newStatusLabel = statusToLabel(newStatus);
  change.timestamp = event.block.timestamp;
  change.blockNumber = event.block.number;
  change.transactionHash = event.transaction.hash;
  change.save();

  // Update Protocol.totalActiveAgents
  let protocol = getOrCreateProtocol();
  if (oldStatus != 1 && newStatus == 1) {
    protocol.totalActiveAgents += 1;
  } else if (oldStatus == 1 && newStatus != 1) {
    protocol.totalActiveAgents -= 1;
  }
  protocol.save();
}

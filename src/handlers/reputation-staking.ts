import { BigInt } from "@graphprotocol/graph-ts";
import {
  StakeDeposited,
  StakeWithdrawn,
  StakeSlashed,
} from "../../generated/ReputationStaking/ReputationStaking";
import { Agent, StakeEvent } from "../../generated/schema";
import { ZERO_BI } from "../helpers/constants";
import { getOrCreateProtocol } from "../helpers/protocol";

// Default min bond: 100 TAGIT (100 * 1e18)
const MIN_BOND = BigInt.fromString("100000000000000000000");

export function handleStakeDeposited(event: StakeDeposited): void {
  let agentId = event.params.agentId.toString();
  let agent = Agent.load(agentId);
  if (agent == null) return;

  // Update agent staking state
  agent.stakeAmount = agent.stakeAmount.plus(event.params.amount);
  agent.staker = event.params.staker;
  agent.hasMinBond = agent.stakeAmount.ge(MIN_BOND);
  agent.save();

  // Create immutable event record
  let eventId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let stakeEvent = new StakeEvent(eventId);
  stakeEvent.agent = agent.id;
  stakeEvent.eventType = "DEPOSITED";
  stakeEvent.staker = event.params.staker;
  stakeEvent.amount = event.params.amount;
  stakeEvent.timestamp = event.block.timestamp;
  stakeEvent.blockNumber = event.block.number;
  stakeEvent.transactionHash = event.transaction.hash;
  stakeEvent.save();

  // Update protocol aggregates
  let protocol = getOrCreateProtocol();
  protocol.totalStakedAmount = protocol.totalStakedAmount.plus(
    event.params.amount
  );
  protocol.totalStakingEvents += 1;
  protocol.save();
}

export function handleStakeWithdrawn(event: StakeWithdrawn): void {
  let agentId = event.params.agentId.toString();
  let agent = Agent.load(agentId);
  if (agent == null) return;

  // Update agent staking state
  agent.stakeAmount = ZERO_BI;
  agent.hasMinBond = false;
  agent.save();

  // Create immutable event record
  let eventId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let stakeEvent = new StakeEvent(eventId);
  stakeEvent.agent = agent.id;
  stakeEvent.eventType = "WITHDRAWN";
  stakeEvent.staker = event.params.staker;
  stakeEvent.amount = event.params.amount;
  stakeEvent.timestamp = event.block.timestamp;
  stakeEvent.blockNumber = event.block.number;
  stakeEvent.transactionHash = event.transaction.hash;
  stakeEvent.save();

  // Update protocol aggregates
  let protocol = getOrCreateProtocol();
  protocol.totalStakedAmount = protocol.totalStakedAmount.minus(
    event.params.amount
  );
  protocol.totalStakingEvents += 1;
  protocol.save();
}

export function handleStakeSlashed(event: StakeSlashed): void {
  let agentId = event.params.agentId.toString();
  let agent = Agent.load(agentId);
  if (agent == null) return;

  // Update agent staking state
  agent.stakeAmount = agent.stakeAmount.minus(event.params.amount);
  agent.hasMinBond = agent.stakeAmount.ge(MIN_BOND);
  agent.save();

  // Create immutable event record
  let eventId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let stakeEvent = new StakeEvent(eventId);
  stakeEvent.agent = agent.id;
  stakeEvent.eventType = "SLASHED";
  stakeEvent.staker = event.params.slashedBy;
  stakeEvent.amount = event.params.amount;
  stakeEvent.timestamp = event.block.timestamp;
  stakeEvent.blockNumber = event.block.number;
  stakeEvent.transactionHash = event.transaction.hash;
  stakeEvent.save();

  // Update protocol aggregates
  let protocol = getOrCreateProtocol();
  protocol.totalStakedAmount = protocol.totalStakedAmount.minus(
    event.params.amount
  );
  protocol.totalSlashedAmount = protocol.totalSlashedAmount.plus(
    event.params.amount
  );
  protocol.totalStakingEvents += 1;
  protocol.save();
}

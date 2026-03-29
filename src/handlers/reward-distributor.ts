import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  RewardDistribution,
  RewardRecipient,
} from "../../generated/schema";
import { ZERO_BI } from "../helpers/constants";

/**
 * Maps a triggerType integer to its human-readable label.
 * 0 = ECOSYSTEM, 1 = REFERRAL, 2 = VERIFICATION, 3 = GOVERNANCE
 */
export function triggerTypeToLabel(triggerType: i32): string {
  if (triggerType == 0) return "ECOSYSTEM";
  if (triggerType == 1) return "REFERRAL";
  if (triggerType == 2) return "VERIFICATION";
  if (triggerType == 3) return "GOVERNANCE";
  return "UNKNOWN";
}

function getOrCreateRewardRecipient(address: Bytes): RewardRecipient {
  let id = address.toHexString();
  let recipient = RewardRecipient.load(id);
  if (recipient == null) {
    recipient = new RewardRecipient(id);
    recipient.totalEcosystemRewards = ZERO_BI;
    recipient.totalReferralRewards = ZERO_BI;
    recipient.totalVerificationRewards = ZERO_BI;
    recipient.totalGovernanceRewards = ZERO_BI;
    recipient.totalRewards = ZERO_BI;
    recipient.rewardCount = 0;
    recipient.save();
  }
  return recipient;
}

/**
 * Handles the RewardDistributed event emitted by the RewardDistributor contract.
 *
 * NOTE: This handler cannot be wired up until the RewardDistributor ABI is added
 * to abis/ and a corresponding dataSource is added to subgraph.yaml.
 * Once the ABI is available, the event type import should be:
 *
 *   import { RewardDistributed } from "../../generated/RewardDistributor/RewardDistributor";
 *
 * For now we use a minimal ethereum.Event interface so the logic compiles
 * and can be tested with matchstick mock events.
 */
export function handleRewardDistributed(event: ethereum.Event): void {
  let recipient = event.parameters[0].value.toAddress();
  let amount = event.parameters[1].value.toBigInt();
  let triggerType = event.parameters[2].value.toI32();
  let cumulativeDistributed = event.parameters[3].value.toBigInt();

  // Create or update RewardRecipient (must exist before immutable distribution references it)
  let recipientEntity = getOrCreateRewardRecipient(recipient);

  // Create immutable RewardDistribution record
  let distributionId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let distribution = new RewardDistribution(distributionId);
  distribution.recipient = recipientEntity.id;
  distribution.recipientAddress = recipient;
  distribution.amount = amount;
  distribution.triggerType = triggerType;
  distribution.triggerTypeLabel = triggerTypeToLabel(triggerType);
  distribution.cumulativeDistributed = cumulativeDistributed;
  distribution.blockNumber = event.block.number;
  distribution.timestamp = event.block.timestamp;
  distribution.transactionHash = event.transaction.hash;
  distribution.save();

  // Update RewardRecipient aggregates
  recipientEntity.totalRewards = recipientEntity.totalRewards.plus(amount);
  recipientEntity.rewardCount += 1;

  if (triggerType == 0) {
    recipientEntity.totalEcosystemRewards =
      recipientEntity.totalEcosystemRewards.plus(amount);
  } else if (triggerType == 1) {
    recipientEntity.totalReferralRewards =
      recipientEntity.totalReferralRewards.plus(amount);
  } else if (triggerType == 2) {
    recipientEntity.totalVerificationRewards =
      recipientEntity.totalVerificationRewards.plus(amount);
  } else if (triggerType == 3) {
    recipientEntity.totalGovernanceRewards =
      recipientEntity.totalGovernanceRewards.plus(amount);
  }

  recipientEntity.save();
}

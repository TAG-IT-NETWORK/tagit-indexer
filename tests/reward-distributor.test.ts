import {
  assert,
  describe,
  test,
  clearStore,
  beforeEach,
  newMockEvent,
} from "matchstick-as";
import { BigInt, Address, ethereum, Bytes } from "@graphprotocol/graph-ts";
import {
  handleRewardDistributed,
  triggerTypeToLabel,
} from "../src/handlers/reward-distributor";

const RECIPIENT = Address.fromString(
  "0xDb8ACD440Ef32a4D23AD685Dd64aC386b0d3d63F"
);
const RECIPIENT_2 = Address.fromString(
  "0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D"
);

function createRewardDistributedEvent(
  recipient: Address,
  amount: BigInt,
  triggerType: i32,
  cumulativeDistributed: BigInt
): ethereum.Event {
  let event = newMockEvent();
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "recipient",
      ethereum.Value.fromAddress(recipient)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(amount)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "triggerType",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(triggerType))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "cumulativeDistributed",
      ethereum.Value.fromUnsignedBigInt(cumulativeDistributed)
    )
  );
  return event;
}

describe("Reward Distributor Handlers", () => {
  beforeEach(() => {
    clearStore();
  });

  test("handleRewardDistributed creates RewardDistribution entity", () => {
    let amount = BigInt.fromI32(1000);
    let cumulative = BigInt.fromI32(1000);
    let event = createRewardDistributedEvent(RECIPIENT, amount, 0, cumulative);
    handleRewardDistributed(event);

    assert.entityCount("RewardDistribution", 1);
    let id =
      event.transaction.hash.toHexString() +
      "-" +
      event.logIndex.toString();
    assert.fieldEquals(
      "RewardDistribution",
      id,
      "recipient",
      RECIPIENT.toHexString()
    );
    assert.fieldEquals(
      "RewardDistribution",
      id,
      "recipientAddress",
      RECIPIENT.toHexString()
    );
    assert.fieldEquals("RewardDistribution", id, "amount", "1000");
    assert.fieldEquals("RewardDistribution", id, "triggerType", "0");
    assert.fieldEquals(
      "RewardDistribution",
      id,
      "triggerTypeLabel",
      "ECOSYSTEM"
    );
    assert.fieldEquals(
      "RewardDistribution",
      id,
      "cumulativeDistributed",
      "1000"
    );
  });

  test("handleRewardDistributed creates RewardRecipient entity", () => {
    let amount = BigInt.fromI32(500);
    let event = createRewardDistributedEvent(
      RECIPIENT,
      amount,
      1,
      BigInt.fromI32(500)
    );
    handleRewardDistributed(event);

    assert.entityCount("RewardRecipient", 1);
    let recipientId = RECIPIENT.toHexString();
    assert.fieldEquals(
      "RewardRecipient",
      recipientId,
      "totalRewards",
      "500"
    );
    assert.fieldEquals(
      "RewardRecipient",
      recipientId,
      "totalReferralRewards",
      "500"
    );
    assert.fieldEquals(
      "RewardRecipient",
      recipientId,
      "totalEcosystemRewards",
      "0"
    );
    assert.fieldEquals("RewardRecipient", recipientId, "rewardCount", "1");
  });

  test("handleRewardDistributed accumulates rewards on RewardRecipient", () => {
    let event1 = createRewardDistributedEvent(
      RECIPIENT,
      BigInt.fromI32(100),
      0,
      BigInt.fromI32(100)
    );
    handleRewardDistributed(event1);

    // Second event — different triggerType, increment logIndex to get unique id
    let event2 = createRewardDistributedEvent(
      RECIPIENT,
      BigInt.fromI32(200),
      2,
      BigInt.fromI32(300)
    );
    // newMockEvent() defaults logIndex to 1, so use 2 here to get a distinct
    // RewardDistribution id (txHash-logIndex) from the first event.
    event2.logIndex = BigInt.fromI32(2);
    handleRewardDistributed(event2);

    let recipientId = RECIPIENT.toHexString();
    assert.fieldEquals(
      "RewardRecipient",
      recipientId,
      "totalRewards",
      "300"
    );
    assert.fieldEquals(
      "RewardRecipient",
      recipientId,
      "totalEcosystemRewards",
      "100"
    );
    assert.fieldEquals(
      "RewardRecipient",
      recipientId,
      "totalVerificationRewards",
      "200"
    );
    assert.fieldEquals("RewardRecipient", recipientId, "rewardCount", "2");
    assert.entityCount("RewardDistribution", 2);
  });

  test("triggerType label mapping", () => {
    assert.stringEquals(triggerTypeToLabel(0), "ECOSYSTEM");
    assert.stringEquals(triggerTypeToLabel(1), "REFERRAL");
    assert.stringEquals(triggerTypeToLabel(2), "VERIFICATION");
    assert.stringEquals(triggerTypeToLabel(3), "GOVERNANCE");
    assert.stringEquals(triggerTypeToLabel(99), "UNKNOWN");
  });

  test("handleRewardDistributed tracks GOVERNANCE rewards", () => {
    let event = createRewardDistributedEvent(
      RECIPIENT,
      BigInt.fromI32(750),
      3,
      BigInt.fromI32(750)
    );
    handleRewardDistributed(event);

    let recipientId = RECIPIENT.toHexString();
    assert.fieldEquals(
      "RewardRecipient",
      recipientId,
      "totalGovernanceRewards",
      "750"
    );
    assert.fieldEquals(
      "RewardRecipient",
      recipientId,
      "totalRewards",
      "750"
    );
  });

  test("handleRewardDistributed handles multiple recipients", () => {
    let event1 = createRewardDistributedEvent(
      RECIPIENT,
      BigInt.fromI32(100),
      0,
      BigInt.fromI32(100)
    );
    handleRewardDistributed(event1);

    let event2 = createRewardDistributedEvent(
      RECIPIENT_2,
      BigInt.fromI32(200),
      1,
      BigInt.fromI32(200)
    );
    // newMockEvent() defaults logIndex to 1, so use 2 here to get a distinct
    // RewardDistribution id (txHash-logIndex) from the first event.
    event2.logIndex = BigInt.fromI32(2);
    handleRewardDistributed(event2);

    assert.entityCount("RewardRecipient", 2);
    assert.entityCount("RewardDistribution", 2);
    assert.fieldEquals(
      "RewardRecipient",
      RECIPIENT.toHexString(),
      "totalRewards",
      "100"
    );
    assert.fieldEquals(
      "RewardRecipient",
      RECIPIENT_2.toHexString(),
      "totalRewards",
      "200"
    );
  });
});

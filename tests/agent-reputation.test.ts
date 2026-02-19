import {
  assert,
  describe,
  test,
  clearStore,
  beforeEach,
  newMockEvent,
} from "matchstick-as";
import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts";
import {
  handleFeedbackGiven,
  handleFeedbackRevoked,
  handleResponseAppended,
} from "../src/handlers/agent-reputation";
import {
  FeedbackGiven,
  FeedbackRevoked,
  ResponseAppended,
} from "../generated/TAGITAgentReputation/TAGITAgentReputation";
import { Agent, Protocol } from "../generated/schema";
import { ZERO_BD } from "../src/helpers/constants";

const REVIEWER = Address.fromString(
  "0x2222222222222222222222222222222222222222"
);
const WALLET = Address.fromString(
  "0xDb8ACD440Ef32a4D23AD685Dd64aC386b0d3d63F"
);

function seedAgent(agentId: string): void {
  let agent = new Agent(agentId);
  agent.agentId = BigInt.fromString(agentId);
  agent.registrant = WALLET;
  agent.wallet = WALLET;
  agent.uri = "ipfs://test";
  agent.status = 1;
  agent.statusLabel = "ACTIVE";
  agent.registeredAt = BigInt.fromI32(1000);
  agent.registeredAtBlock = BigInt.fromI32(100);
  agent.feedbackCount = 0;
  agent.activeFeedbackCount = 0;
  agent.ratingSum = 0;
  agent.averageRating = ZERO_BD;
  agent.validationRequestCount = 0;
  agent.validationPassedCount = 0;
  agent.validationFailedCount = 0;
  agent.isValidated = false;
  agent.save();
}

function createFeedbackGivenEvent(
  feedbackId: i32,
  agentId: i32,
  reviewer: Address,
  rating: i32
): FeedbackGiven {
  let event = changetype<FeedbackGiven>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "feedbackId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(feedbackId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam("reviewer", ethereum.Value.fromAddress(reviewer))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "rating",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(rating))
    )
  );
  return event;
}

function createFeedbackRevokedEvent(
  feedbackId: i32,
  agentId: i32
): FeedbackRevoked {
  let event = changetype<FeedbackRevoked>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "feedbackId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(feedbackId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))
    )
  );
  return event;
}

function createResponseAppendedEvent(
  feedbackId: i32,
  agentId: i32
): ResponseAppended {
  let event = changetype<ResponseAppended>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "feedbackId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(feedbackId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))
    )
  );
  return event;
}

describe("Agent Reputation Handlers", () => {
  beforeEach(() => {
    clearStore();
    seedAgent("1");
  });

  test("handleFeedbackGiven creates Feedback and updates aggregates", () => {
    let event = createFeedbackGivenEvent(1, 1, REVIEWER, 4);
    handleFeedbackGiven(event);

    assert.entityCount("Feedback", 1);
    assert.fieldEquals("Feedback", "1", "rating", "4");
    assert.fieldEquals("Feedback", "1", "reviewer", REVIEWER.toHexString());
    assert.fieldEquals("Feedback", "1", "revoked", "false");
    assert.fieldEquals("Feedback", "1", "hasResponse", "false");

    assert.fieldEquals("Agent", "1", "feedbackCount", "1");
    assert.fieldEquals("Agent", "1", "activeFeedbackCount", "1");
    assert.fieldEquals("Agent", "1", "ratingSum", "4");

    assert.fieldEquals("Protocol", "1", "totalFeedback", "1");
    assert.fieldEquals("Protocol", "1", "totalActiveFeedback", "1");
    assert.fieldEquals("Protocol", "1", "totalRatingSum", "4");
  });

  test("handleFeedbackGiven computes averageRating correctly", () => {
    let event1 = createFeedbackGivenEvent(1, 1, REVIEWER, 4);
    handleFeedbackGiven(event1);

    let reviewer2 = Address.fromString(
      "0x3333333333333333333333333333333333333333"
    );
    let event2 = createFeedbackGivenEvent(2, 1, reviewer2, 2);
    handleFeedbackGiven(event2);

    // (4 + 2) / 2 = 3
    assert.fieldEquals("Agent", "1", "ratingSum", "6");
    assert.fieldEquals("Agent", "1", "activeFeedbackCount", "2");
  });

  test("handleFeedbackRevoked sets revoked and updates aggregates", () => {
    let giveEvent = createFeedbackGivenEvent(1, 1, REVIEWER, 5);
    handleFeedbackGiven(giveEvent);

    let revokeEvent = createFeedbackRevokedEvent(1, 1);
    handleFeedbackRevoked(revokeEvent);

    assert.fieldEquals("Feedback", "1", "revoked", "true");
    assert.fieldEquals("Agent", "1", "activeFeedbackCount", "0");
    assert.fieldEquals("Agent", "1", "ratingSum", "0");
    assert.fieldEquals("Protocol", "1", "totalActiveFeedback", "0");
    assert.fieldEquals("Protocol", "1", "totalRatingSum", "0");
  });

  test("handleFeedbackRevoked is idempotent", () => {
    let giveEvent = createFeedbackGivenEvent(1, 1, REVIEWER, 5);
    handleFeedbackGiven(giveEvent);

    let revokeEvent1 = createFeedbackRevokedEvent(1, 1);
    handleFeedbackRevoked(revokeEvent1);

    let revokeEvent2 = createFeedbackRevokedEvent(1, 1);
    handleFeedbackRevoked(revokeEvent2);

    // Should not double-subtract
    assert.fieldEquals("Agent", "1", "activeFeedbackCount", "0");
    assert.fieldEquals("Agent", "1", "ratingSum", "0");
  });

  test("handleFeedbackRevoked skips non-existent feedback", () => {
    let event = createFeedbackRevokedEvent(99, 1);
    handleFeedbackRevoked(event);
    // No error, no changes
    assert.entityCount("Feedback", 0);
  });

  test("handleResponseAppended sets hasResponse to true", () => {
    let giveEvent = createFeedbackGivenEvent(1, 1, REVIEWER, 3);
    handleFeedbackGiven(giveEvent);

    let responseEvent = createResponseAppendedEvent(1, 1);
    handleResponseAppended(responseEvent);

    assert.fieldEquals("Feedback", "1", "hasResponse", "true");
  });

  test("handleResponseAppended skips non-existent feedback", () => {
    let event = createResponseAppendedEvent(99, 1);
    handleResponseAppended(event);
    assert.entityCount("Feedback", 0);
  });

  test("multiple feedbacks on different agents track independently", () => {
    seedAgent("2");

    let event1 = createFeedbackGivenEvent(1, 1, REVIEWER, 5);
    handleFeedbackGiven(event1);

    let event2 = createFeedbackGivenEvent(2, 2, REVIEWER, 3);
    handleFeedbackGiven(event2);

    assert.fieldEquals("Agent", "1", "ratingSum", "5");
    assert.fieldEquals("Agent", "1", "activeFeedbackCount", "1");
    assert.fieldEquals("Agent", "2", "ratingSum", "3");
    assert.fieldEquals("Agent", "2", "activeFeedbackCount", "1");

    assert.fieldEquals("Protocol", "1", "totalFeedback", "2");
    assert.fieldEquals("Protocol", "1", "totalRatingSum", "8");
  });
});

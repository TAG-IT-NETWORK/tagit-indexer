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
  handleValidationRequested,
  handleValidationResponseSubmitted,
  handleValidationFinalized,
} from "../src/handlers/agent-validation";
import {
  ValidationRequested,
  ValidationResponseSubmitted,
  ValidationFinalized,
} from "../generated/TAGITAgentValidation/TAGITAgentValidation";
import { Agent } from "../generated/schema";
import { ZERO_BD } from "../src/helpers/constants";

const REQUESTER = Address.fromString(
  "0x4444444444444444444444444444444444444444"
);
const VALIDATOR1 = Address.fromString(
  "0x5555555555555555555555555555555555555555"
);
const VALIDATOR2 = Address.fromString(
  "0x6666666666666666666666666666666666666666"
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
  agent.stakeAmount = BigInt.fromI32(0);
  agent.hasMinBond = false;
  agent.save();
}

function createValidationRequestedEvent(
  requestId: i32,
  agentId: i32,
  requester: Address,
  isDefense: boolean
): ValidationRequested {
  let event = changetype<ValidationRequested>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(requestId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam("requester", ethereum.Value.fromAddress(requester))
  );
  event.parameters.push(
    new ethereum.EventParam("isDefense", ethereum.Value.fromBoolean(isDefense))
  );
  return event;
}

function createValidationResponseSubmittedEvent(
  requestId: i32,
  agentId: i32,
  validator: Address,
  score: i32
): ValidationResponseSubmitted {
  let event = changetype<ValidationResponseSubmitted>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(requestId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam("validator", ethereum.Value.fromAddress(validator))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "score",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(score))
    )
  );
  return event;
}

function createValidationFinalizedEvent(
  requestId: i32,
  agentId: i32,
  passed: boolean,
  finalScore: i32
): ValidationFinalized {
  let event = changetype<ValidationFinalized>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(requestId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam("passed", ethereum.Value.fromBoolean(passed))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "finalScore",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(finalScore))
    )
  );
  return event;
}

describe("Agent Validation Handlers", () => {
  beforeEach(() => {
    clearStore();
    seedAgent("1");
  });

  test("handleValidationRequested creates request with PENDING status", () => {
    let event = createValidationRequestedEvent(1, 1, REQUESTER, false);
    handleValidationRequested(event);

    assert.entityCount("ValidationRequest", 1);
    assert.fieldEquals("ValidationRequest", "1", "status", "PENDING");
    assert.fieldEquals(
      "ValidationRequest",
      "1",
      "requester",
      REQUESTER.toHexString()
    );
    assert.fieldEquals("ValidationRequest", "1", "isDefense", "false");
    assert.fieldEquals("ValidationRequest", "1", "responseCount", "0");
    assert.fieldEquals("ValidationRequest", "1", "passed", "false");

    assert.fieldEquals("Agent", "1", "validationRequestCount", "1");
    assert.fieldEquals("Protocol", "1", "totalValidationRequests", "1");
  });

  test("handleValidationRequested with defense flag", () => {
    let event = createValidationRequestedEvent(1, 1, REQUESTER, true);
    handleValidationRequested(event);

    assert.fieldEquals("ValidationRequest", "1", "isDefense", "true");
  });

  test("handleValidationResponseSubmitted creates response and updates request", () => {
    let reqEvent = createValidationRequestedEvent(1, 1, REQUESTER, false);
    handleValidationRequested(reqEvent);

    let respEvent = createValidationResponseSubmittedEvent(
      1,
      1,
      VALIDATOR1,
      80
    );
    handleValidationResponseSubmitted(respEvent);

    let responseId = "1-" + VALIDATOR1.toHexString();
    assert.entityCount("ValidationResponse", 1);
    assert.fieldEquals("ValidationResponse", responseId, "score", "80");
    assert.fieldEquals(
      "ValidationResponse",
      responseId,
      "validator",
      VALIDATOR1.toHexString()
    );

    assert.fieldEquals("ValidationRequest", "1", "responseCount", "1");
    assert.fieldEquals("ValidationRequest", "1", "status", "IN_PROGRESS");
  });

  test("handleValidationResponseSubmitted with multiple validators", () => {
    let reqEvent = createValidationRequestedEvent(1, 1, REQUESTER, false);
    handleValidationRequested(reqEvent);

    let resp1 = createValidationResponseSubmittedEvent(1, 1, VALIDATOR1, 80);
    handleValidationResponseSubmitted(resp1);

    let resp2 = createValidationResponseSubmittedEvent(1, 1, VALIDATOR2, 90);
    handleValidationResponseSubmitted(resp2);

    assert.entityCount("ValidationResponse", 2);
    assert.fieldEquals("ValidationRequest", "1", "responseCount", "2");
  });

  test("handleValidationFinalized with passed=true", () => {
    let reqEvent = createValidationRequestedEvent(1, 1, REQUESTER, false);
    handleValidationRequested(reqEvent);

    let finalEvent = createValidationFinalizedEvent(1, 1, true, 85);
    handleValidationFinalized(finalEvent);

    assert.fieldEquals("ValidationRequest", "1", "status", "VALIDATED");
    assert.fieldEquals("ValidationRequest", "1", "passed", "true");
    assert.fieldEquals("ValidationRequest", "1", "finalScore", "85");

    assert.fieldEquals("Agent", "1", "validationPassedCount", "1");
    assert.fieldEquals("Agent", "1", "isValidated", "true");
    assert.fieldEquals("Protocol", "1", "totalValidationsPassed", "1");
  });

  test("handleValidationFinalized with passed=false", () => {
    let reqEvent = createValidationRequestedEvent(1, 1, REQUESTER, false);
    handleValidationRequested(reqEvent);

    let finalEvent = createValidationFinalizedEvent(1, 1, false, 30);
    handleValidationFinalized(finalEvent);

    assert.fieldEquals("ValidationRequest", "1", "status", "REJECTED");
    assert.fieldEquals("ValidationRequest", "1", "passed", "false");
    assert.fieldEquals("ValidationRequest", "1", "finalScore", "30");

    assert.fieldEquals("Agent", "1", "validationFailedCount", "1");
    assert.fieldEquals("Agent", "1", "isValidated", "false");
    assert.fieldEquals("Protocol", "1", "totalValidationsFailed", "1");
  });

  test("handleValidationFinalized skips non-existent request", () => {
    let event = createValidationFinalizedEvent(99, 1, true, 100);
    handleValidationFinalized(event);
    assert.entityCount("ValidationRequest", 0);
  });

  test("full validation lifecycle", () => {
    let reqEvent = createValidationRequestedEvent(1, 1, REQUESTER, false);
    handleValidationRequested(reqEvent);
    assert.fieldEquals("ValidationRequest", "1", "status", "PENDING");

    let resp1 = createValidationResponseSubmittedEvent(1, 1, VALIDATOR1, 75);
    handleValidationResponseSubmitted(resp1);
    assert.fieldEquals("ValidationRequest", "1", "status", "IN_PROGRESS");

    let resp2 = createValidationResponseSubmittedEvent(1, 1, VALIDATOR2, 85);
    handleValidationResponseSubmitted(resp2);
    assert.fieldEquals("ValidationRequest", "1", "responseCount", "2");

    let finalEvent = createValidationFinalizedEvent(1, 1, true, 80);
    handleValidationFinalized(finalEvent);
    assert.fieldEquals("ValidationRequest", "1", "status", "VALIDATED");
    assert.fieldEquals("Agent", "1", "isValidated", "true");
  });
});

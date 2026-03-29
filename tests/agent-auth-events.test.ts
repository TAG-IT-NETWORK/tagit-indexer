/**
 * Integration Test Suite: Agent Authorization Event Detection
 *
 * Task: 3314e3e9-a2d3-8154-bae8-dea3326edc56
 *
 * Tests the indexer's ability to detect and store agent authorization events:
 * 1. AgentStatusChanged: track status transitions that grant/revoke authorization
 * 2. ValidationFinalized: track validation outcomes that affect agent authorization
 * 3. Protocol aggregate updates on authorization state changes
 *
 * Coverage Matrix:
 * ┌───────────────────────────────────────────┬──────────┬──────────┐
 * │ Scenario                                  │ Happy    │ Sad      │
 * ├───────────────────────────────────────────┼──────────┼──────────┤
 * │ Agent registered → status = INACTIVE      │ ✅       │          │
 * │ Agent activated → status = ACTIVE         │ ✅       │          │
 * │ Agent suspended → authorization revoked   │          │ ✅       │
 * │ Agent deregistered → permanently revoked  │          │ ✅       │
 * │ Validation passed → isValidated = true    │ ✅       │          │
 * │ Validation failed → isValidated = false   │          │ ✅       │
 * │ Protocol aggregates update correctly      │ ✅       │          │
 * │ Full lifecycle: register → activate →     │ ✅       │          │
 * │   validate → suspend → reactivate        │          │          │
 * └───────────────────────────────────────────┴──────────┴──────────┘
 */

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
  handleAgentRegistered,
  handleAgentStatusChanged,
} from "../src/handlers/agent-identity";
import {
  handleValidationRequested,
  handleValidationFinalized,
} from "../src/handlers/agent-validation";
import {
  AgentRegistered,
  AgentStatusChanged,
} from "../generated/TAGITAgentIdentity/TAGITAgentIdentity";
import {
  ValidationRequested,
  ValidationFinalized,
} from "../generated/TAGITAgentValidation/TAGITAgentValidation";

const WALLET = Address.fromString(
  "0xDb8ACD440Ef32a4D23AD685Dd64aC386b0d3d63F",
);
const REGISTRANT = Address.fromString(
  "0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D",
);

// ── Event Factories ────────────────────────────────────────

function createAgentRegisteredEvent(
  agentId: i32,
  registrant: Address,
  wallet: Address,
  uri: string,
): AgentRegistered {
  let event = changetype<AgentRegistered>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "registrant",
      ethereum.Value.fromAddress(registrant),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam("wallet", ethereum.Value.fromAddress(wallet)),
  );
  event.parameters.push(
    new ethereum.EventParam("uri", ethereum.Value.fromString(uri)),
  );
  return event;
}

function createAgentStatusChangedEvent(
  agentId: i32,
  oldStatus: i32,
  newStatus: i32,
): AgentStatusChanged {
  let event = changetype<AgentStatusChanged>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "oldStatus",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(oldStatus)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "newStatus",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(newStatus)),
    ),
  );
  return event;
}

function createValidationRequestedEvent(
  requestId: i32,
  agentId: i32,
  requester: Address,
  quorum: i32,
  isDefense: boolean,
): ValidationRequested {
  let event = changetype<ValidationRequested>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(requestId)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "requester",
      ethereum.Value.fromAddress(requester),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "quorum",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(quorum)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "isDefense",
      ethereum.Value.fromBoolean(isDefense),
    ),
  );
  return event;
}

function createValidationFinalizedEvent(
  requestId: i32,
  agentId: i32,
  passed: boolean,
  averageScore: i32,
): ValidationFinalized {
  let event = changetype<ValidationFinalized>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(requestId)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam("passed", ethereum.Value.fromBoolean(passed)),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "averageScore",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(averageScore)),
    ),
  );
  return event;
}

function registerAgent(agentId: i32): void {
  let event = createAgentRegisteredEvent(
    agentId,
    REGISTRANT,
    WALLET,
    "ipfs://agent-" + agentId.toString(),
  );
  handleAgentRegistered(event);
}

// ── Test: Authorization Grant via Status Change ────────────

describe("Agent authorization grant via status change", () => {
  beforeEach(() => {
    clearStore();
  });

  test("newly registered agent starts as INACTIVE (unauthorized)", () => {
    registerAgent(1);

    assert.fieldEquals("Agent", "1", "status", "0");
    assert.fieldEquals("Agent", "1", "statusLabel", "INACTIVE");
    assert.fieldEquals("Protocol", "1", "totalAgents", "1");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "0");
  });

  test("agent activation grants authorization (INACTIVE → ACTIVE)", () => {
    registerAgent(1);

    let activateEvent = createAgentStatusChangedEvent(1, 0, 1);
    handleAgentStatusChanged(activateEvent);

    assert.fieldEquals("Agent", "1", "status", "1");
    assert.fieldEquals("Agent", "1", "statusLabel", "ACTIVE");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "1");

    // Status change record created
    assert.entityCount("AgentStatusChange", 1);
  });

  test("multiple agents can be authorized independently", () => {
    registerAgent(1);
    registerAgent(2);
    registerAgent(3);

    // Activate agent 1 and 3
    handleAgentStatusChanged(createAgentStatusChangedEvent(1, 0, 1));
    handleAgentStatusChanged(createAgentStatusChangedEvent(3, 0, 1));

    assert.fieldEquals("Agent", "1", "status", "1");
    assert.fieldEquals("Agent", "2", "status", "0");
    assert.fieldEquals("Agent", "3", "status", "1");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "2");
    assert.fieldEquals("Protocol", "1", "totalAgents", "3");
  });
});

// ── Test: Authorization Revocation via Status Change ───────

describe("Agent authorization revocation", () => {
  beforeEach(() => {
    clearStore();
  });

  test("suspension revokes authorization (ACTIVE → SUSPENDED)", () => {
    registerAgent(1);
    handleAgentStatusChanged(createAgentStatusChangedEvent(1, 0, 1));
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "1");

    // Suspend
    handleAgentStatusChanged(createAgentStatusChangedEvent(1, 1, 2));

    assert.fieldEquals("Agent", "1", "status", "2");
    assert.fieldEquals("Agent", "1", "statusLabel", "SUSPENDED");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "0");
  });

  test("deregistration permanently revokes authorization", () => {
    registerAgent(1);
    handleAgentStatusChanged(createAgentStatusChangedEvent(1, 0, 1));

    // Deregister
    handleAgentStatusChanged(createAgentStatusChangedEvent(1, 1, 3));

    assert.fieldEquals("Agent", "1", "status", "3");
    assert.fieldEquals("Agent", "1", "statusLabel", "DEREGISTERED");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "0");
  });

  test("suspension does not affect other agents' authorization", () => {
    registerAgent(1);
    registerAgent(2);
    handleAgentStatusChanged(createAgentStatusChangedEvent(1, 0, 1));
    handleAgentStatusChanged(createAgentStatusChangedEvent(2, 0, 1));

    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "2");

    // Suspend only agent 1
    handleAgentStatusChanged(createAgentStatusChangedEvent(1, 1, 2));

    assert.fieldEquals("Agent", "1", "statusLabel", "SUSPENDED");
    assert.fieldEquals("Agent", "2", "statusLabel", "ACTIVE");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "1");
  });
});

// ── Test: Validation → Authorization ───────────────────────

describe("Validation finalization affects authorization", () => {
  beforeEach(() => {
    clearStore();
  });

  test("validation passed sets agent as validated", () => {
    registerAgent(1);

    // Request validation
    let reqEvent = createValidationRequestedEvent(100, 1, REGISTRANT, 3, false);
    handleValidationRequested(reqEvent);

    assert.entityCount("ValidationRequest", 1);
    assert.fieldEquals("ValidationRequest", "100", "agentId", "1");

    // Finalize as passed
    let finalEvent = createValidationFinalizedEvent(100, 1, true, 85);
    handleValidationFinalized(finalEvent);

    assert.fieldEquals("Agent", "1", "isValidated", "true");
    assert.fieldEquals("ValidationRequest", "100", "status", "PASSED");
  });

  test("validation failed keeps agent as not validated", () => {
    registerAgent(1);

    let reqEvent = createValidationRequestedEvent(101, 1, REGISTRANT, 3, false);
    handleValidationRequested(reqEvent);

    let finalEvent = createValidationFinalizedEvent(101, 1, false, 40);
    handleValidationFinalized(finalEvent);

    assert.fieldEquals("Agent", "1", "isValidated", "false");
    assert.fieldEquals("ValidationRequest", "101", "status", "FAILED");
  });

  test("defense validation requires higher quorum", () => {
    registerAgent(1);

    let reqEvent = createValidationRequestedEvent(102, 1, REGISTRANT, 5, true);
    handleValidationRequested(reqEvent);

    assert.fieldEquals("ValidationRequest", "102", "isDefense", "true");
    assert.fieldEquals("ValidationRequest", "102", "quorum", "5");
  });
});

// ── Test: Full Agent Authorization Lifecycle ───────────────

describe("Full agent authorization lifecycle", () => {
  beforeEach(() => {
    clearStore();
  });

  test("complete lifecycle: register → activate → validate → suspend → reactivate", () => {
    // Step 1: Register (INACTIVE, not validated)
    registerAgent(1);
    assert.fieldEquals("Agent", "1", "status", "0");
    assert.fieldEquals("Agent", "1", "statusLabel", "INACTIVE");
    assert.fieldEquals("Agent", "1", "isValidated", "false");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "0");

    // Step 2: Activate (ACTIVE, authorization granted)
    handleAgentStatusChanged(createAgentStatusChangedEvent(1, 0, 1));
    assert.fieldEquals("Agent", "1", "status", "1");
    assert.fieldEquals("Agent", "1", "statusLabel", "ACTIVE");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "1");

    // Step 3: Validate (confirmed authorization)
    let reqEvent = createValidationRequestedEvent(200, 1, REGISTRANT, 3, false);
    handleValidationRequested(reqEvent);
    let finalEvent = createValidationFinalizedEvent(200, 1, true, 92);
    handleValidationFinalized(finalEvent);
    assert.fieldEquals("Agent", "1", "isValidated", "true");

    // Step 4: Suspend (authorization revoked temporarily)
    handleAgentStatusChanged(createAgentStatusChangedEvent(1, 1, 2));
    assert.fieldEquals("Agent", "1", "status", "2");
    assert.fieldEquals("Agent", "1", "statusLabel", "SUSPENDED");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "0");
    // Validation status persists even when suspended
    assert.fieldEquals("Agent", "1", "isValidated", "true");

    // Step 5: Reactivate (authorization restored)
    handleAgentStatusChanged(createAgentStatusChangedEvent(1, 2, 1));
    assert.fieldEquals("Agent", "1", "status", "1");
    assert.fieldEquals("Agent", "1", "statusLabel", "ACTIVE");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "1");

    // Verify full audit trail
    assert.entityCount("AgentStatusChange", 3); // activate, suspend, reactivate
  });

  test("protocol aggregates remain consistent across multiple agent lifecycles", () => {
    // Register 3 agents
    registerAgent(1);
    registerAgent(2);
    registerAgent(3);
    assert.fieldEquals("Protocol", "1", "totalAgents", "3");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "0");

    // Activate all
    handleAgentStatusChanged(createAgentStatusChangedEvent(1, 0, 1));
    handleAgentStatusChanged(createAgentStatusChangedEvent(2, 0, 1));
    handleAgentStatusChanged(createAgentStatusChangedEvent(3, 0, 1));
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "3");

    // Suspend agent 2
    handleAgentStatusChanged(createAgentStatusChangedEvent(2, 1, 2));
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "2");

    // Deregister agent 3
    handleAgentStatusChanged(createAgentStatusChangedEvent(3, 1, 3));
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "1");

    // Reactivate agent 2
    handleAgentStatusChanged(createAgentStatusChangedEvent(2, 2, 1));
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "2");

    // Final state check
    assert.fieldEquals("Agent", "1", "statusLabel", "ACTIVE");
    assert.fieldEquals("Agent", "2", "statusLabel", "ACTIVE");
    assert.fieldEquals("Agent", "3", "statusLabel", "DEREGISTERED");
  });
});

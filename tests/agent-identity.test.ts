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
  handleAgentActivated,
  handleAgentRegistered,
  handleAgentURIUpdated,
  handleAgentWalletUpdated,
  handleAgentMetadataSet,
  handleAgentStatusChanged,
} from "../src/handlers/agent-identity";
import {
  AgentActivated,
  AgentRegistered,
  AgentURIUpdated,
  AgentWalletUpdated,
  AgentMetadataSet as AgentMetadataSetEvent,
  AgentStatusChanged,
} from "../generated/TAGITAgentIdentity/TAGITAgentIdentity";

const WALLET = Address.fromString(
  "0xDb8ACD440Ef32a4D23AD685Dd64aC386b0d3d63F"
);
const REGISTRANT = Address.fromString(
  "0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D"
);
const NEW_WALLET = Address.fromString(
  "0x1111111111111111111111111111111111111111"
);

function createAgentRegisteredEvent(
  agentId: i32,
  registrant: Address,
  wallet: Address,
  uri: string
): AgentRegistered {
  let event = changetype<AgentRegistered>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam("registrant", ethereum.Value.fromAddress(registrant))
  );
  event.parameters.push(
    new ethereum.EventParam("wallet", ethereum.Value.fromAddress(wallet))
  );
  event.parameters.push(
    new ethereum.EventParam("uri", ethereum.Value.fromString(uri))
  );
  return event;
}

function createAgentURIUpdatedEvent(
  agentId: i32,
  newURI: string
): AgentURIUpdated {
  let event = changetype<AgentURIUpdated>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam("newURI", ethereum.Value.fromString(newURI))
  );
  return event;
}

function createAgentWalletUpdatedEvent(
  agentId: i32,
  oldWallet: Address,
  newWallet: Address
): AgentWalletUpdated {
  let event = changetype<AgentWalletUpdated>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam("oldWallet", ethereum.Value.fromAddress(oldWallet))
  );
  event.parameters.push(
    new ethereum.EventParam("newWallet", ethereum.Value.fromAddress(newWallet))
  );
  return event;
}

function createAgentMetadataSetEvent(
  agentId: i32,
  key: string,
  value: string
): AgentMetadataSetEvent {
  let event = changetype<AgentMetadataSetEvent>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam("key", ethereum.Value.fromString(key))
  );
  event.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromString(value))
  );
  return event;
}

function createAgentStatusChangedEvent(
  agentId: i32,
  oldStatus: i32,
  newStatus: i32
): AgentStatusChanged {
  let event = changetype<AgentStatusChanged>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "oldStatus",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(oldStatus))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "newStatus",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(newStatus))
    )
  );
  return event;
}

function createAgentActivatedEvent(
  agentId: i32,
  registrant: Address
): AgentActivated {
  let event = changetype<AgentActivated>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))
    )
  );
  event.parameters.push(
    new ethereum.EventParam("registrant", ethereum.Value.fromAddress(registrant))
  );
  return event;
}

function registerAgent(agentId: i32): void {
  let event = createAgentRegisteredEvent(
    agentId,
    REGISTRANT,
    WALLET,
    "ipfs://sage-agent"
  );
  handleAgentRegistered(event);
}

describe("Agent Identity Handlers", () => {
  beforeEach(() => {
    clearStore();
  });

  test("handleAgentRegistered creates Agent and increments Protocol.totalAgents", () => {
    registerAgent(1);

    assert.entityCount("Agent", 1);
    assert.fieldEquals("Agent", "1", "agentId", "1");
    assert.fieldEquals("Agent", "1", "wallet", WALLET.toHexString());
    assert.fieldEquals("Agent", "1", "registrant", REGISTRANT.toHexString());
    assert.fieldEquals("Agent", "1", "uri", "ipfs://sage-agent");
    assert.fieldEquals("Agent", "1", "status", "0");
    assert.fieldEquals("Agent", "1", "statusLabel", "INACTIVE");
    assert.fieldEquals("Agent", "1", "feedbackCount", "0");
    assert.fieldEquals("Agent", "1", "isValidated", "false");

    assert.entityCount("Protocol", 1);
    assert.fieldEquals("Protocol", "1", "totalAgents", "1");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "0");
  });

  test("handleAgentRegistered registers multiple agents", () => {
    registerAgent(1);
    registerAgent(2);

    assert.entityCount("Agent", 2);
    assert.fieldEquals("Protocol", "1", "totalAgents", "2");
  });

  test("handleAgentURIUpdated updates Agent uri", () => {
    registerAgent(1);

    let event = createAgentURIUpdatedEvent(1, "ipfs://updated-uri");
    handleAgentURIUpdated(event);

    assert.fieldEquals("Agent", "1", "uri", "ipfs://updated-uri");
  });

  test("handleAgentURIUpdated skips non-existent agent", () => {
    let event = createAgentURIUpdatedEvent(99, "ipfs://noop");
    handleAgentURIUpdated(event);

    assert.entityCount("Agent", 0);
  });

  test("handleAgentWalletUpdated changes wallet address", () => {
    registerAgent(1);

    let event = createAgentWalletUpdatedEvent(1, WALLET, NEW_WALLET);
    handleAgentWalletUpdated(event);

    assert.fieldEquals("Agent", "1", "wallet", NEW_WALLET.toHexString());
  });

  test("handleAgentMetadataSet creates and upserts metadata", () => {
    registerAgent(1);

    let event1 = createAgentMetadataSetEvent(1, "name", "Sage Agent");
    handleAgentMetadataSet(event1);

    assert.entityCount("AgentMetadata", 1);
    assert.fieldEquals("AgentMetadata", "1-name", "key", "name");
    assert.fieldEquals("AgentMetadata", "1-name", "value", "Sage Agent");

    // Upsert same key
    let event2 = createAgentMetadataSetEvent(1, "name", "Sage v2");
    handleAgentMetadataSet(event2);

    assert.entityCount("AgentMetadata", 1);
    assert.fieldEquals("AgentMetadata", "1-name", "value", "Sage v2");
  });

  test("handleAgentStatusChanged updates status and creates change record", () => {
    registerAgent(1);

    let event = createAgentStatusChangedEvent(1, 0, 1);
    handleAgentStatusChanged(event);

    assert.fieldEquals("Agent", "1", "status", "1");
    assert.fieldEquals("Agent", "1", "statusLabel", "ACTIVE");
    assert.entityCount("AgentStatusChange", 1);
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "1");
  });

  test("handleAgentStatusChanged decrements active when moving from ACTIVE", () => {
    registerAgent(1);

    let activateEvent = createAgentStatusChangedEvent(1, 0, 1);
    handleAgentStatusChanged(activateEvent);
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "1");

    let suspendEvent = createAgentStatusChangedEvent(1, 1, 2);
    handleAgentStatusChanged(suspendEvent);

    assert.fieldEquals("Agent", "1", "status", "2");
    assert.fieldEquals("Agent", "1", "statusLabel", "SUSPENDED");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "0");
  });

  test("handleAgentStatusChanged with DEREGISTERED status", () => {
    registerAgent(1);

    let activateEvent = createAgentStatusChangedEvent(1, 0, 1);
    handleAgentStatusChanged(activateEvent);

    let deregisterEvent = createAgentStatusChangedEvent(1, 1, 3);
    handleAgentStatusChanged(deregisterEvent);

    assert.fieldEquals("Agent", "1", "status", "3");
    assert.fieldEquals("Agent", "1", "statusLabel", "DEREGISTERED");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "0");
  });

  test("handleAgentActivated records activatedAt on existing agent", () => {
    registerAgent(1);

    let event = createAgentActivatedEvent(1, REGISTRANT);
    handleAgentActivated(event);

    assert.fieldEquals("Agent", "1", "activatedAt", event.block.timestamp.toString());
  });

  test("handleAgentActivated skips non-existent agent", () => {
    let event = createAgentActivatedEvent(99, REGISTRANT);
    handleAgentActivated(event);

    assert.entityCount("Agent", 0);
  });
});

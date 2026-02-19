import {
  assert,
  describe,
  test,
  clearStore,
  beforeEach,
} from "matchstick-as";
import { BigDecimal } from "@graphprotocol/graph-ts";
import {
  statusToLabel,
  PROTOCOL_ID,
  ZERO_BI,
  ZERO_BD,
} from "../src/helpers/constants";
import { getOrCreateProtocol } from "../src/helpers/protocol";
import { computeAverage } from "../src/helpers/math";

describe("Constants", () => {
  test("PROTOCOL_ID is '1'", () => {
    assert.stringEquals(PROTOCOL_ID, "1");
  });

  test("statusToLabel maps all status values", () => {
    assert.stringEquals(statusToLabel(0), "INACTIVE");
    assert.stringEquals(statusToLabel(1), "ACTIVE");
    assert.stringEquals(statusToLabel(2), "SUSPENDED");
    assert.stringEquals(statusToLabel(3), "DEREGISTERED");
    assert.stringEquals(statusToLabel(99), "UNKNOWN");
  });
});

describe("Protocol Helper", () => {
  beforeEach(() => {
    clearStore();
  });

  test("getOrCreateProtocol creates singleton with zeroed fields", () => {
    let protocol = getOrCreateProtocol();
    protocol.save();

    assert.entityCount("Protocol", 1);
    assert.fieldEquals("Protocol", "1", "totalAgents", "0");
    assert.fieldEquals("Protocol", "1", "totalActiveAgents", "0");
    assert.fieldEquals("Protocol", "1", "totalFeedback", "0");
    assert.fieldEquals("Protocol", "1", "totalValidationRequests", "0");
  });

  test("getOrCreateProtocol returns existing singleton", () => {
    let protocol1 = getOrCreateProtocol();
    protocol1.totalAgents = 5;
    protocol1.save();

    let protocol2 = getOrCreateProtocol();
    assert.i32Equals(protocol2.totalAgents, 5);
  });
});

describe("Math Helper", () => {
  test("computeAverage returns zero for zero count", () => {
    let result = computeAverage(10, 0);
    assert.stringEquals(result.toString(), "0");
  });

  test("computeAverage computes correct average", () => {
    let result = computeAverage(15, 3);
    assert.stringEquals(result.toString(), "5");
  });

  test("computeAverage handles non-integer results", () => {
    let result = computeAverage(10, 3);
    // 10/3 = 3.333...
    assert.assertTrue(result.gt(BigDecimal.fromString("3.3")));
    assert.assertTrue(result.lt(BigDecimal.fromString("3.4")));
  });
});
